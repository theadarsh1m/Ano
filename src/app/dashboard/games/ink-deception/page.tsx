"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Play, UserPlus, LogOut, Loader2,
  Clock, Check, X, ShieldAlert, Award, Volume2, VolumeX, Sparkles, ArrowLeft
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useInkDeceptionStore } from "@/store/useInkDeceptionStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { socketService } from "@/lib/socket";

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
    fetchLobbies
  } = useInkDeceptionStore();

  const [inviteCopied, setInviteCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Lobby settings state
  const [drawingTime, setDrawingTime] = useState(20);
  const [discussionTime, setDiscussionTime] = useState(10);
  const [category, setCategory] = useState("mixed");
  const guessTime = 8;

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

  // Play theme music
  useEffect(() => {
    soundService.startBackgroundMusic();
    Promise.resolve().then(() => {
      setIsMuted(soundService.getMutedState());
    });
    return () => {
      soundService.stopBackgroundMusic();
    };
  }, []);

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
        rounds: 1,
        drawingTime,
        discussionTime,
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
      <div className="flex h-screen bg-[#070B16] items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-[#FF5DA8] animate-spin" />
      </div>
    );
  }

  // 1. LOBBY SCREEN
  if (lobby) {
    const isHost = lobby.hostId === userId;
    const isReady = lobby.players.find(p => p.userId === userId)?.isReady || isHost;
    
    return (
      <div className="flex flex-col h-full space-y-6 max-w-4xl mx-auto w-full p-4 md:p-8 pb-20 relative">

        {/* Top Header navbar */}
        <div className="flex justify-between items-center bg-[#111827]/80 border border-slate-800 p-4 rounded-[24px] backdrop-blur-md">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF5DA8] to-indigo-900 flex items-center justify-center shadow-lg border border-[#FF5DA8]/20">
                <span className="text-2xl">🖌️</span>
             </div>
             <div>
                <h1 className="text-xl font-black text-[#FAF8F5] uppercase tracking-wider">Ink & Deception</h1>
                <p className="text-xs text-[#6AA6FF] font-mono">LOBBY CODE: {lobby.id}</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/dashboard/games/ink-deception?gameId=${lobby.id}`);
                setInviteCopied(true);
                setTimeout(() => setInviteCopied(false), 2000);
              }}
              className="px-4 py-2 bg-[#6AA6FF]/20 hover:bg-[#6AA6FF]/35 text-[#6AA6FF] rounded-xl font-mono text-xs tracking-wider transition-colors flex items-center gap-2 cursor-pointer"
            >
              {inviteCopied ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {inviteCopied ? "COPIED" : "INVITE"}
            </button>
            
            <button 
              onClick={handleMuteToggle}
              className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-[#B7C0D8] hover:text-[#FAF8F5] transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button onClick={handleLeave} className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/35 text-rose-400 rounded-xl font-mono text-xs tracking-wider transition-colors flex items-center gap-2 cursor-pointer">
              <LogOut className="w-4 h-4" /> LEAVE
            </button>
          </div>
        </div>

        {/* Lobby Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Players List */}
          <GlassCard className="p-6 bg-[#111827]/80 border-slate-850 rounded-[24px]">
            <h2 className="text-lg font-black text-[#FAF8F5] mb-4 flex items-center gap-2 uppercase tracking-wide">
              <Users className="text-[#FF5DA8] w-5 h-5" /> Players ({lobby.players.length}/10)
            </h2>
            
            <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {lobby.players.map(p => (
                <div key={p.userId} className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                  <div className="flex items-center gap-2">
                    <span className="text-[#FAF8F5] text-sm font-bold">{p.nickname}</span>
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
                    : 'bg-emerald-500 hover:bg-emerald-600 text-[#FAF8F5] shadow-emerald-500/10'
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
          <GlassCard className="p-6 bg-[#111827]/80 border-slate-850 rounded-[24px]">
             <h2 className="text-lg font-black text-[#FAF8F5] mb-4 flex items-center gap-2 uppercase tracking-wide">
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-[#FAF8F5] outline-none disabled:opacity-50"
                  >
                    <option value="mixed">Mixed Categories</option>
                    <option value="animals">Animals</option>
                    <option value="food">Food</option>
                    <option value="technology">Technology</option>
                    <option value="anime">Anime</option>
                    <option value="gaming">Gaming</option>
                    <option value="sports">Sports</option>
                    <option value="movies">Movies</option>
                    <option value="countries">Countries</option>
                    <option value="objects">Objects</option>
                    <option value="fantasy">Fantasy</option>
                    <option value="nature">Nature</option>
                    <option value="science">Science</option>
                    <option value="jobs">Jobs</option>
                    <option value="vehicles">Vehicles</option>
                    <option value="music">Music</option>
                    <option value="programming">Programming</option>
                    <option value="internet_culture">Internet Culture</option>
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
                       className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-[#FAF8F5] outline-none disabled:opacity-50"
                     >
                       {[15, 20, 30, 45].map(t => <option key={t} value={t}>{t}s / Stroke</option>)}
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
                       className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-[#FAF8F5] outline-none disabled:opacity-50"
                     >
                       {[10, 20, 30, 60].map(t => <option key={t} value={t}>{t}s</option>)}
                     </select>
                  </div>
               </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
              <span className="text-[10px] font-mono text-slate-500">
                ⚠️ Need at least 3 players to start.
              </span>
            </div>
          </GlassCard>
        </div>
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

    return (
      <div className="flex flex-col h-screen w-full p-3 md:p-6 pb-20 max-w-[1600px] mx-auto gap-4 overflow-hidden relative">

        {/* Global Reveal Modal overlays */}
        <RoleRevealModal />
        <GuessOverlay />

        {/* Active game header bar */}
        <div className="flex justify-between items-center bg-[#111827]/80 border border-slate-800 p-3.5 rounded-3xl backdrop-blur-md flex-shrink-0 gap-4">
          <div className="flex items-center gap-4">
             {/* Turn Counter instead of Rounds */}
             <div className="text-center px-4 py-1.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-[9px] text-[#6AA6FF] font-mono uppercase tracking-wider">Turn</div>
                <div className="text-sm font-black text-[#FAF8F5] font-mono">
                  {gameState.turnState === "DRAWING" 
                    ? `${gameState.currentTurnCount + 1} / ${gameState.totalTurns}`
                    : `${gameState.currentTurnCount} / ${gameState.totalTurns}`}
                </div>
             </div>
             
             {/* Countdown timer clock */}
             <div className="text-center px-4 py-1.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FF5DA8]" />
                <div className="font-bold text-xl text-[#FAF8F5] font-mono w-8">
                  {gameState.timeLeft}
                </div>
             </div>
          </div>

          {/* Central Category Word Display */}
          <div className="flex-1 flex justify-center text-center">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono font-bold text-[#6AA6FF] uppercase tracking-widest mb-0.5">
                Category: {gameState.category || "MIXED"}
              </span>
              
              <h2 className="text-2xl font-black tracking-[0.2em] text-[#FAF8F5] uppercase">
                {gameState.word}
              </h2>
            </div>
          </div>

          {/* HUD status labels */}
          <div className="hidden md:flex items-center gap-3 text-center">
             <div className="px-4 py-1.5 bg-slate-950/40 rounded-xl border border-slate-850">
               <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest block">Phase</span>
               <span className="text-xs font-bold text-[#FAF8F5] uppercase">{getPhaseName()}</span>
             </div>
             {gameState.turnState === "DRAWING" && (
               <div className="px-4 py-1.5 bg-slate-950/40 rounded-xl border border-slate-850">
                 <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest block">Active Drawer</span>
                 <span className="text-xs font-bold text-amber-400 uppercase">
                   {gameState.players.find(p => p.userId === gameState.activeDrawerId)?.nickname || 'Nobody'}
                 </span>
               </div>
             )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleMuteToggle}
              className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-[#B7C0D8] hover:text-[#FAF8F5] transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button onClick={handleLeave} className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/35 text-rose-400 rounded-xl font-mono text-xs tracking-wider transition-colors cursor-pointer">
              LEAVE
            </button>
          </div>
        </div>

        {/* Main interactive grid area */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 relative">
          
          {/* Left panel: player grid lists */}
          <div className="w-full lg:w-60 flex flex-col flex-shrink-0">
            <PlayerGrid />
          </div>

          {/* Central Screen viewport */}
          <div className="flex-1 flex flex-col relative min-w-0">
            
            {/* DRAWING PHASE: Canvas viewport */}
            {isDrawingPhase && (
              <div className="flex-1 relative min-h-0">
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
                <GlassCard className="p-8 max-w-md w-full bg-[#111827]/85 border-slate-800 rounded-[32px] text-center shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#6AA6FF] to-indigo-600" />
                  
                  <div className="w-16 h-16 rounded-full border-4 border-dashed border-[#6AA6FF]/20 flex items-center justify-center bg-slate-900/60 mx-auto mb-6 text-[#6AA6FF]">
                    <span className="text-2xl font-mono font-bold animate-pulse">💬</span>
                  </div>

                  <h2 className="text-2xl font-black tracking-widest text-[#FAF8F5] uppercase">
                    Discussion phase
                  </h2>
                  <p className="text-xs text-[#B7C0D8]/60 font-mono tracking-widest mt-2 uppercase">
                    TALK IN ROOM CHAT. VOTE PREPARATION IN PROGRESS.
                  </p>

                  {/* Breathing timer countdown */}
                  <div className="text-6xl font-black text-[#6AA6FF] font-mono tracking-tight my-8 animate-pulse">
                    {gameState.timeLeft}s
                  </div>

                  <div className="text-[10px] text-slate-500 font-mono leading-relaxed bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
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
                <div className="p-5 bg-[#111827]/80 border border-slate-850 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      gameState.roundWinner === "ARTISTS" 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                    }`}>
                      {gameState.roundWinner === "ARTISTS" ? <Award className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-black text-[#FAF8F5] tracking-widest uppercase">
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
                        The Secret Word was: <span className="text-[#FAF8F5] font-bold">{gameState.word}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Fake Artist Word Guess Details */}
                    {gameState.mostVotedId && (
                      <div className="text-xs font-mono bg-slate-950/50 p-2.5 rounded-xl border border-slate-850">
                        {gameState.guessWordCorrect ? (
                          <span className="text-emerald-400 font-bold">✓ IMPOSTOR GUESSED WORD!</span>
                        ) : (
                          <span className="text-rose-400 font-bold">✗ IMPOSTOR GUESSED WRONG!</span>
                        )}
                      </div>
                    )}

                    {/* Next round buttons for host */}
                    {gameState.turnState === "ROUND_END" ? (
                      <div className="text-xs font-mono text-[#6AA6FF] animate-pulse bg-slate-950/40 border border-slate-850 px-4 py-2.5 rounded-xl">
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

                {/* Stroke Timeline replay window */}
                <div className="flex-1 min-h-[350px]">
                  <ReplayTimeline />
                </div>
              </div>
            )}

          </div>

          {/* Right panel: Communication Chats */}
          <div className="w-full lg:w-80 flex flex-col flex-shrink-0">
            <GuessChat />
          </div>

        </div>

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
      <div className="flex flex-col h-full space-y-8 max-w-4xl mx-auto w-full p-4 md:p-8 pb-20 relative justify-center min-h-[85vh]">

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
            className="text-4xl md:text-5xl font-black text-[#FAF8F5] tracking-[0.15em] uppercase"
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
          <GlassCard className="p-8 bg-[#111827]/80 border-slate-850 rounded-[32px] flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FF5DA8] to-[#6AA6FF]" />
            <div>
              <h2 className="text-xl font-black text-[#FAF8F5] mb-2 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="text-[#FF5DA8] w-5 h-5" /> Host a Room
              </h2>
              <p className="text-xs text-slate-500 font-mono uppercase leading-relaxed mb-6">
                Create a private lobby and invite your friends.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-500 font-mono block mb-1.5 uppercase tracking-wider">Your Nickname</label>
                  <input
                    type="text"
                    value={nickname || ""}
                    disabled
                    className="w-full bg-slate-950/70 border border-slate-850 rounded-2xl py-3.5 px-4 text-xs font-bold text-[#B7C0D8] outline-none disabled:opacity-70"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateLobby}
              className="w-full mt-8 py-4 bg-gradient-to-r from-[#FF5DA8] to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white rounded-2xl font-bold tracking-widest text-xs transition-all shadow-lg shadow-pink-500/10 active:scale-95 cursor-pointer"
            >
              CREATE PRIVATE LOBBY
            </button>
          </GlassCard>

          {/* Join / Available Lobbies panel */}
          <GlassCard className="p-8 bg-[#111827]/80 border-slate-850 rounded-[32px] flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#6AA6FF] to-emerald-500" />
            <div>
              <h2 className="text-xl font-black text-[#FAF8F5] mb-2 uppercase tracking-widest flex items-center gap-2">
                <Users className="text-[#6AA6FF] w-5 h-5" /> Join a Room
              </h2>
              <p className="text-xs text-slate-500 font-mono uppercase leading-relaxed mb-6">
                Enter a code or select a lobby below.
              </p>

              {/* Direct Code Entry */}
              <div className="flex gap-2.5 mb-6">
                <input
                  type="text"
                  placeholder="ENTER LOBBY CODE..."
                  id="direct-join-code"
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs font-mono font-bold tracking-widest text-[#FAF8F5] outline-none focus:border-[#6AA6FF] uppercase"
                />
                <button
                  onClick={() => {
                    const el = document.getElementById("direct-join-code") as HTMLInputElement;
                    if (el && el.value.trim() && userId && nickname) {
                      joinLobby(el.value.trim().toUpperCase(), userId, nickname);
                      soundService.playClick();
                    }
                  }}
                  className="px-5 py-3 bg-[#6AA6FF]/20 hover:bg-[#6AA6FF]/35 text-[#6AA6FF] border border-[#6AA6FF]/30 rounded-xl font-mono text-xs font-bold tracking-wider transition-colors cursor-pointer"
                >
                  JOIN
                </button>
              </div>

              {/* Available Active public rooms */}
              <div className="border-t border-slate-800/80 pt-4">
                <span className="text-[10px] text-slate-500 font-mono block mb-3 uppercase tracking-wider">Active Lobbies ({availableLobbies.length})</span>
                
                {availableLobbies.length === 0 ? (
                  <div className="py-8 text-center text-xs font-mono text-slate-600 bg-slate-950/20 border border-dashed border-slate-850 rounded-2xl">
                    No active rooms found. Host a lobby!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                    {availableLobbies.map((room) => (
                      <div key={room.id} className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-850">
                        <div>
                          <span className="text-xs font-mono font-bold text-[#FAF8F5]">
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

        {/* Back navigation */}
        <div className="text-center pt-4">
          <button 
            onClick={() => router.push("/dashboard/games")}
            className="inline-flex items-center gap-2 text-xs font-mono text-slate-600 hover:text-[#FAF8F5] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // default fallback
  return null;
}

export default function InkDeceptionPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-[#070B16] items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-[#FF5DA8] animate-spin" />
      </div>
    }>
      <InkDeceptionContent />
    </Suspense>
  );
}
