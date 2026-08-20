"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';
import { useFlappyStore } from '@/store/useFlappyStore';
import { FlappyCore } from './engine/FlappyCore';
import { PhysicsEngine } from './engine/PhysicsEngine';
import { BirdSkin, GameStatus, PipeStyle, ThemeType, WeatherType } from './engine/types';
import { socketService } from '@/lib/socket';
import { copyToClipboard } from '@/lib/clipboard';
import { useInviteCooldown } from '@/hooks/useInviteCooldown';
import {
  Trophy,
  Award,
  Settings,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Users,
  UserPlus,
  ArrowLeft,
  Copy,
  Check,
  UserX,
  Shield,
  Sparkles,
  Zap,
  Palette,
  CloudRain,
  Eye,
  BarChart3,
  History,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export function FlappyGameHub() {
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get('gameId');

  const userId = useUserStore((s) => s.id) || '';
  const nickname = useUserStore((s) => s.nickname) || 'Player';
  const avatar = useUserStore((s) => s.avatar);

  const {
    selectedTheme,
    setTheme,
    selectedSkin,
    setSkin,
    selectedWeather,
    setWeather,
    selectedPipeStyle,
    setPipeStyle,
    soundVolume,
    isMuted,
    toggleMute,
    singlePlayerStats,
    multiplayerStats,
    matchHistory,
    achievements,
    leaderboard,
    roomState,
    availableLobbies,
    fetchStats,
    submitSinglePlayerScore,
    fetchLeaderboard,
    createLobby,
    joinLobby,
    toggleReady,
    kickPlayer,
    invitePlayer,
    updateSettings,
    startMatch,
    requestPlayAgain,
    spectateMatch,
    returnToLobby,
    resetLobby,
    leaveLobby,
    fetchLobbies,
    initLobbySockets
  } = useFlappyStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coreRef = useRef<FlappyCore | null>(null);

  // Active View Tab: 'MENU' | 'SINGLEPLAYER' | 'MULTIPLAYER_LOBBY' | 'MULTIPLAYER_MATCH'
  const [activeView, setActiveView] = useState<'MENU' | 'SINGLEPLAYER' | 'MULTIPLAYER_LOBBY' | 'MULTIPLAYER_MATCH'>('MENU');

  // Use refs to avoid recreating FlappyCore when activeView or roomState changes
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;

  const roomStateRef = useRef(roomState);
  roomStateRef.current = roomState;

  // Game UI State
  const [gameStatus, setGameStatus] = useState<GameStatus>('IDLE');
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [countdownVal, setCountdownVal] = useState<number | null>(null);

  // Modals State
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showAchievements, setShowAchievements] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showCustomization, setShowCustomization] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Leaderboard Mode Filter
  const [leaderboardFilter, setLeaderboardFilter] = useState<'SINGLEPLAYER' | 'MULTIPLAYER'>('SINGLEPLAYER');

  // Online Friends for Invite Modal
  const [onlineFriends, setOnlineFriends] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());

  // Spectator mode target index
  const [spectatorIndex, setSpectatorIndex] = useState<number>(0);

  // Rewards Popup after game over
  const [lastRewards, setLastRewards] = useState<{
    score: number;
    highScore: number;
  } | null>(null);

  // Initialize engine & sockets
  useEffect(() => {
    if (userId) {
      fetchStats(userId);
      fetchLeaderboard();
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      const cleanup = initLobbySockets(userId);
      return () => cleanup();
    }
  }, [userId]);

  // Handle URL Game Invite Param (?gameId=XYZ)
  useEffect(() => {
    if (gameIdParam && userId && nickname && !roomState) {
      setActiveView('MULTIPLAYER_LOBBY');
      initLobbySockets(userId);
      const socket = socketService.getSocket();
      const doJoin = () => {
        joinLobby(gameIdParam, userId, nickname);
      };
      if (socket?.connected) {
        doJoin();
      } else if (socket) {
        socket.once('connect', doJoin);
        const timer = setTimeout(doJoin, 500);
        return () => {
          socket.off('connect', doJoin);
          clearTimeout(timer);
        };
      }
    }
  }, [gameIdParam, userId, nickname, roomState, initLobbySockets, joinLobby]);

  // Fetch online friends for invite modal
  useEffect(() => {
    if (!userId || !showInviteModal) return;

    const getApiUrl = () => {
      if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
      if (typeof window !== 'undefined') return `http://${window.location.hostname}:3001`;
      return 'http://localhost:3001';
    };
    const API_URL = getApiUrl();

    fetch(`${API_URL}/api/users/online`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOnlineFriends(data.filter((u) => u.id !== userId));
        }
      })
      .catch(console.error);
  }, [userId, showInviteModal]);

  // Track explicit return to lobby user action
  const [hasReturnedToLobby, setHasReturnedToLobby] = useState(false);

  const startMultiplayerGameSession = (seed: number) => {
    setLastRewards(null);
    setCurrentScore(0);
    const activeRoom = roomState || roomStateRef.current;
    if (coreRef.current && activeRoom) {
      coreRef.current.mode = 'MULTIPLAYER';

      const opponents = activeRoom.players
        .filter((p) => p.userId !== userId)
        .map((p) => ({
          id: p.userId,
          nickname: p.nickname
        }));
      coreRef.current.setOpponentBirds(opponents);
      coreRef.current.startMatch(seed);
    }
  };

  // Handle Room State changes for Multiplayer Match Transition
  useEffect(() => {
    if (roomState) {
      if ((roomState.status === 'PLAYING' || roomState.status === 'COUNTDOWN')) {
        if (!hasReturnedToLobby && activeView !== 'MULTIPLAYER_MATCH') {
          const myP = roomState.players.find((p) => p.userId === userId);
          if (!myP || (myP.status !== 'RETURNED_TO_LOBBY' && myP.status !== 'DEAD' && myP.status !== 'SPECTATING')) {
            setActiveView('MULTIPLAYER_MATCH');
            startMultiplayerGameSession(roomState.seed);
          }
        }
      } else if (roomState.status === 'LOBBY' || (roomState.status as string) === 'WAITING') {
        setHasReturnedToLobby(false);
        if (activeView !== 'MULTIPLAYER_LOBBY') {
          setActiveView('MULTIPLAYER_LOBBY');
          setGameStatus('IDLE');
        }
      } else if (roomState.status === 'FINISHED') {
        setGameStatus('GAMEOVER');
      }
    }
  }, [roomState, activeView, userId, hasReturnedToLobby]);

  // Initialize Flappy Core Game Instance once
  useEffect(() => {
    const core = new FlappyCore({
      onScoreUpdate: (score) => setCurrentScore(score),
      onCountdownTick: (val) => setCountdownVal(val),
      onStatusChange: (status) => setGameStatus(status),
      onJump: (birdId, y, vy) => {
        if (activeViewRef.current === 'MULTIPLAYER_MATCH' && roomStateRef.current) {
          const socket = socketService.getSocket();
          if (socket) {
            socket.emit('flappy_jump', { gameId: roomStateRef.current.id, userId, y, vy });
          }
        }
      },
      onBirdDeath: (bird) => {
        if (activeViewRef.current === 'MULTIPLAYER_MATCH' && roomStateRef.current) {
          const socket = socketService.getSocket();
          if (socket) {
            socket.emit('flappy_death', {
              gameId: roomStateRef.current.id,
              userId,
              score: bird.score,
              timeSurvived: bird.timeSurvivedSeconds
            });
          }
        }
      },
      onGameOver: async (finalScore, timeSurvived) => {
        if (activeViewRef.current === 'SINGLEPLAYER' && userId) {
          const res = await submitSinglePlayerScore(
            userId,
            finalScore,
            finalScore,
            timeSurvived,
            nickname,
            avatar
          );
          if (res) {
            setLastRewards({
              score: finalScore,
              highScore: res.highScore
            });
          }
        }
      }
    });

    coreRef.current = core;
    core.theme = selectedTheme;
    core.skin = selectedSkin;
    core.weather = selectedWeather;
    core.pipeStyle = selectedPipeStyle;
    core.audioEngine.setMuted(isMuted);
    core.audioEngine.setVolume(soundVolume);
    core.initLocalBird(userId, nickname, avatar);

    // Socket Listeners for Multiplayer Jumps & Deaths
    const socket = socketService.getSocket();
    if (socket) {
      const onRemoteJump = (data: { userId: string; y: number; vy: number }) => {
        if (coreRef.current && data.userId !== userId) {
          coreRef.current.updateRemoteBird(data.userId, data.y, data.vy);
        }
      };

      const onRemoteDeath = (data: { userId: string; score: number }) => {
        if (coreRef.current && data.userId !== userId) {
          coreRef.current.updateRemoteBird(data.userId, -1, 0, data.score, false);
        }
        useFlappyStore.setState((state) => {
          if (!state.roomState) return state;
          return {
            roomState: {
              ...state.roomState,
              players: state.roomState.players.map((p) =>
                p.userId === data.userId ? { ...p, isAlive: false, status: 'DEAD' } : p
              )
            }
          };
        });
      };

      const onStartMatch = (data: { seed: number }) => {
        setActiveView('MULTIPLAYER_MATCH');
        startMultiplayerGameSession(data.seed);
      };

      const onGameOver = (data: any) => {
        setGameStatus('GAMEOVER');
      };

      socket.on('flappy_jump', onRemoteJump);
      socket.on('flappy_death', onRemoteDeath);
      socket.on('flappy_start_match', onStartMatch);
      socket.on('game_started', onStartMatch);
      socket.on('game_over', onGameOver);

      return () => {
        socket.off('flappy_jump', onRemoteJump);
        socket.off('flappy_death', onRemoteDeath);
        socket.off('flappy_start_match', onStartMatch);
        socket.off('game_started', onStartMatch);
        socket.off('game_over', onGameOver);
        core.stopLoop();
      };
    }

    return () => {
      core.stopLoop();
    };
  }, [userId, nickname, avatar]);

  // Sync cosmetics, theme & sound settings to core & renderer
  useEffect(() => {
    if (coreRef.current) {
      coreRef.current.theme = selectedTheme;
      coreRef.current.skin = selectedSkin;
      coreRef.current.weather = selectedWeather;
      coreRef.current.pipeStyle = selectedPipeStyle;
      coreRef.current.audioEngine.setMuted(isMuted);
      coreRef.current.audioEngine.setVolume(soundVolume);
      const local = coreRef.current.birds.get(coreRef.current.localBirdId);
      if (local) {
        local.skin = selectedSkin;
      }
    }
  }, [selectedTheme, selectedSkin, selectedWeather, selectedPipeStyle, isMuted, soundVolume]);

  // Start loop on Canvas element mount
  useEffect(() => {
    if (canvasRef.current && coreRef.current && (activeView === 'SINGLEPLAYER' || activeView === 'MULTIPLAYER_MATCH')) {
      coreRef.current.startLoop(canvasRef.current);
    }
    return () => {
      coreRef.current?.stopLoop();
    };
  }, [activeView]);

  // Singleplayer Start
  const startSinglePlayerGame = () => {
    setActiveView('SINGLEPLAYER');
    setLastRewards(null);
    setCurrentScore(0);
    if (coreRef.current) {
      coreRef.current.mode = 'SINGLEPLAYER';
      coreRef.current.clearOpponentBirds();
      coreRef.current.startMatch();
    }
  };

  const triggerJumpOrStart = () => {
    if (!coreRef.current) return;
    const core = coreRef.current;
    if (activeView === 'SINGLEPLAYER') {
      if (core.status === 'IDLE' || core.status === 'GAMEOVER') {
        startSinglePlayerGame();
      } else if (core.status === 'PLAYING') {
        core.jumpLocalBird();
      }
    } else if (activeView === 'MULTIPLAYER_MATCH') {
      const localBird = core.birds.get(core.localBirdId);
      if (core.status === 'PLAYING' && localBird && localBird.isAlive) {
        core.jumpLocalBird();
      }
    }
  };

  // User Controls: Keyboard (Spacebar / ArrowUp / W / R) & Mouse / Touch
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      
      const isControlKey =
        e.code === 'Space' || e.key === ' ' ||
        e.code === 'ArrowUp' || e.key === 'ArrowUp' ||
        e.code === 'KeyW' || e.key === 'w' || e.key === 'W' ||
        e.code === 'KeyR' || e.key === 'r' || e.key === 'R';

      if (isControlKey) {
        const activeEl = document.activeElement;
        const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
        if (!isInputFocused) {
          e.preventDefault();
          triggerJumpOrStart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, userId]);

  const lastTouchTimeRef = useRef(0);

  const handleCanvasClick = () => {
    if (Date.now() - lastTouchTimeRef.current < 400) {
      return;
    }
    triggerJumpOrStart();
  };

  const handleCanvasTouchStart = (e?: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    if (e && e.preventDefault) e.preventDefault();
    triggerJumpOrStart();
  };

  // Copy Lobby Invite Link
  const copyInviteLink = async () => {
    if (!roomState) return;
    const url = `${window.location.origin}/dashboard/games/flappy-bird?gameId=${roomState.id}`;
    const success = await copyToClipboard(url);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const { triggerInvite, getInviteStatus } = useInviteCooldown(roomState?.id);

  // Handle Send Friend Invite Notification
  const handleSendInvite = (targetUserId: string) => {
    if (!roomState) return;
    invitePlayer(roomState.id, userId, nickname, targetUserId, 'FLAPPY_BIRD');
    triggerInvite(targetUserId);
  };

  const myPlayerInMP = roomState?.players.find((p) => p.userId === userId);
  const isLocalDeadInMP = activeView === 'MULTIPLAYER_MATCH' && !!myPlayerInMP && (!myPlayerInMP.isAlive || myPlayerInMP.status === 'DEAD');
  const aliveMPPlayers = roomState?.players.filter((p) => p.isAlive || p.status === 'PLAYING') || [];

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto p-2 sm:p-4 text-white">
      {/* ──── TOP NAVIGATION HEADER ──── */}
      <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-3 mb-4 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          {activeView !== 'MENU' ? (
            <button
              onClick={() => {
                if (roomState) leaveLobby(userId);
                setActiveView('MENU');
              }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white/80 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <Link
              href="/dashboard/games"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white/80 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}

          <div className="flex items-center gap-2">
            <span className="text-2xl">🐤</span>
            <div>
              <h1 className="font-extrabold text-lg sm:text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-500">
                Flappy Bird
              </h1>
              <p className="text-xs text-white/50 hidden sm:block">
                {activeView === 'MULTIPLAYER_MATCH' ? 'Multiplayer Match' : activeView === 'SINGLEPLAYER' ? 'Single Player' : 'Ano Arcade'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCustomization(true)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-400 hover:scale-105 active:scale-95 transition-all"
            title="Skins & Wardrobe"
          >
            <Palette className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowLeaderboard(true)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-yellow-400 hover:scale-105 active:scale-95 transition-all"
            title="Leaderboards"
          >
            <Trophy className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white hover:scale-105 active:scale-95 transition-all"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ──── MAIN MENU ──── */}
      {activeView === 'MENU' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 my-auto p-4">
          <div className="text-center space-y-2">
            <div className="inline-block p-4 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-600/30 border border-amber-500/30 shadow-2xl animate-bounce">
              <span className="text-6xl sm:text-7xl">🐤</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white drop-shadow-md">
              FLAPPY BIRD
            </h2>
            <p className="text-white/60 text-sm max-w-sm mx-auto">
              Fly, dodge pipes, and compete with friends in real-time multiplayer!
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-6 px-6 py-3 bg-white/5 border border-white/10 rounded-full backdrop-blur-md shadow-inner text-sm">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-white/70">Best:</span>
              <span className="font-bold text-white">{singlePlayerStats.highScore}</span>
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-white/70">Played:</span>
              <span className="font-bold text-white">{singlePlayerStats.gamesPlayed}</span>
            </div>
          </div>

          {/* Mode Selection Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
            <button
              onClick={startSinglePlayerGame}
              className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-extrabold text-lg rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-black/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 fill-current text-black" />
              </div>
              Single Player
              <span className="text-xs font-medium text-black/70 mt-1">Classic solo run</span>
            </button>

            <button
              onClick={() => {
                setActiveView('MULTIPLAYER_LOBBY');
                fetchLobbies();
              }}
              className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white font-extrabold text-lg rounded-2xl shadow-xl border border-indigo-400/30 hover:scale-105 active:scale-95 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-white" />
              </div>
              Multiplayer Lobby
              <span className="text-xs font-medium text-white/70 mt-1">Ano Multiplayer Hub</span>
            </button>
          </div>
        </div>
      )}

      {/* ──── SINGLEPLAYER / MULTIPLAYER GAME CANVAS ──── */}
      {(activeView === 'SINGLEPLAYER' || activeView === 'MULTIPLAYER_MATCH') && (
        <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
          {/* Top In-Game Live HUD */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
            <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-3">
              <span className="text-xs text-white/60 uppercase tracking-wider font-semibold">Score</span>
              <span className="text-2xl font-black text-yellow-400">{currentScore}</span>
            </div>

            {/* Multiplayer Alive Counter */}
            {activeView === 'MULTIPLAYER_MATCH' && roomState && (
              <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-white/80 font-bold">
                  Alive: {aliveMPPlayers.length} / {roomState.players.length}
                </span>
              </div>
            )}
          </div>

          {/* Interactive HTML5 Canvas Container */}
          <div className="relative w-full max-w-[480px] aspect-[3/4] max-h-[640px] rounded-3xl overflow-hidden shadow-2xl border border-white/20 cursor-pointer select-none group">
            <canvas
              ref={canvasRef}
              width={PhysicsEngine.CANVAS_WIDTH}
              height={PhysicsEngine.CANVAS_HEIGHT}
              onClick={handleCanvasClick}
              onTouchStart={handleCanvasTouchStart}
              className="w-full h-full object-cover"
            />

            {/* Start Tap Overlay for Single Player */}
            {gameStatus === 'IDLE' && (
              <div
                onClick={handleCanvasClick}
                onTouchStart={handleCanvasTouchStart}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs text-center p-6 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-amber-400 text-black flex items-center justify-center mb-4 shadow-lg animate-pulse">
                  <Play className="w-8 h-8 fill-current ml-1" />
                </div>
                <h3 className="text-2xl font-black text-white mb-1">TAP OR PRESS SPACE</h3>
                <p className="text-xs text-white/70">To flap wings and start flying</p>
              </div>
            )}

            {/* Spectator Mode HUD when player dies in Multiplayer */}
            {isLocalDeadInMP && (
              <div className="absolute bottom-4 left-4 right-4 z-20 bg-black/80 backdrop-blur-md p-3 rounded-2xl border border-white/15 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-cyan-300 font-bold">
                  <Eye className="w-4 h-4" /> Spectating: {aliveMPPlayers[spectatorIndex]?.nickname || 'Match'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSpectatorIndex((prev) => (prev > 0 ? prev - 1 : aliveMPPlayers.length - 1));
                    }}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white"
                    title="Previous Player"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSpectatorIndex((prev) => (prev < aliveMPPlayers.length - 1 ? prev + 1 : 0));
                    }}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white"
                    title="Next Player"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setHasReturnedToLobby(true);
                      const currentRoomId = roomState?.id;
                      if (currentRoomId) {
                        returnToLobby(currentRoomId, userId);
                      }
                      // Clear roomState so player sees lobby browser (not stale game data)
                      // Server will send fresh lobby_state when game ends
                      useFlappyStore.setState({ roomState: null });
                      setActiveView('MULTIPLAYER_LOBBY');
                      setGameStatus('IDLE');
                    }}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold flex items-center gap-1 active:scale-95 transition-all text-xs ml-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Return to Lobby
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Game Over Rewards Modal */}
          {((activeView === 'SINGLEPLAYER' && gameStatus === 'GAMEOVER') || (activeView === 'MULTIPLAYER_MATCH' && roomState?.status === 'FINISHED')) && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
              <div className="bg-gradient-to-b from-neutral-900 to-black border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl space-y-6">
                <div className="inline-block p-4 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400">
                  <Trophy className="w-10 h-10" />
                </div>

                <div>
                  <h3 className="text-2xl font-black text-white">
                    {roomState && roomState.results && roomState.results.length > 0 ? (
                      roomState.results.find(r => r.rank === 1)?.userId === userId ? '🏆 YOU WON!' : 'MATCH ENDED'
                    ) : 'GAME OVER'}
                  </h3>
                  <p className="text-xs text-white/50">
                    {lastRewards ? 'Great effort! Here is your payout:' : 'Match ended!'}
                  </p>
                </div>

                {roomState && roomState.results && roomState.results.length > 0 ? (
                  <div className="space-y-2 bg-white/5 p-3 rounded-2xl border border-white/10 text-xs text-left max-h-36 overflow-y-auto">
                    <span className="font-bold text-white/60 uppercase block text-[10px]">Final Match Standings</span>
                    {roomState.results.map((res) => {
                      const player = roomState.players.find(p => p.userId === res.userId);
                      return (
                        <div key={res.userId} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                          <span className="font-bold text-white">#{res.rank} {player?.nickname || 'Player'}</span>
                          <span className="font-mono text-amber-400">{res.score} pts</span>
                        </div>
                      );
                    })}
                  </div>
                ) : lastRewards ? (
                  <div className="grid grid-cols-2 gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                    <div className="bg-white/5 p-3 rounded-xl">
                      <span className="text-xs text-white/60 block">Score</span>
                      <span className="text-2xl font-black text-amber-400">{lastRewards.score}</span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl">
                      <span className="text-xs text-white/60 block">High Score</span>
                      <span className="text-2xl font-black text-yellow-300">{lastRewards.highScore}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                    <span className="text-xs text-white/60 block">Final Score</span>
                    <span className="text-3xl font-black text-amber-400">{currentScore}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setActiveView('MENU')}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl active:scale-95 transition-all text-sm"
                  >
                    Main Menu
                  </button>
                  <button
                    onClick={() => {
                      if (activeView === 'SINGLEPLAYER') {
                        startSinglePlayerGame();
                      } else if (roomState) {
                        returnToLobby(roomState.id, userId);
                        resetLobby(roomState.id);
                        setActiveView('MULTIPLAYER_LOBBY');
                        setGameStatus('IDLE');
                      } else {
                        setActiveView('MULTIPLAYER_LOBBY');
                        setGameStatus('IDLE');
                      }
                    }}
                    className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-xl shadow-lg active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" /> {roomState ? "Return to Lobby" : "Play Again"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──── MULTIPLAYER LOBBY (ANO STANDARD UX) ──── */}
      {activeView === 'MULTIPLAYER_LOBBY' && (
        <div className="flex-1 flex flex-col md:flex-row gap-6 max-w-5xl mx-auto w-full my-auto">
          {!roomState ? (
            <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" /> Multiplayer Lobby Browser
                  </h3>
                  <button
                    onClick={() => fetchLobbies()}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl text-xs flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>

                <div className="mb-6">
                  <button
                    onClick={() => createLobby(userId, nickname)}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-base"
                  >
                    + Create Game Lobby
                  </button>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3">
                    Available Lobbies ({availableLobbies.length})
                  </h4>
                  {availableLobbies.length === 0 ? (
                    <div className="p-8 text-center bg-white/5 border border-white/10 rounded-2xl">
                      <p className="text-xs text-white/40 italic mb-2">No public game lobbies open right now.</p>
                      <p className="text-xs text-indigo-400 font-semibold">Create one above to start a lobby!</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {availableLobbies.map((l) => (
                        <div
                          key={l.id}
                          className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap select-text">
                              <span className="font-bold text-white text-sm">Host: {l.hostName || 'Player'}</span>
                              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[10px] font-mono font-bold">
                                #{l.id}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-white/50">
                              <span>Players: {l.playerCount || l.players?.length || 1} / {l.maxPlayers || 8}</span>
                              <span>Mode: Flappy Battle</span>
                            </div>
                          </div>

                          <button
                            onClick={() => joinLobby(l.id, userId, nickname)}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl active:scale-95 transition-all"
                          >
                            Join Lobby
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 backdrop-blur-xl flex flex-col justify-between space-y-6 overflow-hidden">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 max-w-full overflow-hidden">
                      <h3 className="text-base sm:text-2xl font-black text-white font-mono truncate max-w-[200px] sm:max-w-md select-text" title={roomState.id}>
                        #{roomState.id}
                      </h3>
                      <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[10px] font-bold uppercase shrink-0">
                        Flappy Battle
                      </span>
                    </div>
                    <p className="text-xs text-white/60 mt-0.5">Ano Real-Time Multiplayer Lobby</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={copyInviteLink}
                      className="px-2.5 sm:px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span className="hidden sm:inline">{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                      <span className="sm:hidden">{copiedLink ? 'Copied' : 'Link'}</span>
                    </button>

                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="px-2.5 sm:px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
                    >
                      <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Invite Friends</span><span className="sm:hidden">Invite</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wider">
                    Lobby Players ({roomState.players.length} / 8)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {roomState.players.map((p) => {
                      const isHost = p.userId === roomState.hostId;
                      const isSelf = p.userId === userId;

                      return (
                        <div
                          key={p.userId}
                          className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-2xl text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-extrabold text-white shadow-md">
                              {p.nickname.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white text-sm">{p.nickname}</span>
                                {isHost && (
                                  <span title="Lobby Host">
                                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-white/50">{isSelf ? 'You' : isHost ? 'Lobby Host' : 'Player'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {p.isReady ? (
                              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black flex items-center gap-1">
                                READY
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-white/5 text-white/40 border border-white/10 rounded-lg text-[10px] font-bold">
                                WAITING
                              </span>
                            )}

                            {roomState.hostId === userId && !isSelf && (
                              <button
                                onClick={() => kickPlayer(roomState.id, userId, p.userId)}
                                className="p-1 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                                title="Kick player"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pt-4 border-t border-white/10">
                {roomState.hostId === userId ? (
                  <button
                    onClick={() => startMatch(roomState.id, userId)}
                    className="flex-1 py-3 sm:py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-extrabold rounded-xl shadow-xl active:scale-95 transition-all text-sm sm:text-base flex items-center justify-center gap-2"
                  >
                    🚀 Start Game Match
                  </button>
                ) : (
                  <button
                    onClick={() => toggleReady(roomState.id, userId)}
                    className="flex-1 py-3 sm:py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-xl active:scale-95 transition-all text-sm sm:text-base"
                  >
                    Toggle Ready
                  </button>
                )}

                <button
                  onClick={() => leaveLobby(userId)}
                  className="px-4 sm:px-5 py-2.5 sm:py-3.5 bg-red-500/20 border border-red-500/40 text-red-300 font-bold text-xs sm:text-sm rounded-xl hover:bg-red-500/30 active:scale-95 transition-all text-center"
                >
                  Leave Lobby
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──── COSMETICS & WARDROBE MODAL ──── */}
      {showCustomization && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-neutral-900 border border-white/15 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
                <Palette className="w-5 h-5" /> Bird Skins & Wardrobe
              </h3>
              <button onClick={() => setShowCustomization(false)} className="text-white/60 hover:text-white">
                ✕
              </button>
            </div>

            {/* Bird Skin Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase">Bird Skin</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CLASSIC', name: 'Classic 🐤' },
                  { id: 'PHOENIX', name: 'Phoenix 🔥' },
                  { id: 'ROBO', name: 'Robo 🤖' },
                  { id: 'BLUEJAY', name: 'Blue Jay 🐦' },
                  { id: 'EAGLE', name: 'Eagle 🦅' },
                  { id: 'BAT', name: 'Bat 🦇' }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSkin(s.id as BirdSkin)}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all ${selectedSkin === s.id ? 'bg-cyan-500 text-black border-cyan-400 shadow-md' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Pipe Style Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase">Pipe Style</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CLASSIC', name: 'Green 🟩' },
                  { id: 'NEON', name: 'Neon 🟪' },
                  { id: 'BAMBOO', name: 'Bamboo 🎋' },
                  { id: 'LAVA', name: 'Lava 🌋' },
                  { id: 'GOLDEN', name: 'Gold 🪙' }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPipeStyle(p.id as PipeStyle)}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all ${selectedPipeStyle === p.id ? 'bg-amber-400 text-black border-amber-400 shadow-md' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Weather Effects Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase">Weather Effect</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'NONE', name: 'Off ☀️' },
                  { id: 'RAIN', name: 'Rain 🌧️' },
                  { id: 'SNOW', name: 'Snow ❄️' },
                  { id: 'FOG', name: 'Fog 🌫️' }
                ].map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setWeather(w.id as WeatherType)}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all ${selectedWeather === w.id ? 'bg-indigo-500 text-white border-indigo-400 shadow-md' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowCustomization(false)}
              className="w-full py-3 bg-white text-black font-extrabold rounded-xl hover:bg-neutral-200"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ──── STATISTICS & MATCH HISTORY MODAL ──── */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-neutral-900 border border-white/15 rounded-3xl p-6 max-w-lg w-full text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2 text-emerald-400">
                <BarChart3 className="w-5 h-5" /> Player Statistics & History
              </h3>
              <button onClick={() => setShowStatsModal(false)} className="text-white/60 hover:text-white">
                ✕
              </button>
            </div>

            {/* Single Player Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 text-xs">
              <div className="text-center">
                <span className="text-white/50 block">High Score</span>
                <span className="text-xl font-black text-amber-400">{singlePlayerStats.highScore}</span>
              </div>
              <div className="text-center">
                <span className="text-white/50 block">Avg Score</span>
                <span className="text-xl font-black text-cyan-400">{singlePlayerStats.averageScore || 0}</span>
              </div>
              <div className="text-center">
                <span className="text-white/50 block">Total Played</span>
                <span className="text-xl font-black text-indigo-300">{singlePlayerStats.gamesPlayed}</span>
              </div>
            </div>

            {/* Match History List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-400" /> Recent Matches ({matchHistory.length})
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {matchHistory.length === 0 ? (
                  <p className="text-center text-xs text-white/40 py-6 italic">No match history recorded yet.</p>
                ) : (
                  matchHistory.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">{m.mode} Run</span>
                        <span className="text-[10px] text-white/40 block">
                          {new Date(m.date).toLocaleDateString()} • {m.timeSurvivedSeconds}s survival
                        </span>
                      </div>
                      <span className="font-black text-amber-400 text-sm">{m.score} pts</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => setShowStatsModal(false)}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ──── INVITE ONLINE FRIENDS MODAL ──── */}
      {showInviteModal && roomState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-neutral-900 border border-white/15 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
                <UserPlus className="w-5 h-5" /> Invite Online Friends
              </h3>
              <button onClick={() => setShowInviteModal(false)} className="text-white/60 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {onlineFriends.length === 0 ? (
                <div className="p-6 text-center text-xs text-white/40 italic">
                  No online friends available to invite right now.
                </div>
              ) : (
                onlineFriends.map((friend) => {
                  const isInvited = invitedUsers.has(friend.id);

                  const status = getInviteStatus(friend.id);

                  return (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-2xl text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white">
                          {friend.nickname.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-white">{friend.nickname}</span>
                      </div>

                      <button
                        onClick={() => handleSendInvite(friend.id)}
                        disabled={!status.canInvite}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                          !status.canInvite
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:scale-95 cursor-pointer'
                        }`}
                      >
                        {status.label}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => setShowInviteModal(false)}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ──── LEADERBOARD MODAL ──── */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-neutral-900 border border-white/15 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2 text-yellow-400">
                <Trophy className="w-5 h-5" /> Global Leaderboard
              </h3>
              <button onClick={() => setShowLeaderboard(false)} className="text-white/60 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {leaderboard.length === 0 ? (
                <p className="text-center text-xs text-white/40 py-8">No leaderboard scores yet.</p>
              ) : (
                leaderboard.map((entry) => (
                  <div
                    key={entry.userId}
                    className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-black w-6 text-center text-sm ${entry.rank === 1 ? 'text-yellow-400' : entry.rank === 2 ? 'text-gray-300' : entry.rank === 3 ? 'text-amber-600' : 'text-white/60'}`}>
                        #{entry.rank}
                      </span>
                      <span className="font-semibold text-white">{entry.nickname}</span>
                    </div>
                    <span className="font-black text-amber-400 text-sm">{entry.highScore} pts</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──── SETTINGS MODAL ──── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-neutral-900 border border-white/15 rounded-3xl p-6 max-w-sm w-full text-white shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-white/80" /> Game Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-white/60 hover:text-white">
                ✕
              </button>
            </div>

            {/* Background Theme Picker */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 uppercase">Background Theme</label>
              <div className="grid grid-cols-2 gap-2">
                {(['DAY', 'NIGHT', 'SUNSET', 'CYBERPUNK'] as ThemeType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${selectedTheme === t ? 'bg-amber-400 text-black border-amber-400' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Sound Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white/60 uppercase">Audio Mute</label>
                <button
                  onClick={toggleMute}
                  className={`p-2 rounded-xl border ${isMuted ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'}`}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-3 bg-white text-black font-extrabold rounded-xl hover:bg-neutral-200"
            >
              Save & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
