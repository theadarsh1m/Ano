"use client";

import { useEffect, useState, useRef, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Users, LogOut, Loader2, X, BookOpen, Volume2, VolumeX, ScrollText } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useRoomConnectionStore } from "@/store/useRoomConnectionStore";
import { useChamberClashStore, type ActionLogEntry } from "@/store/useChamberClashStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { TurnIndicator } from "@/components/games/TurnIndicator";
import dynamic from "next/dynamic";
import { useExitWarning } from "@/hooks/useExitWarning";
import { sounds } from "@/lib/sounds";
import { getItemAnimConfig } from "@/components/games/chamber-clash/animationConfigs";
import { PlayerHealthIndicator } from "@/components/games/chamber-clash/PlayerHealthIndicator";

const ChamberClash3D = dynamic(() => import("@/components/games/chamber-clash/ChamberClash3D").then((m) => m.ChamberClash3D), { ssr: false });

// ─── Item Metadata ───
const ITEM_META: Record<string, { name: string; icon: string; desc: string; color: string; sound: () => void }> = {
  magnifier:    { name: "Magnifier",    icon: "🔍", desc: "Peek at the current shell", color: "text-blue-400", sound: () => sounds.playInspect() },
  medkit:       { name: "Medkit",       icon: "💊", desc: "Heal 1 HP",               color: "text-green-400", sound: () => sounds.playEat() },
  handcuffs:    { name: "Handcuffs",    icon: "⛓️", desc: "Skip target's next turn", color: "text-zinc-400", sound: () => sounds.playHandcuffsLock() },
  inverter:     { name: "Inverter",     icon: "🔄", desc: "Converts current shell",  color: "text-cyan-400", sound: () => sounds.playInverter() },
  burner_phone: { name: "Burner Phone", icon: "📞", desc: "Reveal upcoming shell",    color: "text-amber-400", sound: () => sounds.playBurnerPhone() },
  adrenaline:   { name: "Adrenaline",   icon: "💉", desc: "Steal and immediately use an opponent's item.", color: "text-amber-500", sound: () => sounds.playAdrenaline() },
  handsaw:      { name: "Handsaw",      icon: "🪚", desc: "Double next shot damage", color: "text-orange-400", sound: () => sounds.playHandsaw() },
  beer:         { name: "Beer",         icon: "🍺", desc: "Eject current shell",     color: "text-amber-400", sound: () => sounds.playDrink() },
};

// ─── Helper: get nickname from players list ───
function getPlayerName(players: any[], id: string | null): string {
  if (!id) return "Unknown";
  return players?.find((p: any) => p.userId === id)?.nickname || "Unknown";
}

function ChamberClashGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get("gameId");

  const { id: userId, nickname } = useUserStore();
  const { currentRoomId } = useRoomConnectionStore();

  const {
    lobby, gameState, eventQueue, isAnimating, availableLobbies, error,
    actionLog, revealedShell, burnerPhoneReveal,
    createLobby, joinLobby, leaveLobby, toggleReady, startGame, startPracticeGame,
    shootTarget, useItem, resolvePendingItem,
    setupListeners, dequeueEvent, setAnimating, addLogEntry, clearState
  } = useChamberClashStore();

  // ─── Local UI State ───
  const [targetingAction, setTargetingAction] = useState<'shoot' | 'handcuffs' | 'adrenaline' | null>(null);
  const [stealingFromPlayerId, setStealingFromPlayerId] = useState<string | null>(null);
  const [stealingAnimation, setStealingAnimation] = useState<{ icon: string; from: { left: string; top: string }; to: { left: string; top: string } } | null>(null);
  const [visualTurnPlayerId, setVisualTurnPlayerId] = useState<string | null>(null);
  const [gunAngle, setGunAngle] = useState(0);
  const [gunState, setGunState] = useState<'idle' | 'pointing' | 'pump' | 'firing'>('idle');
  const [gunTarget, setGunTarget] = useState<'local' | 'opponent' | null>(null);
  const [activeItemAnimation, setActiveItemAnimation] = useState<{ itemId: string; userId: string; targetId: string | null } | null>(null);
  const [currentShellType, setCurrentShellType] = useState<'LIVE' | 'BLANK' | null>(null);
  const [localBarrelCut, setLocalBarrelCut] = useState(false);
  const isBarrelShortened = Boolean(
    gameState?.players?.some((p) => p.statusEffects?.some((e: any) => e.type === 'DOUBLE_DAMAGE')) ||
    localBarrelCut
  );
  const [animationLocked, setAnimationLocked] = useState(false);
  const [privatePayload, setPrivatePayload] = useState<any>(null);
  const [isStealSelectionMode, setIsStealSelectionMode] = useState(false);
  const [stolenItemPending, setStolenItemPending] = useState<string | null>(null);
  const [muzzleFlash, setMuzzleFlash] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [smokeParticles, setSmokeParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [showRoundOverlay, setShowRoundOverlay] = useState(false);
  const [roundOverlayData, setRoundOverlayData] = useState<{ round: number; total: number; live: number; blank: number } | null>(null);

  // Derive selectedTargetId from the active targetingAction, except when shooting it might just highlight
  const selectedTargetId = targetingAction === 'shoot' ? (gameState?.players.find(p => p.userId !== userId)?.userId || null) : null;
  const [shellCounterLive, setShellCounterLive] = useState(0);
  const [shellCounterBlank, setShellCounterBlank] = useState(0);
  const [showActionLog, setShowActionLog] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [isMuted, setIsMuted] = useState(sounds.isMuted);
  const [activeItemAnim, setActiveItemAnim] = useState<{ itemId: string; targetId: string } | null>(null);
  const [damagedPlayerId, setDamagedPlayerId] = useState<string | null>(null);
  const [healedPlayerId, setHealedPlayerId] = useState<string | null>(null);
  const [eliminatedPlayerId, setEliminatedPlayerId] = useState<string | null>(null);
  const [ejectedShellType, setEjectedShellType] = useState<string | null>(null);
  const [extraTurnPlayerId, setExtraTurnPlayerId] = useState<string | null>(null);
  const [skippedPlayerId, setSkippedPlayerId] = useState<string | null>(null);

  const isAnimatingRef = useRef(false);
  const processedShellEvents = useRef<Set<string>>(new Set());
  const logEndRef = useRef<HTMLDivElement>(null);
  const dustParticles = useMemo(() =>
    Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      delay: Math.random() * 8,
      duration: 10 + Math.random() * 10,
    })), []);

  const { bypassWarning } = useExitWarning(!!lobby || !!gameState);

  // ─── Clear on mount and force mute by default ───
  useEffect(() => {
    clearState();
    sounds.isMuted = true;
    setIsMuted(true);
  }, [clearState]);

  // ─── Escape key listener to cancel targeting ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (targetingAction || isStealSelectionMode)) {
        setTargetingAction(null);
        setIsStealSelectionMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetingAction, isStealSelectionMode]);

  // ─── Leave on unmount ───
  useEffect(() => {
    return () => {
      const s = useChamberClashStore.getState();
      const gid = s.lobby?.id || s.gameState?.gameId;
      const uid = useUserStore.getState().id;
      if (gid && uid) s.leaveLobby(gid, uid);
    };
  }, []);

  // ─── Setup listeners ───
  useEffect(() => {
    if (!userId) return;
    const cleanup = setupListeners(lobby?.id || gameState?.gameId || "", userId);
    if (gameIdParam && !lobby && !gameState) joinLobby(gameIdParam, userId, nickname || "Player");
    return () => cleanup();
  }, [userId, lobby?.id, gameState?.gameId, gameIdParam]);

  // ─── // Local variables previously used for shell counters are removed for suspense
  // ─── Sync visual turn when not animating ───
  useEffect(() => {
    if (!isAnimating && eventQueue.length === 0 && gameState?.currentTurnPlayerId) {
      setVisualTurnPlayerId(gameState.currentTurnPlayerId);
      if (gameState.currentTurnPlayerId !== userId) {
        setTargetingAction(null);
      }
    }
  }, [isAnimating, eventQueue.length, gameState?.currentTurnPlayerId, userId]);

  // ─── Heartbeat for low HP ───
  const me = useMemo(() => gameState?.players.find((p) => p.userId === userId), [gameState?.players, userId]);
  useEffect(() => {
    if (!gameState || !me || me.hp > 1 || me.hp <= 0) return;
    const iv = setInterval(() => sounds.playHeartbeat(), 1200);
    return () => clearInterval(iv);
  }, [gameState, me?.hp]);

  // ─── Auto-scroll action log ───
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [actionLog.length]);

  // ─── Player ordering: local player at bottom ───
  const orderedPlayers = useMemo(() => {
    if (!gameState) return [];
    const myIdx = gameState.players.findIndex(p => p.userId === userId);
    if (myIdx === -1) return gameState.players;
    return [...gameState.players.slice(myIdx), ...gameState.players.slice(0, myIdx)];
  }, [gameState?.players, userId]);

  // ─── Get position for player around table ───
  const getPlayerPos = useCallback((idx: number, total: number) => {
    // Start at bottom (PI/2) and go clockwise
    const angle = (idx * (2 * Math.PI) / total) + (Math.PI / 2);
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    
    // Position outside the table
    // Table is 82% width, so radius is 41%. We put players at 46% radius.
    // Table aspect is 1.7, so Y radius is 41% / 1.7 = 24%. We put players at 35% Y radius.
    return {
      left: `${50 + 46 * x}%`,
      top: `${50 + 35 * y}%`,
      rotateX: -y * 25, // Bottom tilts up, top tilts down
      rotateY: x * 25    // Left tilts right, right tilts left
    };
  }, []);

  // ─── Compute gun angle toward target ───
  const computeGunAngle = useCallback((targetId: string | null) => {
    if (!targetId || orderedPlayers.length === 0) return 0;
    const idx = orderedPlayers.findIndex(p => p.userId === targetId);
    if (idx === -1) return 0;
    const angle = (idx * (2 * Math.PI) / orderedPlayers.length) + (Math.PI / 2);
    return (angle * 180 / Math.PI) + 90;
  }, [orderedPlayers]);

  // ─── Update gun angle when target changes ───
  useEffect(() => {
    setGunAngle(computeGunAngle(selectedTargetId || gameState?.currentTurnPlayerId || null));
  }, [selectedTargetId, gameState?.currentTurnPlayerId, computeGunAngle]);

  // ═══════════════════════════════════════
  //  EVENT QUEUE PROCESSOR (animation engine)
  // ═══════════════════════════════════════
  useEffect(() => {
    const evtId = eventQueue[0]?.id;
    if (!evtId || isAnimatingRef.current) return;

    const evt = eventQueue[0];
    isAnimatingRef.current = true;
    setAnimating(true);

    let duration = 1500;
    const players = gameState?.players || [];

    switch (evt.type) {
      // ──── ROUND START ────
      case 'round_started': {
        duration = 3500;
        setLocalBarrelCut(false);
        setRoundOverlayData({ round: evt.data.roundNumber, total: evt.data.totalShells, live: evt.data.liveShells, blank: evt.data.blankShells });
        setShowRoundOverlay(true);
        setShellCounterLive(evt.data.liveShells);
        setShellCounterBlank(evt.data.blankShells);
        sounds.playRoundDrum();
        // Load shells one by one
        const shellCount = evt.data.totalShells;
        for (let i = 0; i < shellCount; i++) {
          setTimeout(() => sounds.playShellLoad(), 800 + i * 200);
        }
        addLogEntry(`Round ${evt.data.roundNumber} — ${evt.data.liveShells} Live, ${evt.data.blankShells} Blank`, "🎯", "text-red-400");
        setTimeout(() => setShowRoundOverlay(false), 3200);
        break;
      }

      // ──── ITEMS DISTRIBUTED ────
      case 'items_distributed': {
        duration = 1500;
        sounds.playItemUse();
        const entries = Object.entries(evt.data.itemsGiven || {});
        entries.forEach(([pid, items]: [string, any]) => {
          if (items.length > 0) {
            addLogEntry(`${getPlayerName(players, pid)} received ${items.length} item(s)`, "📦", "text-purple-400");
          }
        });
        break;
      }

      // ──── TURN STARTED ────
      case 'turn_started': {
        duration = 1200;
        setGunState('idle');
        setGunTarget(null);
        setTargetingAction(null);
        setActiveItemAnimation(null);
        setVisualTurnPlayerId(evt.data.playerId);
        
        // Point gun toward current turn player
        setGunAngle(computeGunAngle(evt.data.playerId));
        sounds.playTurnChime();
        // Update shell counters if data includes them
        if (evt.data.remainingLive !== undefined) {
          setShellCounterLive(evt.data.remainingLive);
          setShellCounterBlank(evt.data.remainingBlank);
        }
        addLogEntry(`${getPlayerName(players, evt.data.playerId)}'s turn`, "🎲", "text-white");
        break;
      }

      // ──── SHOT FIRED ────
      case 'shot_fired': {
        const isLive = evt.data.shellType === 'LIVE';
        // Total visual duration: pickup(0.4) + aim(0.5) + settle(0.3) + fire(0.08) + recoil(0.2) + recover(0.4) + return(0.6) = 2.48s + buffer
        duration = isLive ? 3200 : 2600;
        
        setAnimationLocked(true);
        
        // Set shell type so shotgun knows recoil intensity
        setCurrentShellType(isLive ? 'LIVE' : 'BLANK');

        // Point at target — starts the PICKING_UP → AIMING → AIM_SETTLE sequence
        setGunAngle(computeGunAngle(evt.data.targetId));
        setGunTarget(evt.data.targetId === userId ? 'local' : 'opponent');
        setGunState('pointing');
        
        // Fire after aim settles: pickup(0.4) + aim(0.5) + settle(0.3) = 1.2s
        setTimeout(() => {
          setGunState('firing');
          // ONE sound, ONE muzzle flash, ONE recoil
          if (isLive) {
            sounds.playGunShootLive();
            setMuzzleFlash(true);
            setScreenShake(true);
            setSmokeParticles(Array.from({ length: 8 }).map((_, i) => ({
              id: Date.now() + i, x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 60
            })));
            setTimeout(() => setMuzzleFlash(false), 200);
            setTimeout(() => setScreenShake(false), 350);
          } else {
            sounds.playGunShootBlank();
            setScreenShake(true);
            setTimeout(() => setScreenShake(false), 150);
          }
        }, 1200);

        // Update shell counters after fire
        if (evt.data.remainingLive !== undefined) {
          setTimeout(() => {
            setShellCounterLive(evt.data.remainingLive);
            setShellCounterBlank(evt.data.remainingBlank);
          }, 1500);
        }

        // Return gun to idle — the shotgun state machine handles the visual return
        setTimeout(() => { 
            setGunState('idle'); 
            setGunTarget(null);
            setCurrentShellType(null);
            setSmokeParticles([]); 
            setAnimationLocked(false);
        }, duration - 300);

        const shooterName = getPlayerName(players, evt.data.shooterId);
        const targetName = evt.data.shooterId === evt.data.targetId ? "themselves" : getPlayerName(players, evt.data.targetId);
        addLogEntry(
          `${shooterName} fired at ${targetName} — ${isLive ? '💥 LIVE' : '💨 Blank'}${evt.data.damage > 1 ? ` (${evt.data.damage} DMG)` : ''}`,
          isLive ? "🔴" : "⚪", isLive ? "text-red-400" : "text-zinc-400"
        );
        break;
      }

      // ──── PLAYER DAMAGED ────
      case 'player_damaged': {
        duration = 1200;
        setDamagedPlayerId(evt.data.playerId);
        sounds.playCrash();
        
        // Patch local state so HP bar drops exactly now
        useChamberClashStore.setState(state => {
          if (!state.gameState) return state;
          const newPlayers = state.gameState.players.map(p => 
            p.userId === evt.data.playerId ? { ...p, hp: evt.data.newHp } : p
          );
          return { gameState: { ...state.gameState, players: newPlayers } };
        });

        setTimeout(() => setDamagedPlayerId(null), 1000);
        addLogEntry(`${getPlayerName(players, evt.data.playerId)} took ${evt.data.damage} damage (${evt.data.newHp} HP left)`, "💔", "text-red-500");
        break;
      }

      // ──── SHELL INVERTED ────
      case 'shell_inverted': {
        duration = 1800;
        setGunState('pointing');
        sounds.playInverter();
        setGunAngle(prev => prev + 360);
        
        setMuzzleFlash(true);
        setTimeout(() => setMuzzleFlash(false), 300);

        if (evt.data.remainingLive !== undefined) {
          setTimeout(() => {
            setShellCounterLive(evt.data.remainingLive);
            setShellCounterBlank(evt.data.remainingBlank);
          }, 1000);
        }

        setTimeout(() => {
          setStealingAnimation(null);
          setActiveItemAnimation(null);
        }, duration);

        setTimeout(() => setGunState('idle'), duration - 300);
        
        const player = getPlayerName(players, evt.data.playerId);
        addLogEntry(`${player} inverted the chambered shell (${evt.data.newShell === 'LIVE' ? '🔴 LIVE' : '⚪ BLANK'})`, "🔄", "text-cyan-400");
        break;
      }

      // ──── PLAYER HEALED ────
      case 'player_healed': {
        duration = 1200;
        setHealedPlayerId(evt.data.playerId);
        sounds.playEat();
        
        // Patch local state
        useChamberClashStore.setState(state => {
          if (!state.gameState) return state;
          const newPlayers = state.gameState.players.map(p => 
            p.userId === evt.data.playerId ? { ...p, hp: p.hp + evt.data.amount } : p
          );
          return { gameState: { ...state.gameState, players: newPlayers } };
        });

        setTimeout(() => setHealedPlayerId(null), 1000);
        addLogEntry(`${getPlayerName(players, evt.data.playerId)} healed +${evt.data.amount} HP`, "💚", "text-green-400");
        break;
      }

      // ──── PLAYER ELIMINATED ────
      case 'player_eliminated': {
        duration = 2000;
        setEliminatedPlayerId(evt.data.playerId);
        sounds.playElimination();
        
        // Patch local state
        useChamberClashStore.setState(state => {
          if (!state.gameState) return state;
          const newPlayers = state.gameState.players.map(p => 
            p.userId === evt.data.playerId ? { ...p, isAlive: false } : p
          );
          return { gameState: { ...state.gameState, players: newPlayers } };
        });

        setTimeout(() => setEliminatedPlayerId(null), 1800);
        addLogEntry(`${getPlayerName(players, evt.data.playerId)} eliminated${evt.data.reason === 'disconnected' ? ' (disconnected)' : ''}`, "☠️", "text-red-600");
        break;
      }

      // ──── ITEM USED ────
      case 'item_used': {
        const isLocalActor = evt.data.playerId === userId;
        const isLocalTarget = (evt.data.targetId || null) === userId;
        const itemConfig = getItemAnimConfig(evt.data.itemId, isLocalActor, isLocalTarget);
        
        const isAdrenalineSteal = evt.data.itemId === 'adrenaline' && evt.data.stolenItem;
        const stolenItemConfig = isAdrenalineSteal ? getItemAnimConfig(evt.data.stolenItem, isLocalActor, isLocalTarget) : null;
        const targetItem = isAdrenalineSteal ? evt.data.stolenItem : evt.data.itemId;

        // Pass single authoritative private payload for Burner Phone and Magnifier
        const storeBurner = useChamberClashStore.getState().burnerPhoneReveal;

        if (isLocalActor && (targetItem === 'burner_phone' || storeBurner || evt.data.revealedShell || evt.data.shellType)) {
          const authoritativePayload = {
            displayShellNumber: storeBurner?.displayShellNumber || evt.data.position || evt.data.displayShellNumber,
            shellType: storeBurner?.shellType || evt.data.shell || evt.data.shellType
          };

          setPrivatePayload(authoritativePayload);
        }
        
        duration = isAdrenalineSteal
          ? Math.ceil((itemConfig.totalDuration + (stolenItemConfig?.totalDuration || 1.5)) * 1000) + 600
          : Math.ceil(itemConfig.totalDuration * 1000) + 500;
        
        setAnimationLocked(true);
        setActiveItemAnimation({
          itemId: evt.data.itemId,
          userId: evt.data.playerId,
          targetId: evt.data.targetId || null
        });

        const meta = ITEM_META[evt.data.itemId];
        if (meta) meta.sound();
        
        // Patch local state (remove item from inventory)
        useChamberClashStore.setState(state => {
          if (!state.gameState) return state;
          const newPlayers = state.gameState.players.map(p => {
            if (p.userId !== evt.data.playerId) return p;
            const newInv = [...p.inventory];
            const idx = newInv.indexOf(evt.data.itemId);
            if (idx > -1) newInv.splice(idx, 1);
            return { ...p, inventory: newInv };
          });
          return { gameState: { ...state.gameState, players: newPlayers } };
        });

        // Adrenaline Stolen Item Chaining: play stolen item animation after self-injection
        if (isAdrenalineSteal) {
          setTimeout(() => {
            setActiveItemAnimation({
              itemId: evt.data.stolenItem,
              userId: evt.data.playerId,
              targetId: evt.data.targetId || null
            });
            const stolenMeta = ITEM_META[evt.data.stolenItem];
            if (stolenMeta) stolenMeta.sound();
          }, Math.ceil(itemConfig.totalDuration * 1000));
        }

        // Safety watchdog: clear animation if onComplete doesn't fire
        setTimeout(() => {
          setActiveItemAnimation(null);
          setAnimationLocked(false);
          setPrivatePayload(null);
        }, duration + 1500);

        const itemName = meta?.name || evt.data.itemId;
        addLogEntry(`${getPlayerName(players, evt.data.playerId)} used ${itemName}`, meta?.icon || "📦", meta?.color || "text-white");
        break;
      }

      // ──── SHELL EJECTED (Beer) ────
      case 'shell_ejected': {
        duration = 1500;
        const eventKey = evt.id || `${evt.timestamp || Date.now()}_${evt.data.shellType}`;
        if (!processedShellEvents.current.has(eventKey)) {
          processedShellEvents.current.add(eventKey);
          if (processedShellEvents.current.size > 50) {
            const firstKey = processedShellEvents.current.values().next().value;
            if (firstKey) processedShellEvents.current.delete(firstKey);
          }

          console.log(`[BEER] shell_ejected received eventId=${eventKey} type=${evt.data.shellType}`);
          setEjectedShellType(evt.data.shellType);
          sounds.playShellEject();
          setTimeout(() => setEjectedShellType(null), 4500);
        }
        
        if (evt.data.remainingLive !== undefined) {
          setShellCounterLive(evt.data.remainingLive);
          setShellCounterBlank(evt.data.remainingBlank);
        }
        addLogEntry(`Shell ejected — ${evt.data.shellType === 'LIVE' ? '🔴 Live' : '⚪ Blank'}`, "🍺", "text-amber-400");
        break;
      }

      // ──── EXTRA TURN ────
      case 'extra_turn_granted': {
        duration = 1000;
        setExtraTurnPlayerId(evt.data.playerId);
        sounds.playTurnChime();
        setTimeout(() => setExtraTurnPlayerId(null), 800);
        addLogEntry(`${getPlayerName(players, evt.data.playerId)} gets an extra turn!`, "🔄", "text-yellow-400");
        break;
      }

      // ──── TURN SKIPPED ────
      case 'turn_skipped': {
        duration = 1200;
        setSkippedPlayerId(evt.data.playerId);
        sounds.playHandcuffsLock();
        setTimeout(() => setSkippedPlayerId(null), 1000);
        addLogEntry(`${getPlayerName(players, evt.data.playerId)}'s turn skipped (handcuffed)`, "⛓️", "text-zinc-500");
        break;
      }

      // ──── STATUS EVENTS ────
      case 'status_added': {
        duration = 800;
        
        useChamberClashStore.setState(state => {
          if (!state.gameState) return state;
          const newPlayers = state.gameState.players.map(p => {
            if (p.userId !== evt.data.playerId) return p;
            return { ...p, statusEffects: [...p.statusEffects, { type: evt.data.status, duration: evt.data.duration, source: evt.data.source }] };
          });
          return { gameState: { ...state.gameState, players: newPlayers } };
        });

        addLogEntry(`${getPlayerName(players, evt.data.playerId)} gained ${evt.data.status}`, "⚡", "text-purple-400");
        break;
      }
      case 'status_removed': {
        duration = 500;
        
        useChamberClashStore.setState(state => {
          if (!state.gameState) return state;
          const newPlayers = state.gameState.players.map(p => {
            if (p.userId !== evt.data.playerId) return p;
            const idx = p.statusEffects.findIndex((e:any) => e.type === evt.data.status);
            if (idx === -1) return p;
            const newEffects = [...p.statusEffects];
            newEffects.splice(idx, 1);
            return { ...p, statusEffects: newEffects };
          });
          return { gameState: { ...state.gameState, players: newPlayers } };
        });

        break;
      }

      // ──── ITEM STOLEN ────
      case 'item_stolen': {
        duration = 1800;
        const stealerId = evt.data.stealerId;
        const victimId = evt.data.victimId;
        const itemId = evt.data.itemId;

        const stealerIdx = orderedPlayers.findIndex(p => p.userId === stealerId);
        const victimIdx = orderedPlayers.findIndex(p => p.userId === victimId);
        
        if (stealerIdx !== -1 && victimIdx !== -1) {
          const fromPos = getPlayerPos(victimIdx, orderedPlayers.length);
          const toPos = getPlayerPos(stealerIdx, orderedPlayers.length);
          
          setStealingAnimation({
            icon: ITEM_META[itemId]?.icon || "📦",
            from: { left: fromPos.left, top: fromPos.top },
            to: { left: toPos.left, top: toPos.top }
          });
        }
        
        sounds.playAdrenaline();
        
        const stealerName = getPlayerName(players, stealerId);
        const victimName = getPlayerName(players, victimId);
        const itemName = ITEM_META[itemId]?.name || itemId;
        const itemIcon = ITEM_META[itemId]?.icon || "📦";

        addLogEntry(`${stealerName} used Adrenaline`, "💉", "text-amber-500");
        addLogEntry(`${stealerName} stole ${itemName} from ${victimName}`, itemIcon, "text-amber-400");
        break;
      }

      // ──── GAME FINISHED ────
      case 'game_finished': {
        duration = 3000;
        sounds.playWin();
        if (evt.data.winnerId) {
          addLogEntry(`🏆 ${evt.data.winnerName || getPlayerName(players, evt.data.winnerId)} wins!`, "🏆", "text-yellow-400");
        } else {
          addLogEntry("Match ended in a draw", "🤝", "text-gray-400");
        }
        break;
      }

      // ──── ROUND FINISHED ────
      case 'round_finished': {
        duration = 1000;
        addLogEntry(`Round ${evt.data.roundNumber} finished — reloading...`, "🔄", "text-zinc-400");
        break;
      }

      // ──── GAME STARTED ────
      case 'game_started': {
        duration = 800;
        addLogEntry("Match started!", "🎮", "text-green-400");
        break;
      }

      default:
        duration = 800;
    }

    const timer = setTimeout(() => {
      isAnimatingRef.current = false;
      setAnimating(false);
      dequeueEvent();
    }, duration);

    return () => clearTimeout(timer);
  }, [eventQueue[0]?.id]);

  // ─── Navigation ───
  const handleLeave = () => {
    bypassWarning();
    const gid = gameState?.gameId || lobby?.id;
    if (gid && userId) leaveLobby(gid, userId);
    router.push("/dashboard/games");
  };

  const toggleMute = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  // ═══════════════════
  //  LOADING SCREEN
  // ═══════════════════
  if (!userId || !nickname) {
    return (
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  // ═══════════════════
  //  PRE-LOBBY VIEW
  // ═══════════════════
  if (!lobby && !gameState) {
    const active = availableLobbies.filter(l => l.gameType === 'CHAMBER_CLASH');
    return (
      <div className="flex flex-col h-screen bg-[#050607] text-white p-4 space-y-6">
        <div className="flex justify-between items-center bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard/games")} className="p-2 rounded-full hover:bg-white/10 transition-colors"><X className="w-5 h-5" /></button>
            <h1 className="text-xl font-black tracking-wide">🔫 Chamber Clash</h1>
          </div>
          <button onClick={() => setShowRules(true)} className="p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Rules</span>
          </button>
        </div>

        <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <GlassCard className="p-8 text-center flex flex-col space-y-6 border-red-500/20">
            <div className="text-6xl">🔫</div>
            <div>
              <h2 className="text-2xl font-black mb-2">Host a Match</h2>
              <p className="text-sm text-zinc-500">2–8 players. Last one standing wins.</p>
            </div>
            <button onClick={() => createLobby(userId, nickname)} className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] transition-transform cursor-pointer">
              Create Lobby
            </button>
            <button onClick={() => startPracticeGame(userId, nickname || "Player")} className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold text-sm transition-colors cursor-pointer">
              Practice Mode (Single Player)
            </button>
          </GlassCard>

          <GlassCard className="p-6 flex flex-col space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5 text-red-400" /> Active Lobbies</h2>
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px]">
              {active.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-sm">No lobbies found.</div>
              ) : active.map(l => (
                <div key={l.id} className="p-3 bg-white/[0.03] rounded-xl flex justify-between items-center border border-white/[0.05]">
                  <div>
                    <div className="font-bold text-sm">{l.hostName}&apos;s Game</div>
                    <div className="text-xs text-zinc-500">{l.playerCount}/{l.maxPlayers || 8}</div>
                  </div>
                  <button onClick={() => joinLobby(l.id, userId, nickname)} className="px-4 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-lg text-sm font-semibold transition-colors">Join</button>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  // ═══════════════════
  //  LOBBY VIEW
  // ═══════════════════
  if (lobby && !gameState) {
    const isHost = lobby.hostId === userId;
    const canStart = isHost && lobby.players.length >= 2 && lobby.players.every((p: any) => p.isReady || p.role === 'HOST');
    return (
      <div className="flex flex-col h-screen bg-[#050607] text-white p-4">
        <div className="max-w-4xl mx-auto w-full space-y-6 mt-8">
          <div className="flex flex-wrap items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 sm:p-4 gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <h1 className="text-lg sm:text-2xl font-black text-red-500">Chamber Clash</h1>
              <button onClick={() => setShowRules(true)} className="p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 cursor-pointer">
                <BookOpen className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Rules</span>
              </button>
            </div>
            <button onClick={handleLeave} className="px-3 py-2 bg-red-600/20 text-red-400 rounded-xl hover:bg-red-600/30 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Leave Lobby</span>
              <span className="sm:hidden">Leave</span>
            </button>
          </div>

          <GlassCard className="p-4 sm:p-6 space-y-6">
            <h2 className="text-lg font-bold">Players ({lobby.players.length}/6)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {lobby.players.map((p: any) => (
                <div key={p.userId} className={`p-3 sm:p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${p.userId === userId ? 'border-red-500/50 bg-red-500/10' : 'border-white/[0.06] bg-white/[0.03]'}`}>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-zinc-800 rounded-full flex items-center justify-center font-black text-base sm:text-lg">{p.nickname.substring(0, 2).toUpperCase()}</div>
                  <span className="font-semibold text-xs sm:text-sm truncate w-full text-center">{p.nickname}</span>
                  <span className="text-[11px] sm:text-xs text-zinc-500">{p.role === 'HOST' ? '👑 Host' : (p.isReady ? '✅ Ready' : '⏳ Not Ready')}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-white/[0.06]">
              {!isHost && (
                <button onClick={() => toggleReady(lobby.id, userId, !lobby.players.find((p: any) => p.userId === userId)?.isReady)} className="w-full sm:w-auto px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-colors cursor-pointer">
                  {lobby.players.find((p: any) => p.userId === userId)?.isReady ? 'Unready' : 'Ready'}
                </button>
              )}
              {isHost && (
                <div className="flex gap-2">
                  <button onClick={() => startPracticeGame(userId || 'p1', nickname || 'You')} className="px-5 py-2.5 bg-amber-600/80 hover:bg-amber-500 rounded-xl font-bold transition-all text-white text-xs cursor-pointer">
                    Practice 3D View (Dev)
                  </button>
                  <button onClick={() => startGame(lobby.id, userId)} disabled={!canStart} className={`px-8 py-2.5 rounded-xl font-bold transition-all cursor-pointer text-xs ${canStart ? 'bg-red-600 hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}`}>
                    Start Match
                  </button>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════
  //  ACTIVE GAME — CINEMATIC TABLE VIEW
  // ═════════════════════════════════════
  if (gameState) {
    const isMyTurn = !isAnimating && visualTurnPlayerId === userId;
    const isPendingAction = gameState?.pendingItemAction?.playerId === userId;
    const pendingItemId = isPendingAction ? gameState?.pendingItemAction?.stolenItem : null;
    const isPendingHandcuffs = isPendingAction && pendingItemId === 'handcuffs';
    const isPendingAdrenaline = isPendingAction && pendingItemId === 'adrenaline';
    
    const activeHandcuffMode = targetingAction === 'handcuffs' || isPendingHandcuffs;
    const activeStealMode = targetingAction === 'adrenaline' || isPendingAdrenaline;

    const currentBannerText = eventQueue.length > 0 ? eventQueue[0].type.replace(/_/g, ' ').toUpperCase() : '';
    const hasHandsaw = gameState.players.find(p => p.userId === visualTurnPlayerId)?.statusEffects?.some((e: any) => e.type === 'DOUBLE_DAMAGE');

    return (
      <div className={`flex flex-col h-screen bg-[#060709] text-white overflow-hidden select-none relative ${screenShake ? 'cc-shake' : ''}`}>
        
        {/* DEBUG BUTTONS — Expanded Animation Controls */}
        <div className="absolute top-2 left-2 z-[9999] flex flex-wrap gap-1 max-w-[720px] pointer-events-auto bg-black/80 p-2 rounded-xl border border-white/10 backdrop-blur-md">
          {/* Shotgun Debug */}
          {[
            { label: 'SHOOT OPP LIVE', target: 'opponent' as const, shell: 'LIVE' as const, color: 'bg-red-600' },
            { label: 'SHOOT OPP BLANK', target: 'opponent' as const, shell: 'BLANK' as const, color: 'bg-zinc-600' },
            { label: 'SHOOT SELF LIVE', target: 'local' as const, shell: 'LIVE' as const, color: 'bg-red-800' },
            { label: 'SHOOT SELF BLANK', target: 'local' as const, shell: 'BLANK' as const, color: 'bg-zinc-700' },
          ].map(({ label, target, shell, color }) => (
            <button key={label} className={`px-2 py-1 ${color} text-white text-[9px] font-bold rounded cursor-pointer`}
              onClick={() => {
                if (animationLocked) return;
                setAnimationLocked(true);
                setCurrentShellType(shell);
                setGunTarget(target);
                setGunState('pointing');
                setTimeout(() => {
                  setGunState('firing');
                  if (shell === 'LIVE') {
                    setMuzzleFlash(true);
                    setScreenShake(true);
                    setTimeout(() => setMuzzleFlash(false), 200);
                    setTimeout(() => setScreenShake(false), 350);
                  } else {
                    setScreenShake(true);
                    setTimeout(() => setScreenShake(false), 150);
                  }
                }, 900);
                setTimeout(() => {
                  setGunState('idle');
                  setGunTarget(null);
                  setCurrentShellType(null);
                  setAnimationLocked(false);
                }, 2800);
              }}>
              {label}
            </button>
          ))}

          {/* Beer Debug (Local Live/Blank, Opponent Live/Blank) */}
          <button className="px-2 py-1 bg-amber-700 text-white text-[9px] font-bold rounded cursor-pointer"
            onClick={() => {
              if (animationLocked) return;
              setAnimationLocked(true);
              setEjectedShellType('LIVE');
              setActiveItemAnimation({ itemId: 'beer', userId: userId || 'local', targetId: null });
              setTimeout(() => { setEjectedShellType(null); }, 4500);
              setTimeout(() => { setActiveItemAnimation(null); setAnimationLocked(false); }, 3200);
            }}>LOCAL BEER LIVE</button>

          <button className="px-2 py-1 bg-amber-900 text-white text-[9px] font-bold rounded cursor-pointer"
            onClick={() => {
              if (animationLocked) return;
              setAnimationLocked(true);
              setEjectedShellType('BLANK');
              setActiveItemAnimation({ itemId: 'beer', userId: userId || 'local', targetId: null });
              setTimeout(() => { setEjectedShellType(null); }, 4500);
              setTimeout(() => { setActiveItemAnimation(null); setAnimationLocked(false); }, 3200);
            }}>LOCAL BEER BLANK</button>

          <button className="px-2 py-1 bg-amber-600 text-white text-[9px] font-bold rounded cursor-pointer"
            onClick={() => {
              if (animationLocked) return;
              setAnimationLocked(true);
              setEjectedShellType('LIVE');
              const oppId = gameState?.players.find(p => p.userId !== userId)?.userId || 'opp';
              setActiveItemAnimation({ itemId: 'beer', userId: oppId, targetId: null });
              setTimeout(() => { setEjectedShellType(null); }, 4500);
              setTimeout(() => { setActiveItemAnimation(null); setAnimationLocked(false); }, 3200);
            }}>OPP BEER LIVE</button>

          {/* Burner Phone Debug (Local vs Opponent) */}
          <button className="px-2 py-1 bg-amber-500 text-black text-[9px] font-bold rounded cursor-pointer"
            onClick={() => {
              if (animationLocked) return;
              setAnimationLocked(true);
              const payload = { displayShellNumber: 4, shellType: 'LIVE' };
              setPrivatePayload(payload);
              useChamberClashStore.setState({ burnerPhoneReveal: payload });
              setActiveItemAnimation({ itemId: 'burner_phone', userId: userId || 'local', targetId: null });
              setTimeout(() => {
                setActiveItemAnimation(null);
                setAnimationLocked(false);
                setPrivatePayload(null);
                useChamberClashStore.setState({ burnerPhoneReveal: null });
              }, 2800);
            }}>LOCAL PHONE</button>

          <button className="px-2 py-1 bg-amber-700 text-white text-[9px] font-bold rounded cursor-pointer"
            onClick={() => {
              if (animationLocked) return;
              setAnimationLocked(true);
              const oppId = gameState?.players.find(p => p.userId !== userId)?.userId || 'opp';
              setActiveItemAnimation({ itemId: 'burner_phone', userId: oppId, targetId: null });
              setTimeout(() => { setActiveItemAnimation(null); setAnimationLocked(false); setPrivatePayload(null); }, 2800);
            }}>OPP PHONE (SECRET)</button>

          {/* Adrenaline Steal Debug */}
          <button className="px-2 py-1 bg-purple-600 text-white text-[9px] font-bold rounded cursor-pointer"
            onClick={() => {
              if (animationLocked) return;
              setAnimationLocked(true);
              setEjectedShellType('LIVE');
              // Populate opponent inventory in debug mode for testing
              useChamberClashStore.setState(state => {
                if (!state.gameState) return state;
                const newPlayers = state.gameState.players.map(p => {
                  if (p.userId !== userId) {
                    return { ...p, inventory: ['beer', 'magnifier', 'handsaw', 'medkit'] };
                  }
                  return p;
                });
                return { gameState: { ...state.gameState, players: newPlayers } };
              });
              // Step 1: Self injection
              setActiveItemAnimation({ itemId: 'adrenaline', userId: userId || 'local', targetId: null });
              setTimeout(() => {
                // Step 2: Transition camera to top-down view and expose opponent items for 3D click selection
                setActiveItemAnimation(null);
                setIsStealSelectionMode(true);
              }, 1500);
            }}>TOP-DOWN STEAL MODE</button>

          <button className="px-2 py-1 bg-purple-700 text-white text-[9px] font-bold rounded cursor-pointer"
            onClick={() => {
              if (animationLocked) return;
              setAnimationLocked(true);
              setEjectedShellType('LIVE');
              setActiveItemAnimation({ itemId: 'adrenaline', userId: userId || 'local', targetId: null });
              setTimeout(() => {
                setActiveItemAnimation({ itemId: 'beer', userId: userId || 'local', targetId: null });
              }, 1500);
              setTimeout(() => { setActiveItemAnimation(null); setAnimationLocked(false); }, 4500);
            }}>STEAL BEER</button>

          <button className="px-2 py-1 bg-purple-900 text-white text-[9px] font-bold rounded cursor-pointer"
            onClick={() => {
              if (animationLocked) return;
              setAnimationLocked(true);
              setPrivatePayload({ shellType: 'BLANK' });
              setActiveItemAnimation({ itemId: 'adrenaline', userId: userId || 'local', targetId: null });
              setTimeout(() => {
                setActiveItemAnimation({ itemId: 'magnifier', userId: userId || 'local', targetId: null });
              }, 1500);
              setTimeout(() => { setActiveItemAnimation(null); setAnimationLocked(false); setPrivatePayload(null); }, 3800);
            }}>STEAL MAGNIFIER</button>

          <button className="px-2 py-1 bg-purple-950 text-white text-[9px] font-bold rounded cursor-pointer"
            onClick={() => {
              if (animationLocked) return;
              setAnimationLocked(true);
              setActiveItemAnimation({ itemId: 'adrenaline', userId: userId || 'local', targetId: null });
              setTimeout(() => {
                setActiveItemAnimation(null);
                setStolenItemPending('handcuffs');
                setTargetingAction('handcuffs');
                setAnimationLocked(false);
              }, 1500);
            }}>STEAL HANDCUFFS</button>

          {/* Handcuffs Debug */}
          <button className="px-2 py-1 bg-zinc-700 text-white text-[9px] font-bold rounded cursor-pointer"
            onClick={() => {
              if (animationLocked) return;
              setAnimationLocked(true);
              const oppId = gameState?.players.find(p => p.userId !== userId)?.userId || 'opp';
              setActiveItemAnimation({ itemId: 'handcuffs', userId: userId || 'local', targetId: oppId });
              setTimeout(() => { setActiveItemAnimation(null); setAnimationLocked(false); }, 2000);
            }}>HANDCUFF OPP</button>

          {/* Handsaw Debug */}
          <button className="px-2 py-1 bg-orange-700 text-white text-[9px] font-bold rounded cursor-pointer"
            onClick={() => {
              if (animationLocked) return;
              setAnimationLocked(true);
              setActiveItemAnimation({ itemId: 'handsaw', userId: userId || 'local', targetId: null });
              setTimeout(() => { setActiveItemAnimation(null); setAnimationLocked(false); }, 3000);
            }}>HANDSAW</button>

          {/* Other Items Debug */}
          {['magnifier', 'inverter', 'medkit'].map(itemId => {
            const meta = ITEM_META[itemId];
            return (
              <button key={itemId} className="px-2 py-1 bg-emerald-800 text-white text-[9px] font-bold rounded cursor-pointer"
                onClick={() => {
                  if (animationLocked) return;
                  setAnimationLocked(true);
                  if (itemId === 'magnifier') setPrivatePayload({ shellType: 'LIVE' });
                  setActiveItemAnimation({ itemId, userId: userId || 'local', targetId: null });
                  setTimeout(() => { setActiveItemAnimation(null); setAnimationLocked(false); setPrivatePayload(null); }, 2000);
                }}>
                {meta?.icon} {meta?.name?.toUpperCase() || itemId.toUpperCase()}
              </button>
            );
          })}
        </div>
        {/* ── Ambient Dust ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
          {dustParticles.map(p => (
            <div key={p.id} className="absolute bg-white/50 rounded-full" style={{
              left: `${p.left}%`, top: `${p.top}%`, width: `${p.size}px`, height: `${p.size}px`,
              animation: `cc-float ${p.duration}s ${p.delay}s infinite linear`
            }} />
          ))}
        </div>

        {/* ── Low HP Vignette ── */}
        {me && me.hp > 0 && me.hp <= 2 && (
          <div className="absolute inset-0 pointer-events-none z-10" style={{
            background: 'radial-gradient(circle at center, transparent 40%, rgba(127,29,29,0.35) 100%)',
            animation: 'cc-vignette-pulse 1.5s ease-in-out infinite'
          }} />
        )}

        <TurnIndicator isMyTurn={isMyTurn} />

        {/* ── Top Bar ── */}
        <div className="relative z-30 flex items-center justify-between px-4 py-2.5 bg-black/60 backdrop-blur-md border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <button onClick={handleLeave} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><LogOut className="w-4 h-4 text-zinc-500" /></button>
            <span className="font-black text-red-500 uppercase tracking-[0.2em] text-xs">Chamber Clash</span>
          </div>

          {/* ── Mid-game HUD (Shell counts removed for suspense) ── */}
          <div className="flex items-center gap-4">
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowRules(true)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Rules">
              <BookOpen className="w-4 h-4 text-zinc-500" />
            </button>
            <button onClick={() => setShowActionLog(!showActionLog)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Action Log">
              <ScrollText className="w-4 h-4 text-zinc-500" />
            </button>
            <button onClick={toggleMute} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? <VolumeX className="w-4 h-4 text-zinc-500" /> : <Volume2 className="w-4 h-4 text-zinc-500" />}
            </button>
          </div>
        </div>

        {/* ── Event Banner ── */}
        <AnimatePresence>
          {isAnimating && currentBannerText && (
            <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              className="absolute top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
              <div className="px-5 py-1.5 bg-black/90 backdrop-blur rounded-full font-black tracking-[0.15em] text-red-500 shadow-2xl border border-red-500/15 text-[11px]">
                {currentBannerText}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Extra Turn Banner ── */}
        <AnimatePresence>
          {extraTurnPlayerId && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute top-28 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
              <div className="px-5 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-yellow-400 font-black text-sm tracking-wide">
                🔄 Extra Turn!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Shell Ejected Banner ── */}
        <AnimatePresence>
          {ejectedShellType && (
            <motion.div initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="absolute top-28 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
              <div className={`px-5 py-2 rounded-full font-black text-sm tracking-wide border ${
                ejectedShellType === 'LIVE' ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-zinc-500/20 border-zinc-500/30 text-zinc-400'
              }`}>
                🍺 Shell Ejected — {ejectedShellType === 'LIVE' ? '🔴 LIVE' : '⚪ BLANK'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Magnifier Reveal ── */}
        <AnimatePresence>
          {revealedShell && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
              <div className="bg-black/95 border-2 border-blue-500/30 rounded-2xl p-6 text-center shadow-[0_0_40px_rgba(59,130,246,0.3)]">
                <div className="text-4xl mb-2">🔍</div>
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Current Shell</div>
                <div className={`text-3xl font-black ${revealedShell === 'LIVE' ? 'text-red-500' : 'text-zinc-400'}`}>
                  {revealedShell === 'LIVE' ? '🔴 LIVE' : '⚪ BLANK'}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>



        {/* ── Stealing Target Inventory Modal ── */}
        <AnimatePresence>
          {stealingFromPlayerId && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => {
                setStealingFromPlayerId(null);
                setTargetingAction(null);
              }}
              className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#0f1115] border border-amber-500/20 rounded-3xl p-6 max-w-sm w-full shadow-[0_0_50px_rgba(0,0,0,0.8)] relative flex flex-col gap-4">
                
                {/* Close button */}
                <button onClick={() => {
                  setStealingFromPlayerId(null);
                  setTargetingAction(null);
                }} className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors">
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 border-b border-white/[0.06] pb-3">
                  <span className="text-xl">💉</span>
                  <div className="text-left">
                    <h2 className="text-sm font-black uppercase tracking-wider text-amber-400">Steal from {getPlayerName(gameState.players, stealingFromPlayerId)}</h2>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Select one item to inject and steal</p>
                  </div>
                </div>

                <div className="space-y-2 mt-2 max-h-[40vh] overflow-y-auto pr-1">
                  {gameState.players.find(p => p.userId === stealingFromPlayerId)?.inventory.map((itemId, idx) => (
                    <button key={idx}
                      onClick={() => {
                        if (isPendingAdrenaline) {
                          resolvePendingItem(gameState.gameId, userId, stealingFromPlayerId, itemId);
                        } else {
                          useItem(gameState.gameId, userId, 'adrenaline', stealingFromPlayerId, itemId);
                        }
                        setStealingFromPlayerId(null);
                        setTargetingAction(null);
                      }}
                      className="w-full p-2.5 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] hover:border-amber-500/30 rounded-xl flex items-center justify-between text-left transition-all hover:scale-[1.01]">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{ITEM_META[itemId]?.icon || "📦"}</span>
                        <div>
                          <div className="font-bold text-xs text-zinc-200">{ITEM_META[itemId]?.name || itemId}</div>
                          <div className="text-[9px] text-zinc-500 leading-normal">{ITEM_META[itemId]?.desc}</div>
                        </div>
                      </div>
                      <span className="text-amber-500 text-[10px] font-black uppercase tracking-wider pl-2 flex-shrink-0">Steal ➔</span>
                    </button>
                  ))}
                  {(!gameState.players.find(p => p.userId === stealingFromPlayerId)?.inventory || 
                    gameState.players.find(p => p.userId === stealingFromPlayerId)?.inventory.length === 0) && (
                    <div className="text-center text-xs text-zinc-600 font-bold uppercase tracking-widest py-8">Empty inventory</div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Action Log Sidebar (Overlay) ── */}
        <AnimatePresence>
          {showActionLog && (
            <>
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowActionLog(false)}
                className="absolute inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
              />
              {/* Sidebar / Bottom Sheet */}
              <motion.div 
                initial={{ x: '100%', y: 0 }} 
                animate={{ x: 0, y: 0 }} 
                exit={{ x: '100%', y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute top-0 right-0 w-full md:w-[360px] h-[70vh] md:h-full bottom-0 md:top-0 mt-auto md:mt-0 bg-black/80 md:border-l border-t md:border-t-0 border-white/[0.04] backdrop-blur-xl z-50 flex flex-col shadow-2xl rounded-t-3xl md:rounded-none"
              >
                <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                  <span className="text-sm font-black text-zinc-300 uppercase tracking-widest">Action Log</span>
                  <button onClick={() => setShowActionLog(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X className="w-5 h-5 text-zinc-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {actionLog.length === 0 && <div className="text-sm text-zinc-600 text-center py-8">No actions yet</div>}
                  {actionLog.map(entry => (
                    <div key={entry.id} className="flex items-start gap-3 text-sm p-2 bg-white/[0.02] rounded-lg">
                      <span className="text-lg">{entry.icon}</span>
                      <span className={`${entry.color} leading-tight pt-0.5`}>{entry.text}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} className="h-4" />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Top-Down Adrenaline Selection Banner */}
        {isStealSelectionMode && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto bg-cyan-950/90 border border-cyan-400/60 text-cyan-300 px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider shadow-[0_0_30px_rgba(6,182,212,0.4)] flex items-center gap-3 animate-pulse">
            <span>💉 ADRENALINE ACTIVE — CLICK AN OPPONENT ITEM ON THE TABLE TO STEAL</span>
            <button 
              onClick={() => {
                setIsStealSelectionMode(false);
                setAnimationLocked(false);
              }}
              className="px-2 py-0.5 bg-red-900/60 hover:bg-red-800 text-red-200 rounded text-[9px] uppercase font-bold"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── MAIN GAME AREA ── */}
        <div className="flex-1 relative z-20 flex items-center justify-center overflow-hidden w-full h-full">
          <ChamberClash3D
            gameState={gameState}
            userId={userId}
            eventQueue={eventQueue}
            isAnimating={isAnimating}
            targetingAction={targetingAction}
            gunState={gunState}
            gunTarget={gunTarget}
            shellType={currentShellType}
            activeItemAnimation={activeItemAnimation}
            ejectedShellType={ejectedShellType as any}
            isBarrelShortened={isBarrelShortened}
            privatePayload={privatePayload}
            burnerPhoneResult={burnerPhoneReveal || privatePayload}
            isStealSelectionMode={isStealSelectionMode}
            onShotgunClick={() => {
              if (animationLocked || isPendingAction || !isMyTurn) return;
              setTargetingAction('shoot');
            }}
            onSelectStolenItem={(stolenItemId) => {
              console.log('[ADRENALINE 3D STEAL CLICKED]', stolenItemId);
              if (stolenItemId === 'adrenaline') {
                return;
              }

              const opp = gameState?.players.find(p => p.userId !== userId);
              const oppId = opp?.userId || 'opp';

              setIsStealSelectionMode(false);
              setStolenItemPending(stolenItemId);

              if (stolenItemId === 'handcuffs') {
                // 2-Stage Stolen Item (Handcuffs): Transition directly into player target selection
                setTargetingAction('handcuffs');
                setAnimationLocked(false);
              } else {
                setTargetingAction(null);
              }

              if (gameState) {
                useItem(gameState.gameId, userId || '', 'adrenaline', oppId, stolenItemId);
              }
            }}
            onCameraReturned={() => {
              console.log('[CAMERA RETURNED TO FP]', stolenItemPending);
              if (stolenItemPending && stolenItemPending !== 'handcuffs') {
                const nextItem = stolenItemPending;
                setStolenItemPending(null);
                setAnimationLocked(true);
                setActiveItemAnimation({
                  itemId: nextItem,
                  userId: userId || 'local',
                  targetId: null
                });
                const meta = ITEM_META[nextItem];
                if (meta) meta.sound();

                const config = getItemAnimConfig(nextItem, true, false);
                setTimeout(() => {
                  setActiveItemAnimation(null);
                  setAnimationLocked(false);
                }, Math.ceil(config.totalDuration * 1000) + 1000);
              }
            }}
            onUseItem={(itemId) => {
              if (animationLocked || isPendingAction) return;
              if (itemId === 'adrenaline') {
                const opp = gameState?.players.find(p => p.userId !== userId);
                const oppStealableItems = opp?.inventory?.filter((id: string) => id !== 'adrenaline') || [];
                if (oppStealableItems.length === 0) {
                  addLogEntry("No valid items to steal!", "⚠️", "text-amber-400");
                  return;
                }
                setAnimationLocked(true);
                setActiveItemAnimation({
                  itemId: 'adrenaline',
                  userId: userId || 'local',
                  targetId: null
                });
                setTimeout(() => {
                  setActiveItemAnimation(null);
                  setIsStealSelectionMode(true);
                }, 1500);
              } else if (itemId === 'handcuffs') {
                setTargetingAction('handcuffs');
              } else {
                useItem(gameState.gameId, userId || '', itemId);
              }
            }}
            onSelectTarget={(targetId) => {
              if (animationLocked) return;
              if (targetingAction === 'shoot') {
                shootTarget(gameState.gameId, userId || '', targetId);
                setTargetingAction(null);
              } else if (targetingAction === 'handcuffs') {
                if (stolenItemPending === 'handcuffs' || isPendingHandcuffs) {
                  // Authoritative stolen Handcuffs resolution
                  resolvePendingItem(gameState.gameId, userId || '', targetId, 'handcuffs');
                  setStolenItemPending(null);
                  setTargetingAction(null);
                } else {
                  // Direct Handcuffs resolution
                  useItem(gameState.gameId, userId || '', 'handcuffs', targetId);
                  setTargetingAction(null);
                }
              }
            }}
            onAnimationComplete={() => {
              setActiveItemAnimation(null);
              setAnimationLocked(false);
            }}
            onBarrelCut={() => {
              setLocalBarrelCut(true);
            }}
            onShotgunPump={() => {
              sounds.playPump();
            }}
            onFireMoment={() => {
              // Sound/flash triggered by state machine / event handler
            }}
            onShotgunSequenceComplete={() => {
              setGunState('idle');
              setGunTarget(null);
              setCurrentShellType(null);
              setAnimationLocked(false);
              setLocalBarrelCut(false);
            }}
          />
        </div>

        {/* ── Persistent Local Player Health Indicator HUD ── */}
        {gameState?.players && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            {(() => {
              const localPlayer = gameState.players.find((p: any) => p.userId === userId) || gameState.players[0];
              if (!localPlayer) return null;
              return (
                <PlayerHealthIndicator
                  player={localPlayer}
                  maxHp={gameState.settings?.startingHp || 4}
                  isLocal={true}
                />
              );
            })()}
          </div>
        )}

        {/* ── Bottom Action Bar ── */}
        <div className="relative z-30 bg-black/70 border-t border-white/[0.04] backdrop-blur-md px-4 py-3">
          <div className="max-w-4xl mx-auto">
            {isMyTurn ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full">
                {targetingAction === 'shoot' ? (
                  <div className="flex items-center justify-between w-full bg-red-950/30 border border-red-500/40 rounded-xl p-3 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                    <div className="flex items-center gap-3">
                      <span className="text-xl animate-pulse">🎯</span>
                      <div className="text-left">
                        <div className="text-xs font-bold text-red-400 uppercase tracking-widest leading-normal">Shooting Target Selection Active</div>
                        <p className="text-[10px] text-zinc-400">Click YOU to Shoot Self, or click Opponent marker across table.</p>
                      </div>
                    </div>
                    <button onClick={() => setTargetingAction(null)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">
                      Cancel
                    </button>
                  </div>
                ) : activeStealMode ? (
                  <div className="flex items-center justify-between w-full bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 shadow-[0_0_20px_rgba(245,158,11,0.05)]">
                    <div className="flex items-center gap-3">
                      <span className="text-xl animate-pulse">💉</span>
                      <div className="text-left">
                        <div className="text-xs font-bold text-amber-400 uppercase tracking-widest leading-normal">Adrenaline Active</div>
                        <p className="text-[10px] text-zinc-400">Select an opponent item on the table to steal.</p>
                      </div>
                    </div>
                    <button onClick={() => {
                      setTargetingAction(null);
                      setIsStealSelectionMode(false);
                      setStolenItemPending(null);
                    }} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">
                      Cancel
                    </button>
                  </div>
                ) : activeHandcuffMode ? (
                  <div className="flex items-center justify-between w-full bg-zinc-900/90 border border-zinc-500/30 rounded-xl p-3 shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                    <div className="flex items-center gap-3">
                      <span className="text-xl animate-pulse">⛓️</span>
                      <div className="text-left">
                        <div className="text-xs font-bold text-zinc-200 uppercase tracking-widest leading-normal">{isPendingHandcuffs ? 'Stolen Handcuffs Active' : 'Handcuffs Active'}</div>
                        <p className="text-[10px] text-zinc-400">Select opponent marker across table to handcuff.</p>
                      </div>
                    </div>
                    <button onClick={() => {
                      setTargetingAction(null);
                      setStolenItemPending(null);
                    }} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between sm:w-auto bg-zinc-900/70 border border-white/[0.06] rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🔫</span>
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider whitespace-nowrap">Click Physical Shotgun to Shoot</span>
                    </div>
                  </div>
                )}

                  {/* Divider */}
                  <div className="hidden sm:block w-px h-8 bg-white/[0.06]" />

                  {/* Item inventory */}
                  <div className="flex gap-2 overflow-x-auto w-full sm:flex-1 py-1">
                    {me?.inventory.map((itemId, i) => {
                      const meta = ITEM_META[itemId] || { name: itemId, icon: "📦", desc: "", color: "text-zinc-400", sound: () => {} };
                      return (
                        <button key={i} disabled={isPendingAction}
                          onClick={() => {
                            if (isPendingAction) return;
                            if (itemId === 'adrenaline') {
                              setTargetingAction('adrenaline');
                            } else if (itemId === 'handcuffs') {
                              setTargetingAction('handcuffs');
                            } else {
                              useItem(gameState.gameId, userId, itemId, userId);
                            }
                          }}
                          className={`min-w-[70px] h-[70px] rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${
                            isPendingAction
                              ? 'bg-zinc-950/80 border-white/[0.02] cursor-not-allowed opacity-50 grayscale'
                              : 'bg-zinc-950/80 border-white/[0.06] hover:border-red-500/30 hover:bg-[#141518] cursor-pointer hover:shadow-[0_0_12px_rgba(239,68,68,0.1)]'
                          }`}
                          title={meta.desc}>
                          <span className="text-lg">{meta.icon}</span>
                          <span className={`text-[8px] font-bold ${meta.color}`}>{meta.name}</span>
                        </button>
                      );
                    })}
                    {(!me?.inventory || me.inventory.length === 0) && (
                      <div className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest flex items-center">No items</div>
                    )}
                  </div>
                </div>
            ) : (
              <div className="text-center py-1">
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  {gameState.status === 'FINISHED' ? 'Match Over' :
                    isAnimating ? 'Animating...' :
                    `Waiting for ${getPlayerName(gameState.players, visualTurnPlayerId)}`
                  }
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Cinematic Round Start Overlay ── */}
        <AnimatePresence>
          {showRoundOverlay && roundOverlayData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 z-50 flex items-center justify-center pointer-events-none">
              <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -10 }}
                className="text-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em] mb-2">Loading Chamber</motion.div>
                <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, type: 'spring' }}
                  className="text-5xl font-black text-white mb-6 tracking-wide">Round {roundOverlayData.round}</motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                  className="flex items-center justify-center gap-8 mb-6">
                  <div className="text-center">
                    <div className="flex gap-1 mb-1.5 justify-center">
                      {Array.from({ length: roundOverlayData.live }).map((_, i) => (
                        <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}
                          transition={{ delay: 1 + i * 0.15, type: 'spring', stiffness: 400 }}
                          className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-red-400">Live: {roundOverlayData.live}</span>
                  </div>
                  <div className="text-center">
                    <div className="flex gap-1 mb-1.5 justify-center">
                      {Array.from({ length: roundOverlayData.blank }).map((_, i) => (
                        <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}
                          transition={{ delay: 1 + (roundOverlayData.live + i) * 0.15, type: 'spring', stiffness: 400 }}
                          className="w-3 h-3 rounded-full bg-zinc-600" />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-zinc-400">Blank: {roundOverlayData.blank}</span>
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }}
                  className="text-[10px] text-zinc-600 uppercase tracking-widest">{roundOverlayData.total} shells loaded</motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Victory Overlay ── */}
        <AnimatePresence>
          {gameState.status === 'FINISHED' && !isAnimating && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/93 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
              <motion.div initial={{ y: 40, scale: 0.9 }} animate={{ y: 0, scale: 1 }}
                className="bg-[#0c0d10] border border-red-500/15 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                <div className="text-5xl mb-4">🏆</div>
                <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-wide">Match Over</h2>
                {gameState.winnerId ? (
                  <p className="text-red-400 font-bold mb-6">
                    {getPlayerName(gameState.players, gameState.winnerId)} survived!
                  </p>
                ) : (
                  <p className="text-zinc-500 font-bold mb-6">Draw</p>
                )}
                <div className="text-[10px] text-zinc-600 mb-4 uppercase tracking-wider">{gameState.roundNumber} rounds played</div>
                <button onClick={handleLeave}
                  className="w-full py-3 bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08] rounded-xl font-bold transition-colors">
                  Return to Lobby
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>



        {/* ── Error Toast ── */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-600/20 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Inline Styles ── */}
        <style jsx global>{`
          @keyframes cc-shake {
            0%, 100% { transform: translate(0, 0); }
            10% { transform: translate(-2px, -1px); }
            20% { transform: translate(2px, 1px); }
            30% { transform: translate(-1px, 2px); }
            40% { transform: translate(1px, -1px); }
            50% { transform: translate(-2px, 1px); }
            60% { transform: translate(2px, -1px); }
            70% { transform: translate(-1px, -2px); }
            80% { transform: translate(1px, 1px); }
            90% { transform: translate(-1px, 1px); }
          }
          .cc-shake { animation: cc-shake 0.4s infinite; }
          @keyframes cc-float {
            0% { transform: translateY(0) translateX(0); opacity: 0; }
            10% { opacity: 0.3; }
            90% { opacity: 0.3; }
            100% { transform: translateY(-100vh) translateX(20px); opacity: 0; }
          }
          @keyframes cc-smoke {
            0% { transform: scale(0.4); opacity: 0.8; }
            100% { transform: scale(2.5) translateY(-50px); opacity: 0; }
          }
          @keyframes cc-vignette-pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          .cc-table-wrapper {
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            transform-origin: center center;
          }
          @media (max-width: 1024px) {
            .cc-table-wrapper { transform: scale(0.95); }
          }
          @media (max-width: 768px) {
            .cc-table-wrapper { transform: scale(0.92); }
          }
          @media (max-width: 640px) {
            .cc-table-wrapper { transform: scale(0.9); }
          }
          @media (max-width: 480px) {
            .cc-table-wrapper { transform: scale(0.85); }
          }
          @media (max-width: 380px) {
            .cc-table-wrapper { transform: scale(0.8); }
          }
        `}</style>
        <AnimatePresence>
          {showRules && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowRules(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#0f1115] border border-white/[0.08] rounded-3xl p-6 md:p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-[0_0_50px_rgba(0,0,0,0.8)] relative flex flex-col gap-5">
                
                {/* Close button */}
                <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors">
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 border-b border-white/[0.06] pb-3">
                  <BookOpen className="w-6 h-6 text-red-500" />
                  <h2 className="text-xl font-black uppercase tracking-wider">How to Play</h2>
                </div>

                <div className="space-y-4 text-xs text-zinc-300 leading-relaxed overflow-y-auto pr-1">
                  <div>
                    <h3 className="font-bold text-red-400 uppercase tracking-wide mb-1 text-[11px]">Core Objective</h3>
                    <p>Be the last player standing in a high-stakes, turn-based Russian Roulette duel. Each player starts with 5 HP.</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-red-400 uppercase tracking-wide mb-1 text-[11px]">The Chamber</h3>
                    <p>At the start of each round, the shotgun is loaded with a random mixture of <strong>LIVE (🔴)</strong> and <strong>BLANK (⚪)</strong> shells. The counts are revealed only once during the load intro sequence—remember them!</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-red-400 uppercase tracking-wide mb-1 text-[11px]">Turn Actions</h3>
                    <ul className="list-disc pl-4 space-y-1 mt-1">
                      <li><strong>Shoot Target:</strong> Point the barrel at an opponent. If it is <strong>LIVE (🔴)</strong>, they lose 1 HP. If <strong>BLANK (⚪)</strong>, no damage is dealt. In both cases, your turn ends.</li>
                      <li><strong>Shoot Self:</strong> Fire at yourself. If it is a <strong>BLANK (⚪)</strong> shell, you are granted an <strong>extra turn</strong>! If it is a <strong>LIVE (🔴)</strong> shell, you take 1 damage and your turn ends.</li>
                    </ul>
                  </div>

                  <div className="border-t border-white/[0.06] pt-3">
                    <h3 className="font-bold text-red-400 uppercase tracking-wide mb-2 text-[11px]">Item Directory</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded-xl flex gap-2">
                        <span className="text-base">🔍</span>
                        <div>
                          <strong className="text-blue-400 block">Magnifier</strong>
                          Peeks privately at the current shell in the chamber.
                        </div>
                      </div>
                      <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded-xl flex gap-2">
                        <span className="text-base">💊</span>
                        <div>
                          <strong className="text-green-400 block">Medkit</strong>
                          Heals you for 1 HP. Cannot exceed max HP.
                        </div>
                      </div>
                      <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded-xl flex gap-2">
                        <span className="text-base">🔄</span>
                        <div>
                          <strong className="text-cyan-400 block">Inverter</strong>
                          Converts the current shell: LIVE ➔ BLANK or BLANK ➔ LIVE.
                        </div>
                      </div>
                      <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded-xl flex gap-2">
                        <span className="text-base">📞</span>
                        <div>
                          <strong className="text-amber-400 block">Burner Phone</strong>
                          Reveal information about one upcoming shell privately.
                        </div>
                      </div>
                      <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded-xl flex gap-2">
                        <span className="text-base">🪚</span>
                        <div>
                          <strong className="text-orange-400 block">Handsaw</strong>
                          Saws off the barrel to deal double damage (2 HP) on your next shot.
                        </div>
                      </div>
                      <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded-xl flex gap-2">
                        <span className="text-base">⛓️</span>
                        <div>
                          <strong className="text-zinc-400 block">Handcuffs</strong>
                          Skips the targeted player&apos;s next turn.
                        </div>
                      </div>
                      <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded-xl flex gap-2">
                        <span className="text-base">🍺</span>
                        <div>
                          <strong className="text-amber-400 block">Beer</strong>
                          Ejects the current shell without firing it, revealing it to all players.
                        </div>
                      </div>
                      <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded-xl flex gap-2">
                        <span className="text-base">💉</span>
                        <div>
                          <strong className="text-amber-500 block">Adrenaline</strong>
                          Steal one item from an opponent&apos;s inventory and use it immediately.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button onClick={() => setShowRules(false)} className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors mt-2">
                  Got it
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return null;
}

export default function ChamberClashPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-[#050607] items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    }>
      <ChamberClashGameContent />
    </Suspense>
  );
}
