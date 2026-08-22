import { create } from 'zustand';
import axios from 'axios';
import { socketService } from '@/lib/socket';
import { getApiUrl } from '@/lib/config';
import type {
  Difficulty,
  MatchDuration,
  GameMode,
  PaperFallRoomState,
  PaperFallPlayer,
  SinglePlayerStats,
  MultiplayerStats,
  MatchHistoryEntry,
  PlayerMatchStats,
} from '@/components/games/paper-fall/types';

interface PaperFallStoreState {
  // Settings
  mode: GameMode;
  difficulty: Difficulty;
  matchDuration: MatchDuration;

  // Stats
  singlePlayerStats: SinglePlayerStats;
  multiplayerStats: MultiplayerStats;
  matchHistory: MatchHistoryEntry[];

  // Multiplayer
  roomState: PaperFallRoomState | null;
  availableLobbies: any[];
  matchResults: PlayerMatchStats[] | null;

  // Actions — Settings
  setMode: (m: GameMode) => void;
  setDifficulty: (d: Difficulty) => void;
  setMatchDuration: (d: MatchDuration) => void;

  // Actions — API
  fetchStats: (userId: string) => Promise<void>;
  submitSinglePlayerScore: (
    userId: string,
    score: number,
    wordsTyped: number,
    playTimeSeconds: number,
    nickname?: string,
    avatar?: string | null,
  ) => Promise<{ highScore: number } | null>;

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
  sendWordTyped: (gameId: string, userId: string, word: string, score: number) => void;
  sendFinished: (gameId: string, userId: string, stats: PlayerMatchStats) => void;

  // Socket init
  initLobbySockets: (userId: string) => () => void;
}

export const usePaperFallStore = create<PaperFallStoreState>((set, get) => ({
  mode: 'SURVIVAL',
  difficulty: 'MEDIUM',
  matchDuration: 60,

  singlePlayerStats: {
    highScore: 0,
    gamesPlayed: 0,
    wordsTyped: 0,
    timeSurvivedSeconds: 0,
    averageWpm: 0,
    bestWpm: 0,
    averageAccuracy: 0,
  },
  multiplayerStats: {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    highScore: 0,
    wordsTyped: 0,
    bestWpm: 0,
  },
  matchHistory: [],
  roomState: null,
  availableLobbies: [],
  matchResults: null,

  setMode: (mode) => set({ mode }),
  setDifficulty: (d) => set({ difficulty: d }),
  setMatchDuration: (d) => set({ matchDuration: d }),

  fetchStats: async (userId) => {
    if (!userId) return;
    try {
      const res = await axios.get(`${getApiUrl()}/api/games/stats/${userId}`);
      if (res.data) {
        const gameStat = Array.isArray(res.data)
          ? res.data.find((s: any) => s.gameType === 'paper-fall')
          : null;
        if (gameStat) {
          set({
            singlePlayerStats: {
              highScore: gameStat.highScore || 0,
              gamesPlayed: gameStat.gamesPlayed || 0,
              wordsTyped: gameStat.wordsTyped || 0,
              timeSurvivedSeconds: gameStat.totalPlayTimeSeconds || 0,
              averageWpm: gameStat.averageWpm || 0,
              bestWpm: gameStat.bestWpm || 0,
              averageAccuracy: gameStat.averageAccuracy || 0,
            },
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch paperfall stats:', err);
    }
  },

  submitSinglePlayerScore: async (userId, score, wordsTyped, playTimeSeconds, nickname, avatar) => {
    if (!userId) return null;
    const defaultRewards = { highScore: Math.max(score, get().singlePlayerStats.highScore || 0) };
    try {
      const res = await axios.post(`${getApiUrl()}/api/games/save`, {
        userId,
        gameType: 'paper-fall',
        score,
        playTimeSeconds,
        nickname: nickname || 'Player',
        avatar,
      });
      if (res.data) {
        get().fetchStats(userId);
        return { highScore: res.data.highScore ?? defaultRewards.highScore };
      }
    } catch (err) {
      console.warn('Score submit warning:', err);
    }
    return defaultRewards;
  },

  // Socket Actions
  createLobby: (userId, nickname) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('lobby_create', { gameType: 'PAPER_FALL', userId, nickname });
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
      targetUserId, gameType: 'PAPER_FALL',
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
    socket.emit('paperfall_return_to_lobby', { gameId, userId });
  },

  resetLobby: (gameId) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('paperfall_reset_lobby', { gameId });
  },

  sendProgress: (gameId, userId, data) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('paperfall_progress', { gameId, userId, ...data });
  },

  sendWordTyped: (gameId, userId, word, score) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('paperfall_word_typed', { gameId, userId, word, score });
  },

  sendFinished: (gameId, userId, stats) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.emit('paperfall_finished', { gameId, userId, stats });
  },

  initLobbySockets: (userId) => {
    const socket = socketService.getSocket();
    if (!socket) return () => {};

    socket.emit('lobbies_list');

    const onLobbiesList = (lobbies: any[]) => {
      const filtered = lobbies.filter((l) => l.gameType === 'PAPER_FALL');
      set({ availableLobbies: filtered });
    };

    const onLobbyState = (state: any) => {
      if (state && state.gameType === 'PAPER_FALL') {
        set({
          roomState: {
            id: state.id,
            hostId: state.hostId,
            gameType: 'PAPER_FALL',
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
              wordsTyped: p.wordsTyped ?? 0,
              currentLevel: p.currentLevel ?? 1,
              wpm: p.wpm ?? 0,
              accuracy: p.accuracy ?? 100,
              progress: p.progress ?? 0,
              rank: p.rank,
            })),
            seed: state.seed ?? Math.floor(Math.random() * 1000000),
            startTime: state.startTime ?? null,
            countdownValue: state.countdownValue ?? null,
            settings: state.settings || { difficulty: 'MEDIUM', matchDuration: 300, maxPlayers: 8 },
            results: state.results,
          },
        });
      }
    };

    const onGameState = (state: any) => {
      if (state && (state.gameType === 'PAPER_FALL')) {
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
                wordsTyped: p.wordsTyped ?? 0,
                currentLevel: p.currentLevel ?? 1,
                wpm: p.wpm ?? 0,
                accuracy: p.accuracy ?? 100,
                progress: p.progress ?? 0,
                rank: p.rank,
              }))
            : existingRoom?.players || [];

          return {
            roomState: {
              id: state.gameId || existingRoom?.id || '',
              hostId: existingRoom?.hostId || state.hostId || '',
              gameType: 'PAPER_FALL',
              status: state.status || 'LOBBY',
              players: updatedPlayers,
              seed: state.seed ?? existingRoom?.seed ?? Math.floor(Math.random() * 1000000),
              startTime: state.startTime ?? null,
              countdownValue: state.countdownValue ?? null,
              settings: state.settings || existingRoom?.settings || { difficulty: 'MEDIUM', matchDuration: 300, maxPlayers: 8 },
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

    const onPlayerProgress = (data: { userId: string; score: number; wpm: number; accuracy: number; level: number; wordsTyped: number; status?: string }) => {
      set((current) => {
        if (!current.roomState) return current;
        const players = current.roomState.players.map((p) => {
          if (p.userId === data.userId) {
            return {
              ...p,
              score: data.score,
              wpm: data.wpm,
              accuracy: data.accuracy,
              currentLevel: data.level,
              wordsTyped: data.wordsTyped,
              status: (data.status as any) || p.status,
            };
          }
          return p;
        });
        return { roomState: { ...current.roomState, players } };
      });
    };

    const onPlayerFinished = (data: { userId: string; nickname?: string; score?: number }) => {
      set((current) => {
        if (!current.roomState) return current;
        const players = current.roomState.players.map((p) => {
          if (p.userId === data.userId) {
            return { ...p, status: 'FINISHED' as const, score: data.score ?? p.score };
          }
          return p;
        });
        return { roomState: { ...current.roomState, players } };
      });
    };

    const onGameOver = (data: { results: PlayerMatchStats[] }) => {
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
    socket.on('paperfall_player_progress', onPlayerProgress);
    socket.on('paperfall_player_finished', onPlayerFinished);
    socket.on('game_over', onGameOver);

    return () => {
      socket.off('lobbies_list_response', onLobbiesList);
      socket.off('lobbies_updated', onLobbiesList);
      socket.off('lobby_state', onLobbyState);
      socket.off('game_state', onGameState);
      socket.off('game_started', onGameStarted);
      socket.off('game_countdown', onGameCountdown);
      socket.off('paperfall_player_progress', onPlayerProgress);
      socket.off('paperfall_player_finished', onPlayerFinished);
      socket.off('game_over', onGameOver);
    };
  },
}));
