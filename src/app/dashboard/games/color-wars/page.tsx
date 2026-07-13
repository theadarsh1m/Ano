"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Play, UserPlus, LogOut, Loader2, Check, X,
  MessageSquare, Award, ArrowLeft, Globe, Trophy, Crown, Settings, Clock, BookOpen, Volume2, VolumeX
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useRoomConnectionStore } from "@/store/useRoomConnectionStore";
import { useVoiceStore } from "@/store/useVoiceStore";
import { useColorWarsStore, ColorWarsCell, ColorWarsPlayerState, LobbyPlayer, PublicLobby } from "@/store/useColorWarsStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { ChatArea } from "@/components/room/ChatArea";
import { MessageInput } from "@/components/room/MessageInput";

// Map server color names to Tailwind design assets and hex codes
interface ColorAsset {
  bg: string;
  bgLight: string;
  border: string;
  shadow: string;
  text: string;
  hex: string;
}

const COLOR_ASSETS: Record<string, ColorAsset> = {
  red: {
    bg: 'from-rose-500 to-red-600',
    bgLight: 'bg-red-500/20',
    border: 'border-red-400/50',
    shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.5)]',
    text: 'text-red-400',
    hex: '#ef4444',
  },
  blue: {
    bg: 'from-blue-500 to-sky-600',
    bgLight: 'bg-blue-500/20',
    border: 'border-blue-400/50',
    shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.5)]',
    text: 'text-blue-400',
    hex: '#3b82f6',
  },
  green: {
    bg: 'from-emerald-500 to-teal-600',
    bgLight: 'bg-emerald-500/20',
    border: 'border-emerald-400/50',
    shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.5)]',
    text: 'text-emerald-400',
    hex: '#10b981',
  },
  yellow: {
    bg: 'from-amber-400 to-yellow-500',
    bgLight: 'bg-yellow-500/20',
    border: 'border-yellow-400/50',
    shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]',
    text: 'text-yellow-400',
    hex: '#f59e0b',
  },
  purple: {
    bg: 'from-purple-500 to-violet-600',
    bgLight: 'bg-purple-500/20',
    border: 'border-purple-400/50',
    shadow: 'shadow-[0_0_15px_rgba(139,92,246,0.5)]',
    text: 'text-purple-400',
    hex: '#8b5cf6',
  },
  orange: {
    bg: 'from-orange-500 to-red-500',
    bgLight: 'bg-orange-500/20',
    border: 'border-orange-400/50',
    shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.5)]',
    text: 'text-orange-400',
    hex: '#f97316',
  },
  pink: {
    bg: 'from-pink-500 to-rose-500',
    bgLight: 'bg-pink-500/20',
    border: 'border-pink-400/50',
    shadow: 'shadow-[0_0_15px_rgba(236,72,153,0.5)]',
    text: 'text-pink-400',
    hex: '#ec4899',
  },
  cyan: {
    bg: 'from-cyan-500 to-teal-500',
    bgLight: 'bg-cyan-500/20',
    border: 'border-cyan-400/50',
    shadow: 'shadow-[0_0_15px_rgba(6,182,212,0.5)]',
    text: 'text-cyan-400',
    hex: '#06b6d4',
  },
};

function ColorWarsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get("gameId");

  const { id: userId, nickname } = useUserStore();
  const { currentRoomId } = useRoomConnectionStore();
  const { connectedChannelId, isMuted, toggleMute, disconnect: disconnectVoice } = useVoiceStore();

  const {
    lobby, gameState, error, availableLobbies, lastMoveResult,
    createLobby, joinLobby, toggleReady, kickPlayer, leaveLobby,
    invitePlayer, updateSettings, startGame, selectTile,
    clearState, setupListeners, fetchLobbies
  } = useColorWarsStore();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());

  // Animation States
  const [isAnimating, setIsAnimating] = useState(false);
  const [localGrid, setLocalGrid] = useState<ColorWarsCell[][] | null>(null);
  const [explodingCells, setExplodingCells] = useState<{ r: number; c: number }[]>([]);

  // Setup listeners on mount
  useEffect(() => {
    if (!userId) return;
    const cleanup = setupListeners(lobby?.id || gameState?.gameId || "", userId);

    if (gameIdParam && !lobby && !gameState) {
      joinLobby(gameIdParam, userId, nickname || "Player");
    }

    return () => {
      cleanup();
    };
  }, [userId, gameIdParam]);

  // Fetch online users & friends list
  useEffect(() => {
    if (!userId) return;
    const getApiUrl = () => {
      if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
      if (typeof window !== "undefined") return `http://${window.location.hostname}:3001`;
      return "http://localhost:3001";
    };

    fetch(`${getApiUrl()}/api/users/online`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setOnlineUsers(data.filter(u => u.id !== userId));
      })
      .catch(() => {});

    if (currentRoomId) {
      fetch(`${getApiUrl()}/api/rooms/${currentRoomId}/members`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setRoomMembers(data.filter(u => u.id !== userId));
        })
        .catch(() => {});
    }

    fetchLobbies();
  }, [userId, currentRoomId, lobby?.id]);

  // Wave cascade animation compiler
  useEffect(() => {
    if (!lastMoveResult) return;

    const { waves } = lastMoveResult;
    if (waves.length === 0) return;

    setIsAnimating(true);
    let waveIndex = 0;

    const playWave = () => {
      if (waveIndex >= waves.length) {
        setIsAnimating(false);
        setLocalGrid(null);
        setExplodingCells([]);
        return;
      }

      const currentWave = waves[waveIndex];
      setLocalGrid(currentWave.gridStateSnapshot);
      setExplodingCells(currentWave.explosions);

      // Play explosion sound effect (audio synthesis fallback)
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100 - waveIndex * 5, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch (e) {}

      waveIndex++;
      setTimeout(playWave, 350); // 350ms interval between waves
    };

    playWave();
  }, [lastMoveResult]);

  const handleCreateLobby = () => {
    if (!userId || !nickname) return;
    createLobby(userId, nickname);
  };

  const handleLeave = () => {
    const activeGameId = gameState?.gameId || lobby?.id;
    if (activeGameId && userId) {
      leaveLobby(activeGameId, userId);
    }
    clearState();
    router.push("/dashboard/games");
  };

  const sendInvite = (targetId: string) => {
    const activeGameId = gameState?.gameId || lobby?.id;
    if (!activeGameId || !userId || !nickname) return;
    invitePlayer(activeGameId, userId, nickname, targetId);
    setInvitedUsers(prev => new Set(prev).add(targetId));
  };

  const handleCellClick = (r: number, c: number) => {
    if (!gameState || isAnimating) return;
    const isMyTurn = gameState.currentTurnPlayerId === userId;
    if (!isMyTurn) return;

    const cell = gameState.grid[r][c];
    if (cell.ownerId !== null && cell.ownerId !== userId) return; // Cannot place on opponent's tiles

    selectTile(gameState.gameId, userId, r, c);
  };

  // Render Rules Modal
  const rulesModal = (
    <AnimatePresence>
      {showRulesModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setShowRulesModal(false)}
        >
          <motion.div 
            initial={{ y: 50, scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 50, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto text-left relative shadow-2xl custom-scrollbar"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-rose-400" /> Color Wars Rules
              </h2>
              <button onClick={() => setShowRulesModal(false)} className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-md transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
              <p><strong className="text-white">Goal:</strong> Capture the entire board and eliminate all opponents by trigger-charging tile explosions.</p>
              
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-rose-400 block mb-1">How to Play:</strong>
                <p>On your turn, click any neutral cell or a cell you already own to add +1 energy (dot) to it.</p>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-rose-400 block mb-1">Tile Capacity & Explosions:</strong>
                <p>Each tile has a limit before it bursts:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Corners:</strong> Capacity is 2. Explodes at 2 dots.</li>
                  <li><strong>Edges:</strong> Capacity is 3. Explodes at 3 dots.</li>
                  <li><strong>Center:</strong> Capacity is 4. Explodes at 4 dots.</li>
                </ul>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-rose-400 block mb-1">Chain Reactions:</strong>
                <p>When a cell explodes, its level decreases by its capacity, and it distributes 1 dot to each adjacent tile (top, bottom, left, right).</p>
                <p className="mt-1">Any opponent-owned neighbor hit by the explosion is captured, turning into your color. If the neighbor exceeds its capacity, it triggers another explosion in a cascade!</p>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-rose-400 block mb-1">Elimination:</strong>
                <p>Once you take your first turn, if you are left with 0 tiles on the board, you are eliminated and become a spectator.</p>
              </div>
            </div>

            <button 
              onClick={() => setShowRulesModal(false)}
              className="mt-6 w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-500/25"
            >
              Got it!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  if (!isClient || !userId || !nickname) {
    return (
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
          <span className="text-sm text-gray-400">Loading game session...</span>
        </div>
      </div>
    );
  }

  // ========================
  // PRE-LOBBY VIEW
  // ========================
  if (!lobby && !gameState) {
    const activeColorLobbies = availableLobbies.filter(l => l.gameType === 'COLOR_WARS');
    return (
      <div className="flex flex-col h-screen bg-black text-white overflow-y-auto p-4 space-y-6">
        <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard/games")} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">💥 Color Wars</h1>
              <p className="text-xs text-gray-400">Strategically place energy, trigger reactions, and control the grid</p>
            </div>
          </div>
          <button 
            onClick={() => setShowRulesModal(true)}
            className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-xl flex items-center gap-2 transition-colors text-sm font-semibold hover:bg-white/10"
          >
            <BookOpen className="w-4 h-4" /> Rules
          </button>
        </div>

        <div className="flex-1 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <GlassCard className="p-8 text-center flex flex-col space-y-6 border-rose-500/20 relative">
            <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-red-600 rounded-3xl flex items-center justify-center text-white text-4xl mx-auto shadow-lg shadow-rose-500/20 animate-pulse">
              💥
            </div>
            <div>
              <h2 className="text-2xl font-bold">Create a New Battle</h2>
              <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
                Host a private room, configure custom board sizes, and invite your friends for an explosive chain reaction match.
              </p>
            </div>
            <button
              onClick={handleCreateLobby}
              className="px-8 py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-2xl font-bold text-white shadow-lg hover:shadow-rose-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] w-full max-w-sm mx-auto"
            >
              Create Battle Lobby
            </button>
          </GlassCard>

          <GlassCard className="p-8 flex flex-col space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Globe className="w-5 h-5 text-rose-400 animate-spin-slow" /> Open Lobbies
            </h2>

            {activeColorLobbies.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                No public lobbies are active right now. Start one yourself!
              </div>
            ) : (
              <div className="space-y-3">
                {activeColorLobbies.map(l => (
                  <div key={l.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                    <div>
                      <div className="font-bold text-sm">{l.hostName}&apos;s Lobby</div>
                      <div className="text-xs text-gray-400 mt-0.5">{l.playerCount}/{l.maxPlayers} players • Size: {l.settings?.boardSize}x{l.settings?.boardSize}</div>
                    </div>
                    <button
                      onClick={() => joinLobby(l.id, userId, nickname)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold text-white transition-colors"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
        {rulesModal}
      </div>
    );
  }

  // ========================
  // LOBBY VIEW
  // ========================
  if (lobby && !gameState) {
    const isHost = lobby.hostId === userId;
    const players = lobby.players || [];
    const settings = lobby.settings || { maxPlayers: 8, boardSize: 7, turnTimer: 30 };
    const allReady = players.every(p => p.role === 'HOST' || p.isReady);
    const canStart = isHost && players.length >= 2 && allReady;

    return (
      <div className="flex flex-col h-screen bg-black text-white p-4 space-y-6 overflow-y-auto">
        <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <button onClick={handleLeave} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">💥 Color Wars Lobby</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowRulesModal(true)}
              className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors hover:bg-white/10"
            >
              <BookOpen className="w-4 h-4" /> Rules
            </button>
            <button onClick={() => setShowInviteModal(true)} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
              <UserPlus className="w-4 h-4" /> Invite
            </button>
            <button onClick={handleLeave} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-xl text-sm font-bold text-red-400 flex items-center gap-2 transition-colors">
              <LogOut className="w-4 h-4" /> Leave
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <GlassCard className="p-6 md:col-span-2 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-rose-400" /> Players ({players.length}/{settings.maxPlayers || 8})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {players.map(p => (
                <div key={p.userId} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-2xl relative group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center font-bold text-sm shadow">
                      {p.nickname?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-1.5">
                        {p.nickname}
                        {p.role === 'HOST' && <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-500/20 font-bold uppercase tracking-wider">Host</span>}
                      </div>
                      <span className="text-[10px] text-gray-400">{p.role === 'HOST' ? 'Ready' : (p.isReady ? 'Ready' : 'Not Ready')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {p.role !== 'HOST' && p.isReady && (
                      <div className="p-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {p.role !== 'HOST' && !p.isReady && (
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />
                    )}
                    {isHost && p.userId !== userId && (
                      <button
                        onClick={() => kickPlayer(lobby.id, userId, p.userId)}
                        className="opacity-0 group-hover:opacity-100 px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-lg transition-all text-xs font-semibold"
                      >
                        Kick
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Ready/Start panel */}
            <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
              {!isHost && (
                <button
                  onClick={() => {
                    const self = players.find(p => p.userId === userId);
                    if (self) toggleReady(lobby.id, userId, !self.isReady);
                  }}
                  className={`px-6 py-2.5 rounded-xl font-bold transition-all border ${
                    players.find(p => p.userId === userId)?.isReady 
                      ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' 
                      : 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white'
                  }`}
                >
                  {players.find(p => p.userId === userId)?.isReady ? 'Unready' : 'Ready'}
                </button>
              )}

              {isHost && (
                <button
                  onClick={() => startGame(lobby.id, userId)}
                  disabled={!canStart}
                  className={`px-8 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                    canStart 
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:scale-[1.02]' 
                      : 'bg-white/5 border border-white/5 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-4 h-4" /> Start Battle
                </button>
              )}
            </div>
          </GlassCard>

          {/* Lobby settings */}
          <GlassCard className="p-6 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Settings className="w-5 h-5 text-rose-400" /> Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Board Size</label>
                <select
                  disabled={!isHost}
                  value={settings.boardSize || 7}
                  onChange={(e) => updateSettings(lobby.id, userId, { boardSize: parseInt(e.target.value) })}
                  className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50 transition-colors disabled:opacity-50"
                >
                  <option value="5">Small (5x5)</option>
                  <option value="7">Medium (7x7)</option>
                  <option value="9">Large (9x9)</option>
                  <option value="11">Huge (11x11)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Turn Timer</label>
                <select
                  disabled={!isHost}
                  value={settings.turnTimer || 30}
                  onChange={(e) => updateSettings(lobby.id, userId, { turnTimer: parseInt(e.target.value) })}
                  className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50 transition-colors disabled:opacity-50"
                >
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="45">45 seconds</option>
                  <option value="60">60 seconds</option>
                </select>
              </div>
            </div>
          </GlassCard>
        </div>
        {rulesModal}

        {/* Invites modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <GlassCard className="max-w-md w-full p-6 flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Invite Players</h3>
                <button onClick={() => setShowInviteModal(false)} className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Room Members</h4>
                  {roomMembers.length === 0 ? (
                    <p className="text-xs text-gray-500">No other users in this room channel.</p>
                  ) : (
                    <div className="space-y-2">
                      {roomMembers.map(m => (
                        <div key={m.id} className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5">
                          <span className="text-sm font-semibold">{m.nickname}</span>
                          <button
                            disabled={invitedUsers.has(m.id)}
                            onClick={() => sendInvite(m.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${invitedUsers.has(m.id) ? 'bg-white/5 border border-white/5 text-gray-400 cursor-default' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}
                          >
                            {invitedUsers.has(m.id) ? 'Invited' : 'Invite'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Online Users</h4>
                  {onlineUsers.length === 0 ? (
                    <p className="text-xs text-gray-500">No other players online.</p>
                  ) : (
                    <div className="space-y-2">
                      {onlineUsers.map(u => (
                        <div key={u.id} className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5">
                          <span className="text-sm font-semibold">{u.nickname}</span>
                          <button
                            disabled={invitedUsers.has(u.id)}
                            onClick={() => sendInvite(u.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${invitedUsers.has(u.id) ? 'bg-white/5 border border-white/5 text-gray-400 cursor-default' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}
                          >
                            {invitedUsers.has(u.id) ? 'Invited' : 'Invite'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    );
  }

  // ========================
  // ACTIVE GAME VIEW
  // ========================
  if (gameState) {
    const isMyTurn = gameState.currentTurnPlayerId === userId;
    const gridToRender = localGrid || gameState.grid;
    const boardSize = gameState.boardSize;
    const currentTurnPlayer = gameState.players.find(p => p.userId === gameState.currentTurnPlayerId);
    
    // Sort players by tile count
    const sortedPlayers = [...gameState.players].sort((a, b) => b.tileCount - a.tileCount);

    return (
      <div className="flex flex-col lg:flex-row h-screen bg-neutral-950 text-white overflow-hidden select-none">
        
        {/* Main table area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Top Panel toolbar */}
          <div className="p-3 md:p-4 border-b border-white/10 flex flex-wrap gap-2 justify-between items-center bg-black/40 backdrop-blur-md relative z-20">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleLeave}
                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <span className="text-lg font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-red-500 flex items-center gap-2 select-none uppercase">
                  💥 Color Wars
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400">
              <button 
                onClick={() => setShowRulesModal(true)}
                className="px-3 py-1 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full font-bold text-xs flex items-center gap-1.5 transition-colors hover:bg-white/10"
              >
                <BookOpen className="w-3.5 h-3.5" /> Rules
              </button>
              {gameState.status === 'PLAYING' && (
                <span className="flex items-center gap-1.5 font-bold">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  Time: <span className="text-white">{gameState.turnTimeLeft}s</span>
                </span>
              )}
              {gameState.status === 'PLAYING' && (
                <span className={`px-3 py-1 rounded-full font-bold text-xs ${isMyTurn ? 'bg-rose-500/30 text-rose-300 animate-pulse' : 'bg-white/10 text-gray-400'}`}>
                  {isMyTurn ? "Your Turn" : `${currentTurnPlayer?.nickname}'s Turn`}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleLeave} 
                className="px-3.5 py-2 bg-red-600/20 hover:bg-red-600/45 border border-red-500/35 rounded-xl text-xs font-bold text-red-400 flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Leave
              </button>
              <button 
                onClick={() => setShowChatSidebar(!showChatSidebar)}
                className={`p-2 rounded-xl border transition-all ${
                  showChatSidebar 
                    ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' 
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile/Tablet Horizontal Player Strip */}
          <div className="flex lg:hidden overflow-x-auto gap-2 p-3 bg-neutral-900/60 border-b border-white/10 scrollbar-hide flex-shrink-0 w-full justify-center">
            {gameState.players.map((p) => {
              const colors = COLOR_ASSETS[p.color];
              const isTurn = p.userId === gameState.currentTurnPlayerId;
              return (
                <div 
                  key={p.userId} 
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all ${
                    isTurn 
                      ? 'bg-rose-500/10 shadow-sm font-extrabold' 
                      : 'bg-white/2 border-white/5 opacity-60'
                  }`}
                  style={{ borderColor: isTurn && colors ? colors.hex : 'rgba(255,255,255,0.05)' }}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors?.hex || '#fff' }} />
                  <span>{p.nickname}</span>
                  <span className="text-[10px] text-neutral-400">({p.tileCount})</span>
                </div>
              );
            })}
          </div>

          {/* Interactive Board Grid */}
          <div className="flex-1 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-neutral-950 p-4 flex flex-col items-center justify-center relative overflow-hidden">
            
            {/* Grid wrapper with auto scaling */}
            <div 
              className="w-full max-w-[550px] aspect-square flex items-center justify-center p-2 bg-neutral-900/40 border border-white/5 rounded-3xl relative shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              style={{ maxHeight: 'calc(100vh - 180px)' }}
            >
              <div 
                className="grid gap-1.5 w-full h-full"
                style={{ 
                  gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${boardSize}, minmax(0, 1fr))`
                }}
              >
                {gridToRender.map((row, r) => 
                  row.map((cell, c) => {
                    const cellColor = cell.ownerId 
                      ? (gameState.players.find(p => p.userId === cell.ownerId)?.color || 'red')
                      : null;
                    const colors = cellColor ? COLOR_ASSETS[cellColor] : null;
                    
                    const isExploding = explodingCells.some(ec => ec.r === r && ec.c === c);
                    const isCurrentTurnPlayerCell = cell.ownerId === gameState.currentTurnPlayerId;
                    const myPlayerState = gameState.players.find(p => p.userId === userId);
                    const isFirstTurn = myPlayerState ? myPlayerState.tileCount === 0 : true;
                    
                    const canClickCell = isMyTurn && !isAnimating && (
                      isFirstTurn 
                        ? cell.ownerId === null 
                        : cell.ownerId === userId
                    );

                    const borderClass = isCurrentTurnPlayerCell && colors 
                      ? colors.border 
                      : 'border-white/10';
                    const shadowClass = isCurrentTurnPlayerCell && colors 
                      ? colors.shadow 
                      : 'shadow-none';

                    return (
                      <button
                        key={`${r}-${c}`}
                        disabled={!canClickCell}
                        onClick={() => handleCellClick(r, c)}
                        className={`w-full h-full rounded-xl border flex flex-col items-center justify-center relative transition-all duration-300 touch-game select-none ${
                          colors 
                            ? `${colors.bgLight} ${borderClass} ${shadowClass}` 
                            : 'bg-white/2 border-white/5 hover:bg-white/5 focus:bg-white/5'
                        } ${isExploding ? 'scale-110 border-red-500 bg-red-500/20' : ''}`}
                      >
                        {/* Rendering energy dots */}
                        {cell.level > 0 && colors && (
                          <div className="relative w-10 h-10 flex items-center justify-center">
                            
                            {/* Render level 1 layout (1 dot in center) */}
                            {cell.level === 1 && (
                              <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg`} />
                            )}

                            {/* Render level 2 layout (2 simple static dots side-by-side) */}
                            {cell.level === 2 && (
                              <div className="flex gap-2">
                                <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg`} />
                                <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg`} />
                              </div>
                            )}

                            {/* Render level 3 layout (3 simple static dots in triangle) */}
                            {cell.level === 3 && (
                              <div className="w-8 h-8 relative flex flex-col items-center justify-center gap-0.5">
                                <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg`} />
                                <div className="flex gap-1">
                                  <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg`} />
                                  <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg`} />
                                </div>
                              </div>
                            )}

                            {/* Render level 4+ layout (4 simple static dots in 2x2 grid) */}
                            {cell.level >= 4 && (
                              <div className="grid grid-cols-2 gap-1.5">
                                <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg`} />
                                <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg`} />
                                <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg`} />
                                <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg`} />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Rendering flying exploding orbs */}
                        {isExploding && colors && (
                          <div className="absolute inset-0 pointer-events-none z-30">
                            {r > 0 && (
                              <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-fly-up`} />
                            )}
                            {r < boardSize - 1 && (
                              <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-fly-down`} />
                            )}
                            {c > 0 && (
                              <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-fly-left`} />
                            )}
                            {c < boardSize - 1 && (
                              <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${colors.bg} ${colors.shadow} shadow-lg absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-fly-right`} />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Turn Announcement Banner */}
            <div className="mt-4 text-center select-none">
              {isMyTurn ? (
                <p className="text-sm font-extrabold text-rose-400 tracking-wide animate-pulse">It is your turn! Place energy on any neutral or personal tile.</p>
              ) : (
                <p className="text-sm text-neutral-400">Waiting for {currentTurnPlayer?.nickname || 'next player'} to make a move...</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar panel */}
        <div className="hidden lg:flex w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-white/10 bg-neutral-950 flex-col h-96 lg:h-screen flex-shrink-0">
          
          {/* Header */}
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <span className="font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-rose-400" /> Match Leaderboard
            </span>
          </div>

          {/* Player list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {sortedPlayers.map((p) => {
              const colors = COLOR_ASSETS[p.color];
              const isTurn = p.userId === gameState.currentTurnPlayerId;

              return (
                <div 
                  key={p.userId} 
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 ${
                    p.isEliminated 
                      ? 'bg-neutral-950/40 border-neutral-900 opacity-50' 
                      : isTurn 
                        ? 'bg-rose-500/10 border-rose-500/30' 
                        : 'bg-white/5 border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${colors?.bg} flex items-center justify-center font-bold text-[10px] text-white shadow`}>
                      {p.nickname?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="text-sm font-bold flex items-center gap-1.5">
                        {p.nickname}
                        {p.userId === userId && <span className="text-[8px] bg-white/10 text-gray-300 px-1 rounded">You</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${p.isOnline ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
                        {p.isEliminated ? 'Eliminated (Spectating)' : `Controlling ${p.tileCount} tiles`}
                      </div>
                    </div>
                  </div>

                  {isTurn && !p.isEliminated && (
                    <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                  )}
                </div>
              );
            })}

            {/* Game Logs history ticker */}
            <div className="pt-4 border-t border-white/5">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">History Logs</h3>
              <div className="space-y-1 max-h-[140px] overflow-y-auto text-[10px] text-neutral-500 font-mono">
                {gameState.historyLogs.map((log, idx) => (
                  <div key={idx} className="truncate">{log}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Voice Toolbar */}
          <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between gap-3 flex-shrink-0">
            <button
              onClick={toggleMute}
              className={`p-2.5 rounded-xl border transition-all flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold ${
                isMuted 
                  ? 'bg-red-500/20 border-red-500/30 text-red-300' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
              }`}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4" /> Muted
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" /> Mute
                </>
              )}
            </button>

            {connectedChannelId && (
              <button
                onClick={disconnectVoice}
                className="p-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-xl transition-all text-xs font-semibold"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Chat Sidebar */}
        <AnimatePresence>
          {showChatSidebar && currentRoomId && (
            <motion.div 
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="w-full lg:w-96 border-l border-white/10 bg-white/5 backdrop-blur-md flex flex-col h-screen absolute lg:relative right-0 z-30 shadow-2xl"
            >
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40 backdrop-blur-md">
                <span className="font-bold flex items-center gap-2 text-sm">
                  <MessageSquare className="w-4 h-4 text-purple-400" /> Room Chat
                </span>
                <button 
                  onClick={() => setShowChatSidebar(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ChatArea roomId={currentRoomId} />
              </div>
              <div className="p-4 bg-black/20">
                <MessageInput roomId={currentRoomId} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Winner overlay celebration modal */}
        <AnimatePresence>
          {gameState.status === 'FINISHED' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ y: 50, scale: 0.95 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 50, scale: 0.95 }}
                className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl shadow-rose-500/10"
              >
                <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/30 rounded-3xl flex items-center justify-center text-rose-400 text-5xl mx-auto shadow-lg shadow-rose-500/20 animate-bounce">
                  🏆
                </div>
                
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-wider text-rose-400">Match Concluded</h2>
                  <p className="text-gray-400 text-sm mt-1">Colors have settled. We have a victor!</p>
                </div>

                {gameState.winnerId ? (
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-xs text-neutral-400 uppercase tracking-widest block font-bold mb-1">Victor</span>
                    <strong className="text-2xl text-white block">
                      {gameState.players.find(p => p.userId === gameState.winnerId)?.nickname || 'Player'}
                    </strong>
                  </div>
                ) : (
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <strong className="text-2xl text-white block">It&apos;s a Draw!</strong>
                  </div>
                )}

                <div className="space-y-2 pt-2 text-left">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Ending Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-white/2 p-2 rounded-lg text-neutral-400">
                      Winner ID: <span className="text-white block font-bold truncate">{gameState.winnerId || 'None'}</span>
                    </div>
                    <div className="bg-white/2 p-2 rounded-lg text-neutral-400">
                      Duration: <span className="text-white block font-bold">Ended</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLeave}
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl shadow-lg shadow-rose-500/20 transition-all"
                >
                  Return to Hub
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {rulesModal}
      </div>
    );
  }

  return null;
}

export default function ColorWarsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
      </div>
    }>
      <ColorWarsPageContent />
    </Suspense>
  );
}
