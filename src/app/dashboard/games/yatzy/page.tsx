"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Play, UserPlus, LogOut, Loader2, Check, X,
  MessageSquare, Award, ArrowLeft, Globe,
  Trophy, Crown, RefreshCw, Lock, Sparkles, ChevronRight, BookOpen
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useRoomConnectionStore } from "@/store/useRoomConnectionStore";
import { useVoiceStore } from "@/store/useVoiceStore";
import { useYatzyStore, YatzyPlayerState } from "@/store/useYatzyStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { ChatArea } from "@/components/room/ChatArea";
import { MessageInput } from "@/components/room/MessageInput";
import { TurnIndicator } from "@/components/games/TurnIndicator";
import { useExitWarning } from "@/hooks/useExitWarning";

// 3D-Style Dice Dot Rendering Positions
const DICE_DOTS: Record<number, number[][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

// Player colors preset mapping
const PLAYER_COLOR_CLASSES = [
  { text: 'text-rose-400', border: 'border-rose-500/40', bg: 'bg-rose-500/10', glow: 'shadow-[0_0_15px_rgba(244,63,94,0.35)]' },
  { text: 'text-sky-400', border: 'border-sky-500/40', bg: 'bg-sky-500/10', glow: 'shadow-[0_0_15px_rgba(14,165,233,0.35)]' },
  { text: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.35)]' },
  { text: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.35)]' },
  { text: 'text-violet-400', border: 'border-violet-500/40', bg: 'bg-violet-500/10', glow: 'shadow-[0_0_15px_rgba(139,92,246,0.35)]' },
  { text: 'text-orange-400', border: 'border-orange-500/40', bg: 'bg-orange-500/10', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.35)]' },
  { text: 'text-teal-400', border: 'border-teal-500/40', bg: 'bg-teal-500/10', glow: 'shadow-[0_0_15px_rgba(20,184,166,0.35)]' },
  { text: 'text-fuchsia-400', border: 'border-fuchsia-500/40', bg: 'bg-fuchsia-500/10', glow: 'shadow-[0_0_15px_rgba(217,70,239,0.35)]' },
];

function getColorIndex(players: { userId: string }[], playerId: string): number {
  const idx = players.findIndex(p => p.userId === playerId);
  return idx >= 0 ? idx % PLAYER_COLOR_CLASSES.length : 0;
}

// Categories list & metadata
const UPPER_CATEGORIES = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
const LOWER_CATEGORIES = ['one_pair', 'two_pair', 'three_of_a_kind', 'four_of_a_kind', 'full_house', 'small_straight', 'large_straight', 'chance', 'yatzy'];
const ALL_CATEGORIES = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES];

const CATEGORY_ICONS: Record<string, string> = {
  ones: '⚀', twos: '⚁', threes: '⚂', fours: '⚃', fives: '⚄', sixes: '⚅',
  one_pair: '🎲🎲', two_pair: '🎲🎲🎲🎲', three_of_a_kind: '🎲🎲🎲', four_of_a_kind: '🎲🎲🎲🎲',
  full_house: '🏠', small_straight: '➡', large_straight: '➡➡', chance: '🎯', yatzy: '⭐'
};

const CATEGORY_NAMES: Record<string, string> = {
  ones: 'Ones', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes',
  one_pair: 'One Pair', two_pair: 'Two Pair', three_of_a_kind: '3 of a Kind', four_of_a_kind: '4 of a Kind',
  full_house: 'Full House', small_straight: 'Small Straight', large_straight: 'Large Straight', chance: 'Chance', yatzy: 'Yatzy'
};

// Animated Number Counter Component
function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;
    const duration = 400; // ms
    const startTime = performance.now();

    let frameId: number;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress * (2 - progress);
      const current = Math.round(start + (end - start) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return <span>{displayValue}</span>;
}

// Recommended Category Selector Helper
function getRecommendedCategory(
  possibleScores: Record<string, number> | null,
  scoreSheet: Record<string, number | null>
): string | null {
  if (!possibleScores) return null;
  
  if (possibleScores['yatzy'] === 50 && scoreSheet['yatzy'] === null) return 'yatzy';
  if (possibleScores['large_straight'] === 20 && scoreSheet['large_straight'] === null) return 'large_straight';
  if (possibleScores['full_house'] > 0 && scoreSheet['full_house'] === null) return 'full_house';
  if (possibleScores['small_straight'] === 15 && scoreSheet['small_straight'] === null) return 'small_straight';

  let bestCat: string | null = null;
  let maxScore = -1;

  for (const cat of ALL_CATEGORIES) {
    if (scoreSheet[cat] === null) {
      const score = possibleScores[cat] || 0;
      if (score > maxScore) {
        maxScore = score;
        bestCat = cat;
      }
    }
  }

  return maxScore > 0 ? bestCat : null;
}

// ========== 3D STYLE DICE COMPONENT ==========
interface DiceProps {
  value: number;
  isHeld: boolean;
  isRolling: boolean;
  onClick: () => void;
  disabled: boolean;
}

function Dice3D({ value, isHeld, isRolling, onClick, disabled }: DiceProps) {
  const dots = DICE_DOTS[value] || [];

  return (
    <motion.div
      onClick={disabled ? undefined : onClick}
      whileHover={disabled ? {} : { scale: 1.05, y: -4 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      animate={isRolling ? {
        rotateX: [0, 360, 720, 1080],
        rotateY: [0, 180, 540, 900],
        rotateZ: [0, 90, 270, 360],
        y: [0, -35, 10, -15, 0],
        scale: [1, 1.25, 0.9, 1.1, 1],
      } : isHeld ? { y: -8 } : { y: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl cursor-pointer select-none transition-all duration-300 ${
        isHeld
          ? 'bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
          : 'bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.4)] hover:border-neutral-500/50'
      } ${disabled ? 'cursor-default opacity-85' : ''}`}
    >
      <div className="absolute inset-0.5 rounded-lg bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

      <svg viewBox="0 0 100 100" className="w-full h-full p-2">
        {dots.map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={8.5}
            fill={isHeld ? '#171717' : '#f59e0b'}
            className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
          />
        ))}
      </svg>

      {isHeld && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-amber-500 text-[7px] font-black text-black px-1 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5 shadow-md border border-amber-300/40">
          <Lock className="w-2 h-2" /> Held
        </div>
      )}
    </motion.div>
  );
}

// ========== MOBILE SCORE SHEET CARD COMPONENT ==========
interface MobileCategoryCardProps {
  category: string;
  score: number | null;
  possible: number | null;
  isRec: boolean;
  canSelect: boolean;
  onSelect: () => void;
}

function MobileCategoryCard({ category, score, possible, isRec, canSelect, onSelect }: MobileCategoryCardProps) {
  const isCompleted = score !== null && score !== undefined;

  return (
    <button
      onClick={canSelect ? onSelect : undefined}
      disabled={!canSelect}
      className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
        isCompleted
          ? 'bg-emerald-950/15 border-emerald-500/20 text-emerald-400/90'
          : canSelect
            ? isRec
              ? 'bg-amber-500/10 border-amber-400/40 text-white shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse'
              : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-white'
            : 'bg-neutral-950/40 border-neutral-900/80 text-neutral-600'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Dot indicator */}
        {isCompleted ? (
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        ) : canSelect && possible !== null ? (
          <div className={`w-2.5 h-2.5 rounded-full ${possible > 0 ? 'bg-emerald-500' : 'bg-neutral-700'}`} />
        ) : (
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-800" />
        )}

        <span className="text-base bg-neutral-950 w-7 h-7 rounded-lg flex items-center justify-center border border-neutral-900/80 text-neutral-400">
          {CATEGORY_ICONS[category]}
        </span>
        
        <div>
          <div className={`text-sm font-bold ${isCompleted ? 'text-emerald-400' : 'text-neutral-200'}`}>
            {CATEGORY_NAMES[category]}
          </div>
          {!isCompleted && canSelect && isRec && (
            <span className="text-[9px] font-black bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded-md uppercase tracking-wider">
              ⭐ Best Option
            </span>
          )}
        </div>
      </div>

      <div className="font-black text-sm">
        {isCompleted ? (
          <span className="text-emerald-400 text-base">{score} pts</span>
        ) : canSelect && possible !== null ? (
          <span className={isRec ? 'text-amber-300 text-base' : 'text-neutral-300'}>
            +{possible}
          </span>
        ) : (
          <span className="text-neutral-800 font-normal">—</span>
        )}
      </div>
    </button>
  );
}

// ========== MAIN PAGE CONTAINER ==========
function YatzyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get("gameId");

  const { id: userId, nickname } = useUserStore();
  const { currentRoomId } = useRoomConnectionStore();
  const { connectedChannelId, isMuted, toggleMute, disconnect: disconnectVoice } = useVoiceStore();

  const {
    lobby, gameState, error, availableLobbies,
    createLobby, joinLobby, toggleReady, kickPlayer, leaveLobby,
    invitePlayer, updateLobbySettings, startGame,
    rollDice, holdDice, selectCategory,
    clearState, setupListeners, fetchLobbies
  } = useYatzyStore();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());
  const [rollingDice, setRollingDice] = useState(false);

  // Redesign: Mobile layout modal states
  const [confirmCategory, setConfirmCategory] = useState<string | null>(null);
  const [selectedScorecardPlayer, setSelectedScorecardPlayer] = useState<YatzyPlayerState | null>(null);
  const [showFullComparisonModal, setShowFullComparisonModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

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
      const state = useYatzyStore.getState();
      const currentGameId = state.lobby?.id || state.gameState?.gameId;
      const currentUserId = useUserStore.getState().id;
      if (currentGameId && currentUserId) {
        state.leaveLobby(currentGameId, currentUserId);
      }
    };
  }, []);

  // Fetch online users for invites
  useEffect(() => {
    if (!userId) return;
    const getApiUrl = () => {
      if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
      if (typeof window !== "undefined") return `http://${window.location.hostname}:3001`;
      return "http://localhost:3001";
    };
    fetch(`${getApiUrl()}/api/users/online`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setOnlineUsers(data.filter(u => u.id !== userId));
    }).catch(() => {});

    if (currentRoomId) {
      fetch(`${getApiUrl()}/api/rooms/${currentRoomId}/members`).then(r => r.json()).then(data => {
        if (Array.isArray(data)) setRoomMembers(data.filter(u => u.id !== userId));
      }).catch(() => {});
    }

    fetchLobbies();
  }, [userId, currentRoomId, lobby?.id]);

  const handleCreateLobby = () => {
    if (!userId || !nickname) return;
    createLobby(userId, nickname);
  };

  const handleLeave = () => {
    bypassWarning();
    const currentGameId = lobby?.id || gameState?.gameId;
    if (currentGameId && userId) {
      leaveLobby(currentGameId, userId);
    }
    router.push("/dashboard/games");
  };

  const sendInvite = (targetId: string) => {
    const activeGameId = gameState?.gameId || lobby?.id;
    if (!activeGameId || !userId || !nickname) return;
    invitePlayer(activeGameId, userId, nickname, targetId);
    setInvitedUsers(prev => new Set(prev).add(targetId));
  };

  const handleRoll = () => {
    if (!gameState || !userId) return;
    setRollingDice(true);
    rollDice(gameState.gameId, userId);
    setTimeout(() => setRollingDice(false), 600);
  };

  const handleHold = (diceIndex: number) => {
    if (!gameState || !userId) return;
    holdDice(gameState.gameId, userId, diceIndex);
  };

  const handleSelectCategory = (category: string) => {
    if (!gameState || !userId) return;
    selectCategory(gameState.gameId, userId, category);
  };

  // Helper to trigger confirmation modal on mobile
  const handleSelectWithConfirmation = (category: string) => {
    setConfirmCategory(category);
  };

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  if (!isClient || !userId || !nickname) {
    return (
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
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
              <h2 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-amber-500" /> Yatzy Rules</h2>
              <button onClick={() => setShowRulesModal(false)} className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-md transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
              <p><strong className="text-white">Goal:</strong> Score the highest total points by filling all 15 categories on your score sheet.</p>
              
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-amber-400 block mb-1">On Your Turn:</strong>
                <p>1. Roll all 5 dice to start your turn.</p>
                <p>2. Select which dice to <strong>Hold</strong> (lock) and roll the rest. You can roll up to 3 times total per turn.</p>
                <p>3. Choose an empty category row on the score sheet to lock in your score for this turn.</p>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-amber-400 block mb-1">Scoring Sections:</strong>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Upper Section (Ones to Sixes):</strong> Scores the sum of dice with that rank. Get 63+ total points here to score a <strong>+50 Bonus</strong>!</li>
                  <li><strong>Pairs & Kind:</strong> Score points for having duplicates (One Pair, Two Pairs, Three of a Kind, Four of a Kind).</li>
                  <li><strong>Special combos:</strong> Full House (25 pts), Small Straight (15 pts), Large Straight (20 pts), Chance (sum of all dice), and Yatzy (5 of a kind - 50 pts!).</li>
                </ul>
              </div>
            </div>

            <button 
              onClick={() => setShowRulesModal(false)}
              className="mt-6 w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-500/25"
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
    const yatzyLobbies = availableLobbies.filter(l => l.gameType === 'YATZY');
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
                🎲 Yatzy
              </h1>
            </div>
          </div>
          <button 
            onClick={() => setShowRulesModal(true)}
            className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-xl flex items-center gap-2 transition-colors text-sm font-semibold hover:bg-white/10 animate-pulse"
          >
            <BookOpen className="w-4 h-4" /> Rules
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-6">
            <GlassCard className="p-8 text-center border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.05)]">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-500 to-red-600 rounded-3xl flex items-center justify-center text-4xl mb-4 shadow-lg shadow-amber-500/10">
                🎲
              </div>
              <h2 className="text-2xl font-bold mb-2">Yatzy</h2>
              <p className="text-gray-400 mb-6">Roll the dice, fill your score sheet, and outscore your opponents!</p>
              <button
                onClick={handleCreateLobby}
                className="px-8 py-3 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 rounded-full font-bold text-white shadow-lg hover:shadow-amber-500/30 transition-all hover:scale-105 active:scale-95"
              >
                <Play className="w-5 h-5 inline mr-2" /> Create Lobby
              </button>
            </GlassCard>

            {yatzyLobbies.length > 0 && (
              <GlassCard className="p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-amber-400" /> Open Lobbies
                </h3>
                <div className="space-y-3">
                  {yatzyLobbies.map(l => (
                    <div key={l.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                      <div>
                        <div className="font-bold text-sm">{l.hostName}&apos;s Lobby</div>
                        <div className="text-xs text-gray-400">{l.playerCount}/{l.maxPlayers} players</div>
                      </div>
                      <button
                        onClick={() => joinLobby(l.id, userId, nickname)}
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-full text-sm font-bold transition-colors"
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
              🎲 Yatzy Lobby
            </h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowRulesModal(true)}
              className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full text-sm font-bold flex items-center gap-2 transition-colors hover:bg-white/10 animate-pulse"
            >
              <BookOpen className="w-4 h-4" /> Rules
            </button>
            <button onClick={() => setShowInviteModal(true)} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-full text-sm font-bold flex items-center gap-2 transition-colors">
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
              <Users className="w-5 h-5 text-amber-400" /> Players ({players.length}/8)
            </h2>
            <div className="space-y-3 mb-6">
              {players.map(p => (
                <div key={p.userId} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center text-xs font-bold">
                      {p.nickname?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="font-bold text-sm">{p.nickname}</span>
                    {p.role === 'HOST' && <span className="text-[10px] bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full font-bold">HOST</span>}
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

            {isHost && (
              <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  🎲 Game Settings
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Upper Bonus Threshold</span>
                  <select
                    value={lobby.settings?.bonusThreshold || 63}
                    onChange={(e) => updateLobbySettings(lobby.id, userId, { bonusThreshold: parseInt(e.target.value) })}
                    className="bg-black border border-white/20 rounded px-2 py-1 text-sm outline-none focus:border-amber-500"
                  >
                    <option value={63}>63 (Standard)</option>
                    <option value={42}>42 (Easy)</option>
                    <option value={84}>84 (Hard)</option>
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
                      ? 'bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 hover:scale-105 active:scale-95'
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
                        invitedUsers.has(user.id) ? 'bg-green-600/30 text-green-400 cursor-default' : 'bg-amber-600 hover:bg-amber-500'
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
    
    const sortedPlayers = [...gameState.players].sort((a, b) => b.grandTotal - a.grandTotal);
    
    // Custom recommendation engine lookup
    const myPlayerState = gameState.players.find(p => p.userId === userId);
    const mySheet = myPlayerState?.scoreSheet || {};
    const recommendedCategory = isMyTurn ? getRecommendedCategory(gameState.possibleScores, mySheet) : null;

    // Compile end-game statistics
    const mostYatzysCount = Math.max(...gameState.players.map(p => p.scoreSheet['yatzy'] === 50 ? 1 : 0));
    const mostYatzysPlayers = gameState.players.filter(p => (p.scoreSheet['yatzy'] === 50 ? 1 : 0) === mostYatzysCount && mostYatzysCount > 0);

    const highestTurnVal = Math.max(...gameState.players.map(p => Math.max(...Object.values(p.scoreSheet).map(s => s || 0))));
    const highestTurnPlayers = gameState.players.filter(p => Object.values(p.scoreSheet).some(s => s === highestTurnVal));

    // Shared Score Sheet rendering (For desktop panel and full comparison modal)
    const renderScoreSheetMatrix = (isModal = false) => {
      return (
        <div className={`${isModal ? 'min-w-[600px] p-2' : 'min-w-[650px] p-4 md:p-6'} bg-neutral-950/80 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-2xl relative`}>
          
          {/* Table Header */}
          <div className="grid grid-cols-12 bg-neutral-900/60 border-b border-neutral-800 text-xs font-black uppercase tracking-wider text-neutral-400 select-none sticky top-0 backdrop-blur-md z-10">
            <div className="col-span-4 p-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" /> Scoring Category
            </div>
            
            <div className="col-span-8 grid" style={{ gridTemplateColumns: `repeat(${gameState.players.length}, minmax(0, 1fr))` }}>
              {gameState.players.map((p) => {
                const isActive = p.userId === gameState.currentTurnPlayerId;
                const isMe = p.userId === userId;
                const colors = PLAYER_COLOR_CLASSES[getColorIndex(gameState.players, p.userId)];
                
                return (
                  <div
                    key={p.userId}
                    className={`p-3 text-center border-l border-neutral-800/60 flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
                      isActive ? 'bg-blue-600/15 text-blue-400 font-extrabold relative shadow-[inset_0_-2px_0_#2563eb]' : 'opacity-65'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${colors.text} bg-neutral-800 border ${colors.border} flex items-center justify-center text-[10px] font-black`}>
                      {p.nickname?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="truncate max-w-[80px] font-bold mt-0.5">{p.nickname}</span>
                    {isMe && <span className="text-[8px] bg-neutral-800 text-neutral-400 px-1 rounded-sm">You</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table Matrix rows */}
          <div className="divide-y divide-neutral-900">
            
            {/* ====== UPPER SECTION ====== */}
            <div className="bg-neutral-900/20 py-1.5 px-4 text-[9px] font-black uppercase tracking-widest text-amber-500/80 sticky left-0 select-none">
              Upper Section (Aces to Sixes)
            </div>

            {UPPER_CATEGORIES.map(cat => {
              const isRec = cat === recommendedCategory;
              return (
                <div key={cat} className="grid grid-cols-12 hover:bg-neutral-900/20 transition-colors border-b border-neutral-900/60">
                  <div className="col-span-4 p-3.5 flex items-center gap-3">
                    <span className="text-lg bg-neutral-900 w-8 h-8 rounded-lg flex items-center justify-center border border-neutral-800/40 text-neutral-300">
                      {CATEGORY_ICONS[cat]}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-neutral-200">{CATEGORY_NAMES[cat]}</div>
                      <div className="text-[10px] text-neutral-500">Sum of matching dice</div>
                    </div>
                    {isRec && (
                      <span className="text-[8px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        <Sparkles className="w-2.5 h-2.5" /> Best
                      </span>
                    )}
                  </div>

                  <div className="col-span-8 grid" style={{ gridTemplateColumns: `repeat(${gameState.players.length}, minmax(0, 1fr))` }}>
                    {gameState.players.map(p => {
                      const isTurn = p.userId === gameState.currentTurnPlayerId;
                      const isMe = p.userId === userId;
                      const val = p.scoreSheet[cat];
                      const isCompleted = val !== null && val !== undefined;
                      
                      const possible = isTurn && isMe && gameState.possibleScores ? gameState.possibleScores[cat] : null;
                      const canSelect = isTurn && isMe && !isCompleted && gameState.hasRolled && gameState.status === 'PLAYING';

                      return (
                        <div
                          key={p.userId}
                          onClick={() => canSelect && handleSelectWithConfirmation(cat)}
                          className={`border-l border-neutral-800/60 flex items-center justify-center p-2 font-black transition-all ${
                            isTurn ? 'bg-blue-600/5' : ''
                          } ${canSelect ? 'cursor-pointer hover:bg-amber-500/10' : ''}`}
                        >
                          {isCompleted ? (
                            <div className="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs shadow-md">
                              {val}
                            </div>
                          ) : canSelect && possible !== null ? (
                            <div className={`px-3 py-1 rounded-lg text-xs font-black transition-transform scale-95 border ${
                              isRec
                                ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)] animate-pulse'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700/50 hover:border-neutral-500'
                            }`}>
                              {possible}
                            </div>
                          ) : (
                            <span className="text-neutral-800 font-normal">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* UPPER TOTAL & BONUS */}
            <div className="grid grid-cols-12 bg-neutral-900/35 border-y border-neutral-800 select-none">
              <div className="col-span-4 p-3.5 font-bold text-xs text-neutral-300 flex items-center gap-2">
                <span>Subtotal (Upper)</span>
              </div>
              <div className="col-span-8 grid" style={{ gridTemplateColumns: `repeat(${gameState.players.length}, minmax(0, 1fr))` }}>
                {gameState.players.map(p => (
                  <div key={p.userId} className="border-l border-neutral-800/60 flex items-center justify-center font-extrabold text-sm text-neutral-300">
                    <AnimatedNumber value={p.upperTotal} />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-12 bg-neutral-900/35 border-b border-neutral-800 select-none">
              <div className="col-span-4 p-3.5 font-bold text-xs text-neutral-300 flex items-center justify-between pr-6">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Upper Section Bonus (+50)
                </span>
                <span className="text-[9px] text-neutral-500 font-bold uppercase">Needs {gameState.bonusThreshold}</span>
              </div>
              <div className="col-span-8 grid" style={{ gridTemplateColumns: `repeat(${gameState.players.length}, minmax(0, 1fr))` }}>
                {gameState.players.map(p => {
                  const hasBonus = p.bonus > 0;
                  return (
                    <div key={p.userId} className={`border-l border-neutral-800/60 flex items-center justify-center font-extrabold text-sm ${
                      hasBonus ? 'text-amber-400 bg-amber-500/5' : 'text-neutral-600'
                    }`}>
                      {hasBonus ? '+50' : '0'}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ====== LOWER SECTION ====== */}
            <div className="bg-neutral-900/20 py-1.5 px-4 text-[9px] font-black uppercase tracking-widest text-amber-500/80 sticky left-0 select-none">
              Lower Section (Combinations & Yatzy)
            </div>

            {LOWER_CATEGORIES.map(cat => {
              const isRec = cat === recommendedCategory;
              return (
                <div key={cat} className="grid grid-cols-12 hover:bg-neutral-900/20 transition-colors border-b border-neutral-900/60">
                  <div className="col-span-4 p-3.5 flex items-center gap-3">
                    <span className="text-lg bg-neutral-900 w-8 h-8 rounded-lg flex items-center justify-center border border-neutral-800/40 text-neutral-300">
                      {CATEGORY_ICONS[cat]}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-neutral-200">{CATEGORY_NAMES[cat]}</div>
                      <div className="text-[10px] text-neutral-500">
                        {cat === 'one_pair' && 'Two of same rank'}
                        {cat === 'two_pair' && 'Two different pairs'}
                        {cat === 'three_of_a_kind' && 'Three matching dice'}
                        {cat === 'four_of_a_kind' && 'Four matching dice'}
                        {cat === 'full_house' && 'Three of a kind + Pair'}
                        {cat === 'small_straight' && 'Consecutive 1-2-3-4-5'}
                        {cat === 'large_straight' && 'Consecutive 2-3-4-5-6'}
                        {cat === 'chance' && 'Sum of all 5 dice'}
                        {cat === 'yatzy' && 'Five matching dice (50 pts)'}
                      </div>
                    </div>
                    {isRec && (
                      <span className="text-[8px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        <Sparkles className="w-2.5 h-2.5" /> Best
                      </span>
                    )}
                  </div>

                  <div className="col-span-8 grid" style={{ gridTemplateColumns: `repeat(${gameState.players.length}, minmax(0, 1fr))` }}>
                    {gameState.players.map(p => {
                      const isTurn = p.userId === gameState.currentTurnPlayerId;
                      const isMe = p.userId === userId;
                      const val = p.scoreSheet[cat];
                      const isCompleted = val !== null && val !== undefined;
                      
                      const possible = isTurn && isMe && gameState.possibleScores ? gameState.possibleScores[cat] : null;
                      const canSelect = isTurn && isMe && !isCompleted && gameState.hasRolled && gameState.status === 'PLAYING';

                      return (
                        <div
                          key={p.userId}
                          onClick={() => canSelect && handleSelectWithConfirmation(cat)}
                          className={`border-l border-neutral-800/60 flex items-center justify-center p-2 font-black transition-all ${
                            isTurn ? 'bg-blue-600/5' : ''
                          } ${canSelect ? 'cursor-pointer hover:bg-amber-500/10' : ''}`}
                        >
                          {isCompleted ? (
                            <div className="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs shadow-md">
                              {val}
                            </div>
                          ) : canSelect && possible !== null ? (
                            <div className={`px-3 py-1 rounded-lg text-xs font-black transition-transform scale-95 border ${
                              isRec
                                ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)] animate-pulse'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700/50 hover:border-neutral-500'
                            }`}>
                              {possible}
                            </div>
                          ) : (
                            <span className="text-neutral-800 font-normal">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* GRAND TOTALS */}
            <div className="grid grid-cols-12 bg-neutral-900 border-t-2 border-neutral-800 select-none">
              <div className="col-span-4 p-4 font-black text-sm text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" /> Grand Total Score
              </div>
              <div className="col-span-8 grid" style={{ gridTemplateColumns: `repeat(${gameState.players.length}, minmax(0, 1fr))` }}>
                {gameState.players.map(p => {
                  const isActive = p.userId === gameState.currentTurnPlayerId;
                  return (
                    <div
                      key={p.userId}
                      className={`border-l border-neutral-800/60 flex items-center justify-center font-black text-lg transition-colors ${
                        isActive ? 'text-amber-400 bg-amber-500/5' : 'text-neutral-200'
                      }`}
                    >
                      <AnimatedNumber value={p.grandTotal} />
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      );
    };

    return (
      <div className="flex flex-col h-screen bg-black text-white font-sans overflow-hidden">
        <TurnIndicator isMyTurn={isMyTurn} />
        {/* Top Navbar */}
        <div className="flex items-center justify-between p-3 bg-neutral-950 border-b border-neutral-800 flex-shrink-0 z-10 shadow-md">
          <div className="flex items-center gap-3">
            <button onClick={handleLeave} className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-red-500 flex items-center gap-2 select-none">
              🎲 YATZY
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="hidden sm:flex items-center gap-3 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-full text-xs text-neutral-400">
              <span>Round <strong className="text-white">{gameState.currentRound}</strong> / {gameState.totalRounds}</span>
              <span className="w-px h-3 bg-neutral-800" />
              <span>Threshold <strong className="text-amber-400">{gameState.bonusThreshold}</strong></span>
            </div>

            <button
              onClick={() => setShowRulesModal(!showRulesModal)}
              className={`p-2.5 rounded-lg hover:bg-neutral-800 transition-colors relative ${showRulesModal ? 'text-amber-400 bg-neutral-800' : 'text-neutral-400'}`}
              title="Toggle Game Rules"
            >
              <BookOpen className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowChatSidebar(!showChatSidebar)}
              className={`p-2.5 rounded-lg hover:bg-neutral-800 transition-colors relative ${showChatSidebar ? 'text-amber-400 bg-neutral-800' : 'text-neutral-400'}`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
        </div>
        {rulesModal}

        <div className="flex-1 flex overflow-hidden relative">
          
          {/* Collapsible Chat Area */}
          {currentRoomId && showChatSidebar && (
            <div className="w-80 border-r border-neutral-800 bg-neutral-950 flex flex-col flex-shrink-0 absolute lg:relative inset-y-0 left-0 z-20 shadow-2xl lg:shadow-none">
              <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/40">
                <span className="text-sm font-bold tracking-wide flex items-center gap-2 text-neutral-200">
                  <MessageSquare className="w-4 h-4 text-amber-500" /> Room Chat
                </span>
                <button onClick={() => setShowChatSidebar(false)} className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatArea roomId={currentRoomId} />
              </div>
              <MessageInput roomId={currentRoomId} />
            </div>
          )}

          {/* MAIN MOBILE & TABLET LAYOUT (< 1024px) */}
          <div className="flex-1 flex flex-col lg:hidden overflow-hidden bg-gradient-to-b from-neutral-950 via-neutral-900 to-black">
            
            {/* Sticky Dice Area at the Top */}
            <div className="sticky top-0 bg-neutral-950/95 border-b border-neutral-800/80 p-4 z-10 flex flex-col gap-3.5 shadow-lg backdrop-blur-md flex-shrink-0">
              
              {/* Header Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isMyTurn ? 'bg-amber-500 animate-ping' : 'bg-neutral-600'}`} />
                  <span className={`text-xs font-bold truncate max-w-[140px] ${isMyTurn ? 'text-white' : 'text-neutral-400'}`}>
                    {isMyTurn ? 'Your Turn' : `${currentTurnPlayer?.nickname}'s Turn`}
                  </span>
                </div>
                <div className="text-[10px] font-black text-neutral-400 bg-neutral-900 px-2 py-1 rounded-md border border-neutral-800">
                  Rolls Left: <span className="text-amber-400 font-extrabold">{gameState.rollsLeft}</span>
                </div>
              </div>

              {/* 3D Dice Tray */}
              <div className="flex items-center justify-center gap-2.5 max-w-sm mx-auto w-full py-1">
                {gameState.dice.map((val, idx) => (
                  <Dice3D
                    key={idx}
                    value={val}
                    isHeld={gameState.heldDice[idx]}
                    isRolling={rollingDice && !gameState.heldDice[idx]}
                    onClick={() => handleHold(idx)}
                    disabled={!isMyTurn || !gameState.hasRolled || gameState.rollsLeft <= 0 || gameState.status !== 'PLAYING'}
                  />
                ))}
              </div>

              {/* Roll Button */}
              {isMyTurn && gameState.status === 'PLAYING' && (
                <button
                  onClick={handleRoll}
                  disabled={gameState.rollsLeft <= 0}
                  className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    gameState.rollsLeft > 0
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 shadow-lg shadow-blue-500/20 text-white'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/30'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${rollingDice ? 'animate-spin' : ''}`} />
                  Roll Dice ({gameState.rollsLeft})
                </button>
              )}
            </div>

            {/* Horizontal Mini Leaderboard Banner */}
            <div className="bg-neutral-900/60 border-b border-neutral-800/80 px-4 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none flex-shrink-0 select-none">
              <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mr-1">Leaderboard:</span>
              {sortedPlayers.map((p, idx) => {
                const colors = PLAYER_COLOR_CLASSES[getColorIndex(gameState.players, p.userId)];
                const isActive = p.userId === gameState.currentTurnPlayerId;
                return (
                  <button
                    key={p.userId}
                    onClick={() => setSelectedScorecardPlayer(p)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all border ${
                      isActive
                        ? 'bg-blue-600/10 border-blue-500/40 text-blue-400 font-bold'
                        : 'bg-neutral-950/60 border-neutral-800/80 text-neutral-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-blue-400' : 'bg-neutral-600'}`} />
                    <span className="truncate max-w-[60px] font-bold">{p.nickname}</span>
                    <span className="font-black text-[10px] text-amber-400">{p.grandTotal}</span>
                  </button>
                );
              })}
              <button
                onClick={() => setShowFullComparisonModal(true)}
                className="ml-auto flex items-center gap-1 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
              >
                View Sheets
              </button>
            </div>

            {/* Personal Vertical Scorecards Scroll */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {myPlayerState && (
                <div className="space-y-4 max-w-md mx-auto w-full">
                  
                  {/* Upper section card */}
                  <div className="bg-neutral-950/40 border border-neutral-800/80 rounded-3xl p-3">
                    <div className="flex justify-between items-center mb-2 px-1 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                      <span>Upper section</span>
                      <span className="text-amber-500">
                        {myPlayerState.upperTotal}/{gameState.bonusThreshold} {myPlayerState.bonus > 0 ? 'Bonus ✅' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {UPPER_CATEGORIES.map(cat => (
                        <MobileCategoryCard
                          key={cat}
                          category={cat}
                          score={mySheet[cat]}
                          possible={gameState.possibleScores?.[cat] ?? null}
                          isRec={cat === recommendedCategory}
                          canSelect={isMyTurn && mySheet[cat] === null && gameState.hasRolled && gameState.status === 'PLAYING'}
                          onSelect={() => handleSelectWithConfirmation(cat)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Lower section card */}
                  <div className="bg-neutral-950/40 border border-neutral-800/80 rounded-3xl p-3">
                    <div className="mb-2 px-1 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                      <span>Lower section</span>
                    </div>
                    <div className="space-y-2">
                      {LOWER_CATEGORIES.map(cat => (
                        <MobileCategoryCard
                          key={cat}
                          category={cat}
                          score={mySheet[cat]}
                          possible={gameState.possibleScores?.[cat] ?? null}
                          isRec={cat === recommendedCategory}
                          canSelect={isMyTurn && mySheet[cat] === null && gameState.hasRolled && gameState.status === 'PLAYING'}
                          onSelect={() => handleSelectWithConfirmation(cat)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Summary Footer */}
                  <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-4 flex items-center justify-between shadow-lg">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Your Grand Total</span>
                      <span className="text-[10px] text-neutral-400">Upper: {myPlayerState.upperTotal} | Bonus: {myPlayerState.bonus} | Lower: {myPlayerState.lowerTotal}</span>
                    </div>
                    <div className="text-2xl font-black text-amber-400">
                      <AnimatedNumber value={myPlayerState.grandTotal} /> <span className="text-xs text-neutral-500 font-medium">pts</span>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Bottom history logs */}
            <div className="p-3 bg-neutral-950 border-t border-neutral-850 text-[10px] text-neutral-500 text-center italic truncate flex-shrink-0">
              {gameState.historyLogs[gameState.historyLogs.length - 1] || "Game in progress..."}
            </div>
          </div>

          {/* DESKTOP LAYOUT (>= 1024px) */}
          <div className="flex-1 flex-col overflow-hidden bg-gradient-to-b from-neutral-950 via-neutral-900 to-black hidden lg:flex">
            
            {/* Top Interactive Area (Dices, Roll Buttons & Info) */}
            <div className="p-6 border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-md flex items-center justify-between gap-6 flex-shrink-0 shadow-lg">
              
              {/* Turn/Round details */}
              <div className="flex flex-col gap-1 min-w-[200px]">
                <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                  {isMyTurn ? 'YOUR ACTION' : 'WAITING FOR OPONENT'}
                </div>
                <div className="text-xl font-bold flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full ${isMyTurn ? 'bg-amber-500 animate-ping' : 'bg-neutral-600'}`} />
                  <span className={isMyTurn ? 'text-white' : 'text-neutral-400'}>
                    {isMyTurn ? 'Your Turn' : `${currentTurnPlayer?.nickname}'s Turn`}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Rolls Left: <span className="font-bold text-neutral-300">{gameState.rollsLeft}</span>
                </p>
              </div>

              {/* Five Dice */}
              <div className="flex items-center justify-center gap-4 scale-105">
                {gameState.dice.map((val, idx) => (
                  <Dice3D
                    key={idx}
                    value={val}
                    isHeld={gameState.heldDice[idx]}
                    isRolling={rollingDice && !gameState.heldDice[idx]}
                    onClick={() => handleHold(idx)}
                    disabled={!isMyTurn || !gameState.hasRolled || gameState.rollsLeft <= 0 || gameState.status !== 'PLAYING'}
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 min-w-[200px] justify-end">
                {isMyTurn && gameState.status === 'PLAYING' && (
                  <button
                    onClick={handleRoll}
                    disabled={gameState.rollsLeft <= 0}
                    className={`px-8 py-3.5 rounded-full font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                      gameState.rollsLeft > 0
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/25 text-white'
                        : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/30'
                    }`}
                  >
                    <RefreshCw className={`w-4 h-4 ${rollingDice ? 'animate-spin' : ''}`} />
                    Roll Dice ({gameState.rollsLeft})
                  </button>
                )}
                {!isMyTurn && gameState.status === 'PLAYING' && (
                  <div className="text-center py-2 px-4 rounded-xl bg-neutral-900/50 border border-neutral-800/80 text-xs text-neutral-500 flex items-center gap-2 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                    Opponent thinking...
                  </div>
                )}
              </div>
            </div>

            {/* Score Sheet Matrix (Desktop) */}
            <div className="flex-1 overflow-auto p-6 custom-scrollbar">
              {renderScoreSheetMatrix(false)}
            </div>

            {/* Footer Logs */}
            <div className="p-3 bg-neutral-950/40 border-t border-neutral-800/50 flex items-center justify-between gap-3 text-xs text-neutral-500 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-neutral-600" />
                <span>Authoritative server sync active</span>
              </div>
              <div className="truncate max-w-lg italic text-neutral-400">
                {gameState.historyLogs[gameState.historyLogs.length - 1] || "Game in progress..."}
              </div>
            </div>

          </div>
        </div>

        {/* ========== ONE-TAP MOBILE CONFIRMATION MODAL ========== */}
        <AnimatePresence>
          {confirmCategory && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-neutral-900 border border-neutral-800/80 rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-xl">
                  {CATEGORY_ICONS[confirmCategory]}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Confirm Score</h3>
                <p className="text-sm text-neutral-400 mb-6">
                  Score <strong className="text-amber-400 font-extrabold">{gameState.possibleScores?.[confirmCategory] ?? 0} points</strong> in <strong className="text-white">{CATEGORY_NAMES[confirmCategory]}</strong>?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmCategory(null)}
                    className="flex-1 py-3 rounded-xl border border-neutral-800 hover:bg-neutral-800 text-xs font-bold text-neutral-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleSelectCategory(confirmCategory);
                      setConfirmCategory(null);
                    }}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white transition-all shadow-md shadow-blue-500/15"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========== PLAYER DETAILED SCORECARD MODAL ========== */}
        <AnimatePresence>
          {selectedScorecardPlayer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4"
              onClick={() => setSelectedScorecardPlayer(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl flex flex-col custom-scrollbar"
              >
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${PLAYER_COLOR_CLASSES[getColorIndex(gameState.players, selectedScorecardPlayer.userId)].text} bg-neutral-800 flex items-center justify-center text-xs font-bold`}>
                      {selectedScorecardPlayer.nickname?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{selectedScorecardPlayer.nickname}&apos;s Score</h3>
                      <p className="text-[10px] text-neutral-500">Breakdown of categories</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedScorecardPlayer(null)} className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                  <div className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest px-1">Upper Section</div>
                  {UPPER_CATEGORIES.map(cat => {
                    const val = selectedScorecardPlayer.scoreSheet[cat];
                    return (
                      <div key={cat} className="flex justify-between items-center p-2.5 rounded-xl bg-neutral-950/40 border border-neutral-900/50 text-xs">
                        <span className="text-neutral-400">{CATEGORY_ICONS[cat]} {CATEGORY_NAMES[cat]}</span>
                        <span className="font-black text-neutral-200">{val !== null && val !== undefined ? `${val} pts` : '—'}</span>
                      </div>
                    );
                  })}

                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-neutral-900/40 border border-neutral-850 text-xs text-neutral-300 font-bold">
                    <span>Upper Subtotal</span>
                    <span>{selectedScorecardPlayer.upperTotal}</span>
                  </div>

                  <div className={`flex justify-between items-center p-2.5 rounded-xl border text-xs font-bold ${
                    selectedScorecardPlayer.bonus > 0 ? 'bg-amber-500/5 border-amber-500/20 text-amber-400' : 'bg-neutral-950/40 border-neutral-900/30 text-neutral-600'
                  }`}>
                    <span>Bonus Progress {selectedScorecardPlayer.upperTotal >= gameState.bonusThreshold ? '✅' : `(needs ${gameState.bonusThreshold})`}</span>
                    <span>{selectedScorecardPlayer.bonus > 0 ? '+50' : '0'}</span>
                  </div>

                  <div className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest px-1 pt-2">Lower Section</div>
                  {LOWER_CATEGORIES.map(cat => {
                    const val = selectedScorecardPlayer.scoreSheet[cat];
                    return (
                      <div key={cat} className="flex justify-between items-center p-2.5 rounded-xl bg-neutral-950/40 border border-neutral-900/50 text-xs">
                        <span className="text-neutral-400">{CATEGORY_ICONS[cat]} {CATEGORY_NAMES[cat]}</span>
                        <span className="font-black text-neutral-200">{val !== null && val !== undefined ? `${val} pts` : '—'}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center border-t border-neutral-800 pt-3 mt-4">
                  <span className="font-bold text-sm text-neutral-300">Grand Total</span>
                  <span className="font-black text-lg text-amber-400">{selectedScorecardPlayer.grandTotal} <span className="text-xs text-neutral-500 font-medium">pts</span></span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========== FULL COMPARISON MODAL FOR MOBILE ========== */}
        <AnimatePresence>
          {showFullComparisonModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-neutral-950/95 backdrop-blur-md z-40 flex flex-col p-4"
            >
              <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-sm font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-red-500">
                  ALL PLAYER SCORE SHEETS
                </h3>
                <button
                  onClick={() => setShowFullComparisonModal(false)}
                  className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-850 text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto rounded-3xl border border-neutral-800 bg-neutral-950 custom-scrollbar">
                {renderScoreSheetMatrix(true)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========== WINNER & STATISTICS SCREEN OVERLAY ========== */}
        <AnimatePresence>
          {gameState.status === 'FINISHED' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-neutral-950/90 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4 overflow-y-auto"
            >
              <div className="max-w-xl w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
                
                <motion.div
                  initial={{ scale: 0, y: 50 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="text-center"
                >
                  <Trophy className="w-24 h-24 text-amber-400 mx-auto drop-shadow-[0_0_35px_rgba(245,158,11,0.5)] mb-4" />
                  
                  {gameState.isDraw ? (
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">It&apos;s a Tie Game!</h2>
                  ) : (
                    <>
                      <div className="inline-flex items-center justify-center gap-1.5 text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full uppercase tracking-widest mb-2">
                        <Crown className="w-3.5 h-3.5 animate-bounce" /> Winner Declared
                      </div>
                      <h2 className="text-3xl font-black tracking-tight text-white mb-1">
                        {gameState.players.find(p => p.userId === gameState.winnerId)?.nickname} Wins!
                      </h2>
                    </>
                  )}
                  <p className="text-xs text-neutral-400">Yatzy Session Completed</p>
                </motion.div>

                {/* Leaderboard positions */}
                <div className="mt-6 space-y-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Final Standings</h3>
                  {sortedPlayers.map((p, idx) => {
                    const colors = PLAYER_COLOR_CLASSES[getColorIndex(gameState.players, p.userId)];
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                            idx === 0 ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-neutral-800 text-neutral-400'
                          }`}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                          </div>
                          
                          <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${colors.text} bg-neutral-800 flex items-center justify-center text-[10px] font-bold`}>
                            {p.nickname?.[0]?.toUpperCase()}
                          </div>
                          <span className="font-bold text-sm text-neutral-200">{p.nickname}</span>
                        </div>
                        <span className="font-black text-base text-amber-400">{p.grandTotal} <span className="text-[10px] text-neutral-500 font-medium">pts</span></span>
                      </div>
                    );
                  })}
                </div>

                {/* Additional Fun Stats */}
                <div className="mt-6 p-4 rounded-2xl bg-neutral-950/50 border border-neutral-800/80">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-500/80 mb-3">Game Highlights & Stats</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    
                    <div className="space-y-1">
                      <div className="text-neutral-500 uppercase text-[9px] font-bold">Most Yatzys</div>
                      <div className="font-black text-neutral-200">
                        {mostYatzysCount > 0
                          ? `${mostYatzysPlayers.map(p => p.nickname).join(', ')} (1)`
                          : 'None'
                        }
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-neutral-500 uppercase text-[9px] font-bold">Highest Turn Score</div>
                      <div className="font-black text-neutral-200">
                        {highestTurnVal > 0
                          ? `${highestTurnPlayers.map(p => p.nickname).join(', ')} (${highestTurnVal} pts)`
                          : '0 pts'
                        }
                      </div>
                    </div>

                  </div>
                </div>

                {/* Controls */}
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleLeave}
                    className="flex-1 py-3.5 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 rounded-full font-black text-sm uppercase tracking-wider text-white transition-all hover:scale-105 active:scale-95 text-center shadow-lg shadow-amber-500/10"
                  >
                    Return to Lobby
                  </button>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-6 py-3 rounded-full font-bold shadow-lg z-50 text-sm"
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

export default function YatzyPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    }>
      <YatzyPageContent />
    </Suspense>
  );
}
