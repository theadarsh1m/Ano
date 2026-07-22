import { create } from 'zustand';
import axios from 'axios';
import { socketService } from '@/lib/socket';
import { getApiUrl } from '@/lib/config';
import {
  Achievement,
  BirdSkin,
  FlappyRoomState,
  LeaderboardEntry,
  MatchHistoryEntry,
  MultiplayerStats,
  PipeStyle,
  SinglePlayerStats,
  ThemeType,
  WeatherType
} from '@/components/games/flappy-bird/engine/types';

interface FlappyStoreState {
  // Settings & Cosmetics
  selectedTheme: ThemeType;
  selectedSkin: BirdSkin;
  selectedWeather: WeatherType;
  selectedPipeStyle: PipeStyle;
  soundVolume: number;
  isMuted: boolean;
  reducedMotion: boolean;

  // Singleplayer & Multiplayer Stats
  singlePlayerStats: SinglePlayerStats;
  multiplayerStats: MultiplayerStats;
  matchHistory: MatchHistoryEntry[];
  achievements: Achievement[];
  leaderboard: LeaderboardEntry[];

  // Multiplayer Lobby State
  roomState: FlappyRoomState | null;
  availableLobbies: any[];
  isSearchingMatch: boolean;

  // Actions
  setTheme: (theme: ThemeType) => void;
  setSkin: (skin: BirdSkin) => void;
  setWeather: (weather: WeatherType) => void;
  setPipeStyle: (style: PipeStyle) => void;
  setSoundVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleReducedMotion: () => void;

  // API Requests
  fetchStats: (userId: string) => Promise<void>;
  submitSinglePlayerScore: (
    userId: string,
    score: number,
    pipesPassed: number,
    playTimeSeconds: number,
    nickname?: string,
    avatar?: string | null
  ) => Promise<{ highScore: number } | null>;
  fetchLeaderboard: () => Promise<void>;

  // Multiplayer Lobby Sockets
  createLobby: (userId: string, nickname: string) => void;
  joinLobby: (lobbyId: string, userId: string, nickname: string) => void;
  toggleReady: (lobbyId: string, userId: string, isReady?: boolean) => void;
  kickPlayer: (lobbyId: string, hostId: string, targetUserId: string) => void;
  updateSettings: (lobbyId: string, hostId: string, settings: any) => void;
  invitePlayer: (gameId: string, hostId: string, hostName: string, targetUserId: string, gameType?: string) => void;
  startMatch: (lobbyId: string, hostId?: string) => void;
  requestPlayAgain: (lobbyId: string, userId: string) => void;
  spectateMatch: (gameId: string, userId: string) => void;
  returnToLobby: (gameId: string, userId: string) => void;
  resetLobby: (gameId: string) => void;
  leaveLobby: (userId: string) => void;
  fetchLobbies: () => void;
  initLobbySockets: (userId: string) => () => void;
  setupListeners: (gameId: string, userId: string) => () => void;
}



export const useFlappyStore = create<FlappyStoreState>((set, get) => ({
  selectedTheme: 'DAY',
  selectedSkin: 'CLASSIC',
  selectedWeather: 'NONE',
  selectedPipeStyle: 'CLASSIC',
  soundVolume: 0.7,
  isMuted: false,
  reducedMotion: false,

  singlePlayerStats: {
    highScore: 0,
    gamesPlayed: 0,
    pipesPassed: 0,
    timeSurvivedSeconds: 0,
    averageScore: 0,
    coins: 0,
    xp: 0,
    unlockedAchievements: []
  },
  multiplayerStats: {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    highScore: 0,
    pipesPassed: 0,
    timeSurvivedSeconds: 0,
    longestSurvivalSeconds: 0
  },
  matchHistory: [],
  achievements: [],
  leaderboard: [],

  roomState: null,
  availableLobbies: [],
  isSearchingMatch: false,

  setTheme: (theme) => set({ selectedTheme: theme }),
  setSkin: (skin) => set({ selectedSkin: skin }),
  setWeather: (weather) => set({ selectedWeather: weather }),
  setPipeStyle: (style) => set({ selectedPipeStyle: style }),
  setSoundVolume: (vol) => set({ soundVolume: vol }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleReducedMotion: () => set((s) => ({ reducedMotion: !s.reducedMotion })),

  fetchStats: async (userId) => {
    if (!userId) return;
    try {
      const res = await axios.get(`${getApiUrl()}/api/games/flappy-bird/stats/${userId}`);
      if (res.data) {
        set({
          singlePlayerStats: res.data.singlePlayer || {
            highScore: 0,
            gamesPlayed: 0,
            pipesPassed: 0,
            timeSurvivedSeconds: 0,
            averageScore: 0,
            coins: 0,
            xp: 0,
            unlockedAchievements: []
          },
          multiplayerStats: res.data.multiplayer || {
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            highScore: 0,
            pipesPassed: 0,
            timeSurvivedSeconds: 0,
            longestSurvivalSeconds: 0
          },
          matchHistory: res.data.matchHistory || [],
          achievements: res.data.achievements || []
        });
      }
    } catch (err) {
      console.error('Failed to fetch flappy stats:', err);
    }
  },

  submitSinglePlayerScore: async (userId, score, pipesPassed, playTimeSeconds, nickname?: string, avatar?: string | null) => {
    if (!userId) return null;
    const defaultRewards = {
      highScore: Math.max(score, get().singlePlayerStats.highScore || 0)
    };

    try {
      const apiUrl = getApiUrl();
      const res = await axios.post(`${apiUrl}/api/games/flappy-bird/submit-score`, {
        userId,
        nickname: nickname || 'Player',
        avatar,
        score,
        pipesPassed,
        playTimeSeconds
      });

      if (res.data && res.data.success) {
        get().fetchStats(userId);
        return {
          highScore: res.data.highScore ?? defaultRewards.highScore
        };
      }
    } catch (err) {
      console.warn('Backend flappy score submit warning (using local fallback):', err);
    }
    return defaultRewards;
  },

  fetchLeaderboard: async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/games/flappy-bird/leaderboard`);
      if (Array.isArray(res.data)) {
        set({ leaderboard: res.data });
      }
    } catch (err) {
      console.error('Failed to fetch flappy leaderboard:', err);
    }
  },

  // Socket Actions
  createLobby: (userId, nickname) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('lobby_create', { gameType: 'FLAPPY_BIRD', userId, nickname });
  },

  joinLobby: (lobbyId, userId, nickname) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('lobby_join', { gameId: lobbyId.trim(), userId, nickname });
  },

  toggleReady: (lobbyId, userId, isReady?: boolean) => {
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

  updateSettings: (lobbyId, hostId, settings) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('lobby_settings_update', { gameId: lobbyId, hostId, settings });
  },

  invitePlayer: (gameId, hostId, hostName, targetUserId, gameType = 'FLAPPY_BIRD') => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('game_invite', { gameId, hostId, hostName, targetUserId, gameType });
  },

  startMatch: (lobbyId, hostId) => {
    const socket = socketService.getSocket();
    const room = get().roomState;
    const actualHostId = hostId || room?.hostId;
    if (!socket) return;
    socket.emit('game_start', { gameId: lobbyId, hostId: actualHostId });
  },

  requestPlayAgain: (lobbyId, userId) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('game_action', { gameId: lobbyId, userId, action: 'play_again' });
  },

  spectateMatch: (gameId, userId) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('flappy_spectate', { gameId, userId });
  },

  returnToLobby: (gameId, userId) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('flappy_return_to_lobby', { gameId, userId });
  },

  resetLobby: (gameId) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('flappy_reset_lobby', { gameId });
  },

  leaveLobby: (userId) => {
    const socket = socketService.getSocket();
    const room = get().roomState;
    if (socket && room) {
      socket.emit('lobby_leave', { gameId: room.id, userId });
    }
    set({ roomState: null });
  },

  fetchLobbies: () => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('lobbies_list');
  },

  initLobbySockets: (userId) => {
    const socket = socketService.getSocket();
    if (!socket) return () => {};

    socket.emit('lobbies_list');

    const onLobbiesList = (lobbies: any[]) => {
      const filtered = lobbies.filter((l) => l.gameType === 'FLAPPY_BIRD');
      set({ availableLobbies: filtered });
    };

    const onLobbyState = (state: FlappyRoomState) => {
      if (state && state.gameType === 'FLAPPY_BIRD') {
        set({ roomState: state });
      }
    };

    const onGameState = (state: any) => {
      if (state && (state.gameType === 'FLAPPY_BIRD' || !state.gameType)) {
        set((current) => {
          const existingRoom = current.roomState;
          const updatedPlayers = Array.isArray(state.players)
            ? state.players.map((p: any) => ({
                userId: p.userId,
                nickname: p.nickname,
                avatar: p.avatar,
                isReady: p.isReady ?? false,
                isHost: p.userId === (existingRoom?.hostId || state.hostId),
                score: p.score ?? 0,
                isAlive: p.isAlive ?? true,
                status: p.status || (state.status === 'LOBBY' ? (p.isReady ? 'READY' : 'WAITING') : 'PLAYING'),
                rank: p.rank
              }))
            : existingRoom?.players || [];

          return {
            roomState: {
              id: state.gameId || existingRoom?.id || '',
              hostId: existingRoom?.hostId || state.hostId || '',
              gameType: 'FLAPPY_BIRD',
              status: state.status || 'LOBBY',
              players: updatedPlayers,
              seed: state.seed ?? existingRoom?.seed ?? Math.floor(Math.random() * 1000000),
              startTime: state.startTime ?? null,
              countdownValue: state.countdownValue ?? null,
              results: state.results || existingRoom?.results
            }
          };
        });
      }
    };

    const onGameStarted = (data: { gameId: string; status: string; seed: number; startTime: number }) => {
      set((current) => {
        if (!current.roomState) return current;
        return {
          roomState: {
            ...current.roomState,
            status: 'PLAYING',
            seed: data.seed,
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
  },

  setupListeners: (gameId, userId) => {
    return get().initLobbySockets(userId);
  }
}));
