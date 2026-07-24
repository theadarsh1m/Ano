"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';
import { useSlitherStore, SlitherSkin } from '@/store/useSlitherStore';
import { SlitherClientEngine } from './engine/SlitherClientEngine';
import { socketService } from '@/lib/socket';
import { getApiUrl } from '@/lib/config';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  Play,
  RotateCcw,
  Users,
  UserPlus,
  ArrowLeft,
  Copy,
  Check,
  UserX,
  Volume2,
  VolumeX,
  Settings,
  Tv,
  Wifi,
  Loader2,
  Pause,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

export function SlitherGameHub() {
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get('gameId');

  const userId = useUserStore((s) => s.id) || '';
  const nickname = useUserStore((s) => s.nickname) || 'Player';

  const {
    selectedSkin,
    setSkin,
    roomState,
    availableLobbies,
    createLobby,
    joinLobby,
    toggleReady,
    kickPlayer,
    startMatch,
    leaveLobby,
    initLobbySockets,
    submitScore
  } = useSlitherStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SlitherClientEngine | null>(null);

  // Views: 'MENU' | 'SINGLEPLAYER' | 'MULTIPLAYER_LOBBY' | 'MULTIPLAYER_MATCH' | 'LAN_SELECT'
  const [activeView, setActiveView] = useState<'MENU' | 'SINGLEPLAYER' | 'MULTIPLAYER_LOBBY' | 'MULTIPLAYER_MATCH' | 'LAN_SELECT'>('MENU');

  // Input states
  const [nickNameInput, setNickNameInput] = useState<string>(nickname);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  
  // Game stats overlays
  const [score, setScore] = useState<number>(0);
  const [kills, setKills] = useState<number>(0);
  const [fps, setFps] = useState<number>(60);
  const [ping, setPing] = useState<number>(20);
  const [leaderboard, setLeaderboard] = useState<{ nickname: string; score: number }[]>([]);
  const [showDeathOverlay, setShowDeathOverlay] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // LAN Discovery
  const [lanHosts, setLanHosts] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // FPS calculation
  const lastTimeRef = useRef<number>(performance.now());
  const framesRef = useRef<number>(0);

  // Load stats on login
  useEffect(() => {
    if (userId) {
      useSlitherStore.getState().fetchStats(userId);
    }
  }, [userId]);

  // Handle dynamic invite URL (?gameId=XYZ)
  useEffect(() => {
    if (gameIdParam && userId && nickname && !roomState) {
      setActiveView('MULTIPLAYER_LOBBY');
      joinLobby(gameIdParam, userId, nickname);
    }
  }, [gameIdParam, userId, nickname]);

  // Init general Socket listeners
  useEffect(() => {
    if (userId) {
      const cleanup = initLobbySockets(userId);
      return () => cleanup();
    }
  }, [userId]);

  // Socket updates for multiplayer matches
  useEffect(() => {
    if (roomState && activeView !== 'MULTIPLAYER_MATCH') {
      if (roomState.status === 'PLAYING') {
        setActiveView('MULTIPLAYER_MATCH');
        setTimeout(() => {
          initGameEngine('MULTIPLAYER');
        }, 100);
      } else if (roomState.status === 'LOBBY') {
        setActiveView('MULTIPLAYER_LOBBY');
        if (engineRef.current) {
          engineRef.current.stop();
          engineRef.current = null;
        }
      }
    }
  }, [roomState]);

  // Calc FPS and Ping
  useEffect(() => {
    let intervalId: any;
    if (activeView === 'SINGLEPLAYER' || activeView === 'MULTIPLAYER_MATCH') {
      let lastLbUpdate = 0;
      const checkFps = () => {
        const now = performance.now();
        framesRef.current++;
        if (now > lastTimeRef.current + 1000) {
          setFps(Math.round((framesRef.current * 1000) / (now - lastTimeRef.current)));
          framesRef.current = 0;
          lastTimeRef.current = now;
        }
        // Throttle leaderboard updates to twice per second (500ms) to prevent React DOM re-render thrashing
        if (engineRef.current && now > lastLbUpdate + 500) {
          setLeaderboard(engineRef.current.getLeaderboard());
          lastLbUpdate = now;
        }
        requestAnimationFrame(checkFps);
      };
      const animationId = requestAnimationFrame(checkFps);

      // Ping simulation or actual measurement
      if (activeView === 'MULTIPLAYER_MATCH' && socketService.getSocket()) {
        intervalId = setInterval(() => {
          const start = Date.now();
          socketService.getSocket().volatile.emit('ping_check', () => {
            setPing(Date.now() - start);
          });
        }, 2000);
      }

      return () => {
        cancelAnimationFrame(animationId);
        if (intervalId) clearInterval(intervalId);
      };
    }
  }, [activeView]);

  const initGameEngine = (mode: 'SINGLEPLAYER' | 'MULTIPLAYER') => {
    if (!canvasRef.current) return;
    
    // Stop old engine if running
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }
    
    setShowDeathOverlay(false);
    setIsPaused(false);
    setScore(0);
    setKills(0);
    
    const socket = mode === 'MULTIPLAYER' ? socketService.getSocket() : undefined;
    const gameId = mode === 'MULTIPLAYER' ? (roomState?.id || 'slither_global') : undefined;

    const engine = new SlitherClientEngine(
      canvasRef.current,
      mode,
      userId,
      nickNameInput || 'Player',
      selectedSkin,
      {
        onScoreUpdate: (s) => setScore(s),
        onKillsUpdate: (k) => setKills(k),
        onGameOver: (finalScore, finalKills, duration) => {
          setShowDeathOverlay(true);
          if (userId) {
            submitScore(userId, nickNameInput, Math.floor(finalScore / 10), finalKills, duration);
          }
        }
      },
      socket,
      gameId
    );
    
    engineRef.current = engine;
    engine.start();
  };

  const startSinglePlayer = () => {
    setActiveView('SINGLEPLAYER');
    setTimeout(() => {
      initGameEngine('SINGLEPLAYER');
    }, 100);
  };

  const joinGlobalOnline = () => {
    setActiveView('MULTIPLAYER_MATCH');
    joinLobby('slither_global', userId, nickNameInput);
    setTimeout(() => {
      initGameEngine('MULTIPLAYER');
    }, 100);
  };

  const handleHostLAN = () => {
    // Hosts custom LAN server
    createLobby(userId, nickNameInput);
  };

  const scanLAN = async () => {
    setIsScanning(true);
    setLanHosts([]);
    
    const currentHost = window.location.hostname;
    const subnetParts = currentHost.split('.');
    
    // Default subnets to scan if we are on localhost
    const subnetsToScan = [];
    if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
      subnetsToScan.push('192.168.1');
      subnetsToScan.push('192.168.0');
      subnetsToScan.push('10.0.0');
    } else {
      subnetsToScan.push(subnetParts.slice(0, 3).join('.'));
    }

    const hostsFound: any[] = [];
    const scanPromises: Promise<any>[] = [];

    // Parallel subnet scanning
    subnetsToScan.forEach((subnet) => {
      for (let i = 1; i <= 254; i++) {
        const ip = `${subnet}.${i}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600); // 600ms timeout for quick scanning

        const p = fetch(`http://${ip}:3001/api/games/slither/lan-host`, { signal: controller.signal })
          .then((res) => res.json())
          .then((data) => {
            clearTimeout(timeoutId);
            if (data && data.isHost) {
              hostsFound.push({
                ip,
                hostName: data.hostName,
                gameId: data.gameId
              });
            }
          })
          .catch(() => {
            clearTimeout(timeoutId);
          });
        scanPromises.push(p);
      }
    });

    await Promise.all(scanPromises);
    setLanHosts(hostsFound);
    setIsScanning(false);
  };

  const handleCopyInvite = () => {
    if (roomState) {
      const inviteUrl = `${window.location.origin}/dashboard/games/slither?gameId=${roomState.id}`;
      navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const togglePause = () => {
    if (activeView === 'SINGLEPLAYER' && engineRef.current) {
      if (isPaused) {
        engineRef.current.start();
        setIsPaused(false);
      } else {
        engineRef.current.stop();
        setIsPaused(true);
      }
    }
  };

  const handleExitGame = () => {
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }
    
    if (roomState) {
      leaveLobby(userId);
    }
    
    // Connect back to the default socket URL in case we were redirected to a LAN host
    socketService.connect();
    
    setActiveView('MENU');
    setShowDeathOverlay(false);
    setIsPaused(false);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white select-none">
      {/* 1. Main Canvas Game Area */}
      {(activeView === 'SINGLEPLAYER' || activeView === 'MULTIPLAYER_MATCH') && (
        <div className="absolute inset-0 z-0">
          <canvas ref={canvasRef} className="block w-full h-full cursor-default" />
          
          {/* Game HUD Overlay */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 text-xs md:text-sm font-semibold drop-shadow-md text-white/80 bg-black/40 px-3 py-2 rounded-lg backdrop-blur-sm border border-white/5">
            <div>Nickname: <span className="text-emerald-400 font-bold">{nickNameInput}</span></div>
            <div>Score: <span className="text-yellow-400 font-bold">{score}</span></div>
            <div>Kills: <span className="text-red-400 font-bold">{kills}</span></div>
            <div className="flex gap-4 mt-1 border-t border-white/10 pt-1 text-[10px]">
              <div>FPS: {fps}</div>
              {activeView === 'MULTIPLAYER_MATCH' && <div>Ping: {ping}ms</div>}
            </div>
          </div>

          {/* Leaderboard Overlay */}
          <div className="absolute top-4 right-4 z-10 w-48 md:w-56 bg-black/50 border border-white/10 backdrop-blur-md p-3 rounded-xl drop-shadow-lg max-h-60 overflow-hidden flex flex-col">
            <div className="flex items-center gap-1.5 border-b border-white/10 pb-1.5 mb-1.5">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="text-xs uppercase font-bold tracking-wider text-white">Leaderboard</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 text-xs custom-scrollbar">
              {leaderboard.map((entry, idx) => (
                <div key={idx} className="flex justify-between items-center text-[11px]">
                  <span className="truncate w-32">
                    <span className="font-bold text-white/50 mr-1.5">#{idx + 1}</span>
                    <span className={entry.nickname === nickNameInput ? 'text-emerald-400 font-bold' : 'text-white/85'}>{entry.nickname}</span>
                  </span>
                  <span className="font-mono text-yellow-400 font-semibold">{entry.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pause Button for Single Player */}
          {activeView === 'SINGLEPLAYER' && (
            <button
              onClick={togglePause}
              className="absolute bottom-4 left-4 z-10 p-3 bg-black/60 border border-white/10 hover:bg-white/10 transition-colors rounded-full backdrop-blur-sm"
            >
              <Pause className="w-5 h-5 text-gray-400" />
            </button>
          )}

          {/* Singleplayer Pause Screen */}
          {isPaused && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 backdrop-blur-md">
              <div className="text-center">
                <h2 className="text-3xl font-extrabold text-white mb-6">Game Paused</h2>
                <div className="flex flex-col gap-3">
                  <Button onClick={togglePause} className="bg-emerald-600 hover:bg-emerald-500 font-bold px-8">Resume</Button>
                  <Button variant="destructive" onClick={handleExitGame} className="font-bold px-8">Quit to Menu</Button>
                </div>
              </div>
            </div>
          )}

          {/* Death Overlay */}
          {showDeathOverlay && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-950/75 backdrop-blur-md">
              <div className="text-center p-6 bg-black/65 border border-red-500/20 rounded-2xl max-w-sm w-full mx-4 shadow-2xl">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
                <h2 className="text-3xl font-black text-red-500 tracking-wide mb-2 uppercase">You Crashed!</h2>
                <p className="text-muted-foreground text-sm mb-6">Your snake exploded into glowing food particles.</p>
                
                <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl mb-6 text-center border border-white/5">
                  <div>
                    <div className="text-[10px] text-white/40 uppercase tracking-wide">Final Score</div>
                    <div className="text-2xl font-black text-yellow-400">{score}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/40 uppercase tracking-wide">Opponents Killed</div>
                    <div className="text-2xl font-black text-red-400">{kills}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={() => {
                      if (activeView === 'SINGLEPLAYER') {
                        initGameEngine('SINGLEPLAYER');
                      } else {
                        // For online mode, spawn requests
                        socketService.getSocket().emit('game_action', {
                          gameId: roomState?.id,
                          userId,
                          action: 'respawn',
                          data: { nickname: nickNameInput, skin: selectedSkin }
                        });
                        setShowDeathOverlay(false);
                      }
                    }} 
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Play Again
                  </Button>
                  <Button variant="outline" onClick={handleExitGame} className="border-white/10 hover:bg-white/5 font-bold">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Menu
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Main Menu Overlay */}
      {activeView === 'MENU' && (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black z-10 overflow-y-auto">
          <div className="max-w-md w-full my-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-green-400 via-emerald-500 to-teal-400 bg-clip-text text-transparent transform -skew-x-6">
                SLITHER.IO
              </h1>
              <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1.5">Ano Arcade Multiplayer Edition</p>
            </div>

            <GlassCard className="p-6 border-white/10">
              <div className="space-y-5">
                {/* Nickname selection */}
                <div>
                  <label className="text-xs uppercase font-bold tracking-wider text-gray-400 block mb-2">Nickname</label>
                  <input
                    type="text"
                    value={nickNameInput}
                    onChange={(e) => setNickNameInput(e.target.value.substring(0, 16))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-white/20"
                    placeholder="Enter nickname..."
                  />
                </div>

                {/* Skin Selector */}
                <div>
                  <label className="text-xs uppercase font-bold tracking-wider text-gray-400 block mb-2">Select Skin Style</label>
                  <div className="grid grid-cols-6 gap-2">
                    {(['CLASSIC', 'RED', 'BLUE', 'YELLOW', 'RAINBOW', 'GLOW'] as SlitherSkin[]).map((skin) => (
                      <button
                        key={skin}
                        onClick={() => setSkin(skin)}
                        className={`h-11 rounded-lg border-2 flex items-center justify-center transition-all ${
                          selectedSkin === skin
                            ? 'border-emerald-400 scale-105 bg-white/10'
                            : 'border-white/5 bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full ${
                            skin === 'CLASSIC' ? 'bg-teal-500' :
                            skin === 'RED' ? 'bg-red-500' :
                            skin === 'BLUE' ? 'bg-blue-500' :
                            skin === 'YELLOW' ? 'bg-amber-500' :
                            skin === 'GLOW' ? 'bg-emerald-500' :
                            'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Game Modes */}
                <div className="space-y-3 pt-3">
                  <Button 
                    onClick={startSinglePlayer} 
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black py-4 rounded-xl text-md flex items-center justify-center gap-2 border border-green-400/20 shadow-lg shadow-green-500/10 hover:scale-[1.01] active:scale-[0.99] transition-transform"
                  >
                    <Play className="w-5 h-5" />
                    Play Offline (VS Bots)
                  </Button>

                  <Button 
                    onClick={joinGlobalOnline}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-black py-4 rounded-xl text-md flex items-center justify-center gap-2 border border-blue-400/20 shadow-lg shadow-blue-500/10 hover:scale-[1.01] active:scale-[0.99] transition-transform"
                  >
                    <Users className="w-5 h-5" />
                    Join Online World
                  </Button>

                  <Button 
                    onClick={() => {
                      setActiveView('LAN_SELECT');
                      scanLAN();
                    }}
                    variant="outline"
                    className="w-full border-white/10 hover:bg-white/5 py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <Wifi className="w-4 h-4 text-emerald-400" />
                    Local Network (LAN Mode)
                  </Button>
                </div>
              </div>
            </GlassCard>

            {/* Back to games hub */}
            <div className="text-center mt-6">
              <Link href="/dashboard/games" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Arcade Hub
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 3. LAN Host/Join Lobby Select */}
      {activeView === 'LAN_SELECT' && (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 to-neutral-950 z-10 overflow-y-auto">
          <div className="max-w-md w-full my-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Wifi className="w-6 h-6 text-emerald-400" />
                <h2 className="text-2xl font-black tracking-tight text-white">LAN Multiplayer</h2>
              </div>
              <Button 
                variant="ghost" 
                onClick={() => setActiveView('MENU')}
                className="p-2 rounded-full hover:bg-white/15 text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </div>

            <GlassCard className="p-6 border-white/10 mb-4">
              <div className="space-y-6">
                <div>
                  <Button 
                    onClick={handleHostLAN}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Host a Local LAN Room
                  </Button>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs uppercase font-bold tracking-wider text-gray-400">Available LAN Hosts</span>
                    <Button 
                      size="sm" 
                      onClick={scanLAN} 
                      disabled={isScanning}
                      className="bg-white/5 border border-white/10 hover:bg-white/10 text-xs px-3 py-1.5 h-auto rounded"
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                          Scanning...
                        </>
                      ) : (
                        'Scan Subnet'
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {lanHosts.map((host, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-white/90 truncate">{host.hostName}'s Slither Server</div>
                          <div className="text-[10px] text-emerald-400 font-mono tracking-wider">{host.ip}</div>
                        </div>
                        <Button 
                          onClick={() => {
                            setActiveView('MULTIPLAYER_LOBBY');
                            // Connect directly to the LAN host server
                            socketService.connect(`http://${host.ip}:3001`);
                            joinLobby(host.gameId, userId, nickNameInput);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-xs py-1.5 px-3 h-auto font-bold rounded"
                        >
                          Join
                        </Button>
                      </div>
                    ))}

                    {lanHosts.length === 0 && !isScanning && (
                      <div className="text-center py-8 text-white/30 text-xs border border-dashed border-white/10 rounded-xl">
                        No active LAN hosts found on your network.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* 4. Multiplayer Lobby Area */}
      {activeView === 'MULTIPLAYER_LOBBY' && roomState && (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-gradient-to-br from-neutral-900 to-black z-10 overflow-y-auto">
          <div className="max-w-md w-full my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-white tracking-tight">Game Lobby</h2>
              <Button 
                variant="destructive"
                onClick={handleExitGame}
                className="bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 border border-red-500/30 font-bold"
              >
                Leave Lobby
              </Button>
            </div>

            <GlassCard className="p-6 border-white/10 mb-4">
              <div className="space-y-5">
                {/* Invite link (for non-global) */}
                {roomState.id !== 'slither_global' && (
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="truncate text-xs font-semibold text-white/60">
                      Invite URL: <span className="font-mono text-[10px] text-white/40 block mt-0.5 truncate">
                        {`${window.location.origin}/dashboard/games/slither?gameId=${roomState.id}`}
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={handleCopyInvite} 
                      className="bg-white/10 border border-white/10 hover:bg-white/15 px-3 py-1.5 h-auto rounded flex-shrink-0 text-xs font-bold"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                )}

                {/* Players List */}
                <div>
                  <h3 className="text-xs uppercase font-bold tracking-wider text-gray-400 block mb-2.5">
                    Players ({roomState.players.length})
                  </h3>
                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                    {roomState.players.map((p) => (
                      <div 
                        key={p.userId} 
                        className="flex justify-between items-center p-3 bg-white/5 border border-white/5 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center font-black text-white text-xs">
                            {p.nickname[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-sm">{p.nickname}</span>
                            {p.role === 'HOST' && (
                              <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">
                                Host
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {p.userId !== roomState.hostId && roomState.hostId === userId && (
                            <Button 
                              onClick={() => kickPlayer(roomState.id, userId, p.userId)}
                              className="bg-red-500/10 hover:bg-red-500/30 text-red-400 p-1.5 h-auto rounded"
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          )}
                          
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            p.isReady 
                              ? 'text-green-400 bg-green-500/10 border border-green-500/20' 
                              : 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20'
                          }`}>
                            {p.isReady ? 'Ready' : 'Waiting'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Start Button */}
                {roomState.id !== 'slither_global' && (
                  <div className="pt-3">
                    {userId === roomState.hostId ? (
                      <Button
                        onClick={() => startMatch(roomState.id, userId)}
                        disabled={roomState.players.length < 2 || !roomState.players.every((p) => p.userId === userId || p.isReady)}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Start LAN Match
                      </Button>
                    ) : (
                      <Button
                        onClick={() => toggleReady(roomState.id, userId)}
                        className={`w-full font-black py-3 rounded-xl ${
                          roomState.players.find((p) => p.userId === userId)?.isReady
                            ? 'bg-red-600 hover:bg-red-500'
                            : 'bg-emerald-600 hover:bg-emerald-500'
                        }`}
                      >
                        {roomState.players.find((p) => p.userId === userId)?.isReady ? 'Not Ready' : 'I am Ready!'}
                      </Button>
                    )}
                  </div>
                )}

                {/* Global World Match Waiting Message */}
                {roomState.id === 'slither_global' && (
                  <div className="text-center py-4 bg-white/5 border border-white/5 rounded-xl">
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground font-semibold">Connecting you to the persistent slither world...</p>
                    <Button 
                      onClick={() => {
                        // Immediately launch client side wrapper joining global
                        setActiveView('MULTIPLAYER_MATCH');
                        setTimeout(() => {
                          initGameEngine('MULTIPLAYER');
                        }, 100);
                      }}
                      className="mt-3 bg-emerald-600 hover:bg-emerald-500 font-bold px-8 text-xs py-2 h-auto"
                    >
                      Enter Game
                    </Button>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
