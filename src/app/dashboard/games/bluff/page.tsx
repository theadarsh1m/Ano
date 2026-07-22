"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Gamepad2, Users, Play, UserPlus, LogOut, Loader2, Check, X, 
  Volume2, VolumeX, MessageSquare, ShieldAlert, Award, ArrowLeft, Send, RefreshCw, Globe, BookOpen,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useRoomConnectionStore } from "@/store/useRoomConnectionStore";
import { useVoiceStore } from "@/store/useVoiceStore";
import { useBluffStore, LobbyPlayer, GamePlayerState, PublicLobby } from "@/store/useBluffStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { ChatArea } from "@/components/room/ChatArea";
import { MessageInput } from "@/components/room/MessageInput";
import { socketService } from "@/lib/socket";
import { TurnIndicator } from "@/components/games/TurnIndicator";
import { useExitWarning } from "@/hooks/useExitWarning";
import { useInviteCooldown } from "@/hooks/useInviteCooldown";

const DECLARED_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];

const RANK_ORDER: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'Jack': 11, 'Queen': 12, 'King': 13, 'Ace': 14 };
const SUIT_ORDER: Record<string, number> = { 'spades': 4, 'hearts': 3, 'diamonds': 2, 'clubs': 1 };

function sortCards(cards: { id: string; suit: string; value: string }[]) {
  return [...cards].sort((a, b) => {
    const rankDiff = (RANK_ORDER[b.value] || 0) - (RANK_ORDER[a.value] || 0);
    if (rankDiff !== 0) return rankDiff;
    return (SUIT_ORDER[b.suit] || 0) - (SUIT_ORDER[a.suit] || 0);
  });
}

function BluffGamePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get("gameId");

  const { id: userId, nickname } = useUserStore();
  const { currentRoomId } = useRoomConnectionStore();
  const { connectedChannelId, isMuted, toggleMute, disconnect: disconnectVoice } = useVoiceStore();

  const {
    lobby,
    gameState,
    challengeReveal,
    error,
    availableLobbies,
    createLobby,
    joinLobby,
    toggleReady,
    kickPlayer,
    leaveLobby,
    invitePlayer,
    startGame,
    playCards,
    challengeBluff,
    clearState,
    setupListeners,
    fetchLobbies
  } = useBluffStore();

  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [declaredRank, setDeclaredRank] = useState<string>("Ace");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());

  const handRowRef = useRef<HTMLDivElement>(null);
  const scrollHand = (direction: "left" | "right") => {
    if (handRowRef.current) {
      const scrollAmount = 240;
      handRowRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };
  const { bypassWarning } = useExitWarning(!!lobby || !!gameState);

  // 1. Setup listeners on mount
  useEffect(() => {
    if (!userId) return;
    const cleanup = setupListeners(lobby?.id || gameState?.gameId || "", userId);
    
    // Auto join if parameter exists
    if (gameIdParam && !lobby && !gameState) {
      joinLobby(gameIdParam, userId, nickname || "Player");
    }

    return () => {
      cleanup();
    };
  }, [userId, lobby?.id, gameState?.gameId, gameIdParam]);

  // Leave lobby on unmount
  useEffect(() => {
    return () => {
      const state = useBluffStore.getState();
      const currentGameId = state.lobby?.id || state.gameState?.gameId;
      const currentUserId = useUserStore.getState().id;
      if (currentGameId && currentUserId) {
        state.leaveLobby(currentGameId, currentUserId);
      }
    };
  }, []);

  // Fetch friends, online users, and room members for invites
  useEffect(() => {
    if (!userId) return;
    const getApiUrl = () => {
      if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
      if (typeof window !== "undefined") return `http://${window.location.hostname}:3001`;
      return "http://localhost:3001";
    };
    const API_URL = getApiUrl();
    
    // Fetch friends
    fetch(`${API_URL}/api/notifications/friendships/${userId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setFriendsList(data);
      })
      .catch(console.error);

    // Fetch ALL online users (same endpoint the dashboard uses)
    fetch(`${API_URL}/api/users/online`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setOnlineUsers(data.filter(u => u.id !== userId));
      })
      .catch(console.error);

    // Fetch room members
    if (currentRoomId) {
      fetch(`${API_URL}/api/rooms/${currentRoomId}/users`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setRoomMembers(data.filter(u => u.id !== userId));
          }
        })
        .catch(console.error);
    }
  }, [userId, currentRoomId, lobby?.id]);

  // Fetch available lobbies on mount — wait for socket to be connected
  useEffect(() => {
    if (!userId) return;
    const socket = socketService.getSocket();

    const doFetch = () => fetchLobbies();

    // If already connected, fetch immediately
    if (socket.connected) {
      doFetch();
    }
    // Also fetch whenever the socket (re)connects
    socket.on('connect', doFetch);

    return () => {
      socket.off('connect', doFetch);
    };
  }, [userId]);

  const handleCreateLobby = () => {
    if (!userId || !nickname) return;
    createLobby('BLUFF', userId, nickname);
  };

  const handleToggleCard = (cardId: string) => {
    setSelectedCards(prev => 
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const handlePlayCards = () => {
    const activeGameId = gameState?.gameId || lobby?.id;
    if (!activeGameId || !userId || selectedCards.length === 0) return;
    const finalRank = gameState?.declaredRank || declaredRank;
    playCards(activeGameId, userId, selectedCards, finalRank);
    setSelectedCards([]);
  };

  const handleChallenge = () => {
    if (!userId || !gameState) return;
    challengeBluff(gameState.gameId, userId);
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

  const { triggerInvite, getInviteStatus } = useInviteCooldown(lobby?.id || gameState?.gameId);

  const sendInvite = (targetId: string) => {
    const activeGameId = gameState?.gameId || lobby?.id;
    if (!activeGameId || !userId || !nickname) return;
    invitePlayer(activeGameId, userId, nickname, targetId, 'BLUFF');
    triggerInvite(targetId);
  };

  // Hydration guard to avoid Next.js CSR bails and Zustand mismatch
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || !userId || !nickname) {
    return (
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
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
              <h2 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-emerald-400" /> Game Rules</h2>
              <button onClick={() => setShowRulesModal(false)} className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-md transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
              <p><strong className="text-white">Goal:</strong> Be the first to get rid of all your cards.</p>
              
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-emerald-400 block mb-1">On Your Turn:</strong>
                <p>1. Place 1 or more cards face down into the center pile.</p>
                <p>2. Declare a rank (e.g., "Two 4s"). You can claim <em>any</em> rank.</p>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-emerald-400 block mb-1">Responding to a Play:</strong>
                <p>When the previous player plays, you (and only you) have two choices before taking your turn:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Accept Claim & Play:</strong> Assume they told the truth. Their cards remain hidden. You now make your own play.</li>
                  <li><strong className="text-red-400">Challenge Bluff:</strong> Challenge their claim! Only the <em>immediately previous</em> cards are revealed.</li>
                </ul>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-emerald-400 block mb-1">Challenge Results:</strong>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>If they LIED:</strong> The bluffer picks up the ENTIRE center pile.</li>
                  <li><strong>If they told the TRUTH:</strong> YOU pick up the ENTIRE center pile.</li>
                </ul>
                <p className="mt-2 text-xs text-gray-400">After a challenge, the pile is cleared and the loser of the challenge starts the new round.</p>
              </div>
            </div>

            <button 
              onClick={() => setShowRulesModal(false)}
              className="mt-6 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/25"
            >
              Got it!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render Lobby screen
  if (lobby) {
    const isHost = lobby.hostId === userId;
    const allReady = lobby.players.every(p => p.role === 'HOST' || p.isReady);
    const selfPlayer = lobby.players.find(p => p.userId === userId);

    return (
      <div className="flex flex-col lg:flex-row h-screen bg-black text-white overflow-hidden">
        {/* Main Lobby View */}
        <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 backdrop-blur-md gap-2">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                Bluff Card Game Lobby
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm mt-0.5 select-text">Lobby ID: {lobby.id}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowRulesModal(true)}
                className="px-2.5 sm:px-4 py-2 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-xl flex items-center gap-1.5 transition-colors text-xs sm:text-sm font-semibold animate-pulse cursor-pointer"
              >
                <BookOpen className="w-4 h-4" /> <span className="hidden sm:inline">Rules</span>
              </button>
              <button 
                onClick={handleLeave}
                className="px-2.5 sm:px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-xl flex items-center gap-1.5 transition-colors text-xs sm:text-sm font-semibold cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Leave Lobby</span><span className="sm:hidden">Leave</span>
              </button>
            </div>
          </div>

          {/* Lobby grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Players list card */}
            <GlassCard className="md:col-span-2 p-4 sm:p-6 flex flex-col space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Players ({lobby.players.length}/6)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {lobby.players.map(p => (
                  <div key={p.userId} className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-xl relative group">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center font-bold shrink-0">
                        {p.nickname[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm flex items-center gap-1.5 truncate">
                          <span className="truncate">{p.nickname}</span>
                          {p.role === 'HOST' && <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 border border-yellow-500/20 rounded font-bold uppercase tracking-wider shrink-0">Host</span>}
                        </div>
                        <span className="text-xs text-gray-400">
                          {p.role === 'HOST' ? 'Ready' : (p.isReady ? 'Ready' : 'Not Ready')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {p.role !== 'HOST' && p.isReady && (
                        <div className="p-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                      {p.role !== 'HOST' && !p.isReady && (
                        <div className="p-1 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-full">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      )}
                      
                      {/* Host Kick Action */}
                      {isHost && p.userId !== userId && (
                        <button
                          onClick={() => kickPlayer(lobby.id, userId, p.userId)}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-lg transition-all text-xs cursor-pointer"
                        >
                          Kick
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Ready / Start Control */}
              <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row justify-end gap-3">
                {!isHost && selfPlayer && (
                  <button
                    onClick={() => toggleReady(lobby.id, userId || "", !selfPlayer.isReady)}
                    className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold transition-all border cursor-pointer ${
                      selfPlayer.isReady 
                        ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' 
                        : 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white'
                    }`}
                  >
                    {selfPlayer.isReady ? 'Unready' : 'Ready'}
                  </button>
                )}

                {isHost && (
                  <button
                    onClick={() => startGame(lobby.id, userId || "")}
                    disabled={lobby.players.length < 2 || !allReady}
                    className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 border border-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4" /> Start Game
                  </button>
                )}
              </div>
            </GlassCard>

            {/* Invite lists card */}
            <GlassCard className="p-6 flex flex-col space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Invite Players
              </h2>

              <div className="flex-1 overflow-y-auto max-h-[400px] space-y-3 pr-2">
                {/* Online Users Section (all online, not just friends) */}
                {onlineUsers.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Online Users</span>
                    {onlineUsers
                      .filter(u => !lobby.players.some(p => p.userId === u.id))
                      .map(u => {
                        const isFriend = friendsList.some(f => f.id === u.id);
                        const status = getInviteStatus(u.id);
                        return (
                          <div key={u.id} className="flex justify-between items-center p-2.5 bg-white/5 border border-white/5 rounded-xl text-sm">
                            <div className="flex items-center gap-2.5">
                              <div className="relative">
                                <div className={`w-8 h-8 bg-gradient-to-br ${isFriend ? 'from-purple-500 to-indigo-600' : 'from-blue-500 to-cyan-600'} rounded-lg flex items-center justify-center text-xs font-bold`}>
                                  {u.nickname?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-neutral-900 bg-emerald-400" />
                              </div>
                              <div>
                                <span className="font-medium block leading-tight">{u.nickname}</span>
                                <span className="text-[10px] text-gray-500">
                                  {isFriend ? 'Friend · Online' : 'Online'}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => sendInvite(u.id)}
                              disabled={!status.canInvite}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                !status.canInvite
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-not-allowed'
                                  : 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                              }`}
                            >
                              {status.label}
                            </button>
                          </div>
                        );
                      })}
                    {onlineUsers.filter(u => !lobby.players.some(p => p.userId === u.id)).length === 0 && (
                      <div className="text-xs text-gray-600 text-center py-2">All online users are already in the lobby</div>
                    )}
                  </div>
                )}

                {/* Offline Friends Section */}
                {friendsList.filter(f => !f.isOnline && !lobby.players.some(p => p.userId === f.id)).length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Offline Friends</span>
                    {friendsList
                      .filter(f => !f.isOnline && !lobby.players.some(p => p.userId === f.id) && !onlineUsers.some(u => u.id === f.id))
                      .map(f => {
                        const status = getInviteStatus(f.id);
                        return (
                          <div key={f.id} className="flex justify-between items-center p-2.5 bg-white/5 border border-white/5 rounded-xl text-sm opacity-60">
                            <div className="flex items-center gap-2.5">
                              <div className="relative">
                                <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg flex items-center justify-center text-xs font-bold">
                                  {f.nickname?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-neutral-900 bg-gray-500" />
                              </div>
                              <div>
                                <span className="font-medium block leading-tight">{f.nickname}</span>
                                <span className="text-[10px] text-gray-500">Offline</span>
                              </div>
                            </div>
                            <button
                              onClick={() => sendInvite(f.id)}
                              disabled={!status.canInvite}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                !status.canInvite
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-not-allowed'
                                  : 'bg-white/10 hover:bg-white/20 text-gray-300 cursor-pointer'
                              }`}
                            >
                              {status.label}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}

                {onlineUsers.length === 0 && friendsList.length === 0 && roomMembers.length === 0 && (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    No online users or friends found to invite.
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Room chat sidebar */}
        {currentRoomId && (
          <div className="w-full lg:w-96 border-l border-white/10 bg-white/5 backdrop-blur-md flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <span className="font-bold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" /> Room Chat
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ChatArea roomId={currentRoomId} />
            </div>
            <div className="p-4">
              <MessageInput roomId={currentRoomId} />
            </div>
          </div>
        )}
        {rulesModal}
      </div>
    );
  }

  // Render active Gameplay board
  if (gameState) {
    const playerIds = gameState.players.map(p => p.userId);
    const selfIndex = playerIds.indexOf(userId || "");
    const self = gameState.players[selfIndex];
    const isMyTurn = gameState.currentTurnIdx === selfIndex;
    const activePlayer = gameState.players[gameState.currentTurnIdx];

    return (
      <div className="flex flex-col lg:flex-row h-screen bg-neutral-950 text-white overflow-hidden select-none">
        <TurnIndicator isMyTurn={isMyTurn} />
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
                <h1 className="font-bold text-lg">Bluff Table</h1>
                {gameState.declaredRank && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                    Current Claim: {gameState.declaredRank}
                  </span>
                )}
              </div>
            </div>

            {/* Error notifications */}
            {error && (
              <div className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl text-sm font-semibold flex items-center gap-2 max-w-sm animate-bounce">
                <ShieldAlert className="w-4 h-4" /> {error}
              </div>
            )}

            <div className="flex gap-2">
              <button 
                onClick={() => setShowRulesModal(true)}
                className="p-2.5 rounded-xl border bg-white/5 border-white/10 text-gray-400 hover:text-white transition-all flex items-center gap-2 text-sm font-semibold"
              >
                <BookOpen className="w-5 h-5" /> Rules
              </button>
              <button 
                onClick={() => setShowChatSidebar(!showChatSidebar)}
                className={`p-2.5 rounded-xl border transition-all ${
                  showChatSidebar 
                    ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' 
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Green Felt Table Body */}
          <div className="flex-1 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-950 via-neutral-950 to-neutral-950 p-3 md:p-6 flex flex-col items-center justify-center relative overflow-hidden">
            {rulesModal}

            {/* Reveal Animation Modal */}
            <AnimatePresence>
              {challengeReveal && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6"
                >
                  <div className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-xl w-full text-center space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />
                    
                    <h2 className="text-3xl font-extrabold tracking-wide uppercase">
                      {challengeReveal.isTruth ? (
                        <span className="text-emerald-400">TRUTHFUL!</span>
                      ) : (
                        <span className="text-red-400">BLUFFING!</span>
                      )}
                    </h2>

                    <p className="text-gray-300">{challengeReveal.log}</p>

                    {/* Cards Reveal grid */}
                    <div className="flex flex-wrap gap-4 items-center justify-center pt-4">
                      {challengeReveal.cards.map((c, i) => (
                        <motion.div 
                          key={i}
                          initial={{ rotateY: 180 }}
                          animate={{ rotateY: 0 }}
                          transition={{ delay: i * 0.2 }}
                          className="w-24 h-36 bg-white border-2 border-neutral-300 rounded-xl shadow-lg flex flex-col items-center justify-between p-2 select-none text-black"
                        >
                          <div className="text-left w-full font-bold text-lg">{c.value}</div>
                          <div className="text-3xl">
                            {c.suit === 'hearts' && '♥'}
                            {c.suit === 'diamonds' && '♦'}
                            {c.suit === 'clubs' && '♣'}
                            {c.suit === 'spades' && '♠'}
                          </div>
                          <div className="text-right w-full font-bold text-lg">{c.value}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Victory banner */}
            <AnimatePresence>
              {gameState.status === 'FINISHED' && (
                <motion.div 
                  initial={{ opacity: 0, y: -50 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-20 z-30 bg-yellow-500/20 border border-yellow-500/30 p-6 rounded-2xl text-center backdrop-blur-md shadow-lg"
                >
                  <Award className="w-10 h-10 text-yellow-400 mx-auto mb-2 animate-bounce" />
                  <h2 className="text-2xl font-black text-white">Winner Decided!</h2>
                  <p className="text-sm text-yellow-300 mt-1">
                    {gameState.players.find(p => p.userId === gameState.winnerId)?.nickname} cleared their hand first!
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pile Card placement in the middle */}
            <div className={`flex flex-col items-center justify-center p-4 md:p-8 bg-black/20 border rounded-full w-40 h-40 md:w-64 md:h-64 shadow-inner relative z-10 transition-all duration-500 ${isMyTurn ? 'border-amber-500/80 shadow-[0_0_30px_rgba(245,158,11,0.5)] animate-pulse' : 'border-white/5'}`}>
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Center Pile</span>
              
              {gameState.pileCount > 0 ? (
                <div className="relative w-16 h-24 md:w-24 md:h-36 flex-shrink-0">
                  {/* Visual card stack representation */}
                  {Array.from({ length: Math.min(gameState.pileCount, 5) }).map((_, idx) => {
                    const isTopCard = idx === Math.min(gameState.pileCount, 5) - 1;
                    return (
                      <div 
                        key={idx}
                        className="absolute inset-0 bg-gradient-to-br from-red-700 via-red-800 to-rose-950 border-2 border-neutral-100 rounded-xl shadow-md flex items-center justify-center overflow-hidden select-none"
                        style={{
                          transform: `translate(${idx * 3}px, ${-idx * 5}px) rotate(${(idx - (Math.min(gameState.pileCount, 5) - 1) / 2) * 3}deg)`
                        }}
                      >
                        {/* Decorative card back pattern */}
                        <div className="absolute inset-1 border border-red-500/20 rounded-lg flex flex-col items-center justify-center bg-black/20 overflow-hidden">
                          <div 
                            className="absolute inset-0 opacity-20"
                            style={{
                              backgroundImage: `
                                linear-gradient(45deg, #f43f5e 25%, transparent 25%), 
                                linear-gradient(-45deg, #f43f5e 25%, transparent 25%), 
                                linear-gradient(45deg, transparent 75%, #f43f5e 75%), 
                                linear-gradient(-45deg, transparent 75%, #f43f5e 75%)
                              `,
                              backgroundSize: '12px 12px',
                              backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px'
                            }}
                          />
                          <div className="w-8 h-8 rounded-full border border-red-500/30 flex items-center justify-center bg-red-950/60 relative z-10">
                            <span className="text-[12px] text-red-500/70 select-none">♦</span>
                          </div>
                        </div>
                        
                        {/* Show count on top card */}
                        {isTopCard && (
                          <div className="absolute bg-neutral-950/85 border border-white/20 text-white font-extrabold px-2 py-0.5 rounded-full text-xs shadow-lg flex items-center justify-center min-w-8">
                            {gameState.pileCount}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="w-24 h-36 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-gray-600 text-xs font-semibold">
                  Empty Pile
                </div>
              )}

              {/* Declarations indicators */}
              {gameState.lastPlay && (
                <div className="mt-4 text-center">
                  <div className="text-xs text-gray-400 font-semibold">Last Play Claim:</div>
                  <div className="text-sm font-bold text-emerald-400">{gameState.lastPlay.cardCount}x {gameState.lastPlay.declaredRank}s</div>
                </div>
              )}
            </div>

            {/* Play Logs Console (Overlay left bottom) */}
            <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 w-48 md:w-72 max-h-36 md:max-h-48 overflow-y-auto bg-black/40 border border-white/5 rounded-xl p-2 md:p-3 backdrop-blur-sm text-[10px] md:text-[11px] font-mono text-gray-400 space-y-1">
              <div className="text-[10px] text-gray-500 font-bold border-b border-white/5 pb-1 mb-1 uppercase">History Logs</div>
              {gameState.historyLogs.slice(-10).map((log, idx) => (
                <div key={idx} className="leading-tight">{log}</div>
              ))}
            </div>
          </div>

          {/* Bottom Player Hand Controls */}
          {self && (
            <div className="p-3 md:p-6 border-t border-white/10 bg-black/40 backdrop-blur-md relative z-10 flex-shrink-0 flex flex-col space-y-3 md:space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 md:gap-4">
                {/* Active turn alert */}
                <div>
                  {isMyTurn ? (
                    <span className="text-sm text-emerald-400 font-bold animate-pulse flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" /> It's your turn! Play cards or Pass.
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">
                      Waiting for <span className="font-semibold text-white">{activePlayer?.nickname}</span> to make a play...
                    </span>
                  )}
                </div>

                {/* Hand Action Controls */}
                {isMyTurn && (
                  <div className="flex items-center gap-3">
                    
                    {gameState.lastPlay && (
                      <button
                        onClick={handleChallenge}
                        className="px-5 py-2 bg-red-500 hover:bg-red-600 border border-red-600 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                      >
                        Challenge Bluff!
                      </button>
                    )}

                    <div className="w-px h-8 bg-white/20 mx-1"></div>

                    {/* Rank declaration selector is always visible when it's your turn to play */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-semibold">Declare Rank:</span>
                      <select 
                        value={gameState.declaredRank || declaredRank}
                        disabled={!!gameState.declaredRank}
                        onChange={(e) => setDeclaredRank(e.target.value)}
                        className="bg-neutral-800 border border-white/10 rounded-lg px-2.5 py-1 text-sm font-semibold focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {DECLARED_RANKS.map(rank => (
                          <option key={rank} value={rank}>{rank}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handlePlayCards}
                      disabled={selectedCards.length === 0}
                      className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-600 rounded-xl text-sm font-semibold transition-all"
                    >
                      {gameState.lastPlay ? `Accept Claim & Play ${selectedCards.length} Card(s)` : `Play ${selectedCards.length} Card(s)`}
                    </button>
                  </div>
                )}
              </div>

              {/* Hand cards selection row */}
              <div className="relative w-full group/scroller select-none">
                {self.hand && self.hand.length > 5 && (
                  <>
                    <button 
                      onClick={() => scrollHand('left')}
                      className="absolute left-1 top-1/2 -translate-y-1/2 z-20 bg-neutral-900/90 hover:bg-neutral-800 border border-white/15 text-white rounded-full p-2 shadow-lg backdrop-blur-sm transition-all opacity-0 group-hover/scroller:opacity-100 cursor-pointer flex items-center justify-center"
                      title="Scroll Left"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => scrollHand('right')}
                      className="absolute right-1 top-1/2 -translate-y-1/2 z-20 bg-neutral-900/90 hover:bg-neutral-800 border border-white/15 text-white rounded-full p-2 shadow-lg backdrop-blur-sm transition-all opacity-0 group-hover/scroller:opacity-100 cursor-pointer flex items-center justify-center"
                      title="Scroll Right"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
                <div 
                  ref={handRowRef}
                  className="flex gap-2 md:gap-3 overflow-x-auto py-2 pb-4 px-8 custom-scrollbar mobile-scrollbar-hide select-none max-w-full"
                >
                  {self.hand && sortCards(self.hand).map((c) => {
                    const isSelected = selectedCards.includes(c.id);
                    return (
                      <motion.div
                        key={c.id}
                        onClick={() => isMyTurn && handleToggleCard(c.id)}
                        whileHover={{ y: isMyTurn ? -10 : 0 }}
                        className={`w-14 h-20 md:w-20 md:h-32 border-2 rounded-xl flex flex-col justify-between p-1.5 md:p-2 cursor-pointer shadow-lg select-none relative flex-shrink-0 ${
                          isSelected 
                            ? 'bg-blue-100 border-blue-500 text-blue-900 -translate-y-4' 
                            : 'bg-white border-neutral-300 text-black'
                        }`}
                      >
                        <div className="text-left font-bold text-xs md:text-sm leading-none">{c.value}</div>
                        <div className="text-lg md:text-2xl text-center self-center">
                          {c.suit === 'hearts' && '♥'}
                          {c.suit === 'diamonds' && '♦'}
                          {c.suit === 'clubs' && '♣'}
                          {c.suit === 'spades' && '♠'}
                        </div>
                        <div className="text-right font-bold text-xs md:text-sm leading-none">{c.value}</div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Players panel / details right — hidden on mobile */}
        <div className="w-72 border-l border-white/10 bg-neutral-900 flex-col justify-between overflow-hidden hidden lg:flex">
          <div className="p-4 border-b border-white/10 flex-shrink-0">
            <span className="font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" /> Active Players
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {gameState.players.map((p, idx) => {
              const isCurrentTurn = gameState.currentTurnIdx === idx;
              return (
                <div 
                  key={p.userId} 
                  className={`p-3 border rounded-xl flex items-center justify-between transition-all ${
                    isCurrentTurn 
                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                      : 'bg-white/5 border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs uppercase shadow-md relative">
                      {p.nickname[0]}
                      {isCurrentTurn && <div className="absolute -inset-1 rounded-lg border-2 border-emerald-400 animate-pulse" />}
                    </div>
                    <div>
                      <div className="font-semibold text-xs leading-none flex items-center gap-1">
                        {p.nickname}
                        {p.role === 'HOST' && <span className="text-[8px] bg-yellow-500/20 text-yellow-300 px-1 border border-yellow-500/20 rounded">Host</span>}
                      </div>
                      <span className="text-[10px] text-gray-500 mt-1 block">
                        {p.cardCount} card(s) left
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] text-gray-400 font-semibold">
                    {p.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Voice Toolbar */}
          <div className="p-4 border-t border-white/10 bg-black/40 flex-shrink-0 flex items-center justify-between gap-3">
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
                Disconnect Voice
              </button>
            )}
          </div>
        </div>

        {/* Collapsible sliding panel for Room Chat */}
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
      </div>
    );
  }

  // Fallback initial/Join view
  return (
    <div className="flex flex-col h-screen bg-black text-white p-6 space-y-6 overflow-y-auto">
      {/* Top Header */}
      <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/dashboard/games")}
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <button 
          onClick={() => setShowRulesModal(true)}
          className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-xl flex items-center gap-2 transition-colors text-sm font-semibold animate-pulse"
        >
          <BookOpen className="w-4 h-4" /> Rules
        </button>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Create Lobby Card */}
        <GlassCard className="p-8 flex flex-col space-y-6 text-center border-emerald-500/20">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center text-white text-4xl mx-auto shadow-lg animate-pulse">
            🃏
          </div>

          <div>
            <h2 className="text-2xl font-black">Create a New Session</h2>
            <p className="text-gray-400 text-sm mt-1">Play cards and catch others bluffing in real time!</p>
          </div>

          <button
            onClick={handleCreateLobby}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-semibold transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" /> Create Game Lobby
          </button>
        </GlassCard>

        {/* Browse Available Lobbies */}
        <GlassCard className="p-6 flex flex-col space-y-4 border-blue-500/20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              Available Lobbies
            </h2>
            <button
              onClick={fetchLobbies}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
              title="Refresh lobbies"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[350px] space-y-3 pr-1">
            {availableLobbies.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8 text-gray-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm font-medium">No lobbies available right now</p>
                  <p className="text-gray-600 text-xs mt-1">Create one and invite your friends!</p>
                </div>
              </div>
            ) : (
              availableLobbies.map(l => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/[0.07] border border-white/10 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center font-bold text-sm shadow-md">
                      {l.hostName[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{l.hostName}&apos;s Lobby</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {l.playerCount}/{l.maxPlayers}
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 border border-emerald-500/20 rounded font-semibold">
                          {l.gameType === 'BLUFF' ? 'Bluff' : l.gameType}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => joinLobby(l.id, userId || '', nickname || 'Player')}
                    disabled={l.playerCount >= l.maxPlayers}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" /> Join
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </GlassCard>
      </div>
      {rulesModal}
    </div>
  );
}

export default function BluffGamePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    }>
      <BluffGamePageContent />
    </Suspense>
  );
}
