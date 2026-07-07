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
  gameType: 'BLUFF';
  players: LobbyPlayer[];
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
}

export interface GamePlayerState {
  userId: string;
  nickname: string;
  role: 'HOST' | 'PLAYER';
  isReady: boolean;
  isOnline: boolean;
  cardCount: number;
  hand?: { id: string; suit: string; value: string }[];
}

export interface GameChallengeReveal {
  isTruth: boolean;
  challengerId: string;
  targetId: string;
  cards: { id: string; suit: string; value: string; playerId: string }[];
  log: string;
}

export interface BluffGameState {
  gameId: string;
  gameType: 'BLUFF';
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  currentTurnIdx: number;
  declaredRank: string | null;
  pileCount: number;
  winnerId: string | null;
  players: GamePlayerState[];
  historyLogs: string[];
  lastPlay: {
    playerId: string;
    cardCount: number;
    declaredRank: string;
  } | null;
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

interface BluffStore {
  lobby: LobbyState | null;
  gameState: BluffGameState | null;
  challengeReveal: GameChallengeReveal | null;
  error: string | null;
  availableLobbies: PublicLobby[];
  
  // Actions
  createLobby: (gameType: 'BLUFF', userId: string, nickname: string) => void;
  joinLobby: (gameId: string, userId: string, nickname: string) => void;
  toggleReady: (gameId: string, userId: string, isReady: boolean) => void;
  kickPlayer: (gameId: string, hostId: string, targetUserId: string) => void;
  leaveLobby: (gameId: string, userId: string) => void;
  invitePlayer: (gameId: string, senderId: string, senderName: string, targetUserId: string, gameType: string) => void;
  startGame: (gameId: string, hostId: string) => void;
  playCards: (gameId: string, userId: string, cardIds: string[], declaredRank: string) => void;
  challengeBluff: (gameId: string, userId: string) => void;
  reconnectGame: (gameId: string, userId: string) => void;
  spectateGame: (gameId: string, userId: string) => void;
  clearState: () => void;
  setError: (msg: string | null) => void;
  fetchLobbies: () => void;

  // Listeners Setup
  setupListeners: (gameId: string, targetUserId: string) => () => void;
}

export const useBluffStore = create<BluffStore>((set, get) => ({
  lobby: null,
  gameState: null,
  challengeReveal: null,
  error: null,
  availableLobbies: [],

  createLobby: (gameType, userId, nickname) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_create', { gameType, userId, nickname });
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
    set({ lobby: null, gameState: null, challengeReveal: null, error: null });
  },

  invitePlayer: (gameId, senderId, senderName, targetUserId, gameType) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_invite', { gameId, senderId, senderName, targetUserId, gameType });
  },

  startGame: (gameId, hostId) => {
    const socket = socketService.getSocket();
    socket.emit('game_start', { gameId, hostId });
  },

  playCards: (gameId, userId, cardIds, declaredRank) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'play_cards', data: { cardIds, declaredRank } });
  },

  challengeBluff: (gameId, userId) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', { gameId, userId, action: 'challenge_bluff' });
  },

  reconnectGame: (gameId, userId) => {
    const socket = socketService.getSocket();
    socket.emit('game_reconnect', { gameId, userId });
  },

  spectateGame: (gameId, userId) => {
    const socket = socketService.getSocket();
    socket.emit('game_spectate', { gameId, userId });
  },

  clearState: () => set({ lobby: null, gameState: null, challengeReveal: null, error: null }),
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

    const onGameState = (state: BluffGameState) => {
      set({ gameState: state, lobby: null });
    };

    const onChallengeReveal = (reveal: GameChallengeReveal) => {
      set({ challengeReveal: reveal });
      // Reset reveal after 4 seconds
      setTimeout(() => {
        set({ challengeReveal: null });
      }, 4000);
    };

    const onGameError = (err: { message: string }) => {
      set({ error: err.message });
      setTimeout(() => set({ error: null }), 3000);
    };

    const onKicked = () => {
      set({ lobby: null, gameState: null, challengeReveal: null, error: "You were kicked by the host." });
    };

    const onLobbiesList = (lobbies: PublicLobby[]) => {
      set({ availableLobbies: lobbies });
    };

    const onLobbiesUpdated = (lobbies: PublicLobby[]) => {
      set({ availableLobbies: lobbies });
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
    socket.on('game_challenge_reveal', onChallengeReveal);
    socket.on('game_error', onGameError);
    socket.on(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
    socket.on('lobbies_list_response', onLobbiesList);
    socket.on('lobbies_updated', onLobbiesUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('lobby_state', onLobbyState);
      socket.off('game_state', onGameState);
      socket.off('game_challenge_reveal', onChallengeReveal);
      socket.off('game_error', onGameError);
      socket.off(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
      socket.off('lobbies_list_response', onLobbiesList);
      socket.off('lobbies_updated', onLobbiesUpdated);
    };
  }
}));
