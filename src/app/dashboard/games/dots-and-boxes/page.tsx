"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Play, UserPlus, LogOut, Loader2, Check, X,
  Volume2, VolumeX, MessageSquare, Award, ArrowLeft, Send, RefreshCw, Globe, Trophy, Crown, Settings, Clock, BookOpen
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useRoomConnectionStore } from "@/store/useRoomConnectionStore";
import { useVoiceStore } from "@/store/useVoiceStore";
import { useDotsAndBoxesStore, LobbyPlayer, DotsAndBoxesGameState, PublicLobby } from "@/store/useDotsAndBoxesStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { ChatArea } from "@/components/room/ChatArea";
import { MessageInput } from "@/components/room/MessageInput";
import { socketService } from "@/lib/socket";
import { TurnIndicator } from "@/components/games/TurnIndicator";
import { useExitWarning } from "@/hooks/useExitWarning";

// Unique colors for each player (up to 8)
const PLAYER_COLORS = [
  { bg: 'from-rose-500 to-pink-600',     border: 'border-rose-400/60',   shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.4)]',   text: 'text-rose-400',    bgLight: 'bg-rose-500/20',   hex: '#f43f5e' },
  { bg: 'from-sky-500 to-cyan-600',       border: 'border-sky-400/60',    shadow: 'shadow-[0_0_15px_rgba(14,165,233,0.4)]',  text: 'text-sky-400',     bgLight: 'bg-sky-500/20',    hex: '#0ea5e9' },
  { bg: 'from-emerald-500 to-green-600',  border: 'border-emerald-400/60', shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]', text: 'text-emerald-400', bgLight: 'bg-emerald-500/20', hex: '#10b981' },
  { bg: 'from-amber-500 to-yellow-600',   border: 'border-amber-400/60',  shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',  text: 'text-amber-400',   bgLight: 'bg-amber-500/20',  hex: '#f59e0b' },
  { bg: 'from-violet-500 to-purple-600',  border: 'border-violet-400/60', shadow: 'shadow-[0_0_15px_rgba(139,92,246,0.4)]',  text: 'text-violet-400',  bgLight: 'bg-violet-500/20', hex: '#8b5cf6' },
  { bg: 'from-orange-500 to-red-600',     border: 'border-orange-400/60', shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.4)]',  text: 'text-orange-400',  bgLight: 'bg-orange-500/20', hex: '#f97316' },
  { bg: 'from-teal-500 to-cyan-600',      border: 'border-teal-400/60',   shadow: 'shadow-[0_0_15px_rgba(20,184,166,0.4)]',  text: 'text-teal-400',    bgLight: 'bg-teal-500/20',   hex: '#14b8a6' },
  { bg: 'from-fuchsia-500 to-pink-600',   border: 'border-fuchsia-400/60', shadow: 'shadow-[0_0_15px_rgba(217,70,239,0.4)]', text: 'text-fuchsia-400', bgLight: 'bg-fuchsia-500/20', hex: '#d946ef' },
];

function getPlayerColorIndex(players: { userId: string }[], playerId: string): number {
  const idx = players.findIndex(p => p.userId === playerId);
  return idx >= 0 ? idx % PLAYER_COLORS.length : 0;
}

function DotsAndBoxesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get("gameId");

  const { id: userId, nickname } = useUserStore();
  const { currentRoomId } = useRoomConnectionStore();
  const { connectedChannelId, isMuted, toggleMute, disconnect: disconnectVoice } = useVoiceStore();

  const {
    lobby,
    gameState,
    error,
    availableLobbies,
    createLobby,
    joinLobby,
    toggleReady,
    kickPlayer,
    leaveLobby,
    invitePlayer,
    updateSettings,
    startGame,
    drawLine,
    clearState,
    setupListeners,
    fetchLobbies
  } = useDotsAndBoxesStore();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Board drawing layout configuration variables
  const [hoveredLine, setHoveredLine] = useState<{ type: 'H' | 'V'; r: number; c: number } | null>(null);
  const [boxSize, setBoxSize] = useState(55);

  // Responsive board sizing
  useEffect(() => {
    const updateSize = () => {
      const w = window.innerWidth;
      if (w < 640) setBoxSize(35);
      else if (w < 1024) setBoxSize(45);
      else setBoxSize(55);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const { bypassWarning } = useExitWarning(!!lobby || !!gameState);

  // Setup listeners on mount
  useEffect(() => {
    if (!userId) return;
    const cleanup = setupListeners(lobby?.id || gameState?.gameId || "", userId);

    if (gameIdParam && !lobby && !gameState) {
      joinLobby(gameIdParam, userId, nickname || "Player");
    }

    return () => { cleanup(); };
  }, [userId, lobby?.id, gameState?.gameId, gameIdParam]);

  // Leave lobby on unmount
  useEffect(() => {
    return () => {
      const state = useDotsAndBoxesStore.getState();
      const currentGameId = state.lobby?.id || state.gameState?.gameId;
      const currentUserId = useUserStore.getState().id;
      if (currentGameId && currentUserId) {
        state.leaveLobby(currentGameId, currentUserId);
      }
    };
  }, []);

  // Fetch friends/online users for invites
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

    if (currentRoomId) {
      fetch(`${API_URL}/api/rooms/${currentRoomId}/users`)
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setRoomMembers(data.filter(u => u.id !== userId)); })
        .catch(console.error);
    }
  }, [userId, currentRoomId, lobby?.id]);

  // Fetch lobbies
  useEffect(() => {
    if (!userId) return;
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

  const handleDrawLine = (type: 'H' | 'V', r: number, c: number) => {
    const activeGameId = gameState?.gameId;
    if (!activeGameId || !userId) return;
    drawLine(activeGameId, userId, type, r, c);
    setHoveredLine(null);
  };

  const handleLeave = () => {
    bypassWarning();
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

  const handleSettingsChange = (key: string, val: number) => {
    const activeLobbyId = lobby?.id;
    if (!activeLobbyId || !userId) return;
    updateSettings(activeLobbyId, userId, { [key]: val });
  };

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  if (!isClient || !userId || !nickname) {
    return (
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="text-sm text-gray-400">Loading game session...</span>
        </div>
      </div>
    );
  }

  const rulesModal = (
    <AnimatePresence>
      {showRulesModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in"
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
              <h2 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-blue-400" /> Dots & Boxes Rules</h2>
              <button onClick={() => setShowRulesModal(false)} className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-md transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
              <p><strong className="text-white">Goal:</strong> Close more boxes (squares) than your opponents by drawing lines on the grid.</p>
              
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-blue-400 block mb-1">On Your Turn:</strong>
                <p>Click on any uncolored dotted line (horizontal or vertical) to color it with your player color.</p>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-blue-400 block mb-1">Completing Boxes:</strong>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Score points:</strong> If the line you drew completes a 1x1 square box, that box is captured in your color and you gain 1 point!</li>
                  <li><strong>Double turn:</strong> When you complete a box, you instantly get to make another line draw. You can chain multiple box completions in a single turn.</li>
                  <li><strong>Pass Turn:</strong> If your drawn line does not complete any box, the turn immediately passes to the next player.</li>
                </ul>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-blue-400 block mb-1">Lobby Configurations:</strong>
                <p>The host can change the grid size (number of dots in a row/column) and set a turn timeout limit to speed up gameplay.</p>
              </div>
            </div>

            <button 
              onClick={() => setShowRulesModal(false)}
              className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-755 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/25"
            >
              Got it!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ========================
  // PRE-LOBBY VIEW
  // ========================
  if (!lobby && !gameState) {
    const dbLobbies = availableLobbies.filter(l => l.gameType === 'DOTS_AND_BOXES');
    return (
      <div className="flex flex-col h-screen bg-black text-white">
        <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard/games")} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button onClick={() => router.push("/dashboard")} className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Ano</span>
            </button>
            <div className="ml-2 border-l border-white/20 pl-4">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                ✏️ Dots and Boxes
              </h1>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-6">
            <GlassCard className="p-8 text-center relative">
              <button 
                onClick={() => setShowRulesModal(true)}
                className="absolute top-4 right-4 p-2 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-xl flex items-center gap-1 text-xs font-semibold hover:bg-white/10 transition-all"
              >
                <BookOpen className="w-4 h-4" /> Rules
              </button>
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-indigo-700 rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-lg">
                ✏️
              </div>
              <h2 className="text-2xl font-bold mb-2">Dots and Boxes</h2>
              <p className="text-gray-400 mb-6 font-medium">Connect lines, complete squares, and control the grid in this classic multiplayer turn strategy game!</p>
              <button
                onClick={handleCreateLobby}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-full font-bold text-white shadow-lg hover:shadow-blue-500/30 transition-all hover:scale-105 active:scale-95"
              >
                <Play className="w-5 h-5 inline mr-2" /> Create Lobby
              </button>
            </GlassCard>

            {dbLobbies.length > 0 && (
              <GlassCard className="p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-400" /> Open Lobbies
                </h3>
                <div className="space-y-3">
                  {dbLobbies.map(l => (
                    <div key={l.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                      <div>
                        <div className="font-bold text-sm">{l.hostName}&apos;s Lobby</div>
                        <div className="text-xs text-gray-400">{l.playerCount}/{l.maxPlayers} players • Grid: {l.settings?.boardSize}x{l.settings?.boardSize}</div>
                      </div>
                      <button
                        onClick={() => joinLobby(l.id, userId, nickname)}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-full text-sm font-bold transition-colors"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>
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
    const settings = lobby.settings || { maxPlayers: 8, boardSize: 5, turnTimer: 30 };
    const allReady = players.every(p => p.role === 'HOST' || p.isReady);
    const canStart = isHost && players.length >= 2 && allReady;

    return (
      <div className="flex flex-col h-screen bg-black text-white">
        <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-4">
            <button onClick={handleLeave} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              ✏️ Dots and Boxes Lobby
            </h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowRulesModal(true)}
              className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full text-sm font-bold flex items-center gap-2 transition-colors hover:bg-white/10 animate-pulse"
            >
              <BookOpen className="w-4 h-4" /> Rules
            </button>
            <button onClick={() => setShowInviteModal(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-sm font-bold flex items-center gap-2 transition-colors">
              <UserPlus className="w-4 h-4" /> Invite
            </button>
            <button onClick={handleLeave} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-full text-sm font-bold text-red-400 flex items-center gap-2 transition-colors">
              <LogOut className="w-4 h-4" /> Leave
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 gap-6 overflow-y-auto">
          {/* Players List Card */}
          <GlassCard className="p-6 max-w-md w-full">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" /> Players ({players.length}/{settings.maxPlayers})
            </h2>
            <div className="space-y-3 mb-6">
              {players.map(p => (
                <div key={p.userId} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-xs font-bold">
                      {p.nickname?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="font-bold text-sm">{p.nickname}</span>
                    {p.role === 'HOST' && <span className="text-[10px] bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full font-bold">HOST</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {p.role === 'HOST' || p.isReady ? (
                      <span className="text-green-400 text-xs font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Ready</span>
                    ) : (
                      <span className="text-yellow-400 text-xs font-bold">Waiting...</span>
                    )}
                    {isHost && p.userId !== userId && (
                      <button onClick={() => kickPlayer(lobby.id, userId, p.userId)} className="text-red-400 hover:text-red-300 text-xs ml-2">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              {!isHost && (
                <button
                  onClick={() => {
                    const me = players.find(p => p.userId === userId);
                    if (me) toggleReady(lobby.id, userId, !me.isReady);
                  }}
                  className={`flex-1 py-3 rounded-full font-bold transition-all ${
                    players.find(p => p.userId === userId)?.isReady
                      ? 'bg-green-600 hover:bg-green-500'
                      : 'bg-yellow-600 hover:bg-yellow-500'
                  }`}
                >
                  {players.find(p => p.userId === userId)?.isReady ? '✓ Ready' : 'Ready Up'}
                </button>
              )}
              {isHost && (
                <button
                  onClick={() => startGame(lobby.id, userId)}
                  disabled={!canStart}
                  className={`flex-1 py-3 rounded-full font-bold transition-all ${
                    canStart
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:scale-105 active:scale-95'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-5 h-5 inline mr-2" /> Start Game
                </button>
              )}
            </div>
          </GlassCard>

          {/* Lobby Settings Card (Host Controls) */}
          <GlassCard className="p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-400" /> Game Settings
            </h2>
            <div className="space-y-4 text-sm">
              {/* Max Players */}
              <div>
                <label className="text-gray-400 block mb-1 text-xs">Maximum Players</label>
                <select
                  disabled={!isHost}
                  value={settings.maxPlayers}
                  onChange={e => handleSettingsChange('maxPlayers', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  {[2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n} className="bg-neutral-900">{n} Players</option>
                  ))}
                </select>
              </div>

              {/* Board Size */}
              <div>
                <label className="text-gray-400 block mb-1 text-xs">Board Grid Size</label>
                <select
                  disabled={!isHost}
                  value={settings.boardSize}
                  onChange={e => handleSettingsChange('boardSize', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value={4} className="bg-neutral-900">4 x 4 Dots (3x3 boxes)</option>
                  <option value={5} className="bg-neutral-900">5 x 5 Dots (4x4 boxes)</option>
                  <option value={6} className="bg-neutral-900">6 x 6 Dots (5x5 boxes)</option>
                  <option value={8} className="bg-neutral-900">8 x 8 Dots (7x7 boxes)</option>
                </select>
              </div>

              {/* Turn Timer */}
              <div>
                <label className="text-gray-400 block mb-1 text-xs">Turn Timeout Timer</label>
                <select
                  disabled={!isHost}
                  value={settings.turnTimer}
                  onChange={e => handleSettingsChange('turnTimer', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value={15} className="bg-neutral-900">15 seconds</option>
                  <option value={30} className="bg-neutral-900">30 seconds</option>
                  <option value={45} className="bg-neutral-900">45 seconds</option>
                  <option value={60} className="bg-neutral-900">60 seconds</option>
                </select>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Invite Modal */}
        <AnimatePresence>
          {showInviteModal && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowInviteModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-neutral-900 border border-white/10 rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold mb-4">Invite Players</h3>
                {[...onlineUsers, ...roomMembers].filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i && !players.find(p => p.userId === u.id)).map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl mb-2">
                    <span className="text-sm font-bold">{user.nickname}</span>
                    <button
                      onClick={() => sendInvite(user.id)}
                      disabled={invitedUsers.has(user.id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                        invitedUsers.has(user.id) ? 'bg-green-600/30 text-green-400 cursor-default' : 'bg-blue-600 hover:bg-blue-500'
                      }`}
                    >
                      {invitedUsers.has(user.id) ? '✓ Invited' : 'Invite'}
                    </button>
                  </div>
                ))}
                <button onClick={() => setShowInviteModal(false)} className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm font-bold transition-colors">
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-6 py-3 rounded-full font-bold shadow-lg z-50"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ========================
  // GAME VIEW
  // ========================
  if (gameState) {
    const isMyTurn = gameState.currentTurnPlayerId === userId;
    const currentTurnPlayer = gameState.players.find(p => p.userId === gameState.currentTurnPlayerId);
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);

    // Dynamic sizing configuration for the SVG board canvas
    const N = gameState.boardSize;
    const BOX_SIZE = boxSize;
    const LINE_WIDTH = boxSize < 45 ? 4 : 6;
    const DOT_RADIUS = boxSize < 45 ? 4 : 5;
    const GAP = BOX_SIZE + LINE_WIDTH;
    const padding = DOT_RADIUS + 8;
    const boardWidthHeight = (N - 1) * GAP + padding * 2;

    const getDotCoords = (r: number, c: number) => {
      return {
        cx: padding + c * GAP,
        cy: padding + r * GAP,
      };
    };

    return (
      <div className="flex flex-col h-screen bg-black text-white select-none">
        <TurnIndicator isMyTurn={isMyTurn} />
        {/* Top Bar */}
        <div className="flex items-center justify-between p-2 md:p-3 bg-white/5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 cursor-pointer group hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <MessageSquare className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-bold text-white">Ano</span>
            </button>
            <div className="border-l border-white/20 pl-3">
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                ✏️ Dots and Boxes
              </h1>
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
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Time: <span className="text-white">{gameState.turnTimeLeft}s</span>
              </span>
            )}
            {gameState.status === 'PLAYING' && (
              <span className={`px-3 py-1 rounded-full font-bold text-xs ${isMyTurn ? 'bg-blue-500/30 text-blue-300 animate-pulse' : 'bg-white/10 text-gray-400'}`}>
                {isMyTurn ? "Your Turn" : `${currentTurnPlayer?.nickname}'s Turn`}
              </span>
            )}
          </div>
        </div>
        {rulesModal}

        <div className="flex-1 flex overflow-hidden">
          {/* Room Chat Sidebar (Collapsible) */}
          {currentRoomId && showChatSidebar && (
            <div className="w-80 border-r border-white/10 bg-neutral-900 flex flex-col">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-sm font-bold">Room Chat</span>
                <button onClick={() => setShowChatSidebar(false)} className="text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatArea roomId={currentRoomId} />
              </div>
              <MessageInput roomId={currentRoomId} />
            </div>
          )}

          {/* Main SVG Interactive Game Board */}
          <div className="flex-1 flex items-center justify-center p-2 md:p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-950/20 via-gray-900 to-black overflow-auto">
            <div className="relative">
              {/* SVG Canvas */}
              <svg
                width={boardWidthHeight}
                height={boardWidthHeight}
                className="max-w-full max-h-[65vh] md:max-h-[70vh] drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)] touch-game"
              >
                {/* 1. Draw Boxes background owners */}
                {Array.from({ length: N - 1 }).map((_, br) => (
                  Array.from({ length: N - 1 }).map((_, bc) => {
                    const ownerId = gameState.boxes[br]?.[bc];
                    if (!ownerId) return null;
                    const color = PLAYER_COLORS[getPlayerColorIndex(gameState.players, ownerId)];
                    const startDot = getDotCoords(br, bc);
                    
                    return (
                      <motion.rect
                        key={`box-${br}-${bc}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 0.25, scale: 1 }}
                        x={startDot.cx + LINE_WIDTH / 2}
                        y={startDot.cy + LINE_WIDTH / 2}
                        width={GAP - LINE_WIDTH}
                        height={GAP - LINE_WIDTH}
                        fill={color.hex}
                        rx={4}
                      />
                    );
                  })
                ))}

                {/* 2. Draw Drawn Horizontal Lines */}
                {Array.from({ length: N }).map((_, r) => (
                  Array.from({ length: N - 1 }).map((_, c) => {
                    const ownerId = gameState.hLines[r]?.[c];
                    const dot1 = getDotCoords(r, c);
                    const dot2 = getDotCoords(r, c + 1);

                    if (!ownerId) return null;
                    const color = PLAYER_COLORS[getPlayerColorIndex(gameState.players, ownerId)];

                    return (
                      <line
                        key={`h-line-drawn-${r}-${c}`}
                        x1={dot1.cx}
                        y1={dot1.cy}
                        x2={dot2.cx}
                        y2={dot2.cy}
                        stroke={color.hex}
                        strokeWidth={LINE_WIDTH}
                        strokeLinecap="round"
                      />
                    );
                  })
                ))}

                {/* 3. Draw Drawn Vertical Lines */}
                {Array.from({ length: N - 1 }).map((_, r) => (
                  Array.from({ length: N }).map((_, c) => {
                    const ownerId = gameState.vLines[r]?.[c];
                    const dot1 = getDotCoords(r, c);
                    const dot2 = getDotCoords(r + 1, c);

                    if (!ownerId) return null;
                    const color = PLAYER_COLORS[getPlayerColorIndex(gameState.players, ownerId)];

                    return (
                      <line
                        key={`v-line-drawn-${r}-${c}`}
                        x1={dot1.cx}
                        y1={dot1.cy}
                        x2={dot2.cx}
                        y2={dot2.cy}
                        stroke={color.hex}
                        strokeWidth={LINE_WIDTH}
                        strokeLinecap="round"
                      />
                    );
                  })
                ))}

                {/* 4. Draw Hover/Hitbox Overlay Lines */}
                {gameState.status === 'PLAYING' && isMyTurn && (
                  <>
                    {/* Horizontal Hitbox Overlays */}
                    {Array.from({ length: N }).map((_, r) => (
                      Array.from({ length: N - 1 }).map((_, c) => {
                        const isDrawn = gameState.hLines[r]?.[c] !== null;
                        if (isDrawn) return null;
                        const dot1 = getDotCoords(r, c);
                        const dot2 = getDotCoords(r, c + 1);

                        const isHovered = hoveredLine?.type === 'H' && hoveredLine.r === r && hoveredLine.c === c;
                        const selfColor = PLAYER_COLORS[getPlayerColorIndex(gameState.players, userId)];

                        return (
                          <g key={`h-hitbox-${r}-${c}`}>
                            {isHovered && (
                              <line
                                x1={dot1.cx}
                                y1={dot1.cy}
                                x2={dot2.cx}
                                y2={dot2.cy}
                                stroke={selfColor.hex}
                                strokeWidth={LINE_WIDTH}
                                strokeLinecap="round"
                                opacity={0.4}
                                strokeDasharray="4 2"
                              />
                            )}
                            <line
                              x1={dot1.cx}
                              y1={dot1.cy}
                              x2={dot2.cx}
                              y2={dot2.cy}
                              stroke="transparent"
                              strokeWidth={24}
                              strokeLinecap="round"
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredLine({ type: 'H', r, c })}
                              onMouseLeave={() => setHoveredLine(null)}
                              onClick={() => handleDrawLine('H', r, c)}
                              onTouchStart={(e) => { e.preventDefault(); setHoveredLine({ type: 'H', r, c }); }}
                              onTouchEnd={(e) => { e.preventDefault(); handleDrawLine('H', r, c); setHoveredLine(null); }}
                            />
                          </g>
                        );
                      })
                    ))}

                    {/* Vertical Hitbox Overlays */}
                    {Array.from({ length: N - 1 }).map((_, r) => (
                      Array.from({ length: N }).map((_, c) => {
                        const isDrawn = gameState.vLines[r]?.[c] !== null;
                        if (isDrawn) return null;
                        const dot1 = getDotCoords(r, c);
                        const dot2 = getDotCoords(r + 1, c);

                        const isHovered = hoveredLine?.type === 'V' && hoveredLine.r === r && hoveredLine.c === c;
                        const selfColor = PLAYER_COLORS[getPlayerColorIndex(gameState.players, userId)];

                        return (
                          <g key={`v-hitbox-${r}-${c}`}>
                            {isHovered && (
                              <line
                                x1={dot1.cx}
                                y1={dot1.cy}
                                x2={dot2.cx}
                                y2={dot2.cy}
                                stroke={selfColor.hex}
                                strokeWidth={LINE_WIDTH}
                                strokeLinecap="round"
                                opacity={0.4}
                                strokeDasharray="4 2"
                              />
                            )}
                            <line
                              x1={dot1.cx}
                              y1={dot1.cy}
                              x2={dot2.cx}
                              y2={dot2.cy}
                              stroke="transparent"
                              strokeWidth={24}
                              strokeLinecap="round"
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredLine({ type: 'V', r, c })}
                              onMouseLeave={() => setHoveredLine(null)}
                              onClick={() => handleDrawLine('V', r, c)}
                              onTouchStart={(e) => { e.preventDefault(); setHoveredLine({ type: 'V', r, c }); }}
                              onTouchEnd={(e) => { e.preventDefault(); handleDrawLine('V', r, c); setHoveredLine(null); }}
                            />
                          </g>
                        );
                      })
                    ))}
                  </>
                )}

                {/* 5. Draw Dots Grid */}
                {Array.from({ length: N }).map((_, r) => (
                  Array.from({ length: N }).map((_, c) => {
                    const dot = getDotCoords(r, c);
                    return (
                      <circle
                        key={`dot-${r}-${c}`}
                        cx={dot.cx}
                        cy={dot.cy}
                        r={DOT_RADIUS}
                        fill="#ffffff"
                        opacity={0.9}
                      />
                    );
                  })
                ))}
              </svg>

              {/* Winner Celebration Overlay */}
              <AnimatePresence>
                {gameState.status === 'FINISHED' && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center z-30"
                  >
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15, stiffness: 200 }}>
                      <Trophy className="w-20 h-20 text-yellow-400 mb-4 mx-auto drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]" />
                    </motion.div>
                    {gameState.isDraw ? (
                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                        className="text-3xl font-black text-yellow-400 mb-2 text-center"
                      >
                        It&apos;s a Draw!
                      </motion.div>
                    ) : (
                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                        className="text-3xl font-black text-yellow-400 mb-2 text-center"
                      >
                        {gameState.players.find(p => p.userId === gameState.winnerId)?.nickname} Wins!
                      </motion.div>
                    )}
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                      className="text-gray-400 mb-6 text-center max-w-xs"
                    >
                      All boxes captured! Final Score: {gameState.players.find(p => p.userId === gameState.winnerId)?.score} points.
                    </motion.div>
                    <motion.button
                      initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}
                      onClick={handleLeave}
                      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-full font-bold shadow-lg hover:scale-105 active:scale-95 transition-all"
                    >
                      Back to Lobby
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Sidebar — Scoreboard & Avatars */}
          <div className="w-72 border-l border-white/10 bg-neutral-900 flex flex-col hidden lg:flex">
            <div className="p-3 border-b border-white/10 bg-black/20">
              <h2 className="font-bold text-sm tracking-wide uppercase flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-400" /> Scoreboard
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {sortedPlayers.map((p, index) => (
                <motion.div
                  key={p.userId}
                  layout
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    p.userId === gameState.currentTurnPlayerId
                      ? 'bg-blue-500/20 border border-blue-400/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                      : 'bg-white/5 border border-white/5'
                  }`}
                >
                  <div className={`w-5 text-center font-black text-xs ${
                    index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-white/30'
                  }`}>
                    {index === 0 ? <Crown className="w-4 h-4" /> : `#${index + 1}`}
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-br ${PLAYER_COLORS[getPlayerColorIndex(gameState.players, p.userId)].bg} ${
                    p.userId === gameState.currentTurnPlayerId
                      ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-neutral-900'
                      : ''
                  }`}>
                    {p.nickname?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate">
                      {p.nickname}
                      {p.userId === userId && <span className="text-blue-400 ml-1">(You)</span>}
                    </div>
                    <div className="text-[10px] text-white/40">
                      {!p.isOnline && '(Offline)'}
                      {p.userId === gameState.currentTurnPlayerId && <span className="text-blue-400 animate-pulse">Your move...</span>}
                    </div>
                  </div>
                  <motion.div
                    key={p.score}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="text-right"
                  >
                    <div className="font-black text-lg text-emerald-400">{p.score}</div>
                    <div className="text-[10px] text-white/30">boxes</div>
                  </motion.div>
                </motion.div>
              ))}
            </div>

            {/* Game Logs */}
            <div className="border-t border-white/10 p-3 max-h-48 overflow-y-auto custom-scrollbar bg-black/20">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Game Log</h3>
              <div className="space-y-1">
                {gameState.historyLogs.slice(-10).reverse().map((log, i) => (
                  <div key={i} className="text-[11px] text-gray-500 leading-relaxed">{log}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-between p-2 md:p-3 bg-white/5 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            {currentRoomId && (
              <button onClick={() => setShowChatSidebar(!showChatSidebar)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                <MessageSquare className="w-4 h-4" />
              </button>
            )}
            {connectedChannelId && (
              <>
                <button onClick={toggleMute} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button onClick={disconnectVoice} className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors text-xs font-bold">
                  Disconnect
                </button>
              </>
            )}
          </div>
          <button onClick={handleLeave} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-full text-sm font-bold text-red-400 flex items-center gap-2 transition-colors">
            <LogOut className="w-4 h-4" /> Leave Game
          </button>
        </div>

        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-6 py-3 rounded-full font-bold shadow-lg z-50"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return null;
}

export default function DotsAndBoxesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    }>
      <DotsAndBoxesPageContent />
    </Suspense>
  );
}
