import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { socketService } from '@/lib/socket';
import { getApiUrl } from '@/lib/config';
import type {
  MultiplayerMode,
  LevelCount,
  TimedDuration,
  GameDifficulty,
  ArrowMazeRoomState,
  ArrowMazePlayer,
  ArrowMazeSoloStats,
  ArrowMazeDifficultyStats,
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
    difficulty?: GameDifficulty,
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

const createDefaultDifficultyStats = (): ArrowMazeDifficultyStats => ({
  currentLevel: 1,
  highScore: 0,
  totalScore: 0,
  levelsCleared: 0,
  totalArrowsCleared: 0,
  gamesPlayed: 0,
});

export const useArrowMazeStore = create<ArrowMazeStoreState>()(
  persist(
    (set, get) => ({
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
        byDifficulty: {
          EASY: createDefaultDifficultyStats(),
          MEDIUM: createDefaultDifficultyStats(),
          HARD: createDefaultDifficultyStats(),
        },
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
        if (!userId || userId === 'guest') return;
        try {
          const res = await axios.get(`${getApiUrl()}/api/games/stats/${userId}`);
          if (res.data) {
            const gameStat = Array.isArray(res.data)
              ? res.data.find((s: any) => s.gameType === 'arrow-maze')
              : null;
            if (gameStat) {
              const extra = gameStat.extraStats || {};
              const incomingByDiff = extra.byDifficulty;

              set((prev) => {
                const prevByDiff = prev.soloStats.byDifficulty || {
                  EASY: createDefaultDifficultyStats(),
                  MEDIUM: createDefaultDifficultyStats(),
                  HARD: createDefaultDifficultyStats(),
                };

                const mergedByDiff = {
                  EASY: {
                    currentLevel: Math.max(prevByDiff.EASY?.currentLevel || 1, incomingByDiff?.EASY?.currentLevel || (extra.currentLevel || 1)),
                    highScore: Math.max(prevByDiff.EASY?.highScore || 0, incomingByDiff?.EASY?.highScore || (gameStat.highScore || 0)),
                    totalScore: Math.max(prevByDiff.EASY?.totalScore || 0, incomingByDiff?.EASY?.totalScore || (extra.totalScore || 0)),
                    levelsCleared: Math.max(prevByDiff.EASY?.levelsCleared || 0, incomingByDiff?.EASY?.levelsCleared || (extra.levelsCleared || 0)),
                    totalArrowsCleared: Math.max(prevByDiff.EASY?.totalArrowsCleared || 0, incomingByDiff?.EASY?.totalArrowsCleared || (extra.totalArrowsCleared || 0)),
                    gamesPlayed: Math.max(prevByDiff.EASY?.gamesPlayed || 0, incomingByDiff?.EASY?.gamesPlayed || (extra.gamesPlayed || 0)),
                  },
                  MEDIUM: {
                    currentLevel: Math.max(prevByDiff.MEDIUM?.currentLevel || 1, incomingByDiff?.MEDIUM?.currentLevel || 1),
                    highScore: Math.max(prevByDiff.MEDIUM?.highScore || 0, incomingByDiff?.MEDIUM?.highScore || 0),
                    totalScore: Math.max(prevByDiff.MEDIUM?.totalScore || 0, incomingByDiff?.MEDIUM?.totalScore || 0),
                    levelsCleared: Math.max(prevByDiff.MEDIUM?.levelsCleared || 0, incomingByDiff?.MEDIUM?.levelsCleared || 0),
                    totalArrowsCleared: Math.max(prevByDiff.MEDIUM?.totalArrowsCleared || 0, incomingByDiff?.MEDIUM?.totalArrowsCleared || 0),
                    gamesPlayed: Math.max(prevByDiff.MEDIUM?.gamesPlayed || 0, incomingByDiff?.MEDIUM?.gamesPlayed || 0),
                  },
                  HARD: {
                    currentLevel: Math.max(prevByDiff.HARD?.currentLevel || 1, incomingByDiff?.HARD?.currentLevel || 1),
                    highScore: Math.max(prevByDiff.HARD?.highScore || 0, incomingByDiff?.HARD?.highScore || 0),
                    totalScore: Math.max(prevByDiff.HARD?.totalScore || 0, incomingByDiff?.HARD?.totalScore || 0),
                    levelsCleared: Math.max(prevByDiff.HARD?.levelsCleared || 0, incomingByDiff?.HARD?.levelsCleared || 0),
                    totalArrowsCleared: Math.max(prevByDiff.HARD?.totalArrowsCleared || 0, incomingByDiff?.HARD?.totalArrowsCleared || 0),
                    gamesPlayed: Math.max(prevByDiff.HARD?.gamesPlayed || 0, incomingByDiff?.HARD?.gamesPlayed || 0),
                  },
                };

                return {
                  soloStats: {
                    currentLevel: Math.max(prev.soloStats.currentLevel, extra.currentLevel || 1),
                    highScore: Math.max(prev.soloStats.highScore, gameStat.highScore || 0),
                    totalScore: Math.max(prev.soloStats.totalScore, extra.totalScore || 0),
                    levelsCleared: Math.max(prev.soloStats.levelsCleared, extra.levelsCleared || 0),
                    totalArrowsCleared: Math.max(prev.soloStats.totalArrowsCleared, extra.totalArrowsCleared || 0),
                    gamesPlayed: Math.max(prev.soloStats.gamesPlayed, extra.gamesPlayed || 0),
                    byDifficulty: mergedByDiff,
                  },
                };
              });
            }
          }
        } catch (err) {
          console.warn('Failed to fetch arrow maze stats:', err);
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

      submitSoloProgress: async (userId, currentLevel, totalScore, levelsCleared, totalArrowsCleared, difficulty) => {
        const diffKey = ((difficulty || 'EASY').toUpperCase()) as GameDifficulty;

        // Update local state immediately
        set((prev) => {
          const existingByDiff = prev.soloStats.byDifficulty || {
            EASY: createDefaultDifficultyStats(),
            MEDIUM: createDefaultDifficultyStats(),
            HARD: createDefaultDifficultyStats(),
          };

          const currentDiffStats = existingByDiff[diffKey] || createDefaultDifficultyStats();
          const updatedDiffStats: ArrowMazeDifficultyStats = {
            currentLevel: Math.max(currentDiffStats.currentLevel, currentLevel),
            highScore: Math.max(currentDiffStats.highScore, totalScore),
            totalScore,
            levelsCleared,
            totalArrowsCleared,
            gamesPlayed: (currentDiffStats.gamesPlayed || 0) + 1,
          };

          const newByDiff = {
            ...existingByDiff,
            [diffKey]: updatedDiffStats,
          };

          const globalHighScore = Math.max(
            newByDiff.EASY.highScore,
            newByDiff.MEDIUM.highScore,
            newByDiff.HARD.highScore,
            totalScore
          );
          const globalLevelsCleared = newByDiff.EASY.levelsCleared + newByDiff.MEDIUM.levelsCleared + newByDiff.HARD.levelsCleared;
          const globalArrowsCleared = newByDiff.EASY.totalArrowsCleared + newByDiff.MEDIUM.totalArrowsCleared + newByDiff.HARD.totalArrowsCleared;
          const globalGamesPlayed = newByDiff.EASY.gamesPlayed + newByDiff.MEDIUM.gamesPlayed + newByDiff.HARD.gamesPlayed;

          return {
            soloStats: {
              currentLevel: updatedDiffStats.currentLevel,
              highScore: globalHighScore,
              totalScore,
              levelsCleared: globalLevelsCleared,
              totalArrowsCleared: globalArrowsCleared,
              gamesPlayed: globalGamesPlayed,
              byDifficulty: newByDiff,
            },
          };
        });

        if (!userId || userId === 'guest') return;
        try {
          const currentSolo = get().soloStats;
          await axios.post(`${getApiUrl()}/api/games/save`, {
            userId,
            gameType: 'arrow-maze',
            score: currentSolo.highScore,
            playTimeSeconds: 0,
            extraStats: {
              currentLevel: currentSolo.currentLevel,
              totalScore: currentSolo.totalScore,
              levelsCleared: currentSolo.levelsCleared,
              totalArrowsCleared: currentSolo.totalArrowsCleared,
              gamesPlayed: currentSolo.gamesPlayed,
              byDifficulty: currentSolo.byDifficulty,
            },
          });
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
}),
    {
      name: 'ano_arrow_maze_store',
      partialize: (state) => ({
        soloStats: state.soloStats,
        multiStats: state.multiStats,
        levelCount: state.levelCount,
        timedDuration: state.timedDuration,
        multiplayerMode: state.multiplayerMode,
      }),
    }
  )
);
