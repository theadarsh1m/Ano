"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';
import { useArrowMazeStore } from '@/store/useArrowMazeStore';
import { ArrowMazeEngine } from './ArrowMazeEngine';
import ArrowMazeBoard from './ArrowMazeBoard';
import type { ScoreBreakdown, MultiplayerMode, LevelCount, TimedDuration, GameDifficulty } from './types';
import { socketService } from '@/lib/socket';
import Link from 'next/link';
import {
  ArrowLeft, Play, RotateCcw, Users, UserPlus, Copy, Check,
  Crown, Trophy, Zap, Target, Clock, ChevronLeft,
  Heart, Lightbulb, ArrowRight, Pause, X, SkipForward,
  MessageSquare, BookOpen, ShieldAlert, ZapOff, Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInviteCooldown } from '@/hooks/useInviteCooldown';

type ActiveView = 'MENU' | 'SINGLEPLAYER' | 'MULTIPLAYER_LOBBY' | 'MULTIPLAYER_MATCH' | 'MATCH_RESULTS';

// ── Small UI Components ──────────────────────────────────

function StatBox({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">{icon}<span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span></div>
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
    </div>
  );
}

function LivesDisplay({ lives, maxLives }: { lives: number; maxLives: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxLives }).map((_, i) => (
        <Heart
          key={i}
          className={`w-4 h-4 transition-all duration-300 ${
            i < lives
              ? 'text-red-500 fill-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]'
              : 'text-slate-600 fill-slate-800 opacity-40'
          }`}
        />
      ))}
    </div>
  );
}

// ── Main Game Component ──────────────────────────────────
export function ArrowMazeGameHub() {
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams?.get('room');

  const { user } = useUserStore();
  const userId = user?.id || 'guest';
  const nickname = user?.username || user?.name || 'Player';
  const avatar = user?.avatar;

  const {
    multiplayerMode, setMultiplayerMode,
    levelCount, setLevelCount,
    timedDuration, setTimedDuration,
    roomState, availableLobbies, matchResults,
    soloStats, leaderboard, fetchStats, fetchLeaderboard, submitSoloProgress,
    createLobby, joinLobby, toggleReady, kickPlayer, invitePlayer,
    updateSettings, startMatch, leaveLobby, fetchLobbies,
    returnToLobby, resetLobby, sendProgress, sendLevelCleared, sendFinished,
    initLobbySockets,
  } = useArrowMazeStore();

  const [activeView, setActiveView] = useState<ActiveView>('MENU');
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'levelComplete' | 'over'>('idle');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [selectedDifficulty, setSelectedDifficulty] = useState<GameDifficulty>('EASY');
  const [currentScore, setCurrentScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [maxLives, setMaxLives] = useState(3);
  const [arrowsRemaining, setArrowsRemaining] = useState(0);
  const [hintArrowId, setHintArrowId] = useState<number | null>(null);
  const [hintsLeft, setHintsLeft] = useState(2);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [pendingInviteUserId, setPendingInviteUserId] = useState<string | null>(null);
  const [countdownVal, setCountdownVal] = useState<number | null>(null);
  const [matchTimeRemaining, setMatchTimeRemaining] = useState<number | undefined>(undefined);
  const [multiLevelsClearedThisMatch, setMultiLevelsClearedThisMatch] = useState(0);
  const [multiTotalScoreThisMatch, setMultiTotalScoreThisMatch] = useState(0);

  const { triggerInvite, getInviteStatus } = useInviteCooldown(roomState?.id);

  const engineRef = useRef<ArrowMazeEngine | null>(null);
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;
  const roomStateRef = useRef(roomState);
  roomStateRef.current = roomState;
  const selectedDifficultyRef = useRef(selectedDifficulty);
  selectedDifficultyRef.current = selectedDifficulty;
  const matchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize engine
  useEffect(() => {
    const eng = new ArrowMazeEngine();
    engineRef.current = eng;

    eng.onLevelComplete = (level, breakdown) => {
      setGameStatus('levelComplete');
      setScoreBreakdown(breakdown);
      setCurrentScore(breakdown.total);
      setTotalScore(eng.totalScore);

      if (activeViewRef.current === 'SINGLEPLAYER' && userId) {
        submitSoloProgress(userId, level + 1, eng.totalScore, eng.levelsCleared, eng.totalArrowsCleared);
      }
      if (activeViewRef.current === 'MULTIPLAYER_MATCH' && roomStateRef.current && userId) {
        sendLevelCleared(roomStateRef.current.id, userId, level, breakdown.total, eng.levelsCleared);
      }
    };

    eng.onLifeLost = (livesRemaining) => {
      setLives(livesRemaining);
    };

    eng.onGameOver = (totalScoreFinal, levelsClearedFinal) => {
      setGameStatus('over');
      setTotalScore(totalScoreFinal);
      if (activeViewRef.current === 'MULTIPLAYER_MATCH' && roomStateRef.current && userId) {
        sendFinished(roomStateRef.current.id, userId, {
          userId,
          nickname,
          avatar,
          rank: 0,
          score: totalScoreFinal,
          levelsCleared: levelsClearedFinal,
          totalArrowsCleared: eng.totalArrowsCleared,
          totalMistakes: eng.totalMistakes,
          avgTimePerLevel: eng.getAvgTimePerLevel(),
          fastestLevel: eng.getFastestLevel(),
        });
      }
    };

    return () => { engineRef.current = null; };
  }, [userId, nickname, avatar]);

  // Fetch stats & global leaderboard
  useEffect(() => {
    if (userId) {
      fetchStats(userId);
      fetchLeaderboard();
    }
  }, [userId, fetchStats, fetchLeaderboard]);

  // Init sockets
  useEffect(() => {
    if (userId) {
      const cleanup = initLobbySockets(userId);
      return () => cleanup();
    }
  }, [userId]);

  // Handle URL invite
  useEffect(() => {
    if (roomCodeParam && userId && nickname && !roomState) {
      setActiveView('MULTIPLAYER_LOBBY');
      initLobbySockets(userId);
      const socket = socketService.getSocket();
      const doJoin = () => {
        joinLobby(roomCodeParam, userId, nickname);
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
  }, [roomCodeParam, userId, nickname, roomState, initLobbySockets, joinLobby]);

  // Room state transitions
  useEffect(() => {
    if (roomState) {
      if (roomState.status === 'PLAYING' || roomState.status === 'COUNTDOWN') {
        if (activeView !== 'MULTIPLAYER_MATCH' && activeView !== 'MATCH_RESULTS') {
          setActiveView('MULTIPLAYER_MATCH');
          startMultiplayerGame(roomState.seed, roomState.startTime ?? undefined);
        }
        if (roomState.status === 'COUNTDOWN') {
          setCountdownVal(roomState.countdownValue ?? null);
        } else if (roomState.status === 'PLAYING') {
          setCountdownVal(null);
        }
      } else if (roomState.status === 'LOBBY') {
        if (activeView !== 'MULTIPLAYER_LOBBY') {
          setActiveView('MULTIPLAYER_LOBBY');
          setGameStatus('idle');
        }
      } else if (roomState.status === 'FINISHED') {
        setActiveView('MATCH_RESULTS');
        setGameStatus('over');
        if (matchTimerRef.current) { clearInterval(matchTimerRef.current); matchTimerRef.current = null; }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomState, activeView]);

  // Fetch online users & friends
  const fetchOnlineUsers = useCallback(() => {
    if (!userId) return;
    const apiUrl = typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_SOCKET_URL || `http://${window.location.hostname}:3001`)
      : 'http://localhost:3001';
    fetch(`${apiUrl}/api/users/online`)
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setOnlineUsers(data.filter((u) => u.id !== userId)); })
      .catch(console.error);
    fetch(`${apiUrl}/api/notifications/friendships/${userId}`)
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setFriendsList(data); })
      .catch(console.error);
  }, [userId]);

  useEffect(() => {
    fetchOnlineUsers();
    const socket = socketService.getSocket();
    if (socket) {
      socket.on('user_online', fetchOnlineUsers);
      socket.on('user_offline', fetchOnlineUsers);
      return () => {
        socket.off('user_online', fetchOnlineUsers);
        socket.off('user_offline', fetchOnlineUsers);
      };
    }
  }, [fetchOnlineUsers]);

  // Handle pending invite after creating lobby
  useEffect(() => {
    if (pendingInviteUserId && roomState && userId && nickname) {
      invitePlayer(roomState.id, userId, nickname, pendingInviteUserId);
      triggerInvite(pendingInviteUserId);
      setPendingInviteUserId(null);
    }
  }, [pendingInviteUserId, roomState, userId, nickname, invitePlayer, triggerInvite]);

  // HUD update interval
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    const interval = setInterval(() => {
      const eng = engineRef.current;
      if (!eng) return;
      setArrowsRemaining(eng.getRemainingArrows());
      setLives(eng.lives);
      setHintsLeft(eng.hintsRemaining);
    }, 100);
    return () => clearInterval(interval);
  }, [gameStatus]);

  // ── Game Actions ──────────────────────────────────────

  const startSoloGame = useCallback((startLevel: number, diff?: GameDifficulty) => {
    const eng = engineRef.current;
    if (!eng) return;
    const targetDiff = diff || selectedDifficultyRef.current || 'EASY';
    eng.resetForNewGame();
    const seed = Date.now();
    eng.startLevel(startLevel, seed, false, targetDiff);
    setCurrentLevel(startLevel);
    setLives(eng.lives);
    setMaxLives(eng.maxLives);
    setArrowsRemaining(eng.getRemainingArrows());
    setHintsLeft(eng.hintsRemaining);
    setTotalScore(0);
    setCurrentScore(0);
    setScoreBreakdown(null);
    setHintArrowId(null);
    setGameStatus('playing');
    setActiveView('SINGLEPLAYER');
  }, []);

  const advanceToNextLevel = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const nextLevel = eng.currentLevel + 1;
    eng.startLevel(nextLevel, undefined, true);
    setCurrentLevel(nextLevel);
    setLives(eng.lives);
    setMaxLives(eng.maxLives);
    setArrowsRemaining(eng.getRemainingArrows());
    setHintsLeft(eng.hintsRemaining);
    setScoreBreakdown(null);
    setHintArrowId(null);
    setGameStatus('playing');

    // In multiplayer, track stats
    if (activeViewRef.current === 'MULTIPLAYER_MATCH') {
      setMultiLevelsClearedThisMatch(prev => prev + 1);
      setMultiTotalScoreThisMatch(eng.totalScore);
    }
  }, []);

  const retryLevel = useCallback(() => {
    startSoloGame(1, selectedDifficultyRef.current);
  }, [startSoloGame]);

  const startMultiplayerGame = useCallback((seed: number, startTime?: number) => {
    const eng = engineRef.current;
    const room = roomStateRef.current;
    if (!eng || !room) return;
    const roomDiff = ((room.settings as any)?.difficulty as GameDifficulty) || selectedDifficultyRef.current || 'EASY';
    eng.resetForNewGame();
    eng.startLevel(1, seed, false, roomDiff);
    setCurrentLevel(1);
    setLives(eng.lives);
    setMaxLives(eng.maxLives);
    setArrowsRemaining(eng.getRemainingArrows());
    setHintsLeft(eng.hintsRemaining);
    setTotalScore(0);
    setCurrentScore(0);
    setScoreBreakdown(null);
    setHintArrowId(null);
    setGameStatus('playing');
    setMultiLevelsClearedThisMatch(0);
    setMultiTotalScoreThisMatch(0);

    // Start timed mode timer
    if (room.settings.multiplayerMode === 'TIMED') {
      const duration = room.settings.timedDuration;
      setMatchTimeRemaining(duration);
      matchTimerRef.current = setInterval(() => {
        setMatchTimeRemaining(prev => {
          if (prev === undefined || prev <= 1) {
            // Time's up
            if (matchTimerRef.current) clearInterval(matchTimerRef.current);
            const currentEng = engineRef.current;
            if (currentEng && roomStateRef.current && userId) {
              sendFinished(roomStateRef.current.id, userId, {
                userId,
                nickname,
                avatar,
                rank: 0,
                score: currentEng.totalScore,
                levelsCleared: currentEng.levelsCleared,
                totalArrowsCleared: currentEng.totalArrowsCleared,
                totalMistakes: currentEng.totalMistakes,
                avgTimePerLevel: currentEng.getAvgTimePerLevel(),
                fastestLevel: currentEng.getFastestLevel(),
              });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [userId, nickname, avatar]);

  const handleArrowClick = useCallback((arrowId: number) => {
    const eng = engineRef.current;
    if (!eng) return;
    setHintArrowId(null);
    const result = eng.clickArrow(arrowId);

    if (result === 'cleared') {
      setArrowsRemaining(eng.getRemainingArrows());
      // Send progress in multiplayer
      if (activeViewRef.current === 'MULTIPLAYER_MATCH' && roomStateRef.current && userId) {
        sendProgress(roomStateRef.current.id, userId, {
          score: eng.totalScore,
          level: eng.currentLevel,
          levelsCleared: eng.levelsCleared,
          livesRemaining: eng.lives,
          progress: eng.getProgress(),
        });
      }
    }
  }, [userId]);

  const handleHint = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const hintId = eng.getHint();
    if (hintId >= 0) {
      setHintArrowId(hintId);
      setHintsLeft(eng.hintsRemaining);
      // Auto-clear hint highlight after 3 seconds
      setTimeout(() => setHintArrowId(null), 3000);
    }
  }, []);

  const handleCopyLink = useCallback(() => {
    if (!roomState) return;
    const url = `${window.location.origin}/dashboard/games/arrow-maze?gameId=${roomState.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }, [roomState]);

  const handleSendInvite = useCallback((targetUserId: string) => {
    if (!userId || !nickname) return;
    if (!roomState) {
      setPendingInviteUserId(targetUserId);
      createLobby(userId, nickname);
    } else {
      invitePlayer(roomState.id, userId, nickname, targetUserId);
      triggerInvite(targetUserId);
    }
  }, [userId, nickname, roomState, createLobby, invitePlayer, triggerInvite]);

  const formatTime = (seconds: number | undefined) => {
    if (seconds === undefined) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── TOP NAVBAR ──────────────────────────────────────────
  const renderNavbar = () => (
    <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10 flex-shrink-0 z-30 backdrop-blur-md">
      <div className="flex items-center gap-4">
        {activeView !== 'MENU' ? (
          <button 
            onClick={() => {
              if (roomState) leaveLobby(userId);
              setActiveView('MENU');
              setGameStatus('idle');
            }}
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Back to Menu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <Link 
            href="/dashboard/games"
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Back to Arcade"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}

        <Link href="/dashboard" className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-wide">Ano</span>
        </Link>

        <div className="ml-2 border-l border-white/20 pl-4">
          <h1 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <span>🏹</span>
            <span>Arrow Maze</span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {soloStats.highScore > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-gray-300 mr-1">
            <span className="text-slate-400">High Score:</span>
            <span className="text-yellow-400 font-bold tabular-nums">{soloStats.highScore.toLocaleString()}</span>
          </div>
        )}
        <button 
          onClick={() => {
            fetchLeaderboard();
            setShowLeaderboardModal(true);
          }}
          className="px-3.5 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:text-yellow-300 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors hover:bg-yellow-500/20 cursor-pointer shadow-sm"
        >
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span>High Scores</span>
        </button>
        <button 
          onClick={() => setShowRulesModal(true)}
          className="px-3.5 py-1.5 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors hover:bg-white/10 cursor-pointer"
        >
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>Rules</span>
        </button>
      </div>
    </div>
  );

  // ── LEADERBOARD MODAL ────────────────────────────────────
  const renderLeaderboardModal = () => (
    <AnimatePresence>
      {showLeaderboardModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowLeaderboardModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto text-left relative shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5 font-bold text-white text-base sm:text-lg tracking-wide uppercase">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span>Global High Scores</span>
              </div>
              <button
                onClick={() => setShowLeaderboardModal(false)}
                className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 pt-1">
              {leaderboard.length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-12">
                  No scores submitted yet. Play a Solo Run to be #1!
                </div>
              ) : (
                leaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const rankColor = rank === 1 ? 'text-yellow-400 font-extrabold' : rank === 2 ? 'text-slate-300 font-bold' : rank === 3 ? 'text-amber-500 font-bold' : 'text-slate-500 font-semibold';
                  const displayName = entry.user?.username || entry.user?.name || entry.userId || 'Anonymous';
                  const initial = displayName.charAt(0).toUpperCase();
                  const avatarUrl = entry.user?.avatar;
                  const formattedDate = entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '';

                  return (
                    <div key={entry.id || `${entry.userId}-${index}`} className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`text-base w-7 text-center tabular-nums ${rankColor}`}>#{rank}</span>
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white text-base shadow-md">
                            {initial}
                          </div>
                        )}
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-white text-sm">{displayName}</span>
                          {formattedDate && <span className="text-[10px] text-slate-500">{formattedDate}</span>}
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="font-extrabold text-emerald-400 text-base tabular-nums">{entry.score.toLocaleString()}</span>
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Score</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── RULES MODAL ─────────────────────────────────────────
  const renderRulesModal = () => (
    <AnimatePresence>
      {showRulesModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowRulesModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto text-left relative shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                Arrow Maze Rules & Guide
              </h2>
              <button
                onClick={() => setShowRulesModal(false)}
                className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-sm text-gray-300">
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-1">
                <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <Target className="w-4 h-4" /> Objective
                </div>
                <p className="text-xs text-gray-300">
                  Clear every arrow off the board by clicking arrows in the correct sequence.
                </p>
              </div>

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <ArrowRight className="w-4 h-4" /> Arrow Trajectories
                </div>
                <ul className="list-disc pl-4 space-y-1 text-xs text-gray-300">
                  <li>Each arrow moves straight in its pointed direction until it exits the grid.</li>
                  <li>An arrow will <span className="text-white font-semibold">only escape</span> if the entire path in front of it is free of other arrows.</li>
                  <li>Clicking a blocked arrow causes an obstacle bump and costs <span className="text-red-400 font-semibold">1 Life (❤️)</span>.</li>
                </ul>
              </div>

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> Combos & Scoring
                </div>
                <ul className="list-disc pl-4 space-y-1 text-xs text-gray-300">
                  <li>Clearing arrows rapidly within the combo timer builds a score multiplier up to <span className="text-yellow-400 font-semibold">×3.0</span>.</li>
                  <li>Clear levels with zero mistakes and fast times for extra bonus stars and points!</li>
                </ul>
              </div>

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4" /> Hints & Undo
                </div>
                <p className="text-xs text-gray-300">
                  Stuck? Use the <span className="text-yellow-400 font-semibold">Hint</span> button to highlight an unblocked arrow ready to launch. You can also undo your last move.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/25 cursor-pointer"
            >
              Ready to Play!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── MENU VIEW ──────────────────────────────────────────

  const renderMenu = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
      <div className="max-w-2xl w-full space-y-8 my-auto">
        {/* Title */}
        <div className="text-center space-y-3">
          <div className="text-6xl md:text-7xl font-bold tracking-tight text-white">
            Arrow<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Maze</span>
          </div>
          <p className="text-gray-400 text-sm md:text-base max-w-md mx-auto">
            Clear the grid by clicking arrows in the right order. Each arrow exits in the direction it faces — but only if the path is clear.
          </p>
        </div>

        {/* Stats Card */}
        {soloStats.gamesPlayed > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-around text-center backdrop-blur-sm">
            <div><div className="text-xl font-bold text-cyan-400">Lvl {soloStats.currentLevel}</div><div className="text-[10px] text-gray-500 uppercase tracking-wider">Progress</div></div>
            <div className="w-px h-10 bg-white/10" />
            <div><div className="text-xl font-bold text-yellow-400">{soloStats.highScore.toLocaleString()}</div><div className="text-[10px] text-gray-500 uppercase tracking-wider">Best Score</div></div>
            <div className="w-px h-10 bg-white/10" />
            <div><div className="text-xl font-bold text-emerald-400">{soloStats.levelsCleared}</div><div className="text-[10px] text-gray-500 uppercase tracking-wider">Cleared</div></div>
          </div>
        )}

        {/* Difficulty Mode Selector */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm space-y-2">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold text-center">
            Select Difficulty Mode
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {(['EASY', 'MEDIUM', 'HARD'] as GameDifficulty[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setSelectedDifficulty(mode)}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer border flex flex-col items-center justify-center gap-1 ${
                  selectedDifficulty === mode
                    ? mode === 'HARD'
                      ? 'bg-rose-500/25 text-rose-300 border-rose-500/60 shadow-lg shadow-rose-500/10 scale-[1.02]'
                      : mode === 'MEDIUM'
                      ? 'bg-amber-500/25 text-amber-300 border-amber-500/60 shadow-lg shadow-amber-500/10 scale-[1.02]'
                      : 'bg-emerald-500/25 text-emerald-300 border-emerald-500/60 shadow-lg shadow-emerald-500/10 scale-[1.02]'
                    : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                <span className="text-sm">
                  {mode === 'EASY' && '🟢'}
                  {mode === 'MEDIUM' && '🟡'}
                  {mode === 'HARD' && '🔴'}
                </span>
                <span>{mode}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mode Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => startSoloGame(soloStats.currentLevel || 1)}
            className="group relative overflow-hidden bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl p-6 text-left hover:border-cyan-400/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-lg font-bold text-white">Solo Run</div>
                  {soloStats.currentLevel > 1 && (
                    <div className="text-xs text-cyan-400">Continue from Level {soloStats.currentLevel}</div>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-400">Clear the grid level by level. Your progress is saved automatically.</p>
            </div>
          </button>

          <button
            onClick={() => { setActiveView('MULTIPLAYER_LOBBY'); fetchLobbies(); }}
            className="group relative overflow-hidden bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl p-6 text-left hover:border-violet-400/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-violet-400" />
                </div>
                <div className="text-lg font-bold text-white">Multiplayer</div>
              </div>
              <p className="text-sm text-gray-400">Same puzzle, same grid. Race your friends to solve it first.</p>
            </div>
          </button>
        </div>

        {/* How to Play */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 text-sm backdrop-blur-sm">
          <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">How to Play</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px] font-bold text-cyan-400 shrink-0">1</div>
              <div className="text-gray-400">Click an arrow to <span className="text-white font-medium">fire it</span> in the direction it points.</div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px] font-bold text-cyan-400 shrink-0">2</div>
              <div className="text-gray-400">The path must be <span className="text-white font-medium">completely clear</span> — no other arrows blocking.</div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px] font-bold text-cyan-400 shrink-0">3</div>
              <div className="text-gray-400">Wrong click = <span className="text-red-400 font-medium">lose a life</span>. Clear all arrows to complete the level!</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );


  // ── SINGLEPLAYER VIEW ──────────────────────────────────

  const renderSingleplayer = () => (
    <div className="flex flex-col h-[100dvh] w-full bg-[#0a0f1d] overflow-hidden relative select-none">
      {/* Top HUD */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0 z-20 max-w-4xl w-full mx-auto">
        <button
          onClick={() => {
            if (gameStatus === 'playing') {
              setGameStatus('paused');
            } else {
              setActiveView('MENU');
              setGameStatus('idle');
            }
          }}
          className="w-9 h-9 rounded-xl bg-white/10 text-slate-200 hover:bg-white/15 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-wide">Level {currentLevel}</h2>
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
              (engineRef.current?.difficulty || selectedDifficulty) === 'HARD'
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : (engineRef.current?.difficulty || selectedDifficulty) === 'MEDIUM'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              {engineRef.current?.difficulty || selectedDifficulty}
            </span>
          </div>
          <span className="text-xs font-medium text-slate-400 mt-0.5 tabular-nums">{totalScore.toLocaleString()} pts</span>
        </div>

        <div className="flex items-center">
          <LivesDisplay lives={lives} maxLives={maxLives} />
        </div>
      </div>

      {/* Game Board */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 w-full min-h-0 relative">
        {engineRef.current && gameStatus === 'playing' && (
          <ArrowMazeBoard
            engine={engineRef.current}
            onArrowClick={handleArrowClick}
            hintArrowId={hintArrowId}
            className="w-full h-full p-2 sm:p-6 max-w-2xl max-h-[75vh]"
          />
        )}

        {/* Pause overlay */}
        {gameStatus === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f1d]/85 backdrop-blur-sm z-30">
            <div className="max-w-sm w-full mx-4 bg-[#131b2e] border border-white/10 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
              <Pause className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="text-2xl font-bold text-white">Paused</div>
              <p className="text-slate-400 text-xs">Level {currentLevel} — {arrowsRemaining} arrows remaining</p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setGameStatus('playing')}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl transition-all cursor-pointer"
                >
                  Resume
                </button>
                <button
                  onClick={() => { setActiveView('MENU'); setGameStatus('idle'); }}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-slate-200 font-medium text-sm rounded-xl transition-all border border-white/10 cursor-pointer"
                >
                  Quit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Level Complete overlay */}
        {gameStatus === 'levelComplete' && scoreBreakdown && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f1d]/85 backdrop-blur-sm z-30">
            <div className="max-w-sm w-full mx-4 bg-[#131b2e] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider font-semibold text-emerald-400 mb-1">✨ Level Complete</div>
                <div className="text-2xl font-bold text-white">Level {currentLevel}</div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <StatBox label="Arrows" value={`+${scoreBreakdown.arrowPoints}`} icon={<Target className="w-3.5 h-3.5 text-blue-400" />} />
                <StatBox label="Time" value={`+${scoreBreakdown.timeBonus}`} icon={<Clock className="w-3.5 h-3.5 text-amber-400" />} />
                <StatBox label="Streak" value={`+${scoreBreakdown.streakBonus}`} icon={<Zap className="w-3.5 h-3.5 text-indigo-400" />} />
                <StatBox label="Lives" value={`+${scoreBreakdown.lifeBonus}`} icon={<Heart className="w-3.5 h-3.5 text-red-400" />} />
              </div>

              <div className="text-center py-2.5 bg-white/5 rounded-xl border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Level Score</div>
                <div className="text-xl font-bold text-white tabular-nums">{scoreBreakdown.total.toLocaleString()}</div>
              </div>

              <button
                onClick={advanceToNextLevel}
                className="w-full px-4 py-3 bg-white hover:bg-slate-100 text-[#0f172a] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Next Level</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Game Over overlay */}
        {gameStatus === 'over' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f1d]/85 backdrop-blur-sm z-30">
            <div className="max-w-sm w-full mx-4 bg-[#131b2e] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider font-semibold text-red-400 mb-1">Game Over</div>
                <div className="text-xl font-bold text-white">
                  {totalScore > soloStats.highScore ? '🎉 New High Score!' : 'Out of Lives'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <StatBox label="Score" value={totalScore.toLocaleString()} icon={<Trophy className="w-3.5 h-3.5 text-amber-400" />} />
                <StatBox label="Level" value={String(currentLevel)} icon={<Target className="w-3.5 h-3.5 text-blue-400" />} />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={retryLevel}
                  className="flex-1 px-4 py-2.5 bg-white text-[#0f172a] hover:bg-slate-100 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Retry
                </button>
                <button
                  onClick={() => { setActiveView('MENU'); setGameStatus('idle'); }}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-slate-200 font-medium text-sm rounded-xl transition-all border border-white/10 cursor-pointer"
                >
                  Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-4 pb-8 pt-3 shrink-0 z-20">
        <button
          onClick={handleHint}
          disabled={hintsLeft <= 0 || gameStatus !== 'playing'}
          className={`px-5 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${
            hintsLeft > 0 && gameStatus === 'playing'
              ? 'bg-white/10 hover:bg-white/15 border-white/15 text-white cursor-pointer active:scale-95'
              : 'bg-white/5 border-white/5 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <span>Hint</span>
          {hintsLeft > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 text-xs font-bold">
              {hintsLeft}
            </span>
          )}
        </button>

        <button
          onClick={retryLevel}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-medium flex items-center gap-2 transition-all cursor-pointer active:scale-95"
        >
          <RotateCcw className="w-4 h-4 text-slate-300" />
          <span>Restart</span>
        </button>
      </div>
    </div>
  );

  // ── MULTIPLAYER LOBBY VIEW ─────────────────────────────

  const renderMultiplayerLobby = () => {
    const isHost = roomState?.hostId === userId;
    const allReady = roomState?.players?.every((p) => p.isHost || p.isReady);
    const canStart = isHost && (roomState?.players?.length ?? 0) >= 1 && allReady;

    return (
      <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
        <div className="max-w-3xl w-full mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button onClick={() => { if (roomState) leaveLobby(userId); setActiveView('MENU'); }}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Multiplayer Lobby</h1>
              <p className="text-sm text-gray-500">Arrow Maze — Race to solve</p>
            </div>
          </div>

          {/* Not in a lobby */}
          {!roomState ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Create Lobby & Open Lobbies */}
              <div className="space-y-4">
                <button
                  onClick={() => createLobby(userId, nickname)}
                  className="w-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl p-6 text-left hover:border-cyan-400/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Crown className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xl font-bold text-white">Create Lobby</span>
                  </div>
                  <p className="text-sm text-gray-400">Host a game and invite online players to join your match.</p>
                </button>

                {/* Available Lobbies */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-400" />
                      Open Lobbies ({availableLobbies.length})
                    </div>
                    <button
                      onClick={() => fetchLobbies()}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
                      title="Refresh lobbies"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {availableLobbies.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-xs italic">
                      No open lobbies right now. Create one to get started!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {availableLobbies.map((lobby) => (
                        <div key={lobby.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3">
                          <div>
                            <div className="font-semibold text-white text-sm">{lobby.hostName}&apos;s Lobby</div>
                            <div className="text-xs text-gray-500">{lobby.playerCount}/{lobby.maxPlayers || 8} players</div>
                          </div>
                          <button
                            onClick={() => joinLobby(lobby.id, userId, nickname)}
                            className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            Join
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Online Players to Invite */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-cyan-400" />
                    Online Players ({onlineUsers.length})
                  </h3>
                  <button
                    onClick={fetchOnlineUsers}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
                    title="Refresh online users"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2.5 pr-1">
                  {onlineUsers.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-sm space-y-1">
                      <p>No other players online right now.</p>
                      <p className="text-xs text-gray-600">Create a lobby and share your link with friends!</p>
                    </div>
                  ) : (
                    onlineUsers.map((u) => {
                      const isFriend = friendsList.some((f) => f.id === u.id);
                      const status = getInviteStatus(u.id);
                      return (
                        <div key={u.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                                {u.avatar ? (
                                  <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  (u.nickname || '?')[0].toUpperCase()
                                )}
                              </div>
                              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-neutral-900 bg-emerald-400" />
                            </div>
                            <div>
                              <span className="font-semibold text-sm text-white block leading-tight">{u.nickname}</span>
                              <span className="text-[10px] text-gray-400">
                                {isFriend ? 'Friend · Online' : 'Online'}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSendInvite(u.id)}
                            disabled={!status.canInvite}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              !status.canInvite
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 cursor-not-allowed'
                                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md shadow-cyan-500/20'
                            }`}
                          >
                            {status.canInvite ? 'Invite' : status.label}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* In a lobby */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Lobby Info & Settings & Players */}
              <div className="lg:col-span-2 space-y-5">
                {/* Lobby Code & Copy Link */}
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Lobby Code</div>
                  <code className="text-sm text-cyan-400 font-mono flex-1 truncate">{roomState.id}</code>
                  <button onClick={handleCopyLink} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs text-gray-300">
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>

                {/* Settings (host only) */}
                {isHost && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                    <div className="text-sm font-semibold text-gray-300">Match Settings</div>

                    {/* Difficulty Mode selector */}
                    <div>
                      <div className="text-xs text-gray-500 mb-2">Difficulty Mode</div>
                      <div className="flex gap-2">
                        {(['EASY', 'MEDIUM', 'HARD'] as GameDifficulty[]).map((d) => (
                          <button key={d}
                            onClick={() => {
                              setSelectedDifficulty(d);
                              updateSettings(roomState.id, userId, { difficulty: d } as any);
                            }}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              ((roomState.settings as any)?.difficulty || selectedDifficulty) === d
                                ? d === 'HARD'
                                  ? 'bg-rose-500/30 text-rose-400 border border-rose-500/50'
                                  : d === 'MEDIUM'
                                  ? 'bg-amber-500/30 text-amber-400 border border-amber-500/50'
                                  : 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                                : 'bg-white/5 text-gray-500 border border-white/10'
                            }`}
                          >
                            {d === 'EASY' ? '🟢 Easy' : d === 'MEDIUM' ? '🟡 Medium' : '🔴 Hard'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Mode selector */}
                    <div>
                      <div className="text-xs text-gray-500 mb-2">Game Mode</div>
                      <div className="flex gap-2">
                        {(['LEVELS', 'TIMED'] as MultiplayerMode[]).map((m) => (
                          <button key={m}
                            onClick={() => {
                              setMultiplayerMode(m);
                              updateSettings(roomState.id, userId, { multiplayerMode: m });
                            }}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              (roomState.settings?.multiplayerMode || multiplayerMode) === m
                                ? 'bg-violet-500/30 text-violet-400 border border-violet-500/50'
                                : 'bg-white/5 text-gray-500 border border-white/10'
                            }`}
                          >
                            {m === 'LEVELS' ? '📊 By Levels' : '⏱️ By Time'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Level count or Time duration based on mode */}
                    {(roomState.settings?.multiplayerMode || multiplayerMode) === 'LEVELS' ? (
                      <div>
                        <div className="text-xs text-gray-500 mb-2">Number of Levels</div>
                        <div className="flex gap-2">
                          {([5, 10, 15, 20] as LevelCount[]).map((n) => (
                            <button key={n}
                              onClick={() => {
                                setLevelCount(n);
                                updateSettings(roomState.id, userId, { levelCount: n });
                              }}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                (roomState.settings?.levelCount || levelCount) === n
                                  ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50'
                                  : 'bg-white/5 text-gray-500 border border-white/10'
                              }`}
                            >
                              {n} Lvls
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs text-gray-500 mb-2">Time Limit</div>
                        <div className="flex gap-2">
                          {([60, 180, 300, 600] as TimedDuration[]).map((t) => (
                            <button key={t}
                              onClick={() => {
                                setTimedDuration(t);
                                updateSettings(roomState.id, userId, { timedDuration: t });
                              }}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                (roomState.settings?.timedDuration || timedDuration) === t
                                  ? 'bg-amber-500/30 text-amber-400 border border-amber-500/50'
                                  : 'bg-white/5 text-gray-500 border border-white/10'
                              }`}
                            >
                              {t < 60 ? `${t}s` : `${t / 60}m`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Player list */}
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Players ({roomState.players?.length || 0}/8)</div>
                  {roomState.players?.map((p) => (
                    <div key={p.userId} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                        {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : p.nickname?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-white text-sm flex items-center gap-2">
                          {p.nickname}
                          {p.isHost && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
                        </div>
                      </div>
                      <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        p.isReady || p.isHost ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'
                      }`}>
                        {p.isHost ? 'Host' : p.isReady ? 'Ready' : 'Not Ready'}
                      </div>
                      {isHost && !p.isHost && (
                        <button onClick={() => kickPlayer(roomState.id, userId, p.userId)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                          title="Kick Player"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  {isHost ? (
                    <button
                      onClick={() => startMatch(roomState.id, userId)}
                      disabled={!canStart}
                      className={`flex-1 px-4 py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        canStart ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25' : 'bg-white/5 text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-4 h-4" /> Start Match
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleReady(roomState.id, userId)}
                      className={`flex-1 px-4 py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        roomState.players.find(p => p.userId === userId)?.isReady
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/25'
                      }`}
                    >
                      <Target className="w-4 h-4" />
                      {roomState.players.find(p => p.userId === userId)?.isReady ? 'Unready' : 'Ready Up'}
                    </button>
                  )}
                  <button
                    onClick={() => { leaveLobby(userId); setActiveView('MENU'); }}
                    className="px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-400 font-medium rounded-xl transition-colors border border-white/10 cursor-pointer"
                  >
                    Leave
                  </button>
                </div>
              </div>

              {/* Right Col: Online Players to Invite directly */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-cyan-400" />
                    Invite Online Players
                  </h3>
                  <button
                    onClick={fetchOnlineUsers}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer text-xs"
                    title="Refresh online users"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2.5 pr-1">
                  {onlineUsers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-xs">
                      No other players online
                    </div>
                  ) : (
                    onlineUsers
                      .filter((u) => !roomState.players?.some((p) => p.userId === u.id))
                      .map((u) => {
                        const isFriend = friendsList.some((f) => f.id === u.id);
                        const status = getInviteStatus(u.id);
                        return (
                          <div key={u.id} className="flex items-center justify-between p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="relative shrink-0">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                                  {u.avatar ? (
                                    <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    (u.nickname || '?')[0].toUpperCase()
                                  )}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-neutral-900 bg-emerald-400" />
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-xs text-white block truncate">{u.nickname}</span>
                                <span className="text-[10px] text-gray-500 block">
                                  {isFriend ? 'Friend' : 'Online'}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleSendInvite(u.id)}
                              disabled={!status.canInvite}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                                !status.canInvite
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 cursor-not-allowed'
                                  : 'bg-cyan-500 hover:bg-cyan-400 text-white'
                              }`}
                            >
                              {status.canInvite ? 'Invite' : status.label}
                            </button>
                          </div>
                        );
                      })
                  )}
                  {onlineUsers.filter((u) => !roomState.players?.some((p) => p.userId === u.id)).length === 0 && onlineUsers.length > 0 && (
                    <div className="text-xs text-gray-500 text-center py-4">
                      All online players are already in this lobby!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── MULTIPLAYER MATCH VIEW ─────────────────────────────

  const renderMultiplayerMatch = () => (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-900 overflow-hidden relative">
      {/* Top HUD */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0 z-20">
        <button
          onClick={() => {
            if (roomState) leaveLobby(userId);
            setActiveView('MENU');
            setGameStatus('idle');
          }}
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Level / Score info */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-cyan-400" />
            <span>Level {currentLevel}</span>
          </div>

          <div className="px-3 py-1.5 rounded-full bg-white/10 text-yellow-400 text-xs font-bold flex items-center gap-1.5 tabular-nums">
            <Trophy className="w-3.5 h-3.5" />
            <span>{multiTotalScoreThisMatch + currentScore}</span>
          </div>
        </div>

        {/* Lives / Timer */}
        <div className="flex items-center gap-2">
          {matchTimeRemaining !== undefined && (
            <div className="px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold flex items-center gap-1.5 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{formatTime(matchTimeRemaining)}</span>
            </div>
          )}
          <LivesDisplay lives={lives} maxLives={maxLives} />
        </div>
      </div>

      {/* Countdown overlay */}
      {countdownVal !== null && countdownVal > 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/60 backdrop-blur-sm">
          <div className="text-8xl font-bold text-white animate-bounce">{countdownVal}</div>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden min-h-0">
        {engineRef.current && (
          <ArrowMazeBoard
            engine={engineRef.current}
            hintArrowId={hintArrowId}
            onArrowClick={handleArrowClick}
            className="w-full h-full"
          />
        )}

        {/* Opponents Mini Progress Strip */}
        {roomState && roomState.players && roomState.players.length > 1 && (
          <div className="absolute bottom-3 left-4 right-4 z-20 flex gap-2 overflow-x-auto py-1">
            {roomState.players
              .filter((p) => p.userId !== userId)
              .map((p) => (
                <div
                  key={p.userId}
                  className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 flex flex-col gap-1 min-w-[120px]"
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[10px] text-gray-300 font-bold truncate max-w-[60%]">{p.nickname}</span>
                    <span className="text-[10px] text-cyan-400">Lv {p.currentLevel ?? 1}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                      style={{ width: `${((p as any).progress ?? 0) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );

  // ── MATCH RESULTS VIEW ─────────────────────────────────

  const renderMatchResults = () => {
    const results = matchResults || roomState?.results || [];
    const sorted = [...results].sort((a, b) => b.score - a.score);

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
        <div className="max-w-lg w-full space-y-6 my-auto">
          <div className="text-center space-y-2">
            <Trophy className="w-12 h-12 text-yellow-400 mx-auto" />
            <div className="text-3xl font-bold text-white">Match Results</div>
          </div>

          <div className="space-y-3">
            {sorted.map((p, i) => {
              const isMe = p.userId === userId;
              return (
                <div
                  key={p.userId}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    i === 0
                      ? 'bg-yellow-500/10 border-yellow-500/30'
                      : isMe
                        ? 'bg-cyan-500/10 border-cyan-500/30'
                        : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-gray-400'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white text-sm flex items-center gap-2">
                      {p.nickname}
                      {isMe && <span className="text-[10px] text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">YOU</span>}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {p.levelsCleared} levels • {p.totalArrowsCleared} arrows • {p.totalMistakes} mistakes
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-yellow-400 tabular-nums">{p.score.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500">pts</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                if (roomState) {
                  returnToLobby(roomState.id, userId);
                  resetLobby(roomState.id);
                }
              }}
              className="flex-1 px-4 py-3 bg-violet-500 hover:bg-violet-400 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Play Again
            </button>
            <button
              onClick={() => {
                if (roomState) leaveLobby(userId);
                setActiveView('MENU');
                setGameStatus('idle');
              }}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl transition-colors border border-white/10 text-sm cursor-pointer"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render Router ──────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-screen bg-gradient-to-b from-gray-950 via-slate-950 to-black text-white">
      {/* Add shake keyframe animation */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-6px) rotate(-2deg); }
          30% { transform: translateX(5px) rotate(1deg); }
          45% { transform: translateX(-4px) rotate(-1deg); }
          60% { transform: translateX(3px) rotate(0.5deg); }
          75% { transform: translateX(-2px); }
        }
      `}</style>

      {(activeView === 'MENU' || activeView === 'MULTIPLAYER_LOBBY' || activeView === 'MATCH_RESULTS') && renderNavbar()}
      {renderRulesModal()}
      {renderLeaderboardModal()}

      {activeView === 'MENU' && renderMenu()}
      {activeView === 'SINGLEPLAYER' && renderSingleplayer()}
      {activeView === 'MULTIPLAYER_LOBBY' && renderMultiplayerLobby()}
      {activeView === 'MULTIPLAYER_MATCH' && renderMultiplayerMatch()}
      {activeView === 'MATCH_RESULTS' && renderMatchResults()}
    </div>
  );
}

export default ArrowMazeGameHub;
