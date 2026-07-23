"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Gamepad2, Users, Play, UserPlus, LogOut, Loader2,
  ArrowLeft, Clock, Save, Image as ImageIcon, Check, X,
  Eye, EyeOff, MessageSquare, BookOpen
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useRoomConnectionStore } from "@/store/useRoomConnectionStore";
import { useScribbleStore } from "@/store/useScribbleStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { socketService } from "@/lib/socket";
import { copyToClipboard } from "@/lib/clipboard";
import { TurnIndicator } from "@/components/games/TurnIndicator";
import { useExitWarning } from "@/hooks/useExitWarning";
import { useInviteCooldown } from "@/hooks/useInviteCooldown";

// Components
import { ScribbleCanvas } from "@/components/games/scribble/ScribbleCanvas";
import { DrawingTools } from "@/components/games/scribble/DrawingTools";
import { GuessChat } from "@/components/games/scribble/GuessChat";
import { PlayerList } from "@/components/games/scribble/PlayerList";
import { WordSelectionModal } from "@/components/games/scribble/WordSelectionModal";
import { EndGameScreen } from "@/components/games/scribble/EndGameScreen";

function ScribbleGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get("gameId");

  const { id: userId, nickname } = useUserStore();
  
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
    startGame,
    setupListeners,
    updateSettings,
    invitePlayer,
    fetchLobbies
  } = useScribbleStore();

  const { currentRoomId } = useRoomConnectionStore();

  const [selectedColor, setSelectedColor] = useState('#000000');
  const [selectedSize, setSelectedSize] = useState(5);
  const [selectedTool, setSelectedTool] = useState<'brush' | 'eraser'>('brush');
  const [clearTrigger, setClearTrigger] = useState(0);
  const [undoTrigger, setUndoTrigger] = useState(0);
  const [redoTrigger, setRedoTrigger] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hideWord, setHideWord] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Settings state (only host can change)
  const [rounds, setRounds] = useState(3);
  const [drawingTime, setDrawingTime] = useState(60);

  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());

  const { bypassWarning } = useExitWarning(!!lobby || !!gameState);

  // Fetch friends, online users, and room members for invites
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
        .then(data => {
          if (Array.isArray(data)) setRoomMembers(data.filter(u => u.id !== userId));
        })
        .catch(console.error);
    }
  }, [userId, currentRoomId, lobby?.id]);

  useEffect(() => {
    if (!userId) return;
    const socket = socketService.getSocket();
    const doFetch = () => fetchLobbies();
    if (socket.connected) doFetch();
    socket.on('connect', doFetch);
    return () => {
      socket.off('connect', doFetch);
    };
  }, [userId]);

  const { triggerInvite, getInviteStatus } = useInviteCooldown(lobby?.id || gameState?.gameId);

  const sendInvite = (targetId: string) => {
    const activeGameId = gameState?.gameId || lobby?.id;
    if (!activeGameId || !userId || !nickname) return;
    invitePlayer(activeGameId, userId, nickname, targetId, 'SCRIBBLE');
    triggerInvite(targetId);
  };

  useEffect(() => {
    if (!userId) return;
    const cleanup = setupListeners(lobby?.id || gameState?.gameId || "", userId);
    
    if (gameIdParam && !lobby && !gameState) {
      joinLobby(gameIdParam, userId, nickname || "Player");
    }

    return () => {
      cleanup();
    };
  }, [userId, lobby?.id, gameState?.gameId, gameIdParam]);

  useEffect(() => {
    return () => {
      const state = useScribbleStore.getState();
      const currentGameId = state.lobby?.id || state.gameState?.gameId;
      const currentUserId = useUserStore.getState().id;
      if (currentGameId && currentUserId) {
        state.leaveLobby(currentGameId, currentUserId);
      }
    };
  }, []);

  const handleCreateLobby = () => {
    if (!userId || !nickname) return;
    createLobby(userId, nickname);
  };

  const handleLeave = () => {
    bypassWarning();
    const activeGameId = gameState?.gameId || lobby?.id;
    if (activeGameId && userId) {
      leaveLobby(activeGameId, userId);
    }
    router.push("/dashboard/games");
  };

  const handleUpdateSettings = () => {
    if (lobby?.hostId === userId) {
      updateSettings(lobby.id, userId, { rounds, drawingTime });
    }
  };

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
                <BookOpen className="w-6 h-6 text-sky-400" /> Scribble Rules
              </h2>
              <button onClick={() => setShowRulesModal(false)} className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-md transition-colors cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
              <p><strong className="text-white">Goal:</strong> Earn points by drawing secret words or guessing what others are drawing as fast as you can!</p>
              
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-sky-400 block mb-1">Guesser Role:</strong>
                <p>• When another player draws, type your guess in the chat box.</p>
                <p>• The faster you guess the word, the more points you get.</p>
                <p>• Typing a close guess will trigger a hint for you, but won't reveal it to others.</p>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-sky-400 block mb-1">Drawer Role:</strong>
                <p>• When it's your turn to draw, select one of the three secret words presented.</p>
                <p>• Draw the word on the canvas using colors and tool options to help others guess.</p>
                <p>• <strong>Rule:</strong> Do NOT write letters or words on the canvas. Earn points when other players successfully guess your drawing!</p>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-sky-400 block mb-1">Match End:</strong>
                <p>• The game goes on for the configured number of rounds.</p>
                <p>• The player with the highest total score at the end wins the match!</p>
              </div>
            </div>

            <button 
              onClick={() => setShowRulesModal(false)}
              className="mt-6 w-full py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg cursor-pointer"
            >
              Got it!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Clear canvas when round ends / changes
  useEffect(() => {
    if (gameState?.turnState === 'WAITING_FOR_WORD') {
      setClearTrigger(Date.now());
    }
  }, [gameState?.turnState]);

  // Hydration guard
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  if (!isClient || !userId || !nickname) {
    return (
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
      </div>
    );
  }

  // LOBBY VIEW
  if (lobby) {
    const isHost = lobby.hostId === userId;
    const isReady = lobby.players.find(p => p.userId === userId)?.isReady || isHost;
    
    return (
      <div className="flex flex-col h-screen bg-black text-white">
        {/* Global Header Navbar */}
        <div className="flex items-center justify-between p-3 sm:p-4 bg-white/5 border-b border-white/10 flex-shrink-0 gap-2 flex-wrap">
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
                🎨 Scribble Lobby
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
              onClick={async () => {
                const url = `${window.location.origin}/dashboard/games/scribble?gameId=${lobby.id}`;
                const success = await copyToClipboard(url);
                if (success) {
                  setInviteCopied(true);
                  setTimeout(() => setInviteCopied(false), 2000);
                }
              }}
              className="px-3 sm:px-4 py-2 bg-sky-500/20 hover:bg-sky-500/35 text-sky-400 rounded-full text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              {inviteCopied ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span className="hidden sm:inline">{inviteCopied ? "Copied!" : "Invite Link"}</span>
            </button>
            <button onClick={handleLeave} className="px-3 sm:px-4 py-2 bg-rose-500/20 hover:bg-rose-500/35 text-rose-400 rounded-full text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 max-w-4xl mx-auto w-full">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassCard className="p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="text-sky-400" /> Players ({lobby.players.length}/12)
            </h2>
            <div className="space-y-2 mb-6">
              {lobby.players.map(p => (
                <div key={p.userId} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{p.nickname}</span>
                    {p.role === 'HOST' && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">HOST</span>}
                  </div>
                  {p.role !== 'HOST' && (
                    <span className={`text-xs font-bold px-2 py-1 rounded ${p.isReady ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {p.isReady ? 'READY' : 'NOT READY'}
                    </span>
                  )}
                </div>
              ))}
            </div>
            
            {!isHost && (
              <button
                onClick={() => toggleReady(lobby.id, userId, !isReady)}
                className={`w-full py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                  isReady ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/25' : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25'
                }`}
              >
                {isReady ? <><X className="w-5 h-5"/> Cancel Ready</> : <><Check className="w-5 h-5"/> Ready Up</>}
              </button>
            )}
            
            {isHost && (
              <button
                onClick={() => startGame(lobby.id, userId)}
                disabled={lobby.players.length < 2 || !lobby.players.every(p => p.role === 'HOST' || p.isReady)}
                className="w-full py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" /> Start Game
              </button>
            )}
          </GlassCard>

          <GlassCard className="p-6">
             <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="text-sky-400" /> Settings
            </h2>
            <div className="space-y-4">
               <div>
                  <label className="text-sm text-gray-400 block mb-1">Rounds</label>
                  <select 
                    disabled={!isHost}
                    value={rounds}
                    onChange={(e) => {
                      const r = Number(e.target.value);
                      setRounds(r);
                      updateSettings(lobby.id, userId, { rounds: r, drawingTime });
                    }}
                    className="w-full bg-white/10 border border-white/10 rounded-lg p-2 text-white outline-none disabled:opacity-50"
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(r => <option key={r} value={r} className="bg-neutral-800">{r} Rounds</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-sm text-gray-400 block mb-1">Drawing Time (Seconds)</label>
                  <select 
                    disabled={!isHost}
                    value={drawingTime}
                    onChange={(e) => {
                      const t = Number(e.target.value);
                      setDrawingTime(t);
                      updateSettings(lobby.id, userId, { rounds, drawingTime: t });
                    }}
                    className="w-full bg-white/10 border border-white/10 rounded-lg p-2 text-white outline-none disabled:opacity-50"
                  >
                    {[30, 45, 60, 90, 120].map(t => <option key={t} value={t} className="bg-neutral-800">{t}s</option>)}
                  </select>
               </div>
             </div>

             {/* Invite lists section */}
             <div className="flex flex-col space-y-4 mt-6 pt-6 border-t border-white/10">
               <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                 <UserPlus className="w-5 h-5 text-sky-400" />
                 Invite Players
               </h2>

               <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3 pr-2 custom-scrollbar">
                 {onlineUsers.length > 0 ? (
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
                               <div>
                                 <span className="font-medium block leading-tight text-white">{u.nickname}</span>
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
                                   ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 cursor-not-allowed'
                                   : 'bg-sky-500 hover:bg-sky-600 text-white cursor-pointer'
                               }`}
                             >
                               {status.label}
                             </button>
                           </div>
                         );
                       })}
                   </div>
                 ) : (
                   <div className="text-sm text-gray-500 text-center py-4">No other users online</div>
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

  // ACTIVE GAME VIEW
  if (gameState) {
    const isDrawer = gameState.currentDrawerId === userId;
    const isHost = gameState.players.find(p => p.userId === userId)?.role === 'HOST';

    if (gameState.status === 'FINISHED') {
      return (
        <div className="flex-1 w-full h-full overflow-y-auto custom-scrollbar pt-8">
          <EndGameScreen 
            gameState={gameState}
            isHost={isHost || false}
            onPlayAgain={() => {
              const state = useScribbleStore.getState();
              state.playAgain(gameState.gameId, userId);
            }}
            onLeave={handleLeave}
          />
        </div>
      );
    }

    const isMyTurn = isDrawer && (gameState.turnState === 'DRAWING' || gameState.turnState === 'WAITING_FOR_WORD');

    return (
      <div className="flex flex-col h-auto lg:h-screen w-full p-2 md:p-4 pb-4 lg:pb-6 max-w-[1600px] mx-auto gap-4 overflow-y-auto lg:overflow-hidden relative">
        <TurnIndicator isMyTurn={isMyTurn} />
        {/* Top Header */}
        <div className="flex flex-wrap md:flex-nowrap justify-between items-center bg-white/5 border border-white/10 rounded-2xl p-2.5 sm:p-3 backdrop-blur-md gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap shrink-0">
             <div className="text-center px-2 sm:px-4 py-1 bg-black/20 rounded-lg border border-white/5 flex flex-col items-center">
                <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Round</div>
                <div className="font-bold text-white text-xs sm:text-base leading-tight">{gameState.currentRound} / {gameState.totalRounds}</div>
             </div>
             <div className="text-center px-2 sm:px-4 py-1.5 sm:py-2 bg-black/20 rounded-lg border border-white/5 flex items-center gap-1.5 sm:gap-2">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 shrink-0" />
                <div className="font-bold text-white text-base sm:text-xl w-6 sm:w-8 text-center">{gameState.drawingTimeLeft}</div>
             </div>
          </div>
          
          <div className="flex-1 flex justify-center min-w-[120px] order-3 md:order-none w-full md:w-auto mt-2 md:mt-0">
            {gameState.turnState === 'ROUND_END' ? (
              <div className="text-sm sm:text-2xl font-bold text-emerald-400 tracking-[0.1em] sm:tracking-[0.2em] uppercase bg-emerald-500/20 px-4 sm:px-6 py-1.5 sm:py-2 rounded-xl text-center w-full md:w-auto truncate">
                 {gameState.word}
              </div>
            ) : (
              <div className="text-lg sm:text-3xl font-mono font-bold tracking-[0.1em] sm:tracking-[0.3em] text-white flex items-center justify-center gap-2 sm:gap-4 w-full md:w-auto">
                {isDrawer && hideWord ? (
                  <span className="opacity-30 tracking-[0.2em] sm:tracking-[0.5em] truncate">{(gameState.word || '').replace(/[a-zA-Z]/g, '*')}</span>
                ) : (
                  <span className="truncate">{gameState.word}</span>
                )}
                {isDrawer && gameState.turnState === 'DRAWING' && (
                  <button 
                    onClick={() => setHideWord(!hideWord)} 
                    className="p-1.5 sm:p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white shrink-0"
                    title={hideWord ? "Show word" : "Hide word"}
                  >
                    {hideWord ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                )}
              </div>
            )}
          </div>
          
          <button onClick={handleLeave} className="px-2.5 sm:px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition-colors text-xs sm:text-sm font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            <LogOut className="w-3.5 h-3.5 sm:hidden shrink-0" /> <span className="hidden sm:inline">Leave Game</span>
          </button>
        </div>

        {/* Main Game Area */}
        <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[calc(100vh-200px)] min-h-0 lg:min-h-[600px]">
          
          {/* Left: Player List */}
          <div className="w-full lg:w-64 flex flex-col gap-4 flex-shrink-0">
            <PlayerList />
          </div>

          {/* Center: Canvas & Tools */}
          <div className="flex-1 flex flex-col gap-4 relative min-w-0">
             <WordSelectionModal />
             
             <div className="h-[320px] lg:h-auto lg:flex-1 border-4 border-white/10 rounded-2xl overflow-hidden relative shadow-2xl flex-shrink-0">
                <ScribbleCanvas 
                  isDrawer={isDrawer}
                  gameId={gameState.gameId}
                  selectedColor={selectedColor}
                  selectedSize={selectedSize}
                  selectedTool={selectedTool}
                  clearTrigger={clearTrigger}
                  onClear={() => setClearTrigger(Date.now())}
                  undoTrigger={undoTrigger}
                  redoTrigger={redoTrigger}
                  setCanUndo={setCanUndo}
                  setCanRedo={setCanRedo}
                />
             </div>
             
             <div className="h-20 shrink-0">
               <DrawingTools 
                  isDrawer={isDrawer}
                  selectedColor={selectedColor}
                  setSelectedColor={setSelectedColor}
                  selectedSize={selectedSize}
                  setSelectedSize={setSelectedSize}
                  selectedTool={selectedTool}
                  setSelectedTool={setSelectedTool}
                  onClear={() => {
                    const socket = socketService.getSocket();
                    socket.emit('game_action', { gameId: gameState.gameId, userId, action: 'clear_canvas' });
                    setClearTrigger(Date.now());
                  }}
                  onUndo={() => {
                    const socket = socketService.getSocket();
                    socket.emit('game_action', { gameId: gameState.gameId, userId, action: 'undo' });
                    setUndoTrigger(Date.now());
                  }}
                  onRedo={() => {
                    const socket = socketService.getSocket();
                    socket.emit('game_action', { gameId: gameState.gameId, userId, action: 'redo' });
                    setRedoTrigger(Date.now());
                  }}
                  canUndo={canUndo}
                  canRedo={canRedo}
               />
             </div>
          </div>

          {/* Right: Guess Chat */}
          <div className="w-full lg:w-80 flex flex-col h-full">
            <GuessChat gameId={gameState.gameId} isDrawer={isDrawer} />
          </div>

        </div>
      </div>
    );
  }

  // NO LOBBY, NO GAME - Default entry screen
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
          <div className="ml-2 border-l border-white/20 pl-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              🎨 Scribble
            </h1>
          </div>
        </div>
        <div>
          <button 
            onClick={() => setShowRulesModal(true)}
            className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full text-sm font-bold flex items-center gap-2 transition-colors hover:bg-white/10 cursor-pointer"
          >
            <BookOpen className="w-4 h-4" /> Rules
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 max-w-4xl mx-auto w-full flex flex-col items-center justify-start md:justify-center gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center shadow-2xl shadow-sky-500/20 mx-auto mb-6">
             <span className="text-5xl">🎨</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-500 tracking-tight mb-4">
            Scribble
          </h1>
          <p className="text-gray-400 max-w-md mx-auto text-lg">
            Draw, guess, and laugh with friends in this fast-paced multiplayer party game!
          </p>
        </motion.div>

        <GlassCard className="p-8 w-full max-w-md text-center border-sky-500/20 shadow-xl shadow-sky-500/10">
          <button
            onClick={handleCreateLobby}
            className="w-full py-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center gap-3 text-lg cursor-pointer"
          >
            <UserPlus className="w-6 h-6" /> Create Private Lobby
          </button>
        </GlassCard>

        {/* Public Lobbies */}
        {availableLobbies.length > 0 && (
          <div className="w-full max-w-4xl mt-12">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 justify-center">
              <Users className="w-5 h-5 text-sky-400" /> Public Lobbies
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableLobbies.map(l => (
                <GlassCard key={l.id} className="p-4 flex items-center justify-between border-sky-500/20 hover:border-sky-500/50 transition-colors">
                  <div>
                    <h3 className="font-bold text-white text-lg">{l.hostName}'s Game</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                      <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {l.playerCount}/{l.maxPlayers}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => joinLobby(l.id, userId, nickname || "Player")}
                    className="px-6 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    Join
                  </button>
                </GlassCard>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rules Modal */}
      {rulesModal}
    </div>
  );
}

export default function ScribbleGamePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    }>
      <ScribbleGameContent />
    </Suspense>
  );
}
