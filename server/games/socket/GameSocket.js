const LobbyService = require('../lobby/LobbyService');
const BluffEngine = require('../bluff/BluffEngine');
const MemoryMatchEngine = require('../memory-match/MemoryMatchEngine');
const DotsAndBoxesEngine = require('../dots-and-boxes/DotsAndBoxesEngine');
const YatzyEngine = require('../yatzy/YatzyEngine');
const ColorWarsEngine = require('../color-wars/ColorWarsEngine');
const ScribbleEngine = require('../scribble/ScribbleEngine');
const InkDeceptionEngine = require('../ink-deception/InkDeceptionEngine');
const ChamberClashEngine = require('../chamber-clash/ChamberClashEngine');
const userService = require('../../services/userService');

const ENGINE_MAP = {
  'BLUFF': BluffEngine,
  'MEMORY_MATCH': MemoryMatchEngine,
  'DOTS_AND_BOXES': DotsAndBoxesEngine,
  'YATZY': YatzyEngine,
  'COLOR_WARS': ColorWarsEngine,
  'SCRIBBLE': ScribbleEngine,
  'INK_DECEPTION': InkDeceptionEngine,
  'CHAMBER_CLASH': ChamberClashEngine,
};

const GAME_DISPLAY_NAMES = {
  'BLUFF': 'Bluff',
  'MEMORY_MATCH': 'Memory Match',
  'DOTS_AND_BOXES': 'Dots and Boxes',
  'YATZY': 'Yatzy',
  'COLOR_WARS': 'Color Wars',
  'SCRIBBLE': 'Scribble',
  'INK_DECEPTION': 'Ink & Deception',
  'CHAMBER_CLASH': 'Chamber Clash',
};

function registerGameSockets(io, socket, onlineUsers, activeGames) {
  // Helper to update and broadcast user presence changes
  const updatePresence = async (userId, presenceStatus) => {
    try {
      await userService.updatePresenceStatus(userId, presenceStatus);
      io.emit('user_presence_change', { userId, presenceStatus });
    } catch (err) {
      console.error('Failed to update presence:', err.message);
    }
  };

  // Helper to serialize lobby map for client
  const serializeLobby = (lobby) => {
    if (!lobby) return null;
    const playersList = Array.from(lobby.players.values()).map(p => ({
      userId: p.userId,
      nickname: p.nickname,
      isReady: p.isReady,
      role: p.role
    }));
    return {
      id: lobby.id,
      hostId: lobby.hostId,
      gameType: lobby.gameType,
      players: playersList,
      status: lobby.status,
      settings: lobby.settings || null
    };
  };

  // Helper to broadcast updated lobby list to all connected clients
  const broadcastLobbies = () => {
    io.emit('lobbies_updated', LobbyService.getPublicLobbies());
  };

  // ========================
  // LOBBY ACTIONS
  // ========================

  // Client requests the current list of public lobbies
  socket.on('lobbies_list', () => {
    socket.emit('lobbies_list_response', LobbyService.getPublicLobbies());
  });

  socket.on('lobby_create', async ({ gameType, userId, nickname }) => {
    console.log(`Lobby create requested by ${nickname} (${userId}) for ${gameType}`);
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const lobby = await LobbyService.createLobby(gameId, userId, nickname, gameType);

    socket.join(gameId);
    io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    await updatePresence(userId, `In ${GAME_DISPLAY_NAMES[gameType] || gameType} Lobby`);
    broadcastLobbies();
  });

  socket.on('lobby_join', async ({ gameId, userId, nickname }) => {
    console.log(`Player ${nickname} joined lobby ${gameId}`);
    const lobby = await LobbyService.joinLobby(gameId, userId, nickname);
    if (!lobby) {
      return socket.emit('game_error', { message: 'Lobby full or does not exist.' });
    }

    socket.join(gameId);
    io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    await updatePresence(userId, `In ${GAME_DISPLAY_NAMES[lobby.gameType] || lobby.gameType} Lobby`);
    broadcastLobbies();
  });

  socket.on('lobby_ready', ({ gameId, userId, isReady }) => {
    const lobby = LobbyService.toggleReady(gameId, userId, isReady);
    if (lobby) {
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    }
  });

  socket.on('lobby_kick', ({ gameId, hostId, targetUserId }) => {
    const lobby = LobbyService.kickPlayer(gameId, hostId, targetUserId);
    if (lobby) {
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
      // Notify target client they were kicked
      io.emit(`lobby_kicked_${gameId}_${targetUserId}`, { message: 'You have been kicked by the host.' });
      broadcastLobbies();
    }
  });

  socket.on('lobby_leave', async ({ gameId, userId }) => {
    console.log(`Player ${userId} leaving lobby ${gameId}`);
    const lobby = await LobbyService.leaveLobby(gameId, userId);
    socket.leave(gameId);
    await updatePresence(userId, null);

    if (lobby) {
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
    }
    
    // Also remove from active game if playing
    const engine = activeGames.get(gameId);
    if (engine && engine.status !== 'FINISHED') {
      const removed = engine.removePlayer(userId);
      if (removed) {
        broadcastGameStates(gameId, engine);
        if (engine.players.size === 0) {
          activeGames.delete(gameId);
        }
      }
    }

    broadcastLobbies();
  });

  socket.on('lobby_invite', async ({ gameId, senderId, senderName, targetUserId, gameType }) => {
    try {
      const notificationService = require('../../services/notificationService');
      const notif = await notificationService.createNotification({
        recipientId: targetUserId,
        senderId,
        type: 'room_invite',
        title: `${senderName} invited you to play!`,
        message: `Join their ${GAME_DISPLAY_NAMES[gameType] || gameType} lobby.`,
        metadata: { gameId, gameType }
      });
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets && notif) {
        targetSockets.forEach(sId => io.to(sId).emit('new_notification', notif));
      }
    } catch (err) {
      console.error('Failed to send game invite:', err.message);
    }
  });

  socket.on('lobby_settings_update', ({ gameId, hostId, settings }) => {
    const lobby = LobbyService.getLobby(gameId);
    if (lobby && lobby.hostId === hostId) {
      lobby.settings = { ...lobby.settings, ...settings };
      io.to(gameId).emit('lobby_state', serializeLobby(lobby));
      broadcastLobbies();
    }
  });

  // ========================
  // GAME CONTROL EVENTS
  // ========================

  socket.on('game_start', async ({ gameId, hostId }) => {
    const lobby = LobbyService.getLobby(gameId);
    if (!lobby || lobby.hostId !== hostId) {
      return socket.emit('game_error', { message: 'Only the host can start the game.' });
    }

    if (lobby.players.size < 2) {
      return socket.emit('game_error', { message: 'You need at least 2 players to start!' });
    }

    const playersList = Array.from(lobby.players.values());
    const allReady = playersList.every(p => p.role === 'HOST' || p.isReady);
    if (!allReady) {
      return socket.emit('game_error', { message: 'Wait for all players to be ready!' });
    }

    const EngineClass = ENGINE_MAP[lobby.gameType];
    if (!EngineClass) {
      return socket.emit('game_error', { message: 'Unsupported game type.' });
    }
    let engine = new EngineClass(gameId);
    engine.onEvent = (type, data) => {
      io.to(gameId).emit(type, data);
      // Auto-sync game state on critical events to prevent desyncs (e.g. on timeouts or skip turns)
      const SYNC_EVENTS = ['round_started', 'turn_started', 'player_damaged', 'player_healed', 'player_eliminated', 'game_started', 'round_finished', 'status_added', 'status_removed', 'extra_turn_granted'];
      if (SYNC_EVENTS.includes(type)) {
        broadcastGameStates(gameId, engine);
      }
    };
    engine.onPrivateEvent = (targetUserId, type, data) => {
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach(sId => io.to(sId).emit(type, data));
      }
    };

    if (lobby.settings) {
      engine.settings = { ...engine.settings, ...lobby.settings };
    }

    lobby.players.forEach(p => {
      engine.players.set(p.userId, {
        userId: p.userId,
        nickname: p.nickname,
        role: p.role,
        isReady: true,
        isOnline: true,
        hand: []
      });
    });

    engine.startGame();
    activeGames.set(gameId, engine);
    LobbyService.lobbies.delete(gameId);
    broadcastLobbies();

    for (const p of playersList) {
      await updatePresence(p.userId, `Playing ${GAME_DISPLAY_NAMES[lobby.gameType] || lobby.gameType}`);
    }

    broadcastGameStates(gameId, engine);
  });

  const broadcastGameStates = (gameId, engine) => {
    console.log(`[${new Date().toISOString()}] [GameSocket] broadcastGameStates for gameType="${engine.gameType}" gameId="${gameId}". Player count: ${engine.players.size}`);
    engine.players.forEach((p, id) => {
      const sockets = onlineUsers.get(id);
      console.log(`[${new Date().toISOString()}] [GameSocket] Player "${p.nickname}" (${id}) online sockets:`, sockets ? Array.from(sockets) : 'none');
      if (sockets) {
        sockets.forEach(sId => {
          console.log(`[${new Date().toISOString()}] [GameSocket] Emitting game_state for "${p.nickname}" to socket ${sId}`);
          io.to(sId).emit('game_state', engine.serializeState(id));
        });
      }
    });

    engine.spectators.forEach(specId => {
      const sockets = onlineUsers.get(specId);
      if (sockets) {
        sockets.forEach(sId => {
          io.to(sId).emit('game_state', engine.serializeState(null));
        });
      }
    });
  };

  // ========================
  // PLAYPLAY ACTION EVENTS
  // ========================

  socket.on('game_action', ({ gameId, userId, action, data }) => {
    const engine = activeGames.get(gameId);
    if (!engine) {
      return socket.emit('game_error', { message: 'Game session not found.' });
    }

    if (action === 'play_again' && engine.status === 'FINISHED') {
      const hostP = Array.from(engine.players.values()).find(p => p.role === 'HOST');
      if (hostP && hostP.userId === userId) {
        // Re-create lobby with same ID and current players
        const LobbyService = require('../lobby/LobbyService');
        LobbyService.lobbies.set(gameId, {
          id: gameId,
          gameType: engine.gameType,
          hostId: userId,
          hostName: hostP.nickname,
          players: new Map(Array.from(engine.players.values()).map(p => [
            p.userId,
            {
              userId: p.userId,
              nickname: p.nickname,
              role: p.role,
              isReady: p.role === 'HOST'
            }
          ])),
          settings: engine.settings,
          status: 'WAITING',
          createdAt: new Date(),
          maxPlayers: engine.gameType === 'SCRIBBLE' ? 12 : 8,
          isPrivate: engine.settings.isPrivate || false
        });
        
        activeGames.delete(gameId);
        io.to(gameId).emit('lobby_state', serializeLobby(LobbyService.lobbies.get(gameId)));
        
        broadcastLobbies();
        return;
      } else {
        return socket.emit('game_error', { message: 'Only host can restart the game' });
      }
    }

    const res = engine.handlePlayerAction(userId, action, data);
    if (!res.success) {
      return socket.emit('game_error', { message: res.error });
    }

    if (action === 'challenge_bluff' && res.challengeResult) {
      io.to(gameId).emit('game_challenge_reveal', res.challengeResult);
    }

    // Generic broadcast event support for any engine
    if (res.broadcastEvent) {
      io.to(gameId).emit(res.broadcastEvent.type, res.broadcastEvent.data);
    }
    if (res.broadcastEvents && Array.isArray(res.broadcastEvents)) {
      res.broadcastEvents.forEach(evt => {
        io.to(gameId).emit(evt.type, evt.data);
      });
    }
    if (res.privateEvents && Array.isArray(res.privateEvents)) {
      res.privateEvents.forEach(evt => {
        const sockets = onlineUsers.get(evt.userId);
        if (sockets) {
          sockets.forEach(sId => io.to(sId).emit(evt.type, evt.data));
        }
      });
    }

    if (res.forceStateSync !== false) {
      broadcastGameStates(gameId, engine);
    }

    // Wire up delayed broadcast callback (used by MemoryMatch for mismatch flip-back)
    engine._broadcastCallback = () => {
      broadcastGameStates(gameId, engine);
    };

    if (engine.status === 'FINISHED' && engine.gameType !== 'SCRIBBLE') {
      setTimeout(() => {
        engine.players.forEach(p => {
          updatePresence(p.userId, null).catch(console.error);
        });
        activeGames.delete(gameId);
      }, 5000);
    }
  });

  // ========================
  // SCRIBBLE SPECIFIC EVENTS
  // ========================

  socket.on('scribble_canvas_event', ({ gameId, userId, action, data }) => {
    // We only broadcast to the room, we don't store strokes to avoid DB bloat
    const engine = activeGames.get(gameId);
    if (!engine || engine.gameType !== 'SCRIBBLE') return;
    
    // Only the drawer can draw
    if (engine.currentDrawerId !== userId) return;

    // Broadcast stroke/tool change to everyone else in the game
    socket.to(gameId).emit('scribble_canvas_event', { action, data });
  });

  socket.on('scribble_save_canvas', async ({ gameId, userId, imageData }) => {
    const engine = activeGames.get(gameId);
    if (!engine || engine.gameType !== 'SCRIBBLE') return;
    
    if (engine.currentDrawerId !== userId) return;
    
    console.log(`[Scribble] Received canvas image to save for game ${gameId}`);
  });

  // ========================
  // INK & DECEPTION CANVAS EVENTS
  // ========================
  socket.on('ink_deception_canvas_event', ({ gameId, userId, action, data }) => {
    const engine = activeGames.get(gameId);
    if (!engine || engine.gameType !== 'INK_DECEPTION') return;
    
    // Server validation: only active drawer can broadcast drawing coordinates
    if (engine.turnState === 'DRAWING') {
      const activeDrawerId = engine.drawingQueue[engine.currentDrawerIndex];
      if (activeDrawerId !== userId) return;
    } else {
      return;
    }

    socket.to(gameId).emit('ink_deception_canvas_event', { action, data });
  });

  socket.on('ink_deception_save_canvas', async ({ gameId, userId, imageData }) => {
    const engine = activeGames.get(gameId);
    if (!engine || engine.gameType !== 'INK_DECEPTION') return;
    
    const activeDrawerId = engine.drawingQueue[engine.currentDrawerIndex];
    if (activeDrawerId !== userId) return;
    
    console.log(`[Ink & Deception] Received canvas image to save for game ${gameId}`);
  });



  // Handle sudden disconnects (e.g. closing tab)
  socket.on('disconnect', () => {
    let disconnectedUserId = null;
    for (const [uId, sockets] of onlineUsers.entries()) {
      if (sockets.has(socket.id)) {
        disconnectedUserId = uId;
        break;
      }
    }

    if (disconnectedUserId) {
      const userSockets = onlineUsers.get(disconnectedUserId);
      if (userSockets && userSockets.size > 1) {
        // User has other active tabs, don't remove from games
        return;
      }

      // 1. Clean up lobbies
      for (const [lobbyId, lobby] of LobbyService.lobbies.entries()) {
        if (lobby.players.has(disconnectedUserId)) {
          LobbyService.leaveLobby(lobbyId, disconnectedUserId).then(updatedLobby => {
            if (updatedLobby) {
              io.to(lobbyId).emit('lobby_state', serializeLobby(updatedLobby));
            }
            broadcastLobbies();
          }).catch(console.error);
        }
      }

      // 2. Clean up active games
      for (const [gameId, engine] of activeGames.entries()) {
        if (engine.players.has(disconnectedUserId)) {
          if (engine.gameType === 'INK_DECEPTION') {
            engine.handlePlayerDisconnect(disconnectedUserId);
            broadcastGameStates(gameId, engine);
          } else {
            if (engine.status !== 'FINISHED') {
              const removed = engine.removePlayer(disconnectedUserId);
              if (removed) {
                broadcastGameStates(gameId, engine);
                if (engine.players.size === 0) activeGames.delete(gameId);
              }
            }
          }
        }
      }
    }
  });

  socket.on('game_reconnect', ({ gameId, userId }) => {
    const engine = activeGames.get(gameId);
    if (!engine) {
      return socket.emit('game_error', { message: 'Game session not found or finished.' });
    }

    const player = engine.players.get(userId);
    if (player) {
      if (engine.gameType === 'INK_DECEPTION') {
        engine.handlePlayerReconnect(userId);
      } else {
        player.isOnline = true;
      }
      socket.join(gameId);
      socket.emit('game_state', engine.serializeState(userId));
      io.to(gameId).emit('player_reconnected', { userId, nickname: player.nickname });
      broadcastGameStates(gameId, engine);
    }
  });

  socket.on('game_spectate', ({ gameId, userId }) => {
    const engine = activeGames.get(gameId);
    if (!engine) {
      return socket.emit('game_error', { message: 'Game session not found.' });
    }

    engine.spectators.add(userId);
    socket.join(gameId);
    socket.emit('game_state', engine.serializeState(null));
  });
}

module.exports = registerGameSockets;
