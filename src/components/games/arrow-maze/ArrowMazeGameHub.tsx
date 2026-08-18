"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';
import { useArrowMazeStore } from '@/store/useArrowMazeStore';
import { ArrowMazeEngine } from './ArrowMazeEngine';
import ArrowMazeBoard from './ArrowMazeBoard';
import type { ScoreBreakdown, MultiplayerMode, LevelCount, TimedDuration } from './types';
import { socketService } from '@/lib/socket';
import Link from 'next/link';
import {
  ArrowLeft, Play, RotateCcw, Users, UserPlus, Copy, Check,
  Crown, Trophy, Zap, Target, Clock, ChevronLeft,
  Heart, Lightbulb, ArrowRight, Pause, X, SkipForward,
} from 'lucide-react';

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
          className={`w-5 h-5 transition-all duration-300 ${
            i < lives
              ? 'text-red-500 fill-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]'
              : 'text-gray-700 fill-gray-800'
          }`}
        />
      ))}
    </div>
  );
}

// ── Main Hub Component ───────────────────────────────────

export function ArrowMazeGameHub() {
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get('gameId');

  const userId = useUserStore((s) => s.id) || '';
  const nickname = useUserStore((s) => s.nickname) || 'Player';
  const avatar = useUserStore((s) => s.avatar);

  const {
    multiplayerMode, setMultiplayerMode,
    levelCount, setLevelCount,
    timedDuration, setTimedDuration,
    roomState, availableLobbies, matchResults,
    soloStats, fetchStats, submitSoloProgress,
    createLobby, joinLobby, toggleReady, kickPlayer, invitePlayer,
    updateSettings, startMatch, leaveLobby, fetchLobbies,
    returnToLobby, resetLobby, sendProgress, sendLevelCleared, sendFinished,
    initLobbySockets,
  } = useArrowMazeStore();

  const [activeView, setActiveView] = useState<ActiveView>('MENU');
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'levelComplete' | 'over'>('idle');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentScore, setCurrentScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [maxLives, setMaxLives] = useState(3);
  const [arrowsRemaining, setArrowsRemaining] = useState(0);
  const [hintArrowId, setHintArrowId] = useState<number | null>(null);
  const [hintsLeft, setHintsLeft] = useState(2);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [onlineFriends, setOnlineFriends] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());
  const [countdownVal, setCountdownVal] = useState<number | null>(null);
  const [matchTimeRemaining, setMatchTimeRemaining] = useState<number | undefined>(undefined);
  const [multiLevelsClearedThisMatch, setMultiLevelsClearedThisMatch] = useState(0);
  const [multiTotalScoreThisMatch, setMultiTotalScoreThisMatch] = useState(0);

  const engineRef = useRef<ArrowMazeEngine | null>(null);
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;
  const roomStateRef = useRef(roomState);
  roomStateRef.current = roomState;
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

  // Fetch stats
  useEffect(() => {
    if (userId) fetchStats(userId);
  }, [userId]);

  // Init sockets
  useEffect(() => {
    if (userId) {
      const cleanup = initLobbySockets(userId);
      return () => cleanup();
    }
  }, [userId]);

  // Handle URL invite
  useEffect(() => {
    if (gameIdParam && userId && nickname && !roomState) {
      setActiveView('MULTIPLAYER_LOBBY');
      joinLobby(gameIdParam, userId, nickname);
    }
  }, [gameIdParam, userId, nickname]);

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

  // Fetch online friends for invite
  useEffect(() => {
    if (!userId || !showInviteModal) return;
    const apiUrl = typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_SOCKET_URL || `http://${window.location.hostname}:3001`)
      : 'http://localhost:3001';
    fetch(`${apiUrl}/api/users/online`)
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setOnlineFriends(data.filter((u) => u.id !== userId)); })
      .catch(console.error);
  }, [userId, showInviteModal]);

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

  const startSoloGame = useCallback((startLevel: number) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.resetForNewGame();
    const seed = Date.now();
    eng.startLevel(startLevel, seed);
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
    eng.startLevel(nextLevel);
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
    const eng = engineRef.current;
    if (!eng) return;
    eng.startLevel(eng.currentLevel);
    setLives(eng.lives);
    setMaxLives(eng.maxLives);
    setArrowsRemaining(eng.getRemainingArrows());
    setHintsLeft(eng.hintsRemaining);
    setScoreBreakdown(null);
    setHintArrowId(null);
    setGameStatus('playing');
  }, []);

  const startMultiplayerGame = useCallback((seed: number, startTime?: number) => {
    const eng = engineRef.current;
    const room = roomStateRef.current;
    if (!eng || !room) return;
    eng.resetForNewGame();
    eng.startLevel(1, seed);
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

  const handleInvite = useCallback((targetId: string) => {
    if (!roomState) return;
    invitePlayer(roomState.id, userId, nickname, targetId);
    setInvitedUsers((prev) => new Set(prev).add(targetId));
  }, [roomState, userId, nickname, invitePlayer]);

  const formatTime = (seconds: number | undefined) => {
    if (seconds === undefined) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── MENU VIEW ──────────────────────────────────────────

  const renderMenu = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8">
      <div className="max-w-2xl w-full space-y-8">
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

        {/* Mode Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => startSoloGame(soloStats.currentLevel || 1)}
            className="group relative overflow-hidden bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl p-6 text-left hover:border-cyan-400/50 transition-all duration-300 hover:scale-[1.02]"
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
            className="group relative overflow-hidden bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl p-6 text-left hover:border-violet-400/50 transition-all duration-300 hover:scale-[1.02]"
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
    <div className="flex flex-col h-[100dvh] w-full bg-slate-900 overflow-hidden relative">
      {/* Top HUD */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0 z-20">
        <button
          onClick={() => {
            if (gameStatus === 'playing') {
              setGameStatus('paused');
            } else {
              setActiveView('MENU');
              setGameStatus('idle');
            }
          }}
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center">
          <div className="text-xl font-bold text-white leading-none">Level {currentLevel}</div>
          <div className="text-sm font-semibold text-yellow-400 mt-1">{totalScore.toLocaleString()} pts</div>
        </div>

        <div className="flex items-center gap-1">
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
            className="w-full h-full p-2 sm:p-6"
          />
        )}

        {/* Pause overlay */}
        {gameStatus === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-30">
            <div className="text-center space-y-4">
              <Pause className="w-12 h-12 text-gray-400 mx-auto" />
              <div className="text-3xl font-bold text-white">Paused</div>
              <p className="text-gray-400 text-sm">Level {currentLevel} — {arrowsRemaining} arrows remaining</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setGameStatus('playing')}
                  className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-xl transition-colors"
                >
                  Resume
                </button>
                <button
                  onClick={() => { setActiveView('MENU'); setGameStatus('idle'); }}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors border border-white/10"
                >
                  Quit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Level Complete overlay */}
        {gameStatus === 'levelComplete' && scoreBreakdown && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-30">
            <div className="max-w-sm w-full mx-4 bg-slate-800 border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl">
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider text-emerald-400 mb-1">✨ Level Complete!</div>
                <div className="text-3xl font-bold text-white">Level {currentLevel}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Arrows" value={`+${scoreBreakdown.arrowPoints}`} icon={<Target className="w-4 h-4 text-cyan-400" />} />
                <StatBox label="Time" value={`+${scoreBreakdown.timeBonus}`} icon={<Clock className="w-4 h-4 text-amber-400" />} />
                <StatBox label="Streak" value={`+${scoreBreakdown.streakBonus}`} icon={<Zap className="w-4 h-4 text-violet-400" />} />
                <StatBox label="Lives" value={`+${scoreBreakdown.lifeBonus}`} icon={<Heart className="w-4 h-4 text-red-400" />} />
              </div>

              <div className="text-center py-2 bg-white/5 rounded-xl border border-white/10">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Level Score</div>
                <div className="text-2xl font-bold text-yellow-400">{scoreBreakdown.total.toLocaleString()}</div>
              </div>

              <button
                onClick={advanceToNextLevel}
                className="w-full px-4 py-3.5 bg-white text-[#07164a] font-bold rounded-xl transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                <ArrowRight className="w-5 h-5" /> Next Level
              </button>
            </div>
          </div>
        )}

        {/* Game Over overlay */}
        {gameStatus === 'over' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-30">
            <div className="max-w-sm w-full mx-4 bg-slate-800 border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl">
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider text-red-400 mb-1">💀 Game Over</div>
                <div className="text-2xl font-bold text-white">
                  {totalScore > soloStats.highScore ? '🎉 New High Score!' : 'Out of Lives'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Score" value={totalScore.toLocaleString()} icon={<Trophy className="w-4 h-4 text-yellow-400" />} />
                <StatBox label="Level" value={String(currentLevel)} icon={<Target className="w-4 h-4 text-cyan-400" />} />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={retryLevel}
                  className="flex-1 px-4 py-3 bg-white text-[#07164a] font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Retry
                </button>
                <button
                  onClick={() => { setActiveView('MENU'); setGameStatus('idle'); }}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors border border-white/10"
                >
                  Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-6 pb-8 pt-2 shrink-0 z-20">
        <button
          onClick={handleHint}
          disabled={hintsLeft <= 0 || gameStatus !== 'playing'}
          className={`relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all ${
            hintsLeft > 0 && gameStatus === 'playing'
              ? 'bg-white text-[#07164a] hover:scale-105 active:scale-95'
              : 'bg-white/20 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Lightbulb className="w-7 h-7" />
          {hintsLeft > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 border-2 border-slate-900 text-[10px] font-bold text-black flex items-center justify-center">
              {hintsLeft}
            </span>
          )}
        </button>
        <button
          onClick={retryLevel}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-white text-[#07164a] shadow-lg hover:scale-105 active:scale-95 transition-all"
        >
          <RotateCcw className="w-7 h-7" />
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
      <div className="flex flex-col min-h-screen p-4 md:p-8">
        <div className="max-w-3xl w-full mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button onClick={() => { if (roomState) leaveLobby(userId); setActiveView('MENU'); }}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Multiplayer Lobby</h1>
              <p className="text-sm text-gray-500">Arrow Maze — Race to solve</p>
            </div>
          </div>

          {/* Not in a lobby */}
          {!roomState ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => createLobby(userId, nickname)}
                  className="bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl p-6 text-left hover:border-violet-400/50 transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Crown className="w-5 h-5 text-violet-400" />
                    <span className="text-lg font-bold text-white">Create Lobby</span>
                  </div>
                  <p className="text-sm text-gray-400">Host a game and invite friends</p>
                </button>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="text-sm font-semibold text-gray-300 mb-3">Join with Code</div>
                  <div className="flex gap-2">
                    <input
                      value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Paste lobby code..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50"
                    />
                    <button
                      onClick={() => { if (joinCode.trim()) joinLobby(joinCode, userId, nickname); }}
                      className="px-4 py-2.5 bg-violet-500 hover:bg-violet-400 text-white font-bold rounded-xl transition-colors text-sm"
                    >
                      Join
                    </button>
                  </div>
                </div>
              </div>

              {/* Available Lobbies */}
              {availableLobbies.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Open Lobbies</div>
                  {availableLobbies.map((lobby) => (
                    <div key={lobby.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4">
                      <div>
                        <div className="font-semibold text-white">{lobby.hostName}&apos;s Lobby</div>
                        <div className="text-xs text-gray-500">{lobby.playerCount}/{lobby.maxPlayers} players</div>
                      </div>
                      <button
                        onClick={() => joinLobby(lobby.id, userId, nickname)}
                        className="px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white text-sm font-bold rounded-lg transition-colors"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* In a lobby */
            <div className="space-y-5">
              {/* Lobby Code */}
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Lobby Code</div>
                <code className="text-sm text-violet-400 font-mono flex-1 truncate">{roomState.id}</code>
                <button onClick={handleCopyLink} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
                <button onClick={() => setShowInviteModal(true)} className="p-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 transition-colors">
                  <UserPlus className="w-4 h-4 text-violet-400" />
                </button>
              </div>

              {/* Settings (host only) */}
              {isHost && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                  <div className="text-sm font-semibold text-gray-300">Match Settings</div>

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
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
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
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
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
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
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

              {/* Players list */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-400">Players ({roomState.players.length}/8)</div>
                {roomState.players.map((p) => (
                  <div key={p.userId} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                        {p.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm flex items-center gap-2">
                          {p.nickname}
                          {p.isHost && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.userId === userId && !p.isHost && (
                        <button
                          onClick={() => toggleReady(roomState.id, userId)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            p.isReady
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {p.isReady ? '✓ Ready' : 'Ready Up'}
                        </button>
                      )}
                      {isHost && p.userId !== userId && (
                        <button
                          onClick={() => kickPlayer(roomState.id, userId, p.userId)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {p.isReady && !p.isHost && (
                        <span className="text-[10px] text-emerald-400 font-bold">READY</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Start / Leave */}
              <div className="flex gap-3">
                {isHost && (
                  <button
                    onClick={() => startMatch(roomState.id, userId)}
                    disabled={!canStart}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      canStart
                        ? 'bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white hover:scale-[1.02]'
                        : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                    }`}
                  >
                    <Play className="w-4 h-4" /> Start Match
                  </button>
                )}
                <button
                  onClick={() => { leaveLobby(userId); setActiveView('MENU'); }}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl transition-colors border border-white/10 text-sm"
                >
                  Leave
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-bold text-white">Invite Players</div>
                <button onClick={() => setShowInviteModal(false)} className="p-1 rounded-lg hover:bg-white/10 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {onlineFriends.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No online users found</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {onlineFriends.map((u) => (
                    <div key={u.id} className="flex items-center justify-between bg-white/5 rounded-lg p-2.5">
                      <span className="text-sm text-white">{u.nickname}</span>
                      <button
                        onClick={() => handleInvite(u.id)}
                        disabled={invitedUsers.has(u.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          invitedUsers.has(u.id)
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-violet-500 hover:bg-violet-400 text-white'
                        }`}
                      >
                        {invitedUsers.has(u.id) ? 'Invited' : 'Invite'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── MULTIPLAYER MATCH VIEW ─────────────────────────────

  const renderMultiplayerMatch = () => (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-900 overflow-hidden relative">
      {/* Top HUD */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <LivesDisplay lives={lives} maxLives={maxLives} />
          <div className="w-px h-6 bg-white/20" />
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-400 tabular-nums">{(engineRef.current?.totalScore ?? 0).toLocaleString()}</div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="text-xl font-bold text-white leading-none">Level {currentLevel}</div>
          {matchTimeRemaining !== undefined && (
            <div className={`text-sm font-bold tabular-nums mt-1 ${matchTimeRemaining <= 30 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
              {formatTime(matchTimeRemaining)}
            </div>
          )}
        </div>
      </div>

      {/* Countdown overlay */}
      {countdownVal !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-40">
          <div className="text-8xl font-black text-white animate-bounce drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
            {countdownVal}
          </div>
        </div>
      )}

      {/* Game Board */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 w-full min-h-0 relative">
        {engineRef.current && gameStatus === 'playing' && (
          <ArrowMazeBoard
            engine={engineRef.current}
            onArrowClick={handleArrowClick}
            hintArrowId={null}
            className="w-full h-full p-2 sm:p-6"
          />
        )}

        {/* Level complete in multiplayer — auto advance */}
        {gameStatus === 'levelComplete' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 z-30">
            <div className="text-center space-y-3 animate-in fade-in zoom-in duration-300 bg-slate-800 p-6 rounded-3xl shadow-2xl">
              <div className="text-5xl font-black text-emerald-400 drop-shadow-lg">
                ✓ Level {currentLevel}
              </div>
              <div className="text-xl text-yellow-400 font-bold">+{scoreBreakdown?.total.toLocaleString()} pts</div>
              <button
                onClick={advanceToNextLevel}
                className="px-6 py-3 bg-white text-[#07164a] font-bold rounded-xl transition-all"
              >
                Next Level →
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Bottom Controls / Opponents sidebar */}
      <div className="flex items-center justify-between px-4 pb-8 pt-2 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={retryLevel}
            className="flex items-center justify-center w-14 h-14 rounded-full bg-white text-[#07164a] shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            <RotateCcw className="w-7 h-7" />
          </button>
        </div>

        {roomState && roomState.players.length > 1 && (
          <div className="flex flex-row-reverse gap-2 overflow-x-auto pb-2 items-center flex-1 ml-4 mask-fade-left">
            {roomState.players
              .filter(p => p.userId !== userId)
              .map(p => (
                <div key={p.userId} className="bg-slate-800 border border-white/10 rounded-xl p-2 w-28 shrink-0 flex flex-col justify-between h-14 shadow-md">
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
      <div className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8">
        <div className="max-w-lg w-full space-y-6">
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
              className="flex-1 px-4 py-3 bg-violet-500 hover:bg-violet-400 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <RotateCcw className="w-4 h-4" /> Play Again
            </button>
            <button
              onClick={() => {
                if (roomState) leaveLobby(userId);
                setActiveView('MENU');
                setGameStatus('idle');
              }}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl transition-colors border border-white/10 text-sm"
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
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-slate-950 to-black">
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

      {activeView === 'MENU' && renderMenu()}
      {activeView === 'SINGLEPLAYER' && renderSingleplayer()}
      {activeView === 'MULTIPLAYER_LOBBY' && renderMultiplayerLobby()}
      {activeView === 'MULTIPLAYER_MATCH' && renderMultiplayerMatch()}
      {activeView === 'MATCH_RESULTS' && renderMatchResults()}
    </div>
  );
}
