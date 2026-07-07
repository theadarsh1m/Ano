const LobbyService = require('../lobby/LobbyService');
const BluffEngine = require('../bluff/BluffEngine');
const userService = require('../../services/userService');

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
      status: lobby.status
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
    await updatePresence(userId, `In ${gameType === 'BLUFF' ? 'Bluff' : gameType} Lobby`);
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
    await updatePresence(userId, `In ${lobby.gameType === 'BLUFF' ? 'Bluff' : lobby.gameType} Lobby`);
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
        message: `Join their ${gameType === 'BLUFF' ? 'Bluff' : gameType} lobby.`,
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

    let engine;
    if (lobby.gameType === 'BLUFF') {
      engine = new BluffEngine(gameId);
    } else {
      return socket.emit('game_error', { message: 'Unsupported game type.' });
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
      await updatePresence(p.userId, `Playing ${lobby.gameType === 'BLUFF' ? 'Bluff' : lobby.gameType}`);
    }

    broadcastGameStates(gameId, engine);
  });

  const broadcastGameStates = (gameId, engine) => {
    engine.players.forEach((p, id) => {
      const sockets = onlineUsers.get(id);
      if (sockets) {
        sockets.forEach(sId => {
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

    const res = engine.handlePlayerAction(userId, action, data);
    if (!res.success) {
      return socket.emit('game_error', { message: res.error });
    }

    if (action === 'challenge_bluff' && res.challengeResult) {
      io.to(gameId).emit('game_challenge_reveal', res.challengeResult);
    }

    broadcastGameStates(gameId, engine);

    if (engine.status === 'FINISHED') {
      setTimeout(() => {
        engine.players.forEach(p => {
          updatePresence(p.userId, null);
        });
        activeGames.delete(gameId);
      }, 5000);
    }
  });

  socket.on('game_reconnect', ({ gameId, userId }) => {
    const engine = activeGames.get(gameId);
    if (!engine) {
      return socket.emit('game_error', { message: 'Game session not found or finished.' });
    }

    const player = engine.players.get(userId);
    if (player) {
      player.isOnline = true;
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
