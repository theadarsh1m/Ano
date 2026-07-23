"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Volume2, VolumeX, RotateCcw, Play, Users, 
  Settings, Check, Gamepad2, Info, ChevronRight, Sparkles,
  Loader2, Trophy
} from "lucide-react";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Player, Platform, GameConfig, GravityDirection } from "./types";
import { updatePhysics } from "./physics";
import { audioSynth } from "./audio";
import { ParticleSystem } from "./particles";

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 600;

const DEFAULT_CONFIG: GameConfig = {
  gravityStrength: 1800,
  platformWidth: 480,
  platformHeight: 32,
  charSize: 18,
  bounceAmount: 0.25,
  friction: 0.15,
  winScore: 5,
  roundDelay: 3,
  respawnDelay: 3,
  playerColors: ["#ff3b30", "#34c759", "#007aff", "#af52de"], // Red, Green, Blue, Purple
  playerKeys: ["a", "l", "ArrowLeft", "ArrowRight"]
};

type GameState = "MENU" | "COUNTDOWN" | "PLAYING" | "ROUND_END" | "MATCH_OVER";

export default function GravityFlipPage() {
  const router = useRouter();
  
  // Game state
  const [gameState, setGameState] = useState<GameState>("MENU");
  const [numPlayers, setNumPlayers] = useState<number>(2);
  const [scores, setScores] = useState<number[]>([0, 0, 0, 0]);
  const [winnerName, setWinnerName] = useState<string>("");
  const [matchWinner, setMatchWinner] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(3);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [isClient, setIsClient] = useState<boolean>(false);

  // Config variables editable by user
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);

  // Canvas and loop references
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  
  // Audio state
  const isMutedRef = useRef<boolean>(false);

  // Gameplay entities stored in refs for the physics loop
  const playersRef = useRef<Player[]>([]);
  const platformRef = useRef<Platform>({
    x: (LOGICAL_WIDTH - DEFAULT_CONFIG.platformWidth) / 2,
    y: (LOGICAL_HEIGHT - DEFAULT_CONFIG.platformHeight) / 2,
    width: DEFAULT_CONFIG.platformWidth,
    height: DEFAULT_CONFIG.platformHeight
  });
  const particlesRef = useRef<ParticleSystem>(new ParticleSystem());
  
  // Screen flash effects
  const flashColorRef = useRef<string | null>(null);
  const flashAlphaRef = useRef<number>(0);

  // Ensure client side running
  useEffect(() => {
    setIsClient(true);
    audioSynth.setMute(false);
  }, []);

  // Update sound synth mute state
  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    isMutedRef.current = nextMute;
    audioSynth.setMute(nextMute);
    audioSynth.playClick();
  };

  // Flip player gravity function
  const flipPlayerGravity = (playerIndex: number) => {
    if (gameState !== "PLAYING") return;
    const player = playersRef.current[playerIndex];
    if (player && player.isAlive) {
      player.gravityDir = (player.gravityDir === 1 ? -1 : 1) as GravityDirection;
      player.isGrounded = false;
      player.lastFlipTime = Date.now();
      
      // Apply a small spin torque on flip
      player.angularVelocity = player.gravityDir * 8;
      
      // Trigger a flash overlay of player's color
      flashColorRef.current = config.playerColors[playerIndex];
      flashAlphaRef.current = 0.25;

      audioSynth.playFlip();
    }
  };

  // Setup/Reset Round
  const setupRound = (resetScores: boolean = false) => {
    if (resetScores) {
      setScores(new Array(numPlayers).fill(0));
      setMatchWinner("");
    }

    const platWidth = config.platformWidth;
    const platHeight = config.platformHeight;
    const platX = (LOGICAL_WIDTH - platWidth) / 2;
    const platY = (LOGICAL_HEIGHT - platHeight) / 2;

    platformRef.current = {
      x: platX,
      y: platY,
      width: platWidth,
      height: platHeight
    };

    // Position players evenly spaced on top of the platform
    const spacing = platWidth / (numPlayers + 1);
    const initialPlayers: Player[] = [];

    for (let i = 0; i < numPlayers; i++) {
      const startX = platX + spacing * (i + 1);
      const startY = platY - config.charSize - 5; // just above platform
      
      initialPlayers.push({
        id: i,
        name: `Player ${i + 1}`,
        x: startX,
        y: startY,
        vx: (Math.random() - 0.5) * 40, // tiny horizontal nudge at spawn
        vy: 0,
        radius: config.charSize,
        mass: 1.0,
        rotation: 0,
        angularVelocity: 0,
        gravityDir: 1, // down
        isGrounded: false,
        isAlive: true,
        score: resetScores ? 0 : scores[i] || 0,
        squashX: 1,
        squashY: 1,
        squashVx: 0,
        squashVy: 0,
        lastFlipTime: 0
      });
    }

    playersRef.current = initialPlayers;
    particlesRef.current.clear();
    flashAlphaRef.current = 0;
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== "PLAYING") return;
      const key = e.key;

      for (let i = 0; i < numPlayers; i++) {
        const pKey = config.playerKeys[i];
        if (key === pKey || (key === "ArrowLeft" && pKey === "ArrowLeft") || (key === "ArrowRight" && pKey === "ArrowRight") || key.toLowerCase() === pKey.toLowerCase()) {
          // Prevent scroll
          if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key.toLowerCase())) {
            e.preventDefault();
          }
          flipPlayerGravity(i);
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gameState, numPlayers, config]);

  // Start countdown process
  const startCountdown = () => {
    setGameState("COUNTDOWN");
    setCountdown(3);
    setupRound(false);
    audioSynth.playCountdown();
  };

  // Countdown timer effect
  useEffect(() => {
    if (gameState !== "COUNTDOWN") return;
    
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setGameState("PLAYING");
          lastTimeRef.current = performance.now();
          return 0;
        }
        audioSynth.playCountdown();
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState]);

  // Check Round Outcome
  const checkRoundEnd = () => {
    const alivePlayers = playersRef.current.filter((p) => p.isAlive);
    
    if (alivePlayers.length === 1 && gameState === "PLAYING") {
      const winner = alivePlayers[0];
      setWinnerName(winner.name);
      
      const newScores = [...scores];
      newScores[winner.id] += 1;
      setScores(newScores);
      setGameState("ROUND_END");
      
      audioSynth.playWinner();

      // Check Match Win
      if (newScores[winner.id] >= config.winScore) {
        setTimeout(() => {
          setMatchWinner(winner.name);
          setGameState("MATCH_OVER");
        }, 1500);
      } else {
        setTimeout(() => {
          startCountdown();
        }, config.roundDelay * 1000);
      }
    } else if (alivePlayers.length === 0 && gameState === "PLAYING") {
      // Draw round
      setWinnerName("No one (Draw!)");
      setGameState("ROUND_END");
      audioSynth.playCountdown();
      
      setTimeout(() => {
        startCountdown();
      }, config.roundDelay * 1000);
    }
  };

  // Core Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId: number;

    const render = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = (timestamp - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = timestamp;

      // 1. UPDATE PHYSICS (if playing)
      if (gameState === "PLAYING") {
        updatePhysics(
          playersRef.current,
          platformRef.current,
          config,
          dt,
          LOGICAL_WIDTH,
          LOGICAL_HEIGHT,
          {
            onLanding: (player) => {
              audioSynth.playLanding();
            },
            onPlayerCollision: (p1, p2) => {
              audioSynth.playClick();
            },
            onDeath: (player) => {
              audioSynth.playDeath();
              particlesRef.current.spawnBurst(player.x, player.y, config.playerColors[player.id], 35);
              checkRoundEnd();
            }
          }
        );
      }

      // Update non-physics systems (particles & screen flash)
      particlesRef.current.update(dt);
      
      if (flashAlphaRef.current > 0) {
        flashAlphaRef.current -= dt * 2.0; // fade out quickly
      }

      // 2. RENDERING
      ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      // A. Draw futuristic background grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < LOGICAL_WIDTH; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, LOGICAL_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < LOGICAL_HEIGHT; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(LOGICAL_WIDTH, y);
        ctx.stroke();
      }

      // B. Draw death boundaries glow
      ctx.strokeStyle = "rgba(239, 68, 68, 0.25)";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, LOGICAL_WIDTH - 6, LOGICAL_HEIGHT - 6);

      // C. Draw platform
      const plat = platformRef.current;
      
      // Outer platform border glow
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#475569";
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(plat.x, plat.y, plat.width, plat.height, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Platform safety stripes
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(plat.x, plat.y, plat.width, plat.height, 8);
      ctx.clip();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 4;
      for (let offset = -plat.height; offset < plat.width; offset += 15) {
        ctx.beginPath();
        ctx.moveTo(plat.x + offset, plat.y);
        ctx.lineTo(plat.x + offset + plat.height, plat.y + plat.height);
        ctx.stroke();
      }
      ctx.restore();

      // D. Draw players
      for (const p of playersRef.current) {
        if (!p.isAlive) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        
        // Apply squash and stretch scaling
        ctx.scale(p.squashX, p.squashY);

        // Player Shadow Glow
        ctx.shadowBlur = 18;
        ctx.shadowColor = config.playerColors[p.id];

        // Draw Player Body (Core Ring)
        ctx.fillStyle = config.playerColors[p.id];
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner circle detail
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Draw cute cartoon eyes looking up or down depending on gravity
        ctx.fillStyle = "#ffffff";
        const eyeOffset = p.radius * 0.28;
        const eyeSize = p.radius * 0.22;
        const pupilSize = p.radius * 0.1;
        const lookDir = p.gravityDir; // Look up if gravity UP (-1), down if DOWN (1)

        // Left Eye
        ctx.beginPath();
        ctx.arc(-eyeOffset, -eyeOffset * 0.2, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(-eyeOffset, -eyeOffset * 0.2 + (lookDir * 1.5), pupilSize, 0, Math.PI * 2);
        ctx.fill();

        // Right Eye
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(eyeOffset, -eyeOffset * 0.2, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(eyeOffset, -eyeOffset * 0.2 + (lookDir * 1.5), pupilSize, 0, Math.PI * 2);
        ctx.fill();

        // Gravity Indicator Arrow inside body
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        if (p.gravityDir === 1) { // DOWN Arrow
          ctx.moveTo(0, -p.radius * 0.15);
          ctx.lineTo(0, p.radius * 0.4);
          ctx.moveTo(-p.radius * 0.2, p.radius * 0.2);
          ctx.lineTo(0, p.radius * 0.4);
          ctx.lineTo(p.radius * 0.2, p.radius * 0.2);
        } else { // UP Arrow
          ctx.moveTo(0, p.radius * 0.15);
          ctx.lineTo(0, -p.radius * 0.4);
          ctx.moveTo(-p.radius * 0.2, -p.radius * 0.2);
          ctx.lineTo(0, -p.radius * 0.4);
          ctx.lineTo(p.radius * 0.2, -p.radius * 0.2);
        }
        ctx.stroke();

        ctx.restore();
      }

      // E. Draw particle bursts
      particlesRef.current.draw(ctx);

      // F. Render gravity flip screen flashes
      if (flashColorRef.current && flashAlphaRef.current > 0) {
        ctx.save();
        ctx.fillStyle = flashColorRef.current;
        ctx.globalAlpha = flashAlphaRef.current;
        ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        ctx.restore();
      }

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [gameState, config]);

  // Restart the whole match
  const restartMatch = () => {
    setupRound(true);
    startCountdown();
  };

  const handleStartGame = (players: number) => {
    setNumPlayers(players);
    setupRound(true);
    setScores(new Array(players).fill(0));
    setGameState("COUNTDOWN");
    setCountdown(3);
    audioSynth.playCountdown();
  };

  if (!isClient) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <Loader2 className="w-12 h-12 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Global Navbar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-b border-white/10 shadow-lg backdrop-blur-md z-15">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push("/dashboard/games")}
            className="rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide">Gravity Flip</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowConfig(!showConfig)}
            className="rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-4 gap-6 max-w-7xl mx-auto w-full relative z-10">
        
        {/* Game Canvas Area */}
        <div className="flex-1 flex flex-col items-center justify-center w-full relative">
          
          {/* Canvas Wrapper */}
          <div className="relative border-4 border-slate-800 rounded-3xl overflow-hidden bg-slate-900 shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-[900px] aspect-[900/600]">
            <canvas
              ref={canvasRef}
              width={LOGICAL_WIDTH}
              height={LOGICAL_HEIGHT}
              className="w-full h-full block bg-slate-950"
            />

            {/* Countdown Overlay */}
            {gameState === "COUNTDOWN" && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20 pointer-events-none animate-fade-in">
                <span className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-amber-500 scale-animation drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                  {countdown}
                </span>
                <span className="text-xl font-bold uppercase tracking-widest text-yellow-400/80 mt-4">Get Ready</span>
              </div>
            )}

            {/* Menu Overlay */}
            {gameState === "MENU" && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-25 overflow-y-auto">
                <div className="max-w-md w-full space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-purple-500 to-blue-500">
                      Gravity Flip
                    </h2>
                    <p className="text-slate-400 text-sm">
                      Reverse gravity to stay on the platform. Push other players off to survive. The last player standing wins!
                    </p>
                  </div>

                  <div className="space-y-3">
                    <span className="text-xs uppercase font-bold tracking-widest text-slate-500">Select Players</span>
                    <div className="grid grid-cols-3 gap-3">
                      {[2, 3, 4].map((num) => (
                        <button
                          key={num}
                          onClick={() => handleStartGame(num)}
                          className="flex flex-col items-center justify-center p-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/80 hover:border-purple-500 rounded-2xl transition-all group active:scale-95"
                        >
                          <Users className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-bold">{num} Players</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-left space-y-2.5 text-xs text-slate-400">
                    <span className="font-bold text-slate-300 block mb-1">Keyboard Controls:</span>
                    <div className="grid grid-cols-2 gap-2 font-mono">
                      <div><span className="text-red-400 font-bold">P1:</span> A</div>
                      <div><span className="text-emerald-400 font-bold">P2:</span> L</div>
                      <div><span className="text-blue-400 font-bold">P3:</span> Left Arrow</div>
                      <div><span className="text-purple-400 font-bold">P4:</span> Right Arrow</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Round End Overlay */}
            {gameState === "ROUND_END" && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20 pointer-events-none animate-fade-in">
                <span className="text-sm uppercase tracking-widest text-purple-400 font-extrabold mb-2">Round Over</span>
                <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500">
                  {winnerName} Wins the Round!
                </span>
                <span className="text-xs text-slate-400 mt-6 animate-pulse">Next round starts in 3 seconds...</span>
              </div>
            )}

            {/* Match Over Overlay */}
            {gameState === "MATCH_OVER" && (
              <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
                <div className="space-y-6 max-w-xs">
                  <div className="space-y-2">
                    <Trophy className="w-16 h-16 text-yellow-500 mx-auto animate-bounce" />
                    <h2 className="text-3xl font-black text-white">{matchWinner} Wins!</h2>
                    <p className="text-slate-400 text-sm">Match points limit reached.</p>
                  </div>

                  <div className="flex gap-4">
                    <Button onClick={restartMatch} className="flex-1 bg-purple-600 hover:bg-purple-700">
                      <RotateCcw className="w-4 h-4 mr-2" /> Play Again
                    </Button>
                    <Button onClick={() => setGameState("MENU")} variant="outline" className="flex-1">
                      Menu
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Touch Area / On-screen Buttons */}
            {gameState === "PLAYING" && (
              <div className="absolute inset-0 pointer-events-none select-none z-10">
                {/* P1 Corner Trigger (Top Left) */}
                <div 
                  className="absolute top-4 left-4 w-20 h-20 rounded-full border-4 border-red-500/30 bg-red-500/10 pointer-events-auto flex items-center justify-center active:scale-95 active:bg-red-500/30 transition-all cursor-pointer shadow-lg"
                  onTouchStart={(e) => { e.preventDefault(); flipPlayerGravity(0); }}
                  onMouseDown={() => flipPlayerGravity(0)}
                >
                  <span className="text-red-400 text-xs font-black select-none pointer-events-none font-mono">P1 [A]</span>
                </div>

                {/* P2 Corner Trigger (Top Right) */}
                <div 
                  className="absolute top-4 right-4 w-20 h-20 rounded-full border-4 border-emerald-500/30 bg-emerald-500/10 pointer-events-auto flex items-center justify-center active:scale-95 active:bg-emerald-500/30 transition-all cursor-pointer shadow-lg"
                  onTouchStart={(e) => { e.preventDefault(); flipPlayerGravity(1); }}
                  onMouseDown={() => flipPlayerGravity(1)}
                >
                  <span className="text-emerald-400 text-xs font-black select-none pointer-events-none font-mono">P2 [L]</span>
                </div>

                {/* P3 Corner Trigger (Bottom Left) */}
                {numPlayers >= 3 && (
                  <div 
                    className="absolute bottom-4 left-4 w-20 h-20 rounded-full border-4 border-blue-500/30 bg-blue-500/10 pointer-events-auto flex items-center justify-center active:scale-95 active:bg-blue-500/30 transition-all cursor-pointer shadow-lg"
                    onTouchStart={(e) => { e.preventDefault(); flipPlayerGravity(2); }}
                    onMouseDown={() => flipPlayerGravity(2)}
                  >
                    <span className="text-blue-400 text-xs font-black select-none pointer-events-none font-mono">P3 [←]</span>
                  </div>
                )}

                {/* P4 Corner Trigger (Bottom Right) */}
                {numPlayers >= 4 && (
                  <div 
                    className="absolute bottom-4 right-4 w-20 h-20 rounded-full border-4 border-purple-500/30 bg-purple-500/10 pointer-events-auto flex items-center justify-center active:scale-95 active:bg-purple-500/30 transition-all cursor-pointer shadow-lg"
                    onTouchStart={(e) => { e.preventDefault(); flipPlayerGravity(3); }}
                    onMouseDown={() => flipPlayerGravity(3)}
                  >
                    <span className="text-purple-400 text-xs font-black select-none pointer-events-none font-mono">P4 [→]</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info & Score Sidebar Panel */}
        <div className="w-full lg:w-72 flex flex-col gap-4">
          {/* Scoreboard Panel */}
          <GlassCard className="p-4 flex flex-col space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <Gamepad2 className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-white">Scoreboard</h3>
            </div>
            
            <div className="space-y-2">
              {new Array(numPlayers).fill(null).map((_, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-slate-900/50"
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-3.5 h-3.5 rounded-full shadow-md" 
                      style={{ backgroundColor: config.playerColors[idx], boxShadow: `0 0 8px ${config.playerColors[idx]}` }}
                    />
                    <span className="font-bold text-sm text-slate-200">Player {idx + 1}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 text-xs font-mono">Key:</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700 font-mono">
                      {config.playerKeys[idx] === "ArrowLeft" ? "←" : config.playerKeys[idx] === "ArrowRight" ? "→" : config.playerKeys[idx].toUpperCase()}
                    </kbd>
                    <span className="font-black text-purple-400 ml-2 font-mono text-base">{scores[idx] || 0}</span>
                  </div>
                </div>
              ))}
            </div>

            {gameState !== "MENU" && (
              <Button 
                onClick={() => setGameState("MENU")} 
                variant="outline" 
                size="sm"
                className="w-full border-slate-800 text-slate-400 hover:text-white"
              >
                Back to Menu
              </Button>
            )}
          </GlassCard>

          {/* Config Settings Modal/Drawer (shown in side panel) */}
          {showConfig && (
            <GlassCard className="p-4 space-y-3">
              <h3 className="font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-400" /> Options
              </h3>

              <div className="space-y-3 text-xs text-slate-300">
                {/* Gravity Strength */}
                <div className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span>Gravity strength:</span>
                    <span className="text-purple-400">{config.gravityStrength}</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="3000"
                    step="100"
                    value={config.gravityStrength}
                    onChange={(e) => setConfig({ ...config, gravityStrength: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Target Win Score */}
                <div className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span>Target Win Score:</span>
                    <span className="text-purple-400">{config.winScore} pts</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    step="1"
                    value={config.winScore}
                    onChange={(e) => setConfig({ ...config, winScore: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Bounciness */}
                <div className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span>Bounciness:</span>
                    <span className="text-purple-400">{config.bounceAmount.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.8"
                    step="0.05"
                    value={config.bounceAmount}
                    onChange={(e) => setConfig({ ...config, bounceAmount: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Friction */}
                <div className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span>Friction:</span>
                    <span className="text-purple-400">{config.friction.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.5"
                    step="0.05"
                    value={config.friction}
                    onChange={(e) => setConfig({ ...config, friction: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Platform Width */}
                <div className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span>Platform Width:</span>
                    <span className="text-purple-400">{config.platformWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="300"
                    max="700"
                    step="20"
                    value={config.platformWidth}
                    onChange={(e) => setConfig({ ...config, platformWidth: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                <Button 
                  onClick={() => setConfig(DEFAULT_CONFIG)} 
                  variant="outline" 
                  size="sm"
                  className="w-full border-slate-800 mt-2 hover:bg-slate-900 text-xs text-slate-400"
                >
                  Reset to Defaults
                </Button>
              </div>
            </GlassCard>
          )}

          {/* Quick Info Card */}
          <GlassCard className="p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-slate-300 font-bold border-b border-white/5 pb-1">
              <Info className="w-3.5 h-3.5 text-purple-400" />
              <span>How to play</span>
            </div>
            <p>
              When gravity is <strong>normal (↓)</strong>, players land on top of the platform.
            </p>
            <p>
              When gravity is <strong>reversed (↑)</strong>, players land on the underside of the platform.
            </p>
            <p>
              Time your flips to stay on the platform. Push other players off using elastic physics!
            </p>
          </GlassCard>
        </div>
      </div>

      <style jsx global>{`
        .scale-animation {
          animation: scaleCountdown 1s infinite ease-in-out;
        }
        @keyframes scaleCountdown {
          0% { transform: scale(0.5); opacity: 0; }
          10% { opacity: 1; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1.0); opacity: 0; }
        }
        .animate-fade-in {
          animation: fadeIn 0.25s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
