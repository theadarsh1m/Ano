"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Play, UserPlus, LogOut, Loader2, Check, X,
  Volume2, VolumeX, MessageSquare, Award, ArrowLeft, Send, RefreshCw, Globe, Brain, Trophy, Crown
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useRoomConnectionStore } from "@/store/useRoomConnectionStore";
import { useVoiceStore } from "@/store/useVoiceStore";
import { useMemoryMatchStore, LobbyPlayer, MemoryMatchGameState, PublicLobby, MemoryCard } from "@/store/useMemoryMatchStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { ChatArea } from "@/components/room/ChatArea";
import { MessageInput } from "@/components/room/MessageInput";
import { socketService } from "@/lib/socket";

// Unique colors for each player (up to 8)
const PLAYER_COLORS = [
  { bg: 'from-rose-500 to-pink-600',     border: 'border-rose-400/60',   shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.4)]',   text: 'text-rose-400',    bgLight: 'bg-rose-500/20' },
  { bg: 'from-sky-500 to-cyan-600',       border: 'border-sky-400/60',    shadow: 'shadow-[0_0_15px_rgba(14,165,233,0.4)]',  text: 'text-sky-400',     bgLight: 'bg-sky-500/20' },
  { bg: 'from-emerald-500 to-green-600',  border: 'border-emerald-400/60', shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]', text: 'text-emerald-400', bgLight: 'bg-emerald-500/20' },
  { bg: 'from-amber-500 to-yellow-600',   border: 'border-amber-400/60',  shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',  text: 'text-amber-400',   bgLight: 'bg-amber-500/20' },
  { bg: 'from-violet-500 to-purple-600',  border: 'border-violet-400/60', shadow: 'shadow-[0_0_15px_rgba(139,92,246,0.4)]',  text: 'text-violet-400',  bgLight: 'bg-violet-500/20' },
  { bg: 'from-orange-500 to-red-600',     border: 'border-orange-400/60', shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.4)]',  text: 'text-orange-400',  bgLight: 'bg-orange-500/20' },
  { bg: 'from-teal-500 to-cyan-600',      border: 'border-teal-400/60',   shadow: 'shadow-[0_0_15px_rgba(20,184,166,0.4)]',  text: 'text-teal-400',    bgLight: 'bg-teal-500/20' },
  { bg: 'from-fuchsia-500 to-pink-600',   border: 'border-fuchsia-400/60', shadow: 'shadow-[0_0_15px_rgba(217,70,239,0.4)]', text: 'text-fuchsia-400', bgLight: 'bg-fuchsia-500/20' },
];

function getPlayerColorIndex(players: { userId: string }[], playerId: string): number {
  const idx = players.findIndex(p => p.userId === playerId);
  return idx >= 0 ? idx % PLAYER_COLORS.length : 0;
}

function MemoryMatchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get("gameId");

  const { id: userId, nickname } = useUserStore();
  const { currentRoomId } = useRoomConnectionStore();
  const { connectedChannelId, isMuted, toggleMute, disconnect: disconnectVoice } = useVoiceStore();

  const {
    lobby,
    gameState,
    matchResult,
    error,
    availableLobbies,
    createLobby,
    joinLobby,
    toggleReady,
    kickPlayer,
    leaveLobby,
    invitePlayer,
    updateLobbySettings,
    startGame,
    flipCard,
    clearState,
    setupListeners,
    fetchLobbies
  } = useMemoryMatchStore();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());

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
      const state = useMemoryMatchStore.getState();
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

  const handleFlipCard = (cardIndex: number) => {
    const activeGameId = gameState?.gameId;
    if (!activeGameId || !userId) return;
    flipCard(activeGameId, userId, cardIndex);
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

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  if (!isClient || !userId || !nickname) {
    return (
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <span className="text-sm text-gray-400">Loading game session...</span>
        </div>
      </div>
    );
  }

  // ========================
  // PRE-LOBBY VIEW
  // ========================
  if (!lobby && !gameState) {
    const memoryLobbies = availableLobbies.filter(l => l.gameType === 'MEMORY_MATCH');
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
                <Brain className="w-6 h-6 text-violet-400" /> Memory Match
              </h1>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-6">
            <GlassCard className="p-8 text-center">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-violet-500 to-fuchsia-700 rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-lg">
                🧠
              </div>
              <h2 className="text-2xl font-bold mb-2">Memory Match</h2>
              <p className="text-gray-400 mb-6">Flip cards, find matching pairs, and outscore your opponents!</p>
              <button
                onClick={handleCreateLobby}
                className="px-8 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-full font-bold text-white shadow-lg hover:shadow-violet-500/30 transition-all hover:scale-105 active:scale-95"
              >
                <Play className="w-5 h-5 inline mr-2" /> Create Lobby
              </button>
            </GlassCard>

            {memoryLobbies.length > 0 && (
              <GlassCard className="p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-violet-400" /> Open Lobbies
                </h3>
                <div className="space-y-3">
                  {memoryLobbies.map(l => (
                    <div key={l.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                      <div>
                        <div className="font-bold text-sm">{l.hostName}&apos;s Lobby</div>
                        <div className="text-xs text-gray-400">{l.playerCount}/{l.maxPlayers} players</div>
                      </div>
                      <button
                        onClick={() => joinLobby(l.id, userId, nickname)}
                        className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-full text-sm font-bold transition-colors"
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
      </div>
    );
  }

  // ========================
  // LOBBY VIEW
  // ========================
  if (lobby && !gameState) {
    const isHost = lobby.hostId === userId;
    const players = lobby.players || [];
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
              <Brain className="w-6 h-6 text-violet-400" /> Memory Match Lobby
            </h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowInviteModal(true)} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-full text-sm font-bold flex items-center gap-2 transition-colors">
              <UserPlus className="w-4 h-4" /> Invite
            </button>
            <button onClick={handleLeave} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-full text-sm font-bold text-red-400 flex items-center gap-2 transition-colors">
              <LogOut className="w-4 h-4" /> Leave
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <GlassCard className="p-8 max-w-lg w-full">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-400" /> Players ({players.length}/8)
            </h2>
            <div className="space-y-3 mb-6">
              {players.map(p => (
                <div key={p.userId} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold">
                      {p.nickname?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="font-bold text-sm">{p.nickname}</span>
                    {p.role === 'HOST' && <span className="text-[10px] bg-violet-500/30 text-violet-300 px-2 py-0.5 rounded-full font-bold">HOST</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {p.role === 'HOST' ? (
                      <span className="text-green-400 text-xs font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Ready</span>
                    ) : p.isReady ? (
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

            {isHost && (
              <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-400" /> Game Settings
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Board Size</span>
                  <select
                    value={lobby.settings?.pairCount || 12}
                    onChange={(e) => updateLobbySettings(lobby.id, userId, { pairCount: parseInt(e.target.value) })}
                    className="bg-black border border-white/20 rounded px-2 py-1 text-sm outline-none focus:border-violet-500"
                  >
                    <option value={12}>Small (12 Pairs)</option>
                    <option value={18}>Medium (18 Pairs)</option>
                    <option value={24}>Large (24 Pairs)</option>
                    <option value={32}>Giant (32 Pairs)</option>
                  </select>
                </div>
              </div>
            )}

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
                      ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 hover:scale-105 active:scale-95'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-5 h-5 inline mr-2" /> Start Game
                </button>
              )}
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
                        invitedUsers.has(user.id) ? 'bg-green-600/30 text-green-400 cursor-default' : 'bg-violet-600 hover:bg-violet-500'
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
    const self = gameState.players.find(p => p.userId === userId);
    const isMyTurn = gameState.currentTurnPlayerId === userId;
    const currentTurnPlayer = gameState.players.find(p => p.userId === gameState.currentTurnPlayerId);
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);

    return (
      <div className="flex flex-col h-screen bg-black text-white">
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
                <Brain className="w-4 h-4 text-violet-400" /> Memory Match
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>Pairs: <span className="text-violet-400 font-bold">{gameState.matchedPairs}/{gameState.totalPairs}</span></span>
            {gameState.status === 'PLAYING' && (
              <span className={`px-3 py-1 rounded-full font-bold text-xs ${isMyTurn ? 'bg-violet-500/30 text-violet-300 animate-pulse' : 'bg-white/10 text-gray-400'}`}>
                {isMyTurn ? "Your Turn" : `${currentTurnPlayer?.nickname}'s Turn`}
              </span>
            )}
          </div>
        </div>

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

          {/* Main Game Board */}
          <div className="flex-1 flex items-center justify-center p-2 md:p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-950/30 via-gray-900 to-black overflow-auto">
            <div className="relative">
              {/* Card Grid */}
              <div
                className="grid gap-1.5 sm:gap-2 md:gap-3"
                style={{ gridTemplateColumns: `repeat(${gameState.boardCols}, minmax(0, 1fr))` }}
              >
                {gameState.board.map((card) => {
                  const isRecentMatch = matchResult?.isMatch && (matchResult.cardIndex1 === card.index || matchResult.cardIndex2 === card.index);
                  const isRecentMismatch = matchResult && !matchResult.isMatch && (matchResult.cardIndex1 === card.index || matchResult.cardIndex2 === card.index);

                  const matchedColor = card.isMatched && card.matchedBy
                    ? PLAYER_COLORS[getPlayerColorIndex(gameState.players, card.matchedBy)]
                    : null;

                  return (
                    <motion.button
                      key={card.index}
                      onClick={() => handleFlipCard(card.index)}
                      disabled={card.isFlipped || card.isMatched || !isMyTurn || gameState.status !== 'PLAYING'}
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl cursor-pointer select-none transition-all duration-200 
                        ${card.isMatched && matchedColor
                          ? `${matchedColor.bgLight} border-2 ${matchedColor.border} ${matchedColor.shadow}` 
                          : card.isFlipped 
                            ? 'bg-violet-500/20 border-2 border-violet-400/50 shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                            : isMyTurn && gameState.status === 'PLAYING'
                              ? 'bg-white/10 border-2 border-white/20 hover:border-violet-400/50 hover:bg-violet-500/10 hover:shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:scale-105 active:scale-95'
                              : 'bg-white/5 border-2 border-white/10 cursor-default'
                        }
                        ${isRecentMatch ? 'animate-bounce' : ''}
                        ${isRecentMismatch ? 'animate-[shake_0.3s_ease-in-out]' : ''}
                      `}
                      whileTap={isMyTurn && !card.isFlipped && !card.isMatched ? { scale: 0.9 } : {}}
                    >
                      <AnimatePresence mode="wait">
                        {(card.isFlipped || card.isMatched) && card.symbol ? (
                          <motion.div
                            key="front"
                            initial={{ rotateY: 90, opacity: 0 }}
                            animate={{ rotateY: 0, opacity: 1 }}
                            exit={{ rotateY: -90, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="absolute inset-0 flex items-center justify-center text-2xl sm:text-3xl md:text-4xl"
                          >
                            {card.symbol}
                          </motion.div>
                        ) : (
                          <motion.div
                            key="back"
                            initial={{ rotateY: -90, opacity: 0 }}
                            animate={{ rotateY: 0, opacity: 1 }}
                            exit={{ rotateY: 90, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="absolute inset-0 flex items-center justify-center"
                          >
                            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30 border border-violet-500/20 flex items-center justify-center">
                              <span className="text-violet-400/40 text-lg font-bold">?</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </div>

              {/* Winner Overlay */}
              <AnimatePresence>
                {gameState.status === 'FINISHED' && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/70 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center z-30"
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
                      className="text-gray-400 mb-6 text-center px-4"
                    >
                      {gameState.matchedPairs < gameState.totalPairs 
                        ? "The other players have left the game." 
                        : `All ${gameState.totalPairs} pairs found!`}
                    </motion.div>
                    <motion.button
                      initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}
                      onClick={handleLeave}
                      className="px-8 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-full font-bold shadow-lg hover:scale-105 active:scale-95 transition-all"
                    >
                      Back to Lobby
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Sidebar — Scoreboard */}
          <div className="w-72 border-l border-white/10 bg-neutral-900 flex flex-col hidden lg:flex">
            <div className="p-3 border-b border-white/10 bg-black/20">
              <h2 className="font-bold text-sm tracking-wide uppercase flex items-center gap-2">
                <Award className="w-4 h-4 text-violet-400" /> Scoreboard
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {sortedPlayers.map((p, index) => (
                <motion.div
                  key={p.userId}
                  layout
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    p.userId === gameState.currentTurnPlayerId
                      ? 'bg-violet-500/20 border border-violet-400/30 shadow-[0_0_10px_rgba(139,92,246,0.2)]'
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
                      {p.userId === userId && <span className="text-violet-400 ml-1">(You)</span>}
                    </div>
                    <div className="text-[10px] text-white/40">
                      {!p.isOnline && '(Offline)'}
                      {p.userId === gameState.currentTurnPlayerId && <span className="text-violet-400">Playing...</span>}
                    </div>
                  </div>
                  <motion.div
                    key={p.score}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="text-right"
                  >
                    <div className="font-black text-lg text-emerald-400">{p.score}</div>
                    <div className="text-[10px] text-white/30">pairs</div>
                  </motion.div>
                </motion.div>
              ))}
            </div>

            {/* Game Log */}
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

export default function MemoryMatchPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    }>
      <MemoryMatchPageContent />
    </Suspense>
  );
}
