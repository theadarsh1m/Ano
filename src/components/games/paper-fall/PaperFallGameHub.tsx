"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';
import { usePaperFallStore } from '@/store/usePaperFallStore';
import { PaperFallEngine } from './PaperFallEngine';
import PaperFallCanvas from './PaperFallCanvas';
import type { Difficulty, MatchDuration, PlayerMatchStats, WpmSample } from './types';
import { DIFFICULTY_CONFIGS } from './types';
import { socketService } from '@/lib/socket';
import Link from 'next/link';
import {
  ArrowLeft, Play, RotateCcw, Users, UserPlus, Copy, Check,
  Crown, Trophy, Zap, Target, Clock, BarChart3, Keyboard,
  Bomb, Shield, Gauge, X, Pause, ChevronLeft,
} from 'lucide-react';

type ActiveView = 'MENU' | 'SINGLEPLAYER' | 'MULTIPLAYER_LOBBY' | 'MULTIPLAYER_MATCH' | 'MATCH_RESULTS';

export function PaperFallGameHub() {
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get('gameId');

  const userId = useUserStore((s) => s.id) || '';
  const nickname = useUserStore((s) => s.nickname) || 'Player';
  const avatar = useUserStore((s) => s.avatar);

  const {
    mode, setMode,
    difficulty, setDifficulty,
    matchDuration, setMatchDuration,
    roomState, availableLobbies, matchResults,
    fetchStats, submitSinglePlayerScore,
    createLobby, joinLobby, toggleReady, kickPlayer, invitePlayer,
    updateSettings, startMatch, leaveLobby, fetchLobbies,
    returnToLobby, resetLobby, sendProgress, sendWordTyped, sendFinished,
    initLobbySockets, singlePlayerStats,
  } = usePaperFallStore();

  const [activeView, setActiveView] = useState<ActiveView>('MENU');
  const [gameStatus, setGameStatus] = useState<'idle' | 'playing' | 'paused' | 'over'>('idle');
  const [currentScore, setCurrentScore] = useState(0);
  const [currentWpm, setCurrentWpm] = useState(0);
  const [currentAccuracy, setCurrentAccuracy] = useState(100);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [levelFlash, setLevelFlash] = useState<number | null>(null);
  const [currentCombo, setCurrentCombo] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | undefined>(undefined);
  const [countdownVal, setCountdownVal] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [onlineFriends, setOnlineFriends] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());
  const [soloEndStats, setSoloEndStats] = useState<{
    score: number; wpm: number; accuracy: number; wordsTyped: number;
    errors: number; level: number; wpmHistory: WpmSample[]; timeSurvived: number;
  } | null>(null);

  const engineRef = useRef<PaperFallEngine | null>(null);
  const ghostRef = useRef<HTMLInputElement>(null);
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;
  const roomStateRef = useRef(roomState);
  roomStateRef.current = roomState;

  // Initialize engine
  useEffect(() => {
    const eng = new PaperFallEngine();
    engineRef.current = eng;
    eng.onScoreUpdate = (s) => setCurrentScore(s);
    eng.onLevelUp = (l) => {
      setCurrentLevel(l);
      setLevelFlash(l);
      setTimeout(() => setLevelFlash(null), 2000);
    };
    eng.onGameOver = (finalScore, stats) => {
      setGameStatus('over');
      setSoloEndStats({ score: finalScore, ...stats });
      if (activeViewRef.current === 'SINGLEPLAYER' && userId) {
        submitSinglePlayerScore(userId, finalScore, stats.wordsTyped, stats.timeSurvived, nickname, avatar);
      }
      if (activeViewRef.current === 'MULTIPLAYER_MATCH' && roomStateRef.current && userId) {
        sendFinished(roomStateRef.current.id, userId, {
          userId,
          nickname,
          avatar,
          rank: 0,
          score: finalScore,
          wordsTyped: stats.wordsTyped,
          totalErrors: stats.errors,
          avgWpm: stats.wpm,
          peakWpm: Math.max(...stats.wpmHistory.map(w => w.wpm), stats.wpm),
          accuracy: stats.accuracy,
          levelReached: stats.level,
          wpmTimeline: stats.wpmHistory,
        });
      }
    };
    eng.onWordTyped = (word, score) => {
      if (activeViewRef.current === 'MULTIPLAYER_MATCH' && roomStateRef.current && userId) {
        sendWordTyped(roomStateRef.current.id, userId, word, score);
      }
    };
    eng.onProgressUpdate = (data) => {
      if (activeViewRef.current === 'MULTIPLAYER_MATCH' && roomStateRef.current && userId) {
        sendProgress(roomStateRef.current.id, userId, data);
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
          engineRef.current?.pause();
          setCountdownVal(roomState.countdownValue ?? null);
        } else if (roomState.status === 'PLAYING') {
          engineRef.current?.resume();
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
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomState, activeView]);

  // Fetch online friends for invite modal
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

  // Keyboard input handling
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (activeView !== 'SINGLEPLAYER' && activeView !== 'MULTIPLAYER_MATCH') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (engineRef.current) {
          if (engineRef.current.state.phase === 'paused') {
            engineRef.current.resume();
            setGameStatus('playing');
          } else if (engineRef.current.state.phase === 'play') {
            engineRef.current.pause();
            setGameStatus('paused');
          }
        }
        return;
      }
      if (e.key === ' ') { e.preventDefault(); return; }
      if (e.key.length === 1) {
        e.preventDefault();
        engineRef.current?.handleChar(e.key);
        updateHud();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeView]);

  // Ghost input for mobile
  useEffect(() => {
    const ghost = ghostRef.current;
    if (!ghost) return;
    const onInput = () => {
      const v = ghost.value;
      ghost.value = '';
      for (const ch of v) engineRef.current?.handleChar(ch);
      updateHud();
    };
    ghost.addEventListener('input', onInput);
    return () => ghost.removeEventListener('input', onInput);
  }, []);

  // HUD update interval
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    const interval = setInterval(updateHud, 60);
    return () => clearInterval(interval);
  }, [gameStatus]);

  const updateHud = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    setCurrentScore(Math.round(eng.state.score));
    setCurrentWpm(eng.getWpm());
    setCurrentAccuracy(eng.getAccuracy());
    setCurrentLevel(eng.state.level);
    setCurrentCombo(eng.state.combo);
    setTimeRemaining(eng.getTimeRemaining());
  }, []);

  const claimKeyboard = useCallback(() => {
    try { window.focus(); } catch {}
    try { ghostRef.current?.focus({ preventScroll: true }); } catch { try { ghostRef.current?.focus(); } catch {} }
  }, []);

  // ── Game actions ──────────────────────────────────────

  const startSoloGame = useCallback((diff: Difficulty) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.mode = 'SURVIVAL';
    eng.difficulty = diff;
    eng.isMultiplayer = false;
    eng.matchDuration = 0;
    eng.start();
    setSoloEndStats(null);
    setGameStatus('playing');
    setCountdownVal(null);
    claimKeyboard();
  }, [claimKeyboard]);

  const startCampaignSoloGame = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.mode = 'CAMPAIGN';
    eng.isMultiplayer = false;
    eng.matchDuration = 0;
    eng.start();
    setSoloEndStats(null);
    setGameStatus('playing');
    setCountdownVal(null);
    claimKeyboard();
  }, [claimKeyboard]);

  const startMultiplayerGame = useCallback((seed: number, startTime?: number) => {
    const eng = engineRef.current;
    const room = roomStateRef.current;
    if (!eng || !room) return;
    const { mode: storeMode } = usePaperFallStore.getState();
    eng.mode = room.settings?.mode || storeMode;
    eng.difficulty = room.settings?.difficulty || difficulty;
    eng.isMultiplayer = true;
    eng.matchDuration = eng.mode === 'CAMPAIGN' ? 0 : (room.settings?.matchDuration || matchDuration);
    eng.start(seed, startTime);
    setSoloEndStats(null);
    setGameStatus('playing');
    claimKeyboard();
  }, [difficulty, matchDuration, claimKeyboard]);

  const handleCopyLink = useCallback(() => {
    if (!roomState) return;
    const url = `${window.location.origin}/dashboard/games/paper-fall?gameId=${roomState.id}`;
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

  // ── MENU VIEW ─────────────────────────────────────────

  const renderMenu = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8">
      <div className="max-w-2xl w-full space-y-8">
        {/* Title */}
        <div className="text-center space-y-3">
          <div className="text-6xl md:text-7xl font-bold tracking-tight text-white">
            Paper<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">Fall</span>
          </div>
          <p className="text-gray-400 text-sm md:text-base max-w-md mx-auto">
            Words drift down from the sky. Type them to fire your cannon. Don&apos;t let a single paper touch the ground.
          </p>
        </div>

        {/* Stats Card */}
        {singlePlayerStats.gamesPlayed > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-around text-center backdrop-blur-sm">
            <div><div className="text-xl font-bold text-yellow-400">{singlePlayerStats.highScore.toLocaleString()}</div><div className="text-[10px] text-gray-500 uppercase tracking-wider">Best Score</div></div>
            <div className="w-px h-10 bg-white/10" />
            <div><div className="text-xl font-bold text-cyan-400">{singlePlayerStats.bestWpm}</div><div className="text-[10px] text-gray-500 uppercase tracking-wider">Peak WPM</div></div>
            <div className="w-px h-10 bg-white/10" />
            <div><div className="text-xl font-bold text-emerald-400">{singlePlayerStats.gamesPlayed}</div><div className="text-[10px] text-gray-500 uppercase tracking-wider">Games</div></div>
          </div>
        )}

        {/* Mode Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setActiveView('SINGLEPLAYER')}
            className="group relative overflow-hidden bg-gradient-to-br from-orange-500/20 to-amber-600/20 border border-orange-500/30 rounded-2xl p-6 text-left hover:border-orange-400/50 transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <Keyboard className="w-5 h-5 text-orange-400" />
                </div>
                <div className="text-lg font-bold text-white">Solo Run</div>
              </div>
              <p className="text-sm text-gray-400">Fire the cannon, clear the sky. One paper on the ground ends it all.</p>
            </div>
          </button>

          <button
            onClick={() => {
              setActiveView('MULTIPLAYER_LOBBY');
              fetchLobbies();
            }}
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
              <p className="text-sm text-gray-400">Same words, same sky. Race your friends in a timed typing battle.</p>
            </div>
          </button>
        </div>

        {/* How to Play */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 text-sm backdrop-blur-sm">
          <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">How to Play</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-[10px] font-bold text-orange-400 shrink-0">1</div>
              <div className="text-gray-400">Type any falling word. The first letter <span className="text-white font-medium">locks your target</span>.</div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-[10px] font-bold text-orange-400 shrink-0">2</div>
              <div className="text-gray-400">Finish it before switching. Wrong keys break your <span className="text-white font-medium">combo</span>.</div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-[10px] font-bold text-orange-400 shrink-0">3</div>
              <div className="text-gray-400">In <span className="text-red-400 font-medium">Hard mode</span>, bomb words 💣 explode into scattered letters!</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── SINGLEPLAYER VIEW ─────────────────────────────────

  const renderSingleplayer = () => (
    <div className="flex flex-col h-full min-h-screen bg-black relative">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 md:p-4">
        <button
          onClick={() => { 
            engineRef.current?.pause(); 
            if (gameStatus === 'playing') {
              handleGameOver();
            } else {
              setActiveView('MENU'); 
              setGameStatus('idle'); 
            }
          }}
          className="p-2 rounded-full bg-black/40 backdrop-blur-md text-gray-300 hover:text-white hover:bg-black/60 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {gameStatus === 'playing' && (
          <div className="flex items-center gap-3 md:gap-5 bg-black/40 backdrop-blur-md rounded-full px-4 py-2">
            <div className="text-center">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Score</div>
              <div className="text-lg font-bold text-white tabular-nums">{currentScore.toLocaleString()}</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Level</div>
              <div className="text-lg font-bold text-white">{currentLevel}</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="text-[10px] text-orange-400 uppercase tracking-wider">Combo</div>
              <div className="text-lg font-bold text-orange-400">×{engineRef.current?.getComboMultiplier().toFixed(1)}</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">WPM</div>
              <div className="text-lg font-bold text-cyan-400">{currentWpm}</div>
            </div>
            <div className="w-px h-8 bg-white/10 hidden md:block" />
            <div className="text-center hidden md:block">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Accuracy</div>
              <div className="text-lg font-bold text-emerald-400">{currentAccuracy}%</div>
            </div>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        {engineRef.current && (
          <PaperFallCanvas
            engine={engineRef.current}
            isPlaying={gameStatus === 'playing'}
            className="absolute inset-0"
          />
        )}

        {/* Level Flash Overlay */}
        {levelFlash !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-in fade-in zoom-in duration-500 fade-out duration-1000">
            <div className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500 drop-shadow-[0_0_30px_rgba(249,115,22,0.5)]">
              LEVEL {levelFlash}
            </div>
          </div>
        )}

        {/* Difficulty selector (idle state) */}
        {gameStatus === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/30 via-black/60 to-black/80 z-10">
            <div className="text-center space-y-6 max-w-lg px-4">
              <div className="text-4xl md:text-5xl font-bold text-white">
                Paper<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">Fall</span>
              </div>
              <p className="text-gray-400">Choose your difficulty</p>
              <div className="grid grid-cols-3 gap-3">
                {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map((d) => {
                  const cfg = DIFFICULTY_CONFIGS[d];
                  return (
                    <button
                      key={d}
                      onClick={() => startSoloGame(d)}
                      className={`relative overflow-hidden rounded-xl p-4 border transition-all duration-300 hover:scale-105 ${
                        d === 'EASY' ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-400/60' :
                        d === 'MEDIUM' ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400/60' :
                        'bg-red-500/10 border-red-500/30 hover:border-red-400/60'
                      }`}
                    >
                      <div className={`text-lg font-bold mb-1 ${
                        d === 'EASY' ? 'text-emerald-400' : d === 'MEDIUM' ? 'text-amber-400' : 'text-red-400'
                      }`}>{cfg.label}</div>
                      <div className="text-[10px] text-gray-500">
                        {cfg.wordLengthMin}-{cfg.wordLengthMax} chars
                      </div>
                      {d === 'HARD' && (
                        <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-red-400">
                          <Bomb className="w-3 h-3" /> Bomb Words
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="pt-4 border-t border-white/10">
                <button
                  onClick={() => startCampaignSoloGame()}
                  className="w-full relative overflow-hidden rounded-xl p-4 border bg-purple-500/10 border-purple-500/30 hover:border-purple-400/60 transition-all duration-300 hover:scale-105"
                >
                  <div className="text-lg font-bold mb-1 text-purple-400">Campaign Mode</div>
                  <div className="text-[10px] text-gray-400">Progress through 10 levels of increasing difficulty</div>
                </button>
              </div>
              <div className="text-xs text-gray-600">Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-gray-400 font-mono text-[10px]">Esc</kbd> to pause</div>
            </div>
          </div>
        )}

        {/* Pause overlay */}
        {gameStatus === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-10">
            <div className="text-center space-y-4">
              <Pause className="w-12 h-12 text-gray-400 mx-auto" />
              <div className="text-3xl font-bold text-white">Paused</div>
              <p className="text-gray-400 text-sm">The sky waits. Your combo does not.</p>
              <button
                onClick={() => { engineRef.current?.resume(); setGameStatus('playing'); claimKeyboard(); }}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl transition-colors"
              >
                Resume
              </button>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {gameStatus === 'over' && soloEndStats && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-10">
            <div className="max-w-md w-full mx-4 bg-neutral-900/95 border border-white/10 rounded-2xl p-6 space-y-5">
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Run Ended</div>
                <div className="text-2xl font-bold text-white">
                  {soloEndStats.score > singlePlayerStats.highScore ? '🎉 New High Score!' : 'Ground Contact.'}
                </div>
                {engineRef.current?.state.culprit && (
                  <p className="text-sm text-gray-400 mt-1">
                    &ldquo;<span className="text-orange-400 italic font-medium">{engineRef.current.state.culprit}</span>&rdquo; made it through.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatBox label="Score" value={soloEndStats.score.toLocaleString()} icon={<Trophy className="w-4 h-4 text-yellow-400" />} />
                <StatBox label="WPM" value={String(soloEndStats.wpm)} icon={<Gauge className="w-4 h-4 text-cyan-400" />} />
                <StatBox label="Accuracy" value={`${soloEndStats.accuracy}%`} icon={<Target className="w-4 h-4 text-emerald-400" />} />
                <StatBox label="Words" value={String(soloEndStats.wordsTyped)} icon={<Keyboard className="w-4 h-4 text-violet-400" />} />
              </div>

              {/* Mini WPM Graph */}
              {soloEndStats.wpmHistory.length > 2 && (
                <MiniWpmGraph data={soloEndStats.wpmHistory} />
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setGameStatus('idle')}
                  className="flex-1 px-4 py-3 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Play Again
                </button>
                <button
                  onClick={() => { setActiveView('MENU'); setGameStatus('idle'); }}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl transition-colors border border-white/10"
                >
                  Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden input for mobile keyboard */}
      <input
        ref={ghostRef}
        className="fixed left-2 bottom-2 w-px h-px opacity-[0.01] border-0 p-0 bg-transparent text-transparent"
        autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        aria-label="Type here"
      />
    </div>
  );

  // ── MULTIPLAYER LOBBY VIEW ────────────────────────────

  const renderMultiplayerLobby = () => {
    const isHost = roomState?.hostId === userId;
    const allReady = roomState?.players?.every((p) => p.isHost || p.isReady);
    const canStart = isHost && (roomState?.players?.length ?? 0) >= 2 && allReady;

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
              <p className="text-sm text-gray-500">PaperFall — Timed typing battle</p>
            </div>
          </div>

          {/* Not in a lobby — Create or Join */}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <div className="text-xs text-gray-500 mb-2">Game Mode</div>
                      <div className="flex gap-2">
                        {(['SURVIVAL', 'CAMPAIGN'] as any[]).map((m) => (
                          <button key={m}
                            onClick={() => updateSettings(roomState.id, userId, { mode: m })}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                              (roomState.settings?.mode || mode) === m
                                ? 'bg-violet-500/30 text-violet-400 border border-violet-500/50'
                                : 'bg-white/5 text-gray-500 border border-white/10'
                            }`}
                          >
                            {m === 'SURVIVAL' ? 'Survival (Timed)' : 'Campaign (10 Levels)'}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {(roomState.settings?.mode || mode) === 'SURVIVAL' && (
                      <>
                        <div>
                          <div className="text-xs text-gray-500 mb-2">Difficulty</div>
                          <div className="flex gap-2">
                            {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map((d) => (
                              <button key={d}
                                onClick={() => updateSettings(roomState.id, userId, { difficulty: d })}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                  (roomState.settings?.difficulty || difficulty) === d
                                    ? d === 'EASY' ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                                    : d === 'MEDIUM' ? 'bg-amber-500/30 text-amber-400 border border-amber-500/50'
                                    : 'bg-red-500/30 text-red-400 border border-red-500/50'
                                    : 'bg-white/5 text-gray-500 border border-white/10'
                                }`}
                              >
                                {d === 'HARD' && '💣 '}{DIFFICULTY_CONFIGS[d].label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-2">Match Duration</div>
                          <div className="flex gap-2">
                            {([60, 180, 300, 600] as MatchDuration[]).map((dur) => (
                              <button key={dur}
                                onClick={() => updateSettings(roomState.id, userId, { matchDuration: dur })}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                  (roomState.settings?.matchDuration || matchDuration) === dur
                                    ? 'bg-violet-500/30 text-violet-400 border border-violet-500/50'
                                    : 'bg-white/5 text-gray-500 border border-white/10'
                                }`}
                              >
                                {dur / 60}m
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Players */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-400">Players ({roomState.players.length}/8)</div>
                {roomState.players.map((p) => (
                  <div key={p.userId} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
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
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
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
                    className={`flex-1 px-4 py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                      canStart ? 'bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white' : 'bg-white/5 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-4 h-4" /> Start Match
                  </button>
                ) : (
                  <button
                    onClick={() => toggleReady(roomState.id, userId)}
                    className={`flex-1 px-4 py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                      roomState.players.find(p => p.userId === userId)?.isReady
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-violet-500 hover:bg-violet-400 text-white'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    {roomState.players.find(p => p.userId === userId)?.isReady ? 'Unready' : 'Ready Up'}
                  </button>
                )}
                <button
                  onClick={() => { leaveLobby(userId); setActiveView('MENU'); }}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-400 font-medium rounded-xl transition-colors border border-white/10"
                >
                  Leave
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <div className="relative bg-neutral-900 border border-white/10 rounded-2xl max-w-sm w-full p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white">Invite Players</h3>
                <button onClick={() => setShowInviteModal(false)} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400"><X className="w-4 h-4" /></button>
              </div>
              {onlineFriends.length > 0 ? onlineFriends.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                    {f.avatar ? <img src={f.avatar} alt="" className="w-full h-full object-cover" /> : f.nickname?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 text-sm font-medium text-white truncate">{f.nickname}</div>
                  <button
                    onClick={() => handleInvite(f.id)}
                    disabled={invitedUsers.has(f.id)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${invitedUsers.has(f.id) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-500 hover:bg-violet-400 text-white'}`}
                  >
                    {invitedUsers.has(f.id) ? 'Invited' : 'Invite'}
                  </button>
                </div>
              )) : (
                <p className="text-sm text-gray-500 text-center py-4">No online players found</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── MULTIPLAYER MATCH VIEW ────────────────────────────

  const renderMultiplayerMatch = () => (
    <div className="flex flex-col h-full min-h-screen bg-black relative">
      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3">
        <button
          onClick={() => { if (roomState) leaveLobby(userId); setActiveView('MENU'); setGameStatus('idle'); }}
          className="p-2 rounded-full bg-black/40 backdrop-blur-md text-gray-300 hover:text-white transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {(gameStatus === 'playing' || countdownVal !== null) && (
          <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md rounded-full px-4 py-2">
            {timeRemaining !== undefined && (
              <>
                <div className="text-center">
                  <div className="text-[10px] text-gray-400 uppercase">Time</div>
                  <div className={`text-lg font-bold tabular-nums ${timeRemaining < 30 ? 'text-red-400' : 'text-white'}`}>
                    {formatTime(timeRemaining)}
                  </div>
                </div>
                <div className="w-px h-8 bg-white/10" />
              </>
            )}
            {engineRef.current?.mode === 'CAMPAIGN' && (
              <>
                <div className="text-center">
                  <div className="text-[10px] text-gray-400 uppercase">Level</div>
                  <div className="text-lg font-bold text-white tabular-nums">{currentLevel}</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
              </>
            )}
            <div className="text-center">
              <div className="text-[10px] text-gray-400 uppercase">Score</div>
              <div className="text-lg font-bold text-white tabular-nums">{currentScore.toLocaleString()}</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="text-[10px] text-gray-400 uppercase">WPM</div>
              <div className="text-lg font-bold text-cyan-400">{currentWpm}</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="text-[10px] text-gray-400 uppercase">Acc</div>
              <div className="text-lg font-bold text-emerald-400">{currentAccuracy}%</div>
            </div>
          </div>
        )}
      </div>

      {/* Countdown overlay */}
      {countdownVal !== null && countdownVal > 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/60 backdrop-blur-sm">
          <div className="text-8xl font-bold text-white animate-bounce">{countdownVal}</div>
        </div>
      )}

      {/* Level Flash Overlay */}
      {levelFlash !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-in fade-in zoom-in duration-500 fade-out duration-1000">
          <div className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-500 drop-shadow-[0_0_30px_rgba(167,139,250,0.5)]">
            LEVEL {levelFlash}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative">
        {engineRef.current && (
          <PaperFallCanvas engine={engineRef.current} isPlaying={gameStatus === 'playing'} className="absolute inset-0" />
        )}
        
        {/* Multiplayer Elimination Overlay */}
        {gameStatus === 'over' && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-500">
            <div className="bg-black/80 border border-white/10 p-8 rounded-3xl text-center space-y-4 shadow-2xl">
              <div className="text-5xl font-black text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">ELIMINATED</div>
              <div className="text-gray-400 font-medium">Waiting for other players to finish...</div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom player progress bar */}
      {roomState && gameStatus === 'playing' && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/60 backdrop-blur-md border-t border-white/10 p-2">
          <div className="flex items-center gap-3 overflow-x-auto px-2">
            {roomState.players.map((p) => (
              <div key={p.userId} className="flex items-center gap-2 shrink-0 bg-white/5 rounded-full px-3 py-1.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden">
                  {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : p.nickname?.[0]?.toUpperCase()}
                </div>
                <div className="text-xs font-medium text-white truncate max-w-16">{p.userId === userId ? 'You' : p.nickname}</div>
                <div className="text-xs text-cyan-400 font-bold tabular-nums">{p.wpm ?? 0} wpm</div>
                <div className="text-xs text-yellow-400 font-bold tabular-nums">{(p.score ?? 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <input ref={ghostRef}
        className="fixed left-2 bottom-2 w-px h-px opacity-[0.01] border-0 p-0 bg-transparent text-transparent"
        autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Type here"
      />
    </div>
  );

  // ── MATCH RESULTS VIEW ────────────────────────────────

  const renderMatchResults = () => {
    const results = matchResults || roomState?.results || [];
    const sorted = [...results].sort((a, b) => b.score - a.score);
    const myResult = sorted.find((r) => r.userId === userId);

    return (
      <div className="flex flex-col min-h-screen p-4 md:p-8">
        <div className="max-w-3xl w-full mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="text-xs uppercase tracking-wider text-gray-500">Match Complete</div>
            <h1 className="text-3xl font-bold text-white">
              {myResult && sorted.indexOf(myResult) === 0 ? '🏆 Victory!' : 'Results'}
            </h1>
          </div>

          {/* Player Cards */}
          <div className="space-y-4">
            {sorted.map((r, i) => (
              <div key={r.userId}
                className={`bg-white/5 border rounded-2xl p-5 space-y-4 ${
                  r.userId === userId ? 'border-violet-500/40 bg-violet-500/5' : 'border-white/10'
                }`}
              >
                {/* Header */}
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black ${
                    i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-gray-500/20 text-gray-300' : i === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-white/5 text-gray-500'
                  }`}>
                    #{i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white flex items-center gap-2">
                      {r.nickname} {r.userId === userId && <span className="text-xs text-violet-400">(You)</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-white">{r.score.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500 uppercase">Score</div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-3">
                  <StatBox label="Avg WPM" value={String(r.avgWpm)} icon={<Gauge className="w-3.5 h-3.5 text-cyan-400" />} small />
                  <StatBox label="Peak WPM" value={String(r.peakWpm)} icon={<Zap className="w-3.5 h-3.5 text-yellow-400" />} small />
                  <StatBox label="Accuracy" value={`${r.accuracy}%`} icon={<Target className="w-3.5 h-3.5 text-emerald-400" />} small />
                  <StatBox label="Words" value={String(r.wordsTyped)} icon={<Keyboard className="w-3.5 h-3.5 text-violet-400" />} small />
                </div>

                {/* WPM Graph */}
                {r.wpmTimeline && r.wpmTimeline.length > 2 && (
                  <MiniWpmGraph data={r.wpmTimeline} />
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {roomState && (
              <button
                onClick={() => { resetLobby(roomState.id); }}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Play Again
              </button>
            )}
            <button
              onClick={() => { if (roomState) leaveLobby(userId); setActiveView('MENU'); setGameStatus('idle'); }}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl transition-colors border border-white/10"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-black min-h-screen text-white">
      {activeView === 'MENU' && renderMenu()}
      {activeView === 'SINGLEPLAYER' && renderSingleplayer()}
      {activeView === 'MULTIPLAYER_LOBBY' && renderMultiplayerLobby()}
      {activeView === 'MULTIPLAYER_MATCH' && renderMultiplayerMatch()}
      {activeView === 'MATCH_RESULTS' && renderMatchResults()}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────

function StatBox({ label, value, icon, small }: { label: string; value: string; icon: React.ReactNode; small?: boolean }) {
  return (
    <div className={`bg-white/5 border border-white/10 rounded-xl ${small ? 'p-2.5' : 'p-3'} text-center`}>
      <div className="flex items-center justify-center gap-1.5 mb-1">{icon}<span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span></div>
      <div className={`font-bold text-white ${small ? 'text-sm' : 'text-lg'}`}>{value}</div>
    </div>
  );
}

function MiniWpmGraph({ data }: { data: WpmSample[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !data.length) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = cvs.getBoundingClientRect();
    cvs.width = rect.width * dpr;
    cvs.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width, h = rect.height;
    const pad = { l: 28, r: 8, t: 8, b: 20 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;

    const maxWpm = Math.max(20, ...data.map((d) => d.wpm));
    const maxTime = Math.max(10, data[data.length - 1].time);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (ph / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    }

    // Y axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const val = Math.round(maxWpm * (1 - i / 4));
      ctx.fillText(String(val), pad.l - 4, pad.t + (ph / 4) * i);
    }

    // Line
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = pad.l + (d.time / maxTime) * pw;
      const y = pad.t + (1 - d.wpm / maxWpm) * ph;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Fill under curve
    const lastPt = data[data.length - 1];
    ctx.lineTo(pad.l + (lastPt.time / maxTime) * pw, pad.t + ph);
    ctx.lineTo(pad.l + (data[0].time / maxTime) * pw, pad.t + ph);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
    grad.addColorStop(0, 'rgba(6,182,212,0.15)');
    grad.addColorStop(1, 'rgba(6,182,212,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // X axis
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const ticks = Math.min(6, data.length);
    for (let i = 0; i <= ticks; i++) {
      const t = Math.round((maxTime / ticks) * i);
      const x = pad.l + (t / maxTime) * pw;
      ctx.fillText(`${t}s`, x, pad.t + ph + 4);
    }
  }, [data]);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 px-1">WPM Over Time</div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 80 }} />
    </div>
  );
}
