"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Play, Pause, RotateCcw, ArrowLeft, Trophy } from 'lucide-react';
import { FLAPPY_CONFIG } from './config';
import { FlappyEngine } from './engine/FlappyEngine';
import { CanvasRenderer } from './engine/CanvasRenderer';
import { GameState } from './engine/types';

const HIGH_SCORE_KEY = 'ano_flappy_high_score';

export interface FlappyGameProps {
  onGameEnd?: (score: number, playTimeSeconds: number) => void;
}

export function FlappyGame({ onGameEnd }: FlappyGameProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<FlappyEngine | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);

  // Load High Score from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HIGH_SCORE_KEY);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) {
          setHighScore(val);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Initialize Engine & Canvas Loop
  useEffect(() => {
    const renderer = new CanvasRenderer();
    rendererRef.current = renderer;

    const engine = new FlappyEngine({
      onScoreUpdate: (newScore) => {
        setScore(newScore);
        setHighScore((prev) => {
          if (newScore > prev) {
            try {
              localStorage.setItem(HIGH_SCORE_KEY, String(newScore));
            } catch {
              // Ignore
            }
            return newScore;
          }
          return prev;
        });
      },
      onGameStateChange: (newState) => {
        setGameState(newState);
      },
      onGameOver: (finalScore, playTimeSeconds) => {
        if (onGameEnd) {
          onGameEnd(finalScore, playTimeSeconds);
        }
      }
    });

    engineRef.current = engine;

    // Attach Render Loop
    engine.setRenderCallback(() => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          renderer.render(ctx, engine);
        }
      }
    });

    // Start 60 FPS Engine Loop
    engine.runLoop(performance.now());

    return () => {
      engine.stopLoop();
    };
  }, []);

  // Sync stored high score into engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.highScore = highScore;
    }
  }, [highScore]);

  // Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      if (isInputFocused) return;

      const key = e.key.toLowerCase();
      const code = e.code;

      const isFlapKey = code === 'Space' || key === ' ' || code === 'ArrowUp' || key === 'arrowup' || code === 'KeyW' || key === 'w';

      if (isFlapKey) {
        e.preventDefault();
        if (engineRef.current) {
          engineRef.current.flap();
        }
      } else if (code === 'KeyP' || key === 'p' || code === 'Escape' || key === 'escape') {
        e.preventDefault();
        if (engineRef.current) {
          if (engineRef.current.state === 'PLAYING') {
            engineRef.current.pause();
          } else if (engineRef.current.state === 'PAUSED') {
            engineRef.current.resume();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const lastTouchTimeRef = useRef(0);

  // Controls Handlers
  const handleFlapOrStartClick = (e?: React.MouseEvent) => {
    if (Date.now() - lastTouchTimeRef.current < 400) return;
    if (engineRef.current) {
      engineRef.current.flap();
    }
  };

  const handleFlapOrStartTouch = (e?: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    if (e && e.preventDefault) e.preventDefault();
    if (engineRef.current) {
      engineRef.current.flap();
    }
  };

  const handleFlapOrStart = () => {
    if (engineRef.current) {
      engineRef.current.flap();
    }
  };

  const handlePauseToggle = () => {
    if (!engineRef.current) return;
    if (engineRef.current.state === 'PLAYING') {
      engineRef.current.pause();
    } else if (engineRef.current.state === 'PAUSED') {
      engineRef.current.resume();
    }
  };

  const handleRestart = () => {
    if (engineRef.current) {
      engineRef.current.start();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-5rem)] p-4 select-none">
      {/* Top Header Controls Bar */}
      <div className="w-full max-w-[480px] flex items-center justify-between mb-3 px-2">
        <Link
          href="/dashboard/games"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all active:scale-95 border border-white/10"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Games
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-bold">
            <Trophy className="w-3.5 h-3.5" />
            <span>Best: {highScore}</span>
          </div>

          {gameState === 'PLAYING' && (
            <button
              onClick={handlePauseToggle}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl active:scale-95 transition-all border border-white/10"
              title="Pause Game (P / Esc)"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Responsive Game Canvas Box */}
      <div className="relative w-full max-w-[480px] aspect-[3/4] max-h-[640px] rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-cyan-900">
        <canvas
          ref={canvasRef}
          width={FLAPPY_CONFIG.canvasWidth}
          height={FLAPPY_CONFIG.canvasHeight}
          onClick={handleFlapOrStartClick}
          onTouchStart={handleFlapOrStartTouch}
          className="w-full h-full object-cover cursor-pointer"
        />

        {/* IDLE Overlay */}
        {gameState === 'IDLE' && (
          <div
            onClick={handleFlapOrStartClick}
            onTouchStart={handleFlapOrStartTouch}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs text-center p-6 cursor-pointer animate-fade-in"
          >
            <div className="w-16 h-16 rounded-full bg-amber-400 text-black flex items-center justify-center mb-4 shadow-lg animate-bounce">
              <Play className="w-8 h-8 fill-current ml-1" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-wide mb-1 font-mono">FLAPPY BIRD</h2>
            <p className="text-sm font-semibold text-amber-300 mb-4">Tap or Press Space to Flap</p>
            <div className="px-4 py-2 bg-white/10 rounded-xl text-xs text-white/80 border border-white/10">
              Desktop: Spacebar / Up Arrow / W
              <br />
              Mobile: Tap Screen
            </div>
          </div>
        )}

        {/* PAUSED Overlay */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md animate-fade-in">
            <div className="bg-neutral-900 border border-white/15 rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl space-y-5">
              <h3 className="text-2xl font-black text-white tracking-wide">GAME PAUSED</h3>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handlePauseToggle}
                  className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-xl shadow-lg active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" /> Resume
                </button>

                <button
                  onClick={handleRestart}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2 border border-white/10"
                >
                  <RotateCcw className="w-4 h-4" /> Restart
                </button>

                <Link
                  href="/dashboard/games"
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/70 font-semibold rounded-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Games
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER Overlay */}
        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/75 backdrop-blur-md animate-fade-in">
            <div className="bg-neutral-900 border border-amber-500/30 rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl space-y-5">
              <div className="inline-flex p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                <Trophy className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-white tracking-wide">GAME OVER</h3>
                <p className="text-xs text-white/50 mt-1">Better luck next flight!</p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-white/5 p-3.5 rounded-2xl border border-white/10">
                <div className="bg-white/5 p-2.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-white/60 block">Score</span>
                  <span className="text-2xl font-black text-amber-400">{score}</span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-white/60 block">Best Score</span>
                  <span className="text-2xl font-black text-yellow-300">{highScore}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleRestart}
                  className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold rounded-xl shadow-lg active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Play Again
                </button>

                <Link
                  href="/dashboard/games"
                  className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl active:scale-95 transition-all text-xs flex items-center justify-center gap-2 border border-white/10"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Games
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
