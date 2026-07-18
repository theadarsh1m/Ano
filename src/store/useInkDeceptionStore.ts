import { create } from 'zustand';
import { socketService } from '@/lib/socket';
import { useUserStore } from './useUserStore';

export interface LobbyPlayer {
  userId: string;
  nickname: string;
  isReady: boolean;
  role: 'HOST' | 'PLAYER';
}

export interface LobbyState {
  id: string;
  hostId: string;
  gameType: 'INK_DECEPTION';
  players: LobbyPlayer[];
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  settings?: {
    rounds?: number;
    drawingTime?: number;
    discussionTime?: number;
    guessTime?: number;
    category?: string;
    hiddenCategory?: boolean;
  };
}

export interface InkDeceptionPlayerState {
  userId: string;
  nickname: string;
  role: 'QUESTION_MASTER' | 'ARTIST' | 'FAKE_ARTIST' | 'PLAYER';
  isOnline: boolean;
  score: number;
  inkColor: string;
  hasVoted: boolean;
  votedFor: string | null;
  isHost: boolean;
}

export interface InkDeceptionStroke {
  strokeId: string;
  playerId: string;
  inkColor: string;
  points: { x: number; y: number; pressure?: number }[];
}

export interface InkDeceptionGameState {
  gameId: string;
  gameType: 'INK_DECEPTION';
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  settings: {
    rounds: number;
    drawingTime: number;
    discussionTime: number;
    guessTime: number;
    category: string;
    hiddenCategory: boolean;
    minPlayers?: number;
    maxPlayers?: number;
    pointsArtistWin?: number;
    pointsFakeWin?: number;
    reconnectTimeout?: number;
  };
  currentRound: number;
  totalRounds: number;
  
  questionMasterId: string | null;
  fakeArtistId: string | null;
  
  word: string;
  category: string | null;
  wordChoices: string[];
  
  turnState: 'LOBBY' | 'QUESTION_MASTER_SELECTING' | 'ROLE_REVEAL' | 'DRAWING' | 'DISCUSSION' | 'VOTING' | 'REVEAL' | 'FAKE_GUESS' | 'ROUND_END' | 'GAME_END';
  timeLeft: number;
  
  players: InkDeceptionPlayerState[];
  historyLogs: string[];
  strokes: InkDeceptionStroke[];
  roundWinner: 'ARTISTS' | 'FAKE_ARTIST_AND_QM' | 'FAKE_ARTIST' | null;
  winnerId: string | null;
  
  activeDrawerId: string | null;
  drawingQueue: string[];
  currentTurnCount: number;
  totalTurns: number;
  
  roundReplays: Record<number, InkDeceptionStroke[]>;
  mostVotedId: string | null;
  guessWordCorrect: boolean;

  isPaused?: boolean;
  pausedPlayerId?: string | null;
  pauseTimeLeft?: number;
}

export interface PublicLobby {
  id: string;
  hostId: string;
  hostName: string;
  gameType: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
}

export interface GameLog {
  id: string;
  message: string;
  timestamp: number;
  type: 'system' | 'join' | 'leave' | 'win' | 'vote' | 'guess';
}

interface InkDeceptionStore {
  lobby: LobbyState | null;
  gameState: InkDeceptionGameState | null;
  error: string | null;
  availableLobbies: PublicLobby[];
  logs: GameLog[];
  
  // Actions
  createLobby: (userId: string, nickname: string) => void;
  joinLobby: (gameId: string, userId: string, nickname: string) => void;
  toggleReady: (gameId: string, userId: string, isReady: boolean) => void;
  kickPlayer: (gameId: string, hostId: string, targetUserId: string) => void;
  leaveLobby: (gameId: string, userId: string) => void;
  updateSettings: (gameId: string, hostId: string, settings: Record<string, unknown>) => void;
  startGame: (gameId: string, hostId: string) => void;
  invitePlayer: (gameId: string, senderId: string, senderName: string, targetUserId: string) => void;
  
  // Game Actions
  submitQMWord: (gameId: string, userId: string, category: string, word: string) => void;
  submitStroke: (gameId: string, userId: string, points: { x: number; y: number; pressure?: number }[]) => void;
  castVote: (gameId: string, userId: string, targetUserId: string) => void;
  submitWordGuess: (gameId: string, userId: string, guess: string) => void;
  nextRound: (gameId: string, userId: string) => void;
  playAgain: (gameId: string, userId: string) => void;
  notifyRoleSeen: (gameId: string, userId: string) => void;
  
  clearState: () => void;
  setError: (msg: string | null) => void;
  fetchLobbies: () => void;
  setupListeners: (gameId: string, targetUserId: string) => () => void;
}

export const useInkDeceptionStore = create<InkDeceptionStore>((set, get) => ({
  lobby: null,
  gameState: null,
  error: null,
  availableLobbies: [],
  logs: [],

  createLobby: (userId, nickname) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_create', { gameType: 'INK_DECEPTION', userId, nickname });
  },

  joinLobby: (gameId, userId, nickname) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_join', { gameId, userId, nickname });
  },

  toggleReady: (gameId, userId, isReady) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_ready', { gameId, userId, isReady });
  },

  kickPlayer: (gameId, hostId, targetUserId) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_kick', { gameId, hostId, targetUserId });
  },

  leaveLobby: (gameId, userId) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_leave', { gameId, userId });
    set({ lobby: null, gameState: null, error: null, logs: [] });
  },

  updateSettings: (gameId, hostId, settings) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_settings_update', { gameId, hostId, settings });
  },

  startGame: (gameId, hostId) => {
    const socket = socketService.getSocket();
    socket.emit('game_start', { gameId, hostId });
  },

  invitePlayer: (gameId, senderId, senderName, targetUserId) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_invite', { gameId, senderId, senderName, targetUserId, gameType: 'INK_DECEPTION' });
  },

  submitQMWord: (gameId, userId, category, word) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'select_word', data: { category, word } });
  },

  submitStroke: (gameId, userId, points) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'draw_stroke', data: { points } });
  },

  castVote: (gameId, userId, targetUserId) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'vote', data: { targetUserId } });
  },

  submitWordGuess: (gameId, userId, guess) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'guess_word', data: { guess } });
  },

  nextRound: (gameId, userId) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'next_round', data: {} });
  },

  playAgain: (gameId, userId) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'play_again', data: {} });
  },

  notifyRoleSeen: (gameId, userId) => {
    const socket = socketService.getSocket();
    console.log('[InkDeceptionStore] notifyRoleSeen', { gameId, userId });
    socket.emit('game_action', { gameId, userId, action: 'role_seen', data: {} });
  },

  clearState: () => set({ lobby: null, gameState: null, error: null, logs: [] }),
  setError: (msg) => set({ error: msg }),

  fetchLobbies: () => {
    const socket = socketService.getSocket();
    socket.emit('lobbies_list');
  },

  setupListeners: (gameId, targetUserId) => {
    const socket = socketService.getSocket();
    console.log(`[${new Date().toISOString()}] [Ink & Deception Store] setupListeners registered for gameId: "${gameId}", targetUserId: "${targetUserId}"`);

    const onLobbyState = (state: LobbyState) => {
      console.log(`[${new Date().toISOString()}] [Ink & Deception Store] onLobbyState received:`, state);
      if (state.gameType === 'INK_DECEPTION') {
        set({ lobby: state, gameState: null });
      }
    };

    const onGameState = (state: InkDeceptionGameState) => {
      console.log(`[${new Date().toISOString()}] [Ink & Deception Store] onGameState received:`, state);
      if (state.gameType === 'INK_DECEPTION') {
        set((prev) => {
          const newLogs = [...(prev.logs || [])];
          
          // Sync engine logs
          if (state.historyLogs && prev.gameState) {
             const prevHist = prev.gameState.historyLogs || [];
             if (state.historyLogs.length > prevHist.length) {
                const newHist = state.historyLogs.slice(prevHist.length);
                newHist.forEach(msg => {
                  let type: GameLog['type'] = 'system';
                  if (msg.includes('win')) type = 'win';
                  else if (msg.includes('vote')) type = 'vote';
                  else if (msg.includes('guess')) type = 'guess';
                  
                  newLogs.push({
                     id: Math.random().toString(36).substr(2, 9),
                     message: msg,
                     type,
                     timestamp: Date.now()
                  });
                });
             }
          } else if (state.historyLogs && !prev.gameState) {
            state.historyLogs.forEach(msg => {
              newLogs.push({
                id: Math.random().toString(36).substr(2, 9),
                message: msg,
                type: 'system',
                timestamp: Date.now()
             });
            });
          }
          return { gameState: state, lobby: null, logs: newLogs };
        });
      }
    };

    const onGameError = (err: { message: string }) => {
      set({ error: err.message });
      setTimeout(() => set({ error: null }), 3000);
    };

    const onKicked = () => {
      set({ lobby: null, gameState: null, error: "You were kicked by the host." });
    };

    const onLobbiesList = (lobbies: PublicLobby[]) => {
      set({ availableLobbies: lobbies.filter(l => l.gameType === 'INK_DECEPTION') });
    };

    const onLobbiesUpdated = (lobbies: PublicLobby[]) => {
      set({ availableLobbies: lobbies.filter(l => l.gameType === 'INK_DECEPTION') });
    };

    const handleConnect = () => {
      console.log(`[${new Date().toISOString()}] [Ink & Deception Store] handleConnect running. lobby:`, get().lobby?.id, 'gameState:', get().gameState?.gameId);
      const currentLobby = get().lobby;
      const currentGameState = get().gameState;
      if (currentLobby) {
        socket.emit('lobby_join', { 
          gameId: currentLobby.id, 
          userId: targetUserId, 
          nickname: useUserStore.getState().nickname || 'Player'
        });
      } else if (currentGameState) {
        socket.emit('game_reconnect', { 
          gameId: currentGameState.gameId, 
          userId: targetUserId 
        });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('lobby_state', onLobbyState);
    socket.on('game_state', onGameState);
    socket.on('game_error', onGameError);
    socket.on(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
    socket.on('lobbies_list_response', onLobbiesList);
    socket.on('lobbies_updated', onLobbiesUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('lobby_state', onLobbyState);
      socket.off('game_state', onGameState);
      socket.off('game_error', onGameError);
      socket.off(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
      socket.off('lobbies_list_response', onLobbiesList);
      socket.off('lobbies_updated', onLobbiesUpdated);
    };
  }
}));
