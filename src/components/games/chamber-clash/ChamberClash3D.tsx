"use client";

import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Html, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { dampV3 } from "./animationConfigs";
import { CHAMBER_CLASH_ASSETS } from "@/lib/chamberClashAssets";
import { useChamberClashStore, type ChamberClashState } from "@/store/useChamberClashStore";

import { PlayerTargetSelector } from "./PlayerTargetSelector";
import { EjectedShell } from "./EjectedShell";
import { PlayerHealthIndicator } from "./PlayerHealthIndicator";
import { getClientRelativeSeats, type SeatLayout } from "./seatLayout";

export function preloadChamberClashAssets() {
  Object.values(CHAMBER_CLASH_ASSETS).forEach((url) => {
    useGLTF.preload(url);
  });
}

interface ChamberClash3DProps {
  gameState: ChamberClashState | null;
  userId: string | null;
  eventQueue: any[];
  isAnimating: boolean;
  targetingAction: 'shoot' | 'handcuffs' | 'adrenaline' | null;
  gunState: 'idle' | 'pointing' | 'pump' | 'firing';
  gunTarget: 'local' | 'opponent' | null;
  targetPlayerId?: string | null;
  stealingFromPlayerId?: string | null;
  shellType?: 'LIVE' | 'BLANK' | null;
  activeItemAnimation: { itemId: string; userId: string; targetId: string | null } | null;
  /** Shell type for the beer ejection animation */
  ejectedShellType?: 'LIVE' | 'BLANK' | null;
  /** Whether the handsaw barrel-cut is active */
  isBarrelShortened?: boolean;
  privatePayload?: any;
  burnerPhoneResult?: any;
  isStealSelectionMode?: boolean;
  isSpectating?: boolean;
  onShotgunClick?: () => void;
  onSelectStolenItem?: (payload: { ownerPlayerId: string; itemId: string } | string) => void;
  onCameraReturned?: () => void;
  onUseItem?: (itemId: string, targetId?: string) => void;
  onShootTarget?: (targetId: string) => void;
  onSelectTarget?: (targetId: string) => void;
  onAnimationComplete?: () => void;
  onBarrelCut?: () => void;
  onShotgunPump?: () => void;
  onFireMoment?: () => void;
  onShotgunSequenceComplete?: () => void;
}

// Hardcoded STATIC positions from Blender
const ITEM_MESH_MAP: Record<string, string> = {
  magnifier: "ITEM_MAGNIFIER",
  medkit: "ITEM_MEDKIT",
  handcuffs: "ITEM_HANDCUFFS",
  inverter: "ITEM_INVERTER",
  burner_phone: "ITEM_BURNER_PHONE",
  adrenaline: "ITEM_ADRENALINE",
  handsaw: "ITEM_HANDSAW",
  beer: "ITEM_BEER"
};

const ITEM_ROTATIONS: Record<string, [number, number, number]> = {
  magnifier: [0, 0, 0],
  medkit: [0, Math.PI, 0],
  handcuffs: [0, 0, 0],
  inverter: [0, 0, 0],
  burner_phone: [0, Math.PI, 0],
  adrenaline: [0, 0, 0],
  handsaw: [0, Math.PI/4, 0],
  beer: [0, 0, 0]
};

import { TableSurface } from "./TableSurface";
import { InteractiveItem } from "./InteractiveItem";
import { InteractiveOpponent } from "./InteractiveOpponent";
import { InteractiveShotgun } from "./InteractiveShotgun";
import { AnimatedGhostItem } from "./AnimatedGhostItem";
import { BeerAnimation } from "./BeerAnimation";
import { HandsawAnimation } from "./HandsawAnimation";
import { BurnerPhoneAnimation } from "./BurnerPhoneAnimation";
import { AdrenalineAnimation } from "./AdrenalineAnimation";
import { HandcuffsAnimation, RestrainedHandcuffs } from "./HandcuffsAnimation";
import { MagnifierAnimation } from "./MagnifierAnimation";
import { InverterAnimation } from "./InverterAnimation";
import { MedkitAnimation } from "./MedkitAnimation";

const WEAPON_TABLE_REST = {
  position: [0, 0.77, 0.05] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1.2, 1.2, 1.2] as [number, number, number]
};

const LOCAL_ITEM_SLOTS = [
  { id: "slot-0", position: [-0.4, 0.77, 0.35] as [number, number, number] },
  { id: "slot-1", position: [-0.2, 0.77, 0.35] as [number, number, number] },
  { id: "slot-2", position: [0.0, 0.77, 0.35] as [number, number, number] },
  { id: "slot-3", position: [0.2, 0.77, 0.35] as [number, number, number] },
  { id: "slot-4", position: [0.4, 0.77, 0.35] as [number, number, number] },
];

const OPPONENT_ITEM_SLOTS = [
  { id: "slot-0", position: [0.4, 0.77, -0.35] as [number, number, number] },
  { id: "slot-1", position: [0.2, 0.77, -0.35] as [number, number, number] },
  { id: "slot-2", position: [0.0, 0.77, -0.35] as [number, number, number] },
  { id: "slot-3", position: [-0.2, 0.77, -0.35] as [number, number, number] },
  { id: "slot-4", position: [-0.4, 0.77, -0.35] as [number, number, number] },
];

const OPPONENT_TARGET_HITBOX = {
  position: [0, 1.0, -0.55] as [number, number, number],
  size: [0.4, 0.6, 0.4] as [number, number, number]
};

function LoaderOverlay() {
  const { progress, active } = useProgress();
  if (!active) return null;
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3 bg-zinc-950/90 border border-red-500/30 p-6 rounded-2xl backdrop-blur-md shadow-2xl text-white select-none">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        <div className="font-mono text-sm font-bold tracking-widest text-red-400">
          LOADING CHAMBER CLASH 3D ({Math.round(progress)}%)
        </div>
      </div>
    </Html>
  );
}

function TargetSelectionCamera({
  targetingAction,
  isStealSelectionMode,
  stealingFromPlayerId,
  isSpectating,
  seatMap,
  onCameraReturned
}: {
  targetingAction: 'shoot' | 'handcuffs' | 'adrenaline' | null;
  isStealSelectionMode: boolean;
  stealingFromPlayerId?: string | null;
  isSpectating?: boolean;
  seatMap: Record<string, SeatLayout>;
  onCameraReturned?: () => void;
}) {
  const { camera } = useThree();

  const normalPos = useMemo(() => new THREE.Vector3(0, 1.3, 1.2), []);
  const normalLookAt = useMemo(() => new THREE.Vector3(0, 0.77, -0.4), []);

  const spectatorPos = useMemo(() => new THREE.Vector3(0, 1.85, 1.45), []);
  const spectatorLookAt = useMemo(() => new THREE.Vector3(0, 0.75, -0.30), []);

  const victimSeat = stealingFromPlayerId ? seatMap[stealingFromPlayerId] : null;

  const selectionPos = useMemo(() => {
    if (isStealSelectionMode || targetingAction === 'adrenaline') {
      // Global top-down camera framing ALL outer opponent inventory zones simultaneously
      return new THREE.Vector3(0, 2.45, 0.55);
    }
    // Default target selection view
    return new THREE.Vector3(0, 1.70, 0.40);
  }, [isStealSelectionMode, targetingAction]);

  const selectionLookAt = useMemo(() => {
    if (isStealSelectionMode || targetingAction === 'adrenaline') {
      return new THREE.Vector3(0, 0.77, -0.10);
    }
    return new THREE.Vector3(0, 0.77, -0.20);
  }, [isStealSelectionMode, targetingAction]);

  const targetPos = useRef(new THREE.Vector3().copy(normalPos));
  const targetLookAt = useRef(new THREE.Vector3().copy(normalLookAt));
  const currentLookAt = useRef(new THREE.Vector3().copy(normalLookAt));

  const wasActive = useRef(false);
  const isActive = Boolean(targetingAction || isStealSelectionMode);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    if (isSpectating) {
      targetPos.current.copy(spectatorPos);
      targetLookAt.current.copy(spectatorLookAt);
    } else if (isActive) {
      targetPos.current.copy(selectionPos);
      targetLookAt.current.copy(selectionLookAt);
      wasActive.current = true;
    } else {
      targetPos.current.copy(normalPos);
      targetLookAt.current.copy(normalLookAt);
    }

    dampV3(camera.position, targetPos.current, 6, dt);
    dampV3(currentLookAt.current, targetLookAt.current, 6, dt);
    camera.lookAt(currentLookAt.current);

    if (wasActive.current && !isActive) {
      const distToNormal = camera.position.distanceTo(normalPos);
      if (distToNormal < 0.04) {
        wasActive.current = false;
        onCameraReturned?.();
      }
    }
  });

  return null;
}

function StaticScene({ 
  gameState, 
  userId,
  targetPlayerId,
  stealingFromPlayerId,
  targetingAction,
  gunState,
  gunTarget,
  shellType,
  activeItemAnimation,
  ejectedShellType,
  isBarrelShortened,
  privatePayload,
  burnerPhoneResult,
  isStealSelectionMode,
  isSpectating,
  onShotgunClick,
  onSelectStolenItem,
  onCameraReturned,
  onUseItem,
  onSelectTarget,
  onAnimationComplete,
  onBarrelCut,
  onShotgunPump,
  onFireMoment,
  onShotgunSequenceComplete
}: { 
  gameState: ChamberClashState | null, 
  userId: string | null,
  targetPlayerId?: string | null,
  stealingFromPlayerId?: string | null,
  targetingAction: 'shoot' | 'handcuffs' | 'adrenaline' | null,
  gunState: 'idle' | 'pointing' | 'pump' | 'firing',
  gunTarget: 'local' | 'opponent' | null,
  shellType?: 'LIVE' | 'BLANK' | null,
  activeItemAnimation: { itemId: string; userId: string; targetId: string | null } | null,
  ejectedShellType?: 'LIVE' | 'BLANK' | null,
  isBarrelShortened?: boolean,
  privatePayload?: any,
  burnerPhoneResult?: any,
  isStealSelectionMode?: boolean,
  isSpectating?: boolean,
  onShotgunClick?: () => void,
  onSelectStolenItem?: (payload: { ownerPlayerId: string; itemId: string } | string) => void,
  onCameraReturned?: () => void,
  onUseItem?: (itemId: string, targetId?: string) => void,
  onSelectTarget?: (targetId: string) => void,
  onAnimationComplete?: () => void,
  onBarrelCut?: () => void,
  onShotgunPump?: () => void,
  onFireMoment?: () => void,
  onShotgunSequenceComplete?: () => void,
}) {
  const envGLTF = useGLTF(CHAMBER_CLASH_ASSETS.environment);
  const charGLTF = useGLTF(CHAMBER_CLASH_ASSETS.characterUpper);
  const shotgunGLTF = useGLTF(CHAMBER_CLASH_ASSETS.shotgun);
  const itemsGLTF = useGLTF(CHAMBER_CLASH_ASSETS.items);
  const fpArmsGLTF = useGLTF(CHAMBER_CLASH_ASSETS.fpArms);

  const seatMap = useMemo(() => {
    return getClientRelativeSeats(gameState?.players || [], userId);
  }, [gameState?.players, userId]);

  const localPlayer = gameState?.players?.find(p => p.userId === userId) || gameState?.players?.[0];
  const opponents = useMemo(() => {
    if (!gameState?.players) return [];
    const localId = localPlayer?.userId;
    return gameState.players.filter(p => p.userId !== localId);
  }, [gameState?.players, localPlayer?.userId]);

  const localInventory = localPlayer?.inventory || [];

  const storeSelectedTargetId = useChamberClashStore(state => state.selectedTargetId);

  const customTargetPos = useMemo(() => {
    const activeTargetId = targetPlayerId || storeSelectedTargetId;
    if (activeTargetId && seatMap[activeTargetId]) {
      return seatMap[activeTargetId].anchors.chest;
    }
    if (gunTarget === 'local' && localPlayer && seatMap[localPlayer.userId]) {
      return seatMap[localPlayer.userId].anchors.chest;
    }
    const farOpponent = opponents.find(p => seatMap[p.userId]?.role === 'FAR') || opponents[0];
    if (farOpponent && seatMap[farOpponent.userId]) {
      return seatMap[farOpponent.userId].anchors.chest;
    }
    return undefined;
  }, [targetPlayerId, storeSelectedTargetId, gunTarget, seatMap, localPlayer, opponents]);

  const handleItemClick = (itemId: string) => {
    if (onUseItem) {
      onUseItem(itemId);
    }
  };

  // Determine which animation component to render for the active item
  const renderItemAnimation = () => {
    if (!activeItemAnimation) return null;

    const meshName = ITEM_MESH_MAP[activeItemAnimation.itemId];
    const sourceMesh = itemsGLTF.nodes[meshName] as THREE.Mesh;
    const customMeshItems = ['inverter', 'beer', 'adrenaline', 'medkit', 'handsaw', 'burner_phone'];
    if (!sourceMesh && !customMeshItems.includes(activeItemAnimation.itemId)) return null;

    const baseRot = ITEM_ROTATIONS[activeItemAnimation.itemId] || [0, 0, 0];
    const actorSeat = seatMap[activeItemAnimation.userId];
    const targetSeat = activeItemAnimation.targetId ? seatMap[activeItemAnimation.targetId] : undefined;

    // Dedicated component dispatch for all 8 items
    switch (activeItemAnimation.itemId) {
      case 'beer':
        return (
          <BeerAnimation
            animation={activeItemAnimation}
            sourceMesh={sourceMesh}
            localUserId={userId}
            actorSeat={actorSeat}
            baseRotation={baseRot}
            ejectedShellType={ejectedShellType}
            onShotgunPump={onShotgunPump}
            onComplete={onAnimationComplete}
          />
        );
      case 'burner_phone':
        return (
          <BurnerPhoneAnimation
            animation={activeItemAnimation}
            sourceMesh={sourceMesh}
            localUserId={userId}
            actorSeat={actorSeat}
            burnerPhoneResult={burnerPhoneResult || privatePayload}
            privatePayload={privatePayload}
            onComplete={onAnimationComplete}
          />
        );
      case 'adrenaline':
        return (
          <AdrenalineAnimation
            animation={activeItemAnimation}
            sourceMesh={sourceMesh}
            localUserId={userId}
            actorSeat={actorSeat}
            baseRotation={baseRot}
            onComplete={onAnimationComplete}
          />
        );
      case 'handcuffs':
        return (
          <HandcuffsAnimation
            animation={activeItemAnimation}
            sourceMesh={sourceMesh}
            localUserId={userId}
            actorSeat={actorSeat}
            targetSeat={targetSeat}
            baseRotation={baseRot}
            targetWristPos={targetSeat?.anchors.wrist}
            onComplete={onAnimationComplete}
          />
        );
      case 'handsaw':
        return (
          <HandsawAnimation
            animation={activeItemAnimation}
            sourceMesh={sourceMesh}
            localUserId={userId}
            actorSeat={actorSeat}
            baseRotation={baseRot}
            onBarrelCut={onBarrelCut}
            onComplete={onAnimationComplete}
          />
        );
      case 'magnifier':
        return (
          <MagnifierAnimation
            animation={activeItemAnimation}
            sourceMesh={sourceMesh}
            localUserId={userId}
            actorSeat={actorSeat}
            baseRotation={baseRot}
            privatePayload={privatePayload}
            onComplete={onAnimationComplete}
          />
        );
      case 'inverter':
        return (
          <InverterAnimation
            animation={activeItemAnimation}
            sourceMesh={sourceMesh}
            localUserId={userId}
            actorSeat={actorSeat}
            baseRotation={baseRot}
            onComplete={onAnimationComplete}
          />
        );
      case 'medkit':
        return (
          <MedkitAnimation
            animation={activeItemAnimation}
            sourceMesh={sourceMesh}
            localUserId={userId}
            actorSeat={actorSeat}
            baseRotation={baseRot}
            onComplete={onAnimationComplete}
          />
        );
      default:
        return (
          <AnimatedGhostItem
            animation={activeItemAnimation}
            sourceMesh={sourceMesh}
            localUserId={userId}
            baseRotation={baseRot}
            onComplete={onAnimationComplete}
          />
        );
    }
  };

  return (
    <>
      {/* Moody atmospheric lighting */}
      <ambientLight intensity={0.2} color="#445555" />
      
      {/* Central spot on the table (Shotgun area) */}
      <spotLight 
        position={[0, 2.0, 0]} 
        color="#ffe5bf" 
        intensity={60} 
        angle={Math.PI / 3} 
        penumbra={0.8} 
        distance={4}
      />
      {/* Subtle rim light for opponent */}
      <pointLight 
        position={[0, 1.2, -1.0]} 
        color="#88aaff" 
        intensity={5} 
        distance={3}
      />

      {/* Environment (Room) */}
      <primitive object={envGLTF.scene} />

      {/* NEW Game Table Surface (Y=0.771 to overlay original table) */}
      <TableSurface yPos={0.771} />

      {/* Opponent Characters (Rendered dynamically based on client-relative seats) */}
      {opponents.map((oppPlayer) => {
        const seat = seatMap[oppPlayer.userId];
        if (!seat) return null;
        const c = charGLTF.scene.clone();
        
        const box = new THREE.Box3().setFromObject(c);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        c.position.set(-center.x, -center.y, -center.z);
        
        const scale = 1.15;
        const groupY = 0.77 - (size.y * scale) * 0.25;
        const pos: [number, number, number] = [
          seat.characterPosition[0],
          groupY,
          seat.characterPosition[2]
        ];

        return (
          <group 
            key={`opp-char-${oppPlayer.userId}`}
            position={pos} 
            rotation={seat.characterRotation}
            scale={[scale, scale, scale]}
          >
            <primitive object={c} />
          </group>
        );
      })}

      {/* Shotgun */}
      <InteractiveShotgun
        sourceScene={shotgunGLTF.scene}
        position={WEAPON_TABLE_REST.position}
        scale={WEAPON_TABLE_REST.scale}
        gunState={gunState}
        target={gunTarget}
        customTargetPos={customTargetPos}
        shellType={shellType}
        isBarrelShortened={isBarrelShortened}
        isClickable={gunState === 'idle' && !activeItemAnimation && !isSpectating}
        onClick={onShotgunClick}
        onFireMoment={onFireMoment}
        onSequenceComplete={onShotgunSequenceComplete}
      />

      {/* Target Selection Camera Controller */}
      <TargetSelectionCamera
        targetingAction={targetingAction || null}
        isStealSelectionMode={Boolean(isStealSelectionMode)}
        stealingFromPlayerId={stealingFromPlayerId}
        isSpectating={Boolean(isSpectating)}
        seatMap={seatMap}
        onCameraReturned={onCameraReturned}
      />

      {/* In-World Interactive Player Target Markers */}
      <PlayerTargetSelector
        action={targetingAction || null}
        localUserId={userId}
        gameState={gameState}
        seatMap={seatMap}
        isStealSelectionMode={Boolean(isStealSelectionMode)}
        isSpectating={Boolean(isSpectating)}
        onSelectTarget={(targetId) => {
          onSelectTarget?.(targetId);
        }}
      />

      {/* Opponent Physical Items — Positioned strictly in owning seat's inventory zone */}
      {opponents.map((oppPlayer) => {
        const seat = seatMap[oppPlayer.userId];
        const oppInv = oppPlayer.inventory || [];
        const isVictimSelected = stealingFromPlayerId ? stealingFromPlayerId === oppPlayer.userId : true;
        const isStealActive = Boolean(isStealSelectionMode || targetingAction === 'adrenaline');
        const isMyTurn = gameState?.currentTurnPlayerId === userId;

        return oppInv.map((itemId, idx) => {
          const meshName = ITEM_MESH_MAP[itemId];
          const sourceMesh = itemsGLTF.nodes[meshName] as THREE.Mesh;
          const customMeshItems = ['inverter', 'beer', 'adrenaline', 'medkit', 'handsaw', 'burner_phone'];
          if (!sourceMesh && !customMeshItems.includes(itemId)) return null;
          
          const slotPos = seat?.inventorySlots?.[idx] || OPPONENT_ITEM_SLOTS[idx]?.position || [0, 0.771, -0.36];
          const seatRotY = seat?.characterRotation?.[1] || 0;
          const baseRot = ITEM_ROTATIONS[itemId] || [0, 0, 0];
          const rot: [number, number, number] = [baseRot[0], baseRot[1] + seatRotY, baseRot[2]];
          
          const canStealItem =
            isStealActive &&
            isVictimSelected &&
            isMyTurn &&
            !isSpectating &&
            oppPlayer.isAlive &&
            oppPlayer.hp > 0 &&
            itemId !== 'adrenaline';

          const interactionMode = canStealItem ? 'STEAL' : 'DISABLED';

          return (
            <InteractiveItem 
              key={`opp-${oppPlayer.userId}-${itemId}-${idx}`}
              id={itemId}
              sourceMesh={sourceMesh}
              position={slotPos}
              rotation={rot}
              isLocal={false}
              interactionMode={interactionMode}
              onClick={(stolenItemId) => {
                if (canStealItem) {
                  onSelectStolenItem?.({ ownerPlayerId: oppPlayer.userId, itemId: stolenItemId });
                }
              }}
              tableY={0.771}
            />
          );
        });
      })}

      {/* Item Animation (Beer/Phone/Adrenaline/Handcuffs/Handsaw/Magnifier/Inverter/Medkit) */}
      {renderItemAnimation()}

      {/* Standalone Physical Ejected Shell (Persists for full flight and resting lifecycle) */}
      {ejectedShellType && (
        <EjectedShell
          key={`ejected-shell-${ejectedShellType}`}
          shellType={ejectedShellType}
        />
      )}

      {/* Persistent Restrained Handcuffs Props for ALL Handcuffed Players */}
      {gameState?.players.map((player) => {
        const isHandcuffed = player.statusEffects?.some((e: any) => e.type === 'SKIP_TURN');
        if (!isHandcuffed) return null;
        const seat = seatMap[player.userId];
        if (!seat) return null;
        return (
          <RestrainedHandcuffs
            key={`restrained-handcuffs-${player.userId}`}
            position={seat.anchors.handcuffProp}
            rotation={seat.characterRotation}
          />
        );
      })}

      {/* Local Physical Items — Positioned strictly along local player's outer edge */}
      {localInventory.map((itemId, idx) => {
        const meshName = ITEM_MESH_MAP[itemId];
        const sourceMesh = itemsGLTF.nodes[meshName] as THREE.Mesh;
        const customMeshItems = ['inverter', 'beer', 'adrenaline', 'medkit', 'handsaw', 'burner_phone'];
        if (!sourceMesh && !customMeshItems.includes(itemId)) return null;
        
        const slotPos = seatMap[userId || '']?.inventorySlots?.[idx] || LOCAL_ITEM_SLOTS[idx]?.position || [0, 0.771, 0.48];
        const rot = ITEM_ROTATIONS[itemId] || [0, 0, 0];
        const isStealActive = Boolean(isStealSelectionMode || targetingAction === 'adrenaline');
        const isMyTurn = gameState?.currentTurnPlayerId === userId;
        const canUseNormally = isMyTurn && !isSpectating && !isStealActive;

        const interactionMode = canUseNormally ? 'USE' : 'DISABLED';

        return (
          <InteractiveItem 
            key={`local-${itemId}-${idx}`}
            id={itemId}
            sourceMesh={sourceMesh}
            position={slotPos}
            rotation={rot}
            isLocal={true}
            interactionMode={interactionMode}
            onClick={(clickedItemId) => {
              if (canUseNormally) {
                handleItemClick(clickedItemId);
              }
            }}
            tableY={0.771}
          />
        );
      })}

      {/* Opponent 3D World Health Indicators Attached to Seat Positions */}
      {opponents.map((opp) => {
        const seat = seatMap[opp.userId];
        const healthPos = seat?.anchors?.healthIndicator || [0, 1.48, -0.8];
        const maxHp = gameState?.settings?.startingHp || 4;

        return (
          <Html
            key={`opp-health-3d-${opp.userId}`}
            position={healthPos}
            center
            zIndexRange={[50, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <PlayerHealthIndicator
              player={opp}
              maxHp={maxHp}
              isLocal={false}
            />
          </Html>
        );
      })}

      {/* FP Arms - Pushed back and down to avoid covering the local inventory */}
      {!isSpectating && (
        <group position={[0, -0.3, 0.4]}>
          <primitive object={fpArmsGLTF.scene} />
        </group>
      )}
    </>
  );
}

export function ChamberClash3D(props: ChamberClash3DProps) {
  useEffect(() => {
    preloadChamberClashAssets();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__GAME_STATE = props.gameState;
    }
  }, [props.gameState]);

  return (
    <div className="w-full h-full relative bg-black overflow-hidden rounded-xl">
      <Canvas
        camera={{
          position: [0, 1.3, 1.2],
          fov: 78.5,
          near: 0.1,
          far: 50,
        }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0.77, -0.4);
        }}
        gl={{ antialias: true, alpha: false, localClippingEnabled: true }}
      >
        <Suspense fallback={<LoaderOverlay />}>
          <StaticScene 
            gameState={props.gameState} 
            userId={props.userId}
            targetPlayerId={props.targetPlayerId}
            stealingFromPlayerId={props.stealingFromPlayerId}
            targetingAction={props.targetingAction}
            gunState={props.gunState}
            gunTarget={props.gunTarget}
            shellType={props.shellType}
            activeItemAnimation={props.activeItemAnimation}
            ejectedShellType={props.ejectedShellType}
            isBarrelShortened={props.isBarrelShortened}
            privatePayload={props.privatePayload}
            burnerPhoneResult={props.burnerPhoneResult}
            isStealSelectionMode={props.isStealSelectionMode}
            isSpectating={props.isSpectating}
            onShotgunClick={props.onShotgunClick}
            onSelectStolenItem={props.onSelectStolenItem}
            onCameraReturned={props.onCameraReturned}
            onUseItem={props.onUseItem}
            onSelectTarget={props.onSelectTarget}
            onAnimationComplete={props.onAnimationComplete}
            onBarrelCut={props.onBarrelCut}
            onShotgunPump={props.onShotgunPump}
            onFireMoment={props.onFireMoment}
            onShotgunSequenceComplete={props.onShotgunSequenceComplete}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
