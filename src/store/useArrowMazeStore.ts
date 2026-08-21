import { create } from 'zustand';
import axios from 'axios';
import { socketService } from '@/lib/socket';
import { getApiUrl } from '@/lib/config';
import type {
  MultiplayerMode,
  LevelCount,
  TimedDuration,
  ArrowMazeRoomState,
  ArrowMazePlayer,
  ArrowMazeSoloStats,
  ArrowMazeMultiStats,
  ArrowMazeMatchStats,
  LeaderboardEntry,
} from '@/components/games/arrow-maze/types';

interface ArrowMazeStoreState {
  // Settings
  multiplayerMode: MultiplayerMode;
  levelCount: LevelCount;
  timedDuration: TimedDuration;

  // Stats & Leaderboard
  soloStats: ArrowMazeSoloStats;
  multiStats: ArrowMazeMultiStats;
  leaderboard: LeaderboardEntry[];

  // Multiplayer
  roomState: ArrowMazeRoomState | null;
  availableLobbies: any[];
  matchResults: ArrowMazeMatchStats[] | null;

  // Actions — Settings
  setMultiplayerMode: (m: MultiplayerMode) => void;
  setLevelCount: (n: LevelCount) => void;
  setTimedDuration: (d: TimedDuration) => void;

  // Actions — API
  fetchStats: (userId: string) => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
  submitSoloProgress: (
    userId: string,
    currentLevel: number,
    totalScore: number,
    levelsCleared: number,
    totalArrowsCleared: number,
  ) => Promise<void>;

  // Actions — Multiplayer Lobby
  createLobby: (userId: string, nickname: string) => void;
  joinLobby: (lobbyId: string, userId: string, nickname: string) => void;
  toggleReady: (lobbyId: string, userId: string, isReady?: boolean) => void;
  kickPlayer: (lobbyId: string, hostId: string, targetUserId: string) => void;
  updateSettings: (lobbyId: string, hostId: string, settings: any) => void;
  invitePlayer: (gameId: string, hostId: string, hostName: string, targetUserId: string) => void;
  startMatch: (lobbyId: string, hostId?: string) => void;
  leaveLobby: (userId: string) => void;
  fetchLobbies: () => void;
  returnToLobby: (gameId: string, userId: string) => void;
  resetLobby: (gameId: string) => void;

  // Actions — In-match
  sendProgress: (gameId: string, userId: string, data: any) => void;
  sendLevelCleared: (gameId: string, userId: string, level: number, score: number, levelsCleared: number) => void;
  sendFinished: (gameId: string, userId: string, stats: ArrowMazeMatchStats) => void;

  // Socket init
  initLobbySockets: (userId: string) => () => void;
}

export const useArrowMazeStore = create<ArrowMazeStoreState>((set, get) => ({
  multiplayerMode: 'LEVELS',
  levelCount: 10,
  timedDuration: 180,

  soloStats: {
    currentLevel: 1,
    highScore: 0,
    totalScore: 0,
    levelsCleared: 0,
    totalArrowsCleared: 0,
    gamesPlayed: 0,
  },
  multiStats: {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    highScore: 0,
    levelsCleared: 0,
  },
  roomState: null,
  availableLobbies: [],
  matchResults: null,
  leaderboard: [],

  setMultiplayerMode: (m) => set({ multiplayerMode: m }),
  setLevelCount: (n) => set({ levelCount: n }),
  setTimedDuration: (d) => set({ timedDuration: d }),

  fetchStats: async (userId) => {
    if (!userId) return;
    try {
      const res = await axios.get(`${getApiUrl()}/api/games/stats/${userId}`);
      if (res.data) {
        const gameStat = Array.isArray(res.data)
          ? res.data.find((s: any) => s.gameType === 'arrow-maze')
          : null;
        if (gameStat) {
          const extra = gameStat.extraStats || {};
          set({
            soloStats: {
              currentLevel: extra.currentLevel || 1,
              highScore: gameStat.highScore || 0,
              totalScore: extra.totalScore || 0,
              levelsCleared: extra.levelsCleared || 0,
              totalArrowsCleared: extra.totalArrowsCleared || 0,
              gamesPlayed: extra.gamesPlayed || 0,
            },
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch arrow maze stats:', err);
    }
  },

  fetchLeaderboard: async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/games/leaderboard/arrow-maze`);
      if (res.data) {
        set({ leaderboard: Array.isArray(res.data) ? res.data : [] });
      }
    } catch (err) {
      console.warn('Failed to fetch arrow-maze leaderboard:', err);
    }
  },

  submitSoloProgress: async (userId, currentLevel, totalScore, levelsCleared, totalArrowsCleared) => {
    if (!userId) return;
    try {
      await axios.post(`${getApiUrl()}/api/games/save`, {
        userId,
        gameType: 'arrow-maze',
        score: totalScore,
        playTimeSeconds: 0,
        extraStats: {
          currentLevel,
          totalScore,
          levelsCleared,
          totalArrowsCleared,
          gamesPlayed: (get().soloStats.gamesPlayed || 0) + 1,
        },
      });
      // Update local state immediately & refresh leaderboard
      set(prev => ({
        soloStats: {
          ...prev.soloStats,
          currentLevel: Math.max(prev.soloStats.currentLevel, currentLevel),
          highScore: Math.max(prev.soloStats.highScore, totalScore),
          totalScore,
          levelsCleared,
          totalArrowsCleared,
        },
      }));
      get().fetchLeaderboard();
    } catch (err) {
      console.warn('Arrow maze progress save warning:', err);
    }
  },

  // Socket Actions
  createLobby: (userId, nickname) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('lobby_create', { gameType: 'ARROW_MAZE', userId, nickname });
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

  updateSettings: (lobbyId, hostId, settings) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('lobby_settings_update', { gameId: lobbyId, hostId, settings });
  },

  invitePlayer: (gameId, hostId, hostName, targetUserId) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    const payload = {
      gameId, hostId, senderId: hostId, hostName, senderName: hostName,
      targetUserId, gameType: 'ARROW_MAZE',
    };
    socket.emit('lobby_invite', payload);
    socket.emit('game_invite', payload);
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

  fetchLobbies: () => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('lobbies_list');
  },

  returnToLobby: (gameId, userId) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('arrowmaze_return_to_lobby', { gameId, userId });
  },

  resetLobby: (gameId) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('arrowmaze_reset_lobby', { gameId });
  },

  sendProgress: (gameId, userId, data) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('arrowmaze_progress', { gameId, userId, ...data });
  },

  sendLevelCleared: (gameId, userId, level, score, levelsCleared) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('arrowmaze_level_cleared', { gameId, userId, level, score, levelsCleared });
  },

  sendFinished: (gameId, userId, stats) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('arrowmaze_finished', { gameId, userId, stats });
  },

  initLobbySockets: (userId) => {
    const socket = socketService.getSocket();
    if (!socket) return () => {};

    socket.emit('lobbies_list');

    const onLobbiesList = (lobbies: any[]) => {
      const filtered = lobbies.filter((l) => l.gameType === 'ARROW_MAZE');
      set({ availableLobbies: filtered });
    };

    const onLobbyState = (state: any) => {
      if (state && state.gameType === 'ARROW_MAZE') {
        set({
          roomState: {
            id: state.id,
            hostId: state.hostId,
            gameType: 'ARROW_MAZE',
            status: state.status === 'WAITING' ? 'LOBBY' : state.status,
            players: (state.players || []).map((p: any) => ({
              userId: p.userId,
              nickname: p.nickname,
              avatar: p.avatar,
              isReady: p.isReady ?? false,
              isHost: p.userId === state.hostId,
              role: p.role,
              status: p.status || (state.status === 'WAITING' ? (p.isReady ? 'READY' : 'WAITING') : 'PLAYING'),
              score: p.score ?? 0,
              currentLevel: p.currentLevel ?? 1,
              levelsCleared: p.levelsCleared ?? 0,
              livesRemaining: p.livesRemaining ?? 3,
              rank: p.rank,
            })),
            seed: state.seed ?? Math.floor(Math.random() * 1000000),
            startTime: state.startTime ?? null,
            countdownValue: state.countdownValue ?? null,
            settings: state.settings || {
              multiplayerMode: 'LEVELS',
              levelCount: 10,
              timedDuration: 180,
              deadTimeLimit: 60,
              maxPlayers: 8,
            },
            results: state.results,
          },
        });
      }
    };

    const onGameState = (state: any) => {
      if (state && state.gameType === 'ARROW_MAZE') {
        set((current) => {
          const existingRoom = current.roomState;
          const updatedPlayers = Array.isArray(state.players)
            ? state.players.map((p: any) => ({
                userId: p.userId,
                nickname: p.nickname,
                avatar: p.avatar,
                isReady: p.isReady ?? false,
                isHost: p.userId === (existingRoom?.hostId || state.hostId),
                role: p.role,
                status: p.status || 'PLAYING',
                score: p.score ?? 0,
                currentLevel: p.currentLevel ?? 1,
                levelsCleared: p.levelsCleared ?? 0,
                livesRemaining: p.livesRemaining ?? 3,
                rank: p.rank,
              }))
            : existingRoom?.players || [];

          return {
            roomState: {
              id: state.gameId || existingRoom?.id || '',
              hostId: existingRoom?.hostId || state.hostId || '',
              gameType: 'ARROW_MAZE',
              status: state.status || 'LOBBY',
              players: updatedPlayers,
              seed: state.seed ?? existingRoom?.seed ?? Math.floor(Math.random() * 1000000),
              startTime: state.startTime ?? null,
              countdownValue: state.countdownValue ?? null,
              settings: state.settings || existingRoom?.settings || {
                multiplayerMode: 'LEVELS',
                levelCount: 10,
                timedDuration: 180,
                deadTimeLimit: 60,
                maxPlayers: 8,
              },
              results: state.results || existingRoom?.results,
            },
          };
        });
      }
    };

    const onGameStarted = (data: { gameId: string; status: string; seed: number; startTime: number; settings?: any }) => {
      set((current) => {
        if (!current.roomState) return current;
        return {
          roomState: {
            ...current.roomState,
            status: 'PLAYING',
            seed: data.seed,
            startTime: data.startTime,
            countdownValue: null,
            settings: data.settings || current.roomState.settings,
          },
        };
      });
    };

    const onGameCountdown = (data: { countdownValue: number; seed: number }) => {
      set((current) => {
        if (!current.roomState) return current;
        return {
          roomState: {
            ...current.roomState,
            status: 'COUNTDOWN',
            countdownValue: data.countdownValue,
            seed: data.seed,
          },
        };
      });
    };

    const onPlayerProgress = (data: { userId: string; score: number; level: number; levelsCleared: number; livesRemaining: number; progress: number }) => {
      set((current) => {
        if (!current.roomState) return current;
        const players = current.roomState.players.map((p) => {
          if (p.userId === data.userId) {
            return {
              ...p,
              score: data.score,
              currentLevel: data.level,
              levelsCleared: data.levelsCleared,
              livesRemaining: data.livesRemaining,
              progress: data.progress,
            } as ArrowMazePlayer & { progress?: number };
          }
          return p;
        });
        return { roomState: { ...current.roomState, players } };
      });
    };

    const onGameOver = (data: { results: ArrowMazeMatchStats[] }) => {
      set((current) => {
        if (!current.roomState) return current;
        return {
          roomState: { ...current.roomState, status: 'FINISHED', results: data.results },
          matchResults: data.results,
        };
      });
    };

    socket.on('lobbies_list_response', onLobbiesList);
    socket.on('lobbies_updated', onLobbiesList);
    socket.on('lobby_state', onLobbyState);
    socket.on('game_state', onGameState);
    socket.on('game_started', onGameStarted);
    socket.on('game_countdown', onGameCountdown);
    socket.on('arrowmaze_player_progress', onPlayerProgress);
    socket.on('game_over', onGameOver);

    return () => {
      socket.off('lobbies_list_response', onLobbiesList);
      socket.off('lobbies_updated', onLobbiesList);
      socket.off('lobby_state', onLobbyState);
      socket.off('game_state', onGameState);
      socket.off('game_started', onGameStarted);
      socket.off('game_countdown', onGameCountdown);
      socket.off('arrowmaze_player_progress', onPlayerProgress);
      socket.off('game_over', onGameOver);
    };
  },
}));
