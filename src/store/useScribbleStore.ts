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
  gameType: 'SCRIBBLE';
  players: LobbyPlayer[];
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  settings?: {
    rounds?: number;
    drawingTime?: number;
    wordChoices?: number;
    category?: string;
  };
}

export interface ScribblePlayerState {
  userId: string;
  nickname: string;
  role: 'HOST' | 'PLAYER';
  isOnline: boolean;
  score: number;
  hasGuessed: boolean;
}

export interface ScribbleGameState {
  gameId: string;
  gameType: 'SCRIBBLE';
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  settings: any;
  currentRound: number;
  totalRounds: number;
  currentDrawerId: string;
  turnState: 'WAITING_FOR_WORD' | 'DRAWING' | 'ROUND_END';
  drawingTimeLeft: number;
  wordChoices: string[];
  word: string;
  wordLength: number;
  players: ScribblePlayerState[];
  historyLogs: string[];
  winnerId: string | null;
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

export interface GuessLog {
  id: string;
  userId: string;
  nickname: string;
  guess?: string;
  isCorrect: boolean;
  type?: 'join' | 'leave' | 'correct' | 'system' | 'warning' | 'close' | 'normal';
  timestamp: number;
}

interface ScribbleStore {
  lobby: LobbyState | null;
  gameState: ScribbleGameState | null;
  error: string | null;
  availableLobbies: PublicLobby[];
  guessLogs: GuessLog[];
  
  // Actions
  createLobby: (userId: string, nickname: string) => void;
  joinLobby: (gameId: string, userId: string, nickname: string) => void;
  toggleReady: (gameId: string, userId: string, isReady: boolean) => void;
  kickPlayer: (gameId: string, hostId: string, targetUserId: string) => void;
  leaveLobby: (gameId: string, userId: string) => void;
  updateSettings: (gameId: string, hostId: string, settings: any) => void;
  startGame: (gameId: string, hostId: string) => void;
  invitePlayer: (gameId: string, hostId: string, hostName: string, targetUserId: string, gameType: string) => void;
  
  // Game Actions
  selectWord: (gameId: string, userId: string, word: string) => void;
  sendGuess: (gameId: string, userId: string, guess: string) => void;
  reconnectGame: (gameId: string, userId: string) => void;
  playAgain: (gameId: string, userId: string) => void;
  
  clearState: () => void;
  setError: (msg: string | null) => void;
  fetchLobbies: () => void;

  // Listeners Setup
  setupListeners: (gameId: string, targetUserId: string) => () => void;
}

export const useScribbleStore = create<ScribbleStore>((set, get) => ({
  lobby: null,
  gameState: null,
  error: null,
  availableLobbies: [],
  guessLogs: [],

  createLobby: (userId, nickname) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_create', { gameType: 'SCRIBBLE', userId, nickname });
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
    set({ lobby: null, gameState: null, error: null, guessLogs: [] });
  },

  updateSettings: (gameId, hostId, settings) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_settings_update', { gameId, hostId, settings });
  },

  startGame: (gameId, hostId) => {
    const socket = socketService.getSocket();
    socket.emit('game_start', { gameId, hostId });
  },

  invitePlayer: (gameId, hostId, hostName, targetUserId, gameType) => {
    const socket = socketService.getSocket();
    socket.emit('game_invite', { gameId, hostId, hostName, targetUserId, gameType });
  },

  selectWord: (gameId, userId, word) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'select_word', data: { word } });
  },

  sendGuess: (gameId, userId, guess) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'guess', data: { guess } });
  },

  reconnectGame: (gameId, userId) => {
    const socket = socketService.getSocket();
    socket.emit('game_reconnect', { gameId, userId });
  },

  playAgain: (gameId, userId) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'play_again', data: {} });
  },

  clearState: () => set({ lobby: null, gameState: null, error: null, guessLogs: [] }),
  setError: (msg) => set({ error: msg }),

  fetchLobbies: () => {
    const socket = socketService.getSocket();
    socket.emit('lobbies_list');
  },

  setupListeners: (gameId, targetUserId) => {
    const socket = socketService.getSocket();

    const onLobbyState = (state: LobbyState) => {
      set({ lobby: state, gameState: null });
    };

    const onGameState = (state: ScribbleGameState) => {
      set((prev) => {
        let newLogs = [...(prev.guessLogs || [])];
        
        // Sync history logs into guess logs (as system messages)
        if (state.historyLogs && prev.gameState) {
           const prevHist = prev.gameState.historyLogs || [];
           if (state.historyLogs.length > prevHist.length) {
              const newHist = state.historyLogs.slice(prevHist.length);
              newHist.forEach(msg => {
                newLogs.push({
                   id: Math.random().toString(36).substr(2, 9),
                   userId: 'system',
                   nickname: 'System',
                   guess: msg,
                   isCorrect: false,
                   type: 'system',
                   timestamp: Date.now()
                });
              });
           }
        }

        // If turn changes to waiting, clear some state if needed but keep chat
        if (prev.gameState && prev.gameState.turnState !== state.turnState && state.turnState === 'WAITING_FOR_WORD') {
           return { gameState: state, lobby: null, guessLogs: newLogs };
        }
        return { gameState: state, lobby: null, guessLogs: newLogs };
      });
    };

    const onGameError = (err: { message: string }) => {
      set({ error: err.message });
      setTimeout(() => set({ error: null }), 3000);
    };

    const onKicked = () => {
      set({ lobby: null, gameState: null, error: "You were kicked by the host." });
    };

    const onLobbiesList = (lobbies: PublicLobby[]) => {
      set({ availableLobbies: lobbies.filter(l => l.gameType === 'SCRIBBLE') });
    };

    const onLobbiesUpdated = (lobbies: PublicLobby[]) => {
      set({ availableLobbies: lobbies.filter(l => l.gameType === 'SCRIBBLE') });
    };
    
    const onGuess = (data: { userId: string, nickname: string, guess: string }) => {
      set((state) => ({
        guessLogs: [...state.guessLogs, {
          id: Math.random().toString(36).substr(2, 9),
          userId: data.userId,
          nickname: data.nickname,
          guess: data.guess,
          isCorrect: false,
          type: 'normal',
          timestamp: Date.now()
        }]
      }));
    };
    
    const onCorrectGuess = (data: { userId: string, nickname: string }) => {
      set((state) => ({
        guessLogs: [...state.guessLogs, {
          id: Math.random().toString(36).substr(2, 9),
          userId: data.userId,
          nickname: data.nickname,
          isCorrect: true,
          type: 'correct',
          timestamp: Date.now()
        }]
      }));
    };

    const onCloseGuess = (data: { userId: string, nickname: string, guess: string }) => {
      set((state) => ({
        guessLogs: [...state.guessLogs, {
          id: Math.random().toString(36).substr(2, 9),
          userId: data.userId,
          nickname: data.nickname,
          guess: data.guess,
          isCorrect: false,
          type: 'close',
          timestamp: Date.now()
        }]
      }));
    };

    const handleConnect = () => {
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
    
    socket.on('scribble_guess', onGuess);
    socket.on('scribble_correct_guess', onCorrectGuess);
    socket.on('scribble_close_guess', onCloseGuess);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('lobby_state', onLobbyState);
      socket.off('game_state', onGameState);
      socket.off('game_error', onGameError);
      socket.off(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
      socket.off('lobbies_list_response', onLobbiesList);
      socket.off('lobbies_updated', onLobbiesUpdated);
      socket.off('scribble_guess', onGuess);
      socket.off('scribble_correct_guess', onCorrectGuess);
      socket.off('scribble_close_guess', onCloseGuess);
    };
  }
}));
