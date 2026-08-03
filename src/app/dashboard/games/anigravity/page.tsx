"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Play, UserPlus, LogOut, Loader2, Check, X,
  MessageSquare, ArrowLeft, Globe, Settings, Clock, BookOpen
} from "lucide-react";
import confetti from 'canvas-confetti';

import { useUserStore } from "@/store/useUserStore";
import { useRoomConnectionStore } from "@/store/useRoomConnectionStore";
import { useAniGravityStore } from "@/store/useAniGravityStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { ChatArea } from "@/components/room/ChatArea";
import { MessageInput } from "@/components/room/MessageInput";
import { socketService } from "@/lib/socket";
import { TurnIndicator } from "@/components/games/TurnIndicator";
import { useExitWarning } from "@/hooks/useExitWarning";
import { useInviteCooldown } from "@/hooks/useInviteCooldown";
import { Button } from "@/components/ui/button";

// Import Engine and Data
import { GameEngine } from "@/components/games/anigravity/engine/GameEngine";
import { InputSystem } from "@/components/games/anigravity/systems/InputSystem";
import { CHARACTER_DEFINITIONS } from "@/components/games/anigravity/data/characters";

function AniGravityPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get("gameId");

  const { id: userId, nickname } = useUserStore();
  const { currentRoomId } = useRoomConnectionStore();

  const {
    lobby,
    gameState,
    error,
    availableLobbies,
    turnTimeRemaining,
    eliminationData,
    createLobby,
    joinLobby,
    toggleReady,
    kickPlayer,
    leaveLobby,
    invitePlayer,
    updateSettings,
    startGame,
    sendMove,
    sendRotate,
    sendDrop,
    clearState,
    setupListeners,
    fetchLobbies
  } = useAniGravityStore();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const { bypassWarning } = useExitWarning(!!lobby || !!gameState);

  // Setup listeners on mount
  useEffect(() => {
    if (!userId) return;
    // Extract ID safely. gameState has gameType not gameId in some versions, but we should use ID where possible
    const activeId = lobby?.id || (gameState as any)?.gameId || (gameState as any)?.id || gameIdParam || "";
    const cleanup = setupListeners(activeId, userId);

    if (gameIdParam && !lobby && !gameState) {
      joinLobby(gameIdParam, userId, nickname || "Player");
    }

    return () => { cleanup(); };
  }, [userId, lobby?.id, gameState, gameIdParam]);

  // Fetch lobbys
  useEffect(() => {
    if (!userId) return;
    const getApiUrl = () => {
      if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
      if (typeof window !== "undefined") return `http://${window.location.hostname}:3001`;
      return "http://localhost:3001";
    };
    const API_URL = getApiUrl();

    fetch(`${API_URL}/api/notifications/friendships/${userId}`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setFriendsList(data); })
      .catch(console.error);

    fetch(`${API_URL}/api/users/online`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setOnlineUsers(data.filter(u => u.id !== userId)); })
      .catch(console.error);

    const socket = socketService.getSocket();
    const doFetch = () => fetchLobbies();
    if (socket.connected) doFetch();
    socket.on('connect', doFetch);
    return () => { socket.off('connect', doFetch); };
  }, [userId]);

  const handleCreateLobby = () => {
    if (!userId || !nickname) return;
    createLobby(userId, nickname);
  };

  const handleLeave = () => {
    bypassWarning();
    const activeGameId = lobby?.id || (gameState as any)?.gameId;
    if (activeGameId && userId) {
      leaveLobby(activeGameId, userId);
    }
    clearState();
    router.push("/dashboard/games");
  };

  const { triggerInvite, getInviteStatus } = useInviteCooldown(lobby?.id);
  const sendInvite = (targetId: string) => {
    const activeGameId = lobby?.id;
    if (!activeGameId || !userId || !nickname) return;
    invitePlayer(activeGameId, userId, nickname, targetId);
    triggerInvite(targetId);
  };

  const handleSettingsChange = (key: string, val: number) => {
    const activeLobbyId = lobby?.id;
    if (!activeLobbyId || !userId) return;
    updateSettings(activeLobbyId, userId, { [key]: val });
  };

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  // GAME ENGINE STATE
  const canvasRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [sliderValue, setSliderValue] = useState(400);
  const [showInstructions, setShowInstructions] = useState(true);

  const currentTurnRef = useRef<number>(1);
  const inputSystemRef = useRef<InputSystem | null>(null);

  useEffect(() => {
    if (gameState) {
      currentTurnRef.current = gameState.turnNumber;
    }
  }, [gameState]);

  useEffect(() => {
    if (typeof window === 'undefined' || !canvasRef.current || !gameState) return;
    if (engine) return; // Only init once

    let cancelled = false;
    const gameEngine = new GameEngine();
    gameEngine.init(canvasRef.current).then(() => {
      if (!cancelled) {
        setEngine(gameEngine);
      }
    });

    return () => {
      cancelled = true;
      gameEngine.destroy();
    };
  }, [gameState !== null]);

  useEffect(() => {
    if (!engine || !gameState) return;
    
    const activeId = gameState?.gameId || lobby?.id || gameIdParam || "";
    const socket = socketService.getSocket();

    const input = new InputSystem({
      onMove: (x) => {
        engine.movePreviewCharacter(x);
        sendMove(activeId, userId, x);
      },
      onRotate: (angle) => {
        engine.rotatePreviewCharacter(angle);
        sendRotate(activeId, userId, angle);
      },
      onDrop: () => {
        const dropData = engine.dropCharacter(currentTurnRef.current);
        if (dropData) {
          sendDrop(activeId, userId, dropData.x, dropData.angle);
          input.disable();
        }
      },
    });

    inputSystemRef.current = input;

    const onPlayerMoved = (data: any) => {
      if (data.playerId !== userId) engine.movePreviewCharacter(data.x);
    };
    const onPlayerRotated = (data: any) => {
      if (data.playerId !== userId) engine.rotatePreviewCharacter(data.angle);
    };
    const onDropped = async (data: any) => {
      if (data.playerId !== userId) {
        const definition = CHARACTER_DEFINITIONS.find((c) => c.id === data.characterId);
        if (definition) {
          try {
            const absoluteUrl = window.location.origin + definition.colliderFile;
            const res = await fetch(absoluteUrl);
            const colliderData = await res.json();
            engine.spawnDroppedCharacter(definition, colliderData, data.x, data.angle, data.turnNumber);
          } catch (err) {
            console.error('[GamePage] Error loading dropped character collider:', err);
          }
        }
      }
      input.disable();
    };

    socket.on('PLAYER_MOVE', onPlayerMoved);
    socket.on('PLAYER_ROTATE', onPlayerRotated);
    socket.on('DROP_START', onDropped);

    return () => {
      input.disable();
      socket.off('PLAYER_MOVE', onPlayerMoved);
      socket.off('PLAYER_ROTATE', onPlayerRotated);
      socket.off('DROP_START', onDropped);
    };
  }, [engine]);

  const lastSpawnedTurnRef = useRef<number | null>(null);
  const lastSpawnedCharIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!engine || !gameState) return;

    // Sync dropped states if placing/end
    if (gameState.phase === 'DROP' || gameState.phase === 'END') {
      engine.syncPositions(gameState.droppedCharacters);
    }
    
    if (gameState.phase === 'END' && gameState.winnerId) {
      engine.playVictorySound();
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }

    const turnChanged = lastSpawnedTurnRef.current !== gameState.turnNumber;
    const charChanged = lastSpawnedCharIdRef.current !== gameState.currentCharacterId;

    if (!turnChanged && !charChanged) return;

    const isMyTurn = gameState.currentPlayerId === userId;

    if (gameState.phase === 'DROP') {
      const activeCharDef = CHARACTER_DEFINITIONS.find(c => c.id === gameState.currentCharacterId);

      if (activeCharDef) {
        lastSpawnedTurnRef.current = gameState.turnNumber;
        lastSpawnedCharIdRef.current = gameState.currentCharacterId;

        const absoluteUrl = window.location.origin + activeCharDef.colliderFile;
        fetch(absoluteUrl)
          .then((res) => res.json())
          .then((colliderData) => {
            engine.spawnPreviewCharacter(activeCharDef, colliderData);
            const currentInput = inputSystemRef.current;
            if (isMyTurn) currentInput?.enable();
            else currentInput?.disable();
          })
          .catch(console.error);
      }
    } else {
      inputSystemRef.current?.disable();
    }
  }, [gameState, engine, userId]);

  useEffect(() => {
    if (eliminationData && engine) {
      engine.playEliminationSound();
    }
  }, [eliminationData, engine]);

  if (!isClient || !userId || !nickname) {
    return (
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  // PRE-LOBBY
  if (!lobby && !gameState) {
    const agLobbies = availableLobbies.filter(l => l.gameType === 'ANIGRAVITY');
    return (
      <div className="flex flex-col h-screen bg-black text-white">
        <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard/games")} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">🌍 AniGravity</h1>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-6">
            <GlassCard className="p-8 text-center relative">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-indigo-700 rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-lg">🌍</div>
              <h2 className="text-2xl font-bold mb-2">AniGravity</h2>
              <p className="text-gray-400 mb-6 font-medium">Stack random characters without letting them fall off the platform!</p>
              <button
                onClick={handleCreateLobby}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 rounded-full font-bold shadow-lg hover:shadow-purple-500/30 transition-all hover:scale-105"
              >
                <Play className="w-5 h-5 inline mr-2" /> Create Lobby
              </button>
            </GlassCard>

            {agLobbies.length > 0 && (
              <GlassCard className="p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-purple-400" /> Open Lobbies
                </h3>
                <div className="space-y-3">
                  {agLobbies.map(l => (
                    <div key={l.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10">
                      <div>
                        <div className="font-bold text-sm">{l.hostName}&apos;s Lobby</div>
                        <div className="text-xs text-gray-400">{l.playerCount}/{l.maxPlayers} players</div>
                      </div>
                      <button onClick={() => joinLobby(l.id, userId, nickname)} className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-full text-sm font-bold">
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    );
  }

  // LOBBY
  if (lobby && !gameState) {
    const isHost = lobby.hostId === userId;
    const players = lobby.players || [];
    const settings = lobby.settings || { maxPlayers: 8 };
    const allReady = players.every(p => p.role === 'HOST' || p.isReady);
    const canStart = isHost && players.length >= 2 && allReady;

    return (
      <div className="flex flex-col h-screen bg-black text-white">
        <div className="flex flex-wrap items-center justify-between p-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-4">
            <button onClick={handleLeave} className="p-2 hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">🌍 AniGravity Lobby</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInviteModal(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-full text-sm font-bold flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Invite
            </button>
            <button onClick={handleLeave} className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/40 rounded-full text-sm font-bold flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Leave
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 gap-6">
          <GlassCard className="p-6 max-w-md w-full">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" /> Players ({players.length}/{settings.maxPlayers})
            </h2>
            <div className="space-y-3 mb-6">
              {players.map(p => (
                <div key={p.userId} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">{p.nickname}</span>
                    {p.role === 'HOST' && <span className="text-[10px] bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full font-bold">HOST</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {p.role === 'HOST' || p.isReady ? (
                      <span className="text-green-400 text-xs font-bold">Ready</span>
                    ) : (
                      <span className="text-yellow-400 text-xs font-bold">Waiting...</span>
                    )}
                    {isHost && p.userId !== userId && (
                      <button onClick={() => kickPlayer(lobby.id, userId, p.userId)} className="text-red-400 text-xs ml-2"><X className="w-4 h-4"/></button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              {!isHost && (
                <button
                  onClick={() => toggleReady(lobby.id, userId, !(players.find(p => p.userId === userId)?.isReady))}
                  className={`flex-1 py-3 rounded-full font-bold transition-all ${players.find(p => p.userId === userId)?.isReady ? 'bg-green-600' : 'bg-yellow-600'}`}
                >
                  {players.find(p => p.userId === userId)?.isReady ? '✓ Ready' : 'Ready Up'}
                </button>
              )}
              {isHost && (
                <button
                  onClick={() => startGame(lobby.id, userId)}
                  disabled={!canStart}
                  className={`flex-1 py-3 rounded-full font-bold transition-all ${canStart ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-105' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                >
                  <Play className="w-5 h-5 inline mr-2" /> Start Game
                </button>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4">Invite Players</h3>
              {onlineUsers.filter(u => !players.find(p => p.userId === u.id)).map(user => {
                const status = getInviteStatus(user.id);
                return (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl mb-2">
                    <span className="text-sm font-bold">{user.nickname}</span>
                    <button onClick={() => sendInvite(user.id)} disabled={!status.canInvite} className={`px-3 py-1 rounded-full text-xs font-bold ${!status.canInvite ? 'bg-purple-600/30' : 'bg-purple-600'}`}>
                      {status.label}
                    </button>
                  </div>
                );
              })}
              <button onClick={() => setShowInviteModal(false)} className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 rounded-full font-bold">Close</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // GAME
  if (gameState) {
    const isMyTurn = gameState.currentPlayerId === userId;
    const currentPlayer = gameState.players.find(p => (p as any).userId === gameState.currentPlayerId || (p as any).id === gameState.currentPlayerId);
    const currentCharacter = CHARACTER_DEFINITIONS.find(c => c.id === gameState.currentCharacterId);

    const handleMobileRotate = (direction: 'left' | 'right') => {
      inputSystemRef.current?.rotateManual(direction);
    };

    const handleMobileSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      setSliderValue(val);
      inputSystemRef.current?.moveManual(val);
    };

    const handleMobileDrop = () => {
      if (inputSystemRef.current && engine) {
        const dropData = engine.dropCharacter(currentTurnRef.current);
        if (dropData) {
          const activeId = gameState?.gameId || lobby?.id || gameIdParam || "";
          sendDrop(activeId, userId, dropData.x, dropData.angle);
        }
      }
    };

    return (
      <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden select-none">
        {/* Top Bar */}
        <div className="flex items-center justify-between p-3 bg-slate-900 border-b border-white/10 z-10">
          <div className="flex items-center gap-3">
             <button onClick={handleLeave} className="p-2 hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-white flex items-center gap-2">🌍 AniGravity</h1>
          </div>
          <div className="flex items-center gap-3 font-bold text-sm">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-purple-400" /> {turnTimeRemaining}s</span>
            <span className={`px-3 py-1 rounded-full ${isMyTurn ? 'bg-purple-500/30 text-purple-300 animate-pulse' : 'bg-white/10 text-gray-400'}`}>
              {isMyTurn ? "Your Turn" : `${(currentPlayer as any)?.nickname || (currentPlayer as any)?.name}'s Turn`}
            </span>
          </div>
        </div>

        <div className="flex-1 flex relative">
          {/* Main Game Arena */}
          <main className="flex-1 flex flex-col items-center justify-center p-4 relative">
            {eliminationData && (
              <div className="absolute top-10 bg-red-500/25 border-2 border-red-500 text-red-200 font-extrabold px-8 py-3 rounded-2xl shadow-2xl animate-bounce z-20 text-center max-w-sm">
                💥 {gameState.players.find(p => (p as any).userId === eliminationData.playerId || (p as any).id === eliminationData.playerId)?.name || 'Someone'} was eliminated!
                <p className="text-xs font-semibold text-red-300 mt-1">{eliminationData.reason}</p>
              </div>
            )}

            <div
              ref={canvasRef}
              className="w-full max-w-3xl aspect-[4/3] bg-slate-900 border-4 border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative"
            >
              {showInstructions && gameState.turnNumber === 1 && gameState.phase === 'DROP' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center z-30 transition-all duration-500">
                  <h3 className="text-2xl font-black text-white">AniGravity</h3>
                  <p className="text-sm text-slate-300 max-w-sm mt-2 leading-relaxed">
                    Drag mouse or slide to position. Scroll or use Q & E to rotate. Drop to stack!
                  </p>
                  <Button variant="default" className="mt-6 font-black" onClick={() => { engine?.playClickSound(); setShowInstructions(false); }}>
                    GOT IT, LET'S PLAY! 🚀
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile Controls */}
            {isMyTurn && inputSystemRef.current?.isTouchDevice() && (
              <div className="w-full max-w-md bg-slate-900/80 border border-white/5 rounded-3xl p-4 flex flex-col gap-4 mt-4 shadow-xl z-20 backdrop-blur-md">
                <div className="flex gap-4">
                  <Button variant="secondary" className="flex-1" onClick={() => handleMobileRotate('left')}>Rotate ↺</Button>
                  <Button variant="secondary" className="flex-1" onClick={() => handleMobileRotate('right')}>Rotate ↻</Button>
                </div>
                <div className="flex flex-col gap-1.5 px-1">
                  <input type="range" min="150" max="650" value={sliderValue} onChange={handleMobileSlider} className="w-full accent-purple-500 h-2 bg-slate-800 rounded-lg" />
                </div>
                <Button variant="default" className="w-full font-bold" onClick={handleMobileDrop}>DROP CHARACTER 🚀</Button>
              </div>
            )}

            {/* Winner Overlay */}
            {gameState.phase === 'END' && gameState.winnerId && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6">
                <GlassCard className="w-full max-w-md text-center p-8 border-purple-500/20">
                  <span className="text-6xl animate-bounce">👑</span>
                  <h1 className="text-4xl font-black text-white mt-4">Victory!</h1>
                  <p className="text-lg font-bold text-purple-400 mt-2">
                    {gameState.players.find(p => (p as any).userId === gameState.winnerId || (p as any).id === gameState.winnerId)?.name} wins!
                  </p>
                  <Button variant="default" className="mt-8 w-full font-bold" onClick={handleLeave}>Return to Dashboard</Button>
                </GlassCard>
              </div>
            )}
          </main>

          {/* Right Sidebar - Players */}
          <aside className="w-64 bg-slate-900 border-l border-white/10 flex flex-col hidden md:flex">
            <div className="p-4 border-b border-white/10 font-bold text-sm tracking-wider uppercase text-slate-400">Players</div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {gameState.players.map(p => {
                const isActive = gameState.currentPlayerId === ((p as any).userId || (p as any).id);
                const isEliminated = gameState.eliminatedPlayers.includes((p as any).userId || (p as any).id);
                return (
                  <div key={(p as any).userId || (p as any).id} className={`flex items-center gap-3 p-3 rounded-xl border ${isActive ? 'bg-purple-600/20 border-purple-500' : isEliminated ? 'bg-red-500/5 border-red-500/10 opacity-50' : 'bg-white/5 border-white/5'}`}>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-slate-200">{(p as any).nickname || (p as any).name}</span>
                      <span className="text-xs font-bold uppercase text-slate-400">{isEliminated ? 'Eliminated 💀' : isActive ? 'Placing... ⏳' : 'Waiting'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return null;
}

export default function AniGravityPage() {
  return (
    <Suspense fallback={<div className="flex h-screen bg-black items-center justify-center text-white"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>}>
      <AniGravityPageContent />
    </Suspense>
  );
}
