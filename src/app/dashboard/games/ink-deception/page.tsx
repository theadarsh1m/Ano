"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Play, UserPlus, LogOut, Loader2,
  Clock, Check, X, ShieldAlert, Award, Volume2, VolumeX, Sparkles, ArrowLeft,
  BookOpen, MessageSquare
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useInkDeceptionStore } from "@/store/useInkDeceptionStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { socketService } from "@/lib/socket";
import { TurnIndicator } from "@/components/games/TurnIndicator";
import { useExitWarning } from "@/hooks/useExitWarning";

// Ink & Deception components

import { soundService } from "@/components/games/ink-deception/SoundService";
import { InkCanvas } from "@/components/games/ink-deception/InkCanvas";
import { RoleRevealModal } from "@/components/games/ink-deception/RoleRevealModal";
import { VotingDashboard } from "@/components/games/ink-deception/VotingDashboard";
import { GuessOverlay } from "@/components/games/ink-deception/GuessOverlay";
import { ReplayTimeline } from "@/components/games/ink-deception/ReplayTimeline";
import { PlayerGrid } from "@/components/games/ink-deception/PlayerGrid";
import { GuessChat } from "@/components/games/ink-deception/GuessChat";

function InkDeceptionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get("gameId");

  const { id: userId, nickname } = useUserStore();
  
  const {
    lobby,
    gameState,
    availableLobbies,
    createLobby,
    joinLobby,
    toggleReady,
    leaveLobby,
    updateSettings,
    startGame,
    submitStroke,
    playAgain,
    setupListeners,
    fetchLobbies,
    invitePlayer
  } = useInkDeceptionStore();

  const [inviteCopied, setInviteCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showMobilePlayers, setShowMobilePlayers] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());

  // Lobby settings state
  const [drawingTime, setDrawingTime] = useState(20);
  const [discussionTime, setDiscussionTime] = useState(20);
  const [category, setCategory] = useState("mixed");
  const [rounds, setRounds] = useState(3);
  const [turnsPerPlayer, setTurnsPerPlayer] = useState(2);
  const guessTime = 8;

  const { bypassWarning } = useExitWarning(!!lobby || !!gameState);

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
            className="bg-neutral-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto text-left relative shadow-2xl custom-scrollbar text-white"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-[#FF5DA8]" /> Ink & Deception Rules
              </h2>
              <button onClick={() => setShowRulesModal(false)} className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-md transition-colors cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
              <p><strong className="text-white">Goal:</strong> Expose the secretly assigned Impostor (Fake Artist), or as the Impostor, blend in and guess the secret word to steal victory!</p>
              
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-[#FF5DA8] block mb-1">Roles:</strong>
                <p>• <strong>Artists:</strong> Receive a secret word and drawing category (e.g. category "Food", word "Apple").</p>
                <p>• <strong>The Impostor:</strong> Receives only the category, and a warning that they are the Impostor.</p>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-[#FF5DA8] block mb-1">Gameplay:</strong>
                <p>1. Players take turns drawing on a shared canvas. Each player gets exactly two turns.</p>
                <p>2. <strong>Rule:</strong> Each turn you can draw only <strong>one continuous stroke</strong> (releasing mouse/finger ends your turn!).</p>
                <p>3. Artists draw clues to prove they know the word without making it too obvious for the Impostor.</p>
                <p>4. The Impostor draws strategically to pretend they know the word.</p>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-[#FF5DA8] block mb-1">Voting & Guesses:</strong>
                <p>• After drawing, everyone votes on who they think the Impostor is.</p>
                <p>• If the painters vote for the wrong person, the Impostor wins.</p>
                <p>• If the painters successfully catch the Impostor, the Impostor gets 8 seconds to guess the secret word. If they guess correctly, they win. Otherwise, Artists win!</p>
              </div>
            </div>

            <button 
              onClick={() => setShowRulesModal(false)}
              className="mt-6 w-full py-3 bg-gradient-to-r from-[#FF5DA8] to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg cursor-pointer"
            >
              Got it!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Web Audio Context unlock gesture binding
  useEffect(() => {
    const handleInteraction = () => {
      soundService.handleUserInteraction();
      setIsMuted(soundService.getMutedState());
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
    window.addEventListener("click", handleInteraction);
    window.addEventListener("pointerdown", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, []);

  // Sync available lobbies
  useEffect(() => {
    if (!userId) return;
    const socket = socketService.getSocket();
    const doFetch = () => fetchLobbies();
    if (socket.connected) doFetch();
    socket.on('connect', doFetch);
    return () => {
      socket.off('connect', doFetch);
    };
  }, [userId, fetchLobbies]);

  // Setup sockets listener maps
  useEffect(() => {
    if (!userId) return;
    const cleanup = setupListeners(lobby?.id || gameState?.gameId || "", userId!);
    
    if (gameIdParam && !lobby && !gameState) {
      joinLobby(gameIdParam, userId!, nickname || "Player");
    }

    return () => {
      cleanup();
    };
  }, [userId, lobby, gameState, gameIdParam, joinLobby, nickname, setupListeners]);

  // Sync mute state on mount
  useEffect(() => {
    setIsMuted(soundService.getMutedState());
  }, []);

  // Sync local lobby settings state when lobby updates
  useEffect(() => {
    if (lobby?.settings) {
      if (lobby.settings.category) setCategory(lobby.settings.category);
      if (lobby.settings.drawingTime) setDrawingTime(lobby.settings.drawingTime);
      if (lobby.settings.discussionTime) setDiscussionTime(lobby.settings.discussionTime);
      if (lobby.settings.rounds !== undefined) setRounds(lobby.settings.rounds);
      const tpp = (lobby.settings as any).turnsPerPlayer;
      if (tpp !== undefined) setTurnsPerPlayer(tpp);
    }
  }, [lobby]);

  // Fetch online users for invites
  useEffect(() => {
    if (!userId || !showInviteModal) return;
    const getApiUrl = () => {
      if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
      if (typeof window !== "undefined") return `http://${window.location.hostname}:3001`;
      return "http://localhost:3001";
    };
    const API_URL = getApiUrl();
    
    fetch(`${API_URL}/api/users/online`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setOnlineUsers(data.filter(u => u.id !== userId)); })
      .catch(console.error);
  }, [userId, showInviteModal]);

  const sendInvite = (targetId: string) => {
    const activeGameId = gameState?.gameId || lobby?.id;
    if (!activeGameId || !userId || !nickname) return;
    invitePlayer(activeGameId, userId, nickname, targetId);
    setInvitedUsers(prev => new Set(prev).add(targetId));
  };

  // Safe unmount leave logic
  useEffect(() => {
    return () => {
      const state = useInkDeceptionStore.getState();
      const currentGameId = state.lobby?.id || state.gameState?.gameId;
      const currentUserId = useUserStore.getState().id;
      if (currentGameId && currentUserId) {
        state.leaveLobby(currentGameId, currentUserId);
      }
    };
  }, []);

  const handleCreateLobby = () => {
    if (!userId || !nickname) return;
    createLobby(userId!, nickname!);
    soundService.playClick();
  };

  const handleLeave = () => {
    bypassWarning();
    const activeGameId = gameState?.gameId || lobby?.id;
    if (activeGameId && userId) {
      leaveLobby(activeGameId, userId!);
    }
    soundService.playClick();
    router.push("/dashboard/games");
  };

  const handleUpdateSettings = (updated: Record<string, unknown>) => {
    if (lobby?.hostId === userId) {
      updateSettings(lobby.id, userId!, {
        rounds,
        drawingTime,
        discussionTime,
        turnsPerPlayer,
        guessTime,
        category,
        ...updated
      });
    }
  };

  const handleStartGame = () => {
    if (lobby?.hostId === userId) {
      startGame(lobby.id, userId!);
      soundService.playReveal();
    }
  };

  const handleMuteToggle = () => {
    const muted = soundService.toggleMute();
    setIsMuted(muted);
  };

  // Safe navigation guard loading screen
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    Promise.resolve().then(() => {
      setIsClient(true);
    });
    console.log(`[${new Date().toISOString()}] [Ink & Deception Page] Mounted. userId: ${userId}, nickname: ${nickname}`);
  }, [userId, nickname]);

  // Auth Redirect safety check
  useEffect(() => {
    if (isClient && !userId) {
      router.push("/");
    }
  }, [isClient, userId, router]);

  console.log(`[${new Date().toISOString()}] [Ink & Deception Page] Render status: isClient=${isClient}, userId=${userId}, nickname=${nickname}, lobby=${lobby ? lobby.id : 'null'}, gameState=${gameState ? gameState.gameId : 'null'}`);

  if (!isClient || !userId || !nickname) {
    return (
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-[#FF5DA8] animate-spin" />
      </div>
    );
  }

  // 1. LOBBY SCREEN
  if (lobby) {
    const isHost = lobby.hostId === userId;
    const isReady = lobby.players.find(p => p.userId === userId)?.isReady || isHost;
    
    return (
      <div className="flex flex-col h-screen bg-black text-white">
        {/* Global Header Navbar */}
        <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={handleLeave} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button onClick={() => router.push("/dashboard")} className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Ano</span>
            </button>
            <div className="ml-2 border-l border-white/20 pl-4 hidden md:block">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                🖌️ Ink & Deception Lobby
              </h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowRulesModal(true)}
              className="px-3 sm:px-4 py-2 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full text-sm font-bold flex items-center gap-2 transition-colors hover:bg-white/10 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" /> <span className="hidden sm:inline">Rules</span>
            </button>
            <button 
              onClick={() => {
                setShowInviteModal(true);
                soundService.playClick();
              }}
              className="px-3 sm:px-4 py-2 bg-[#6AA6FF]/20 hover:bg-[#6AA6FF]/35 text-[#6AA6FF] rounded-full text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Invite</span>
            </button>
            <button onClick={handleLeave} className="px-3 sm:px-4 py-2 bg-rose-500/20 hover:bg-rose-500/35 text-rose-400 rounded-full text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 max-w-4xl mx-auto w-full">
          {/* Lobby Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Players List */}
            <GlassCard className="p-6">
              <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
                <Users className="text-[#FF5DA8] w-5 h-5" /> Players ({lobby.players.length}/10)
              </h2>
              
              <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {lobby.players.map(p => (
                  <div key={p.userId} className="flex items-center justify-between bg-white/5 p-3.5 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-bold">{p.nickname}</span>
                      {p.role === 'HOST' && <span className="text-[9px] font-mono bg-amber-500/25 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">HOST</span>}
                    </div>
                    {p.role !== 'HOST' && (
                      <span className={`text-[9px] font-mono font-bold px-2.5 py-1 rounded-full border ${p.isReady ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                        {p.isReady ? 'READY' : 'NOT READY'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              
              {!isHost && (
                <button
                  onClick={() => {
                    toggleReady(lobby.id, userId!, !isReady);
                    soundService.playClick();
                  }}
                  className={`w-full py-4 rounded-2xl font-bold tracking-wider text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                    isReady 
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30' 
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/10'
                  }`}
                >
                  {isReady ? <><X className="w-4 h-4"/> CANCEL READY</> : <><Check className="w-4 h-4"/> READY UP</>}
                </button>
              )}
              
              {isHost && (
                <button
                  onClick={handleStartGame}
                  disabled={lobby.players.length < 3 || !lobby.players.every(p => p.role === 'HOST' || p.isReady)}
                  className="w-full py-4 bg-gradient-to-r from-[#FF5DA8] to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white rounded-2xl font-bold tracking-wider text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-pink-500/15 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4" /> START GAME
                </button>
              )}
            </GlassCard>

            {/* Lobby Settings Card */}
            <GlassCard className="p-6">
               <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
                <Clock className="text-[#6AA6FF] w-5 h-5" /> Settings
              </h2>
              <div className="space-y-4">
                 <div>
                    <label className="text-xs text-slate-500 font-mono block mb-1.5 uppercase">Category Word Pack</label>
                    <select 
                      disabled={!isHost}
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        handleUpdateSettings({ category: e.target.value });
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none disabled:opacity-50"
                    >
                      <option value="mixed" className="bg-neutral-900">Mixed Categories</option>
                      <option value="animals" className="bg-neutral-900">Animals</option>
                      <option value="food" className="bg-neutral-900">Food</option>
                      <option value="technology" className="bg-neutral-900">Technology</option>
                      <option value="anime" className="bg-neutral-900">Anime</option>
                      <option value="gaming" className="bg-neutral-900">Gaming</option>
                      <option value="sports" className="bg-neutral-900">Sports</option>
                      <option value="movies" className="bg-neutral-900">Movies</option>
                      <option value="countries" className="bg-neutral-900">Countries</option>
                      <option value="objects" className="bg-neutral-900">Objects</option>
                      <option value="fantasy" className="bg-neutral-900">Fantasy</option>
                      <option value="nature" className="bg-neutral-900">Nature</option>
                      <option value="science" className="bg-neutral-900">Science</option>
                      <option value="jobs" className="bg-neutral-900">Jobs</option>
                      <option value="vehicles" className="bg-neutral-900">Vehicles</option>
                      <option value="music" className="bg-neutral-900">Music</option>
                      <option value="programming" className="bg-neutral-900">Programming</option>
                      <option value="internet_culture" className="bg-neutral-900">Internet Culture</option>
                    </select>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-xs text-slate-500 font-mono block mb-1.5 uppercase">Brush Time</label>
                       <select 
                         disabled={!isHost}
                         value={drawingTime}
                         onChange={(e) => {
                           const t = Number(e.target.value);
                           setDrawingTime(t);
                           handleUpdateSettings({ drawingTime: t });
                         }}
                         className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none disabled:opacity-50"
                       >
                         {[15, 20, 30, 45].map(t => <option key={t} value={t} className="bg-neutral-900">{t}s / Stroke</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="text-xs text-slate-500 font-mono block mb-1.5 uppercase">Discussion Time</label>
                       <select 
                         disabled={!isHost}
                         value={discussionTime}
                         onChange={(e) => {
                           const t = Number(e.target.value);
                           setDiscussionTime(t);
                           handleUpdateSettings({ discussionTime: t });
                         }}
                         className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none disabled:opacity-50"
                       >
                         {[20, 30, 60].map(t => <option key={t} value={t} className="bg-neutral-900">{t}s</option>)}
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-xs text-slate-500 font-mono block mb-1.5 uppercase">Rounds</label>
                       <select 
                         disabled={!isHost}
                         value={rounds}
                         onChange={(e) => {
                           const r = Number(e.target.value);
                           setRounds(r);
                           handleUpdateSettings({ rounds: r });
                         }}
                         className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none disabled:opacity-50"
                       >
                         {[1, 2, 3, 5].map(r => <option key={r} value={r} className="bg-neutral-900">{r} {r === 1 ? 'Round' : 'Rounds'}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="text-xs text-slate-500 font-mono block mb-1.5 uppercase">Turns per Player</label>
                       <select 
                         disabled={!isHost}
                         value={turnsPerPlayer}
                         onChange={(e) => {
                           const t = Number(e.target.value);
                           setTurnsPerPlayer(t);
                           handleUpdateSettings({ turnsPerPlayer: t });
                         }}
                         className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none disabled:opacity-50"
                       >
                         {[1, 2, 3].map(t => <option key={t} value={t} className="bg-neutral-900">{t} {t === 1 ? 'Stroke' : 'Strokes'}</option>)}
                       </select>
                    </div>
                 </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-white/10 text-center">
                <span className="text-[10px] font-mono text-slate-500">
                  ⚠️ Need at least 3 players to start.
                </span>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Invite Modal */}
        <AnimatePresence>
          {showInviteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowInviteModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-neutral-900 border border-white/10 rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold mb-4 text-white">Invite Players</h3>
                
                {/* Copy Link Option */}
                <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
                  <h4 className="text-xs text-slate-400 font-mono uppercase tracking-wider mb-2">Room Invite Link</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/dashboard/games/ink-deception?gameId=${lobby.id}`}
                      className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono outline-none"
                    />
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/dashboard/games/ink-deception?gameId=${lobby.id}`;
                        navigator.clipboard.writeText(link);
                        setInviteCopied(true);
                        setTimeout(() => setInviteCopied(false), 2000);
                      }}
                      className="px-3 py-1.5 bg-[#6AA6FF]/20 hover:bg-[#6AA6FF]/35 text-[#6AA6FF] border border-[#6AA6FF]/30 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                    >
                      {inviteCopied ? "COPIED" : "COPY"}
                    </button>
                  </div>
                </div>

                {/* Online Users List */}
                <div className="space-y-3">
                  <span className="text-xs text-slate-400 font-mono uppercase tracking-wider block">Online Users</span>
                  {onlineUsers.length === 0 ? (
                    <div className="text-xs text-slate-500 font-mono text-center py-4 bg-white/5 border border-dashed border-white/10 rounded-xl">
                      No other users online
                    </div>
                  ) : (
                    <div className="max-h-[250px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                      {onlineUsers
                        .filter(u => !lobby.players.some(p => p.userId === u.id))
                        .map(user => (
                          <div key={user.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                            <span className="text-xs font-bold text-white">{user.nickname}</span>
                            <button
                              onClick={() => sendInvite(user.id)}
                              disabled={invitedUsers.has(user.id)}
                              className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors cursor-pointer ${
                                invitedUsers.has(user.id)
                                  ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                                  : 'bg-[#FF5DA8]/20 hover:bg-[#FF5DA8]/35 text-[#FF5DA8]'
                              }`}
                            >
                               {invitedUsers.has(user.id) ? '✓ Invited' : 'Invite'}
                            </button>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setShowInviteModal(false)} 
                  className="mt-6 w-full py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm font-bold transition-colors text-white cursor-pointer"
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rules Modal */}
        {rulesModal}
      </div>
    );
  }

  // 2. ACTIVE GAMEPLAY SCREENS
  if (gameState) {
    const myPlayer = gameState.players.find(p => p.userId === userId);
    const isHost = myPlayer?.isHost || false;
    const isActiveDrawer = gameState.activeDrawerId === userId;
    const isDrawingPhase = gameState.turnState === "DRAWING";
    const isDiscussionPhase = gameState.turnState === "DISCUSSION";
    const isPaused = gameState.isPaused || false;

    // Phase display translation
    const getPhaseName = () => {
      switch (gameState.turnState) {
        case "ROLE_REVEAL": return "Role Reveal";
        case "DRAWING": return "Drawing Turn";
        case "DISCUSSION": return "Discussion";
        case "VOTING": return "Voting Secretly";
        case "REVEAL": return "Reveal Votes";
        case "FAKE_GUESS": return "Impostor Guessing";
        case "ROUND_END":
        case "GAME_END": return "Game Results";
        default: return "Gameplay";
      }
    };

    const isMyTurn = 
      (isActiveDrawer && isDrawingPhase) || 
      (gameState.questionMasterId === userId && gameState.turnState === "QUESTION_MASTER_SELECTING") ||
      (gameState.fakeArtistId === userId && gameState.turnState === "FAKE_GUESS");

    return (
      <div className="flex flex-col h-auto lg:h-dvh w-full p-2 md:p-6 pb-4 lg:pb-6 max-w-[1600px] mx-auto gap-4 overflow-y-auto lg:overflow-hidden relative">
        <TurnIndicator isMyTurn={isMyTurn} />
        {/* Global Reveal Modal overlays */}
        <RoleRevealModal />
        <GuessOverlay />

        {/* Active game header bar */}
        <div className="flex justify-between items-center bg-white/5 border border-white/10 p-2 md:p-3.5 rounded-3xl backdrop-blur-md flex-shrink-0 gap-2 md:gap-4 overflow-hidden">
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
             {/* Turn Counter instead of Rounds */}
             <div className="text-center px-2 py-1 md:px-4 md:py-1.5 bg-white/5 border border-white/10 rounded-xl flex-shrink-0">
                <div className="text-[8px] md:text-[9px] text-[#6AA6FF] font-mono uppercase tracking-wider">Turn</div>
                <div className="text-xs md:text-sm font-black text-white font-mono">
                  {gameState.turnState === "DRAWING" 
                    ? `${gameState.currentTurnCount + 1}/${gameState.totalTurns}`
                    : `${gameState.currentTurnCount}/${gameState.totalTurns}`}
                </div>
             </div>
             
             {/* Countdown timer clock */}
             <div className="text-center px-2 py-1 md:px-4 md:py-1.5 bg-white/5 border border-white/10 rounded-xl flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                <Clock className="w-3 h-3 md:w-4 md:h-4 text-[#FF5DA8]" />
                <div className="font-bold text-sm md:text-xl text-white font-mono w-6 md:w-8">
                  {gameState.timeLeft}
                </div>
             </div>
          </div>

          {/* Central Category Word Display */}
          <div className="flex-1 flex justify-center text-center min-w-0 px-2">
            <div className="flex flex-col items-center min-w-0">
              <span className="text-[8px] md:text-[10px] font-mono font-bold text-[#6AA6FF] uppercase tracking-widest mb-0.5 truncate max-w-[80px] sm:max-w-none">
                Category: {gameState.category || "MIXED"}
              </span>
              
              <h2 className="text-xs sm:text-sm md:text-2xl font-black text-white uppercase truncate max-w-[120px] sm:max-w-none">
                {gameState.word}
              </h2>
            </div>
          </div>

          {/* HUD status labels */}
          <div className="hidden lg:flex items-center gap-3 text-center flex-shrink-0">
             <div className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-xl">
               <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest block">Phase</span>
               <span className="text-xs font-bold text-white uppercase">{getPhaseName()}</span>
             </div>
             {gameState.turnState === "DRAWING" && (
               <div className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-xl">
                 <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest block">Active Drawer</span>
                 <span className="text-xs font-bold text-amber-400 uppercase">
                   {gameState.players.find(p => p.userId === gameState.activeDrawerId)?.nickname || 'Nobody'}
                 </span>
               </div>
             )}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            <button 
              onClick={handleMuteToggle}
              className="p-1.5 md:p-2 rounded-xl bg-white/5 border border-white/10 text-[#B7C0D8] hover:text-white transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Volume2 className="w-3.5 h-3.5 md:w-4 md:h-4" />}
            </button>

            <button onClick={handleLeave} className="px-2.5 py-1.5 md:px-3.5 md:py-2 bg-rose-500/20 hover:bg-rose-500/35 text-rose-400 rounded-xl font-mono text-[10px] md:text-xs tracking-wider transition-colors cursor-pointer">
              LEAVE
            </button>
          </div>
        </div>


        {/* Main interactive grid area */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 h-auto lg:h-[calc(100vh-200px)] min-h-0 lg:min-h-[600px] relative">
          
          {/* Left panel: player grid lists */}
          <div className="hidden lg:flex w-full lg:w-60 flex-col flex-shrink-0">
            <PlayerGrid />
          </div>

          {/* Central Screen viewport */}
          <div className="flex-1 flex flex-col relative min-w-0">
            
            {/* DRAWING PHASE: Canvas viewport */}
            {isDrawingPhase && (
              <div className="h-[320px] lg:h-auto lg:flex-1 relative min-h-0 flex-shrink-0">
                <InkCanvas
                  isDrawer={true}
                  gameId={gameState.gameId}
                  inkColor={myPlayer?.inkColor || "#6AA6FF"}
                  isActiveTurn={isActiveDrawer}
                  onStrokeComplete={(points) => {
                    submitStroke(gameState.gameId, userId!, points);
                  }}
                />
              </div>
            )}

            {/* DISCUSSION PHASE: Chat unlocked and timer visible */}
            {isDiscussionPhase && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <GlassCard className="p-8 max-w-md w-full text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#6AA6FF] to-indigo-600" />
                  
                  <div className="w-16 h-16 rounded-full border-4 border-dashed border-[#6AA6FF]/20 flex items-center justify-center bg-white/5 border border-white/10 mx-auto mb-6 text-[#6AA6FF]">
                    <span className="text-2xl font-mono font-bold animate-pulse">💬</span>
                  </div>

                  <h2 className="text-2xl font-black tracking-widest text-white uppercase">
                    Discussion phase
                  </h2>
                  <p className="text-xs text-[#B7C0D8]/60 font-mono tracking-widest mt-2 uppercase">
                    TALK IN ROOM CHAT. VOTE PREPARATION IN PROGRESS.
                  </p>

                  {/* Breathing timer countdown */}
                  <div className="text-6xl font-black text-[#6AA6FF] font-mono tracking-tight my-8 animate-pulse">
                    {gameState.timeLeft}s
                  </div>

                  <div className="text-[10px] text-slate-500 font-mono leading-relaxed bg-white/5 border border-white/10 p-4 rounded-2xl">
                     🔍 Examine the canvas carefully. The Impostor drew a continuous line without knowing the word!
                  </div>
                </GlassCard>
              </div>
            )}

            {/* VOTING & REVEAL PHASES */}
            {(gameState.turnState === "VOTING" || gameState.turnState === "REVEAL") && (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <VotingDashboard />
              </div>
            )}

            {/* ROUND END / GAME RESULTS SUMMARIES WITH PLAYBACK REPLAY */}
            {(gameState.turnState === "ROUND_END" || gameState.turnState === "GAME_END") && (
              <div className="flex-1 flex flex-col gap-4 min-h-0">
                {/* Result header */}
                <div className="p-5 bg-white/5 border border-white/10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      gameState.roundWinner === "ARTISTS" 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                    }`}>
                      {gameState.roundWinner === "ARTISTS" ? <Award className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-black text-white tracking-widest uppercase">
                        {gameState.turnState === "ROUND_END" ? (
                          gameState.roundWinner === "ARTISTS" 
                            ? `ROUND ${gameState.currentRound} RESULTS: ARTISTS WIN!` 
                            : `ROUND ${gameState.currentRound} RESULTS: IMPOSTOR WINS!`
                        ) : (
                          gameState.roundWinner === "ARTISTS" 
                            ? "GAME OVER: ARTISTS WIN THE MATCH!" 
                            : "GAME OVER: IMPOSTOR WINS THE MATCH!"
                        )}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                        The Secret Word was: <span className="text-white font-bold">{gameState.word}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Fake Artist Word Guess Details */}
                    {gameState.mostVotedId && (
                      <div className="text-xs font-mono bg-white/5 border border-white/10 p-2.5 rounded-xl">
                        {gameState.guessWordCorrect ? (
                          <span className="text-emerald-400 font-bold">✓ IMPOSTOR GUESSED WORD!</span>
                        ) : (
                          <span className="text-rose-400 font-bold">✗ IMPOSTOR GUESSED WRONG!</span>
                        )}
                      </div>
                    )}

                    {/* Next round buttons for host */}
                    {gameState.turnState === "ROUND_END" ? (
                      <div className="text-xs font-mono text-[#6AA6FF] animate-pulse bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl">
                        ⏳ Starting next round...
                      </div>
                    ) : (
                      isHost && (
                        <button
                          onClick={() => {
                            playAgain(gameState.gameId, userId!);
                            soundService.playClick();
                          }}
                          className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-bold tracking-wider text-xs cursor-pointer shadow-md"
                        >
                          PLAY AGAIN / LOBBY
                        </button>
                      )
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Right panel: Communication Chats */}
          <div className="hidden lg:flex w-full lg:w-80 flex-col flex-shrink-0">
            <GuessChat />
          </div>

        </div>

        {/* Mobile floating navigation buttons */}
        <div className="lg:hidden fixed bottom-6 right-6 z-40 flex flex-col gap-3">
          <button
            onClick={() => setShowMobilePlayers(true)}
            className="w-12 h-12 rounded-full bg-[#6AA6FF] hover:bg-[#6AA6FF]/90 text-white shadow-lg flex items-center justify-center cursor-pointer border border-[#6AA6FF]/20 transition-all active:scale-95"
            title="Players List"
          >
            <Users className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setShowMobileChat(true)}
            className="w-12 h-12 rounded-full bg-[#FF5DA8] hover:bg-[#FF5DA8]/90 text-white shadow-lg flex items-center justify-center cursor-pointer border border-[#FF5DA8]/20 transition-all active:scale-95"
            title="Chat Rooms"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Slide-out Drawer: Players */}
        <AnimatePresence>
          {showMobilePlayers && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobilePlayers(false)}
              className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] flex justify-end"
            >
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                onClick={(e) => e.stopPropagation()}
                className="w-[85%] max-w-sm h-full bg-[#03060c] border-l border-white/10 p-6 flex flex-col relative overflow-y-auto"
              >
                <button
                  onClick={() => setShowMobilePlayers(false)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="flex-1 pt-8 flex flex-col min-h-0">
                  <PlayerGrid />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Slide-out Drawer: Chat */}
        <AnimatePresence>
          {showMobileChat && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileChat(false)}
              className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] flex justify-end"
            >
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                onClick={(e) => e.stopPropagation()}
                className="w-[85%] max-w-sm h-full bg-[#03060c] border-l border-white/10 p-4 flex flex-col relative"
              >
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer transition-colors z-[100]"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="flex-1 pt-8 flex flex-col min-h-0">
                  <GuessChat />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AUTHORITATIVE DISCONNECT RECONNECT OVERLAY */}
        <AnimatePresence>
          {isPaused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 w-full h-full bg-[#03060c]/95 z-[99] flex items-center justify-center p-4 backdrop-blur-md"
            >
              <div className="text-center max-w-sm flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-6 animate-pulse">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-widest">
                  Match Paused
                </h2>
                <p className="text-xs text-rose-400 font-mono tracking-wider mt-2">
                  WAITING FOR PLAYER TO RECONNECT...
                </p>
                <div className="text-4xl font-black text-white font-mono mt-6 animate-pulse">
                  {gameState.pauseTimeLeft}s
                </div>
                <p className="text-[10px] text-slate-500 font-mono mt-4 max-w-xs">
                  The match will resume as soon as the player returns. If the timer reaches 0, they will be removed and the match will resume or abort.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 3. ENTRY LANDING SCREEN (If not in lobby and not in game)
  if (!lobby && !gameState) {
    return (
      <div className="flex flex-col h-screen bg-black text-white">
        {/* Global Header Navbar */}
        <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard/games")} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button onClick={() => router.push("/dashboard")} className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Ano</span>
            </button>
            <div className="ml-2 border-l border-white/20 pl-4 hidden md:block">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                🖌️ Ink & Deception
              </h1>
            </div>
          </div>
          <div>
            <button 
              onClick={() => setShowRulesModal(true)}
              className="px-3 sm:px-4 py-2 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full text-sm font-bold flex items-center gap-2 transition-colors hover:bg-white/10 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" /> <span className="hidden sm:inline">Rules</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 max-w-4xl mx-auto w-full flex flex-col justify-start md:justify-center gap-8">
          {/* Title branding */}
          <div className="text-center space-y-3">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-block w-20 h-20 rounded-[28px] bg-gradient-to-br from-[#FF5DA8] to-indigo-900 flex items-center justify-center shadow-2xl border-2 border-[#FF5DA8]/40 mb-2"
            >
              <span className="text-4xl">🖌️</span>
            </motion.div>
            
            <motion.h1 
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-4xl md:text-5xl font-black text-white tracking-[0.15em] uppercase"
            >
              Ink & Deception
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[#6AA6FF] font-mono text-xs md:text-sm tracking-[0.2em] uppercase max-w-lg mx-auto leading-relaxed"
            >
              One Drawing. One Impostor. Trust No Stroke.
            </motion.p>
          </div>

          {/* Content Split Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Host Lobby panel */}
            <GlassCard className="p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FF5DA8] to-[#6AA6FF]" />
              <div>
                <h2 className="text-xl font-black text-white mb-2 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="text-[#FF5DA8] w-5 h-5" /> Host a Room
                </h2>
                <p className="text-xs text-slate-500 font-mono uppercase leading-relaxed mb-6">
                  Create a private lobby and invite your friends.
                </p>
              </div>

              <button
                onClick={handleCreateLobby}
                className="w-full mt-8 py-4 bg-gradient-to-r from-[#FF5DA8] to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white rounded-2xl font-bold tracking-widest text-xs transition-all shadow-lg shadow-pink-500/10 active:scale-95 cursor-pointer"
              >
                CREATE PRIVATE LOBBY
              </button>
            </GlassCard>

            {/* Join / Available Lobbies panel */}
            <GlassCard className="p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#6AA6FF] to-emerald-500" />
              <div>
                <h2 className="text-xl font-black text-white mb-2 uppercase tracking-widest flex items-center gap-2">
                  <Users className="text-[#6AA6FF] w-5 h-5" /> Join a Room
                </h2>
                <p className="text-xs text-slate-500 font-mono uppercase leading-relaxed mb-6">
                  Select an available lobby below.
                </p>

                {/* Available Active public rooms */}
                <div className="border-t border-white/10 pt-4">
                  <span className="text-[10px] text-slate-500 font-mono block mb-3 uppercase tracking-wider">Active Lobbies ({availableLobbies.length})</span>
                  
                  {availableLobbies.length === 0 ? (
                    <div className="py-8 text-center text-xs font-mono text-slate-600 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                      No active rooms found. Host a lobby!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                      {availableLobbies.map((room) => (
                        <div key={room.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                          <div>
                            <span className="text-xs font-mono font-bold text-white">
                              {room.hostName ? `${room.hostName}'s Room` : room.id}
                            </span>
                            <span className="text-[9px] font-mono text-slate-500 ml-2">({room.playerCount} painters)</span>
                          </div>
                          <button
                            onClick={() => {
                              if (userId && nickname) {
                                joinLobby(room.id, userId, nickname);
                                soundService.playClick();
                              }
                            }}
                            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-mono font-bold tracking-wider cursor-pointer"
                          >
                            JOIN
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>

          </div>
        </div>

        {/* Rules Modal */}
        {rulesModal}
      </div>
    );
  }

  // default fallback
  return null;
}

export default function InkDeceptionPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-[#FF5DA8] animate-spin" />
      </div>
    }>
      <InkDeceptionContent />
    </Suspense>
  );
}
