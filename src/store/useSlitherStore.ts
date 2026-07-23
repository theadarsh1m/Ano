import { create } from 'zustand';
import axios from 'axios';
import { socketService } from '@/lib/socket';
import { getApiUrl } from '@/lib/config';

export type SlitherSkin = 'CLASSIC' | 'RED' | 'BLUE' | 'YELLOW' | 'RAINBOW' | 'GLOW';

export interface SlitherPlayer {
  userId: string;
  nickname: string;
  isReady: boolean;
  role: 'HOST' | 'PLAYER';
  isOnline: boolean;
  score?: number;
  isAlive?: boolean;
}

export interface SlitherRoomState {
  id: string;
  hostId: string;
  gameType: 'SLITHER';
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  players: SlitherPlayer[];
  seed: number;
  startTime: number | null;
  results?: any[];
}

interface SlitherStoreState {
  selectedSkin: SlitherSkin;
  nickname: string;
  highScore: number;
  gamesPlayed: number;
  kills: number;
  deaths: number;
  totalTimePlayed: number;

  // Lobbies
  roomState: SlitherRoomState | null;
  availableLobbies: any[];
  isScanningLAN: boolean;

  setSkin: (skin: SlitherSkin) => void;
  setNickname: (name: string) => void;

  fetchStats: (userId: string) => Promise<void>;
  submitScore: (userId: string, nickname: string, score: number, kills: number, playTimeSeconds: number) => Promise<void>;
  
  // Socket Lobbies for LAN / Custom Mode
  createLobby: (userId: string, nickname: string) => void;
  joinLobby: (lobbyId: string, userId: string, nickname: string) => void;
  toggleReady: (lobbyId: string, userId: string, isReady?: boolean) => void;
  kickPlayer: (lobbyId: string, hostId: string, targetUserId: string) => void;
  startMatch: (lobbyId: string, hostId?: string) => void;
  leaveLobby: (userId: string) => void;
  initLobbySockets: (userId: string) => () => void;
}

export const useSlitherStore = create<SlitherStoreState>((set, get) => ({
  selectedSkin: 'CLASSIC',
  nickname: 'Player',
  highScore: 0,
  gamesPlayed: 0,
  kills: 0,
  deaths: 0,
  totalTimePlayed: 0,

  roomState: null,
  availableLobbies: [],
  isScanningLAN: false,

  setSkin: (skin) => set({ selectedSkin: skin }),
  setNickname: (name) => set({ nickname: name }),

  fetchStats: async (userId) => {
    if (!userId) return;
    try {
      const res = await axios.get(`${getApiUrl()}/api/games/stats/${userId}`);
      if (Array.isArray(res.data)) {
        const slitherStat = res.data.find((s: any) => s.gameType === 'slither' || s.gameType === 'SLITHER');
        if (slitherStat) {
          set({
            highScore: slitherStat.highScore || 0,
            totalTimePlayed: slitherStat.totalPlayTimeSeconds || 0,
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch slither stats:', err);
    }
  },

  submitScore: async (userId, nickname, score, kills, playTimeSeconds) => {
    if (!userId) return;
    try {
      const res = await axios.post(`${getApiUrl()}/api/games/save`, {
        userId,
        gameType: 'SLITHER',
        score,
        playTimeSeconds
      });
      if (res.data) {
        set((state) => ({
          highScore: Math.max(state.highScore, score),
          totalTimePlayed: state.totalTimePlayed + playTimeSeconds,
          gamesPlayed: state.gamesPlayed + 1,
          kills: state.kills + kills,
          deaths: state.deaths + 1
        }));
      }
    } catch (err) {
      console.error('Failed to save score:', err);
    }
  },

  createLobby: (userId, nickname) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('lobby_create', { gameType: 'SLITHER', userId, nickname });
  },

  joinLobby: (lobbyId, userId, nickname) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('lobby_join', { gameId: lobbyId.trim(), userId, nickname });
  },

  toggleReady: (lobbyId, userId, isReady) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    const room = get().roomState;
    const player = room?.players.find((p) => p.userId === userId);
    const nextReadyState = typeof isReady === 'boolean' ? isReady : !(player?.isReady);
    socket.emit('lobby_ready', { gameId: lobbyId, userId, isReady: nextReadyState });
  },

  kickPlayer: (lobbyId, hostId, targetUserId) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('lobby_kick', { gameId: lobbyId, hostId, targetUserId });
  },

  startMatch: (lobbyId, hostId) => {
    const socket = socketService.getSocket();
    const room = get().roomState;
    const actualHostId = hostId || room?.hostId;
    if (!socket) return;
    socket.emit('game_start', { gameId: lobbyId, hostId: actualHostId });
  },

  leaveLobby: (userId) => {
    const socket = socketService.getSocket();
    const room = get().roomState;
    if (socket && room) {
      socket.emit('lobby_leave', { gameId: room.id, userId });
    }
    set({ roomState: null });
  },

  initLobbySockets: (userId) => {
    const socket = socketService.getSocket();
    if (!socket) return () => {};

    socket.emit('lobbies_list');

    const onLobbiesList = (lobbies: any[]) => {
      const filtered = lobbies.filter((l) => l.gameType === 'SLITHER');
      set({ availableLobbies: filtered });
    };

    const onLobbyState = (state: any) => {
      if (state && state.gameType === 'SLITHER') {
        set({ roomState: state });
      }
    };

    const onGameState = (state: any) => {
      if (state && state.gameType === 'SLITHER') {
        set((current) => {
          const existingRoom = current.roomState;
          const updatedPlayers = Array.isArray(state.players)
            ? state.players.map((p: any) => ({
                userId: p.userId,
                nickname: p.nickname,
                isReady: p.isReady ?? false,
                role: p.userId === (existingRoom?.hostId || state.hostId) ? 'HOST' : 'PLAYER',
                isOnline: p.isOnline ?? true,
                score: p.score ?? 0,
                isAlive: p.isAlive ?? true
              }))
            : existingRoom?.players || [];

          return {
            roomState: {
              id: state.gameId || existingRoom?.id || '',
              hostId: existingRoom?.hostId || state.hostId || '',
              gameType: 'SLITHER',
              status: state.status || 'LOBBY',
              players: updatedPlayers,
              seed: state.seed ?? 0,
              startTime: state.startTime ?? null,
              results: state.results || []
            }
          };
        });
      }
    };

    const onGameStarted = (data: any) => {
      set((current) => {
        if (!current.roomState) return current;
        return {
          roomState: {
            ...current.roomState,
            status: 'PLAYING',
            startTime: data.startTime
          }
        };
      });
    };

    socket.on('lobbies_list_response', onLobbiesList);
    socket.on('lobbies_updated', onLobbiesList);
    socket.on('lobby_state', onLobbyState);
    socket.on('game_state', onGameState);
    socket.on('game_started', onGameStarted);

    return () => {
      socket.off('lobbies_list_response', onLobbiesList);
      socket.off('lobbies_updated', onLobbiesList);
      socket.off('lobby_state', onLobbyState);
      socket.off('game_state', onGameState);
      socket.off('game_started', onGameStarted);
    };
  }
}));
