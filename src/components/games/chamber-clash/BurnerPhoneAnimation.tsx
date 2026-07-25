import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { applyEasing, TABLE_Y, LOCAL_EAR, OPPONENT_EAR } from './animationConfigs';

interface BurnerPhoneAnimationProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh?: THREE.Mesh;
  localUserId: string | null;
  /** Private payload from server event — e.g. { shellIndex: 3, shellType: 'LIVE' } */
  privatePayload?: { shellIndex?: number; shellType?: 'LIVE' | 'BLANK' } | null;
  onComplete?: () => void;
}

/**
 * Burner Phone: Old-school Flip Phone 3D Model with Hinge Animation
 * 
 * Sequence:
 * PICK_UP -> MOVE_TOWARD_ACTOR -> FLIP_OPEN -> SCREEN_ON (Private payload display) -> HOLD -> SCREEN_OFF -> FLIP_CLOSED -> REMOVE
 * 
 * PRIVACY RULE: Screen text is visible ONLY to `isLocalActor`.
 * For remote clients, the screen remains dark/unreadable.
 */
export function BurnerPhoneAnimation({
  animation,
  localUserId,
  privatePayload,
  onComplete
}: BurnerPhoneAnimationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const hingeRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);

  const isLocalActor = animation.userId === localUserId;
  const ear = isLocalActor ? LOCAL_EAR : OPPONENT_EAR;
  const startZ = isLocalActor ? 0.35 : -0.35;

  // Determine private message values
  const shellNum = privatePayload?.shellIndex ?? 3;
  const shellType = privatePayload?.shellType ?? 'LIVE';
  const isLive = shellType === 'LIVE';

  // Timings (total 2.8s)
  const phases = useMemo(() => [
    { name: 'LIFT',        start: 0,   end: 0.3, from: [0, TABLE_Y, startZ],            to: [0, TABLE_Y + 0.15, startZ] },
    { name: 'TO_EAR',      start: 0.3, end: 0.8, from: [0, TABLE_Y + 0.15, startZ],     to: [ear.x, ear.y, ear.z] },
    { name: 'FLIP_OPEN',   start: 0.8, end: 1.2, from: [ear.x, ear.y, ear.z],         to: [ear.x, ear.y, ear.z] },
    { name: 'READ_HOLD',   start: 1.2, end: 2.1, from: [ear.x, ear.y, ear.z],         to: [ear.x, ear.y, ear.z] },
    { name: 'FLIP_CLOSE',  start: 2.1, end: 2.4, from: [ear.x, ear.y, ear.z],         to: [ear.x, ear.y, ear.z] },
    { name: 'LOWER',       start: 2.4, end: 2.8, from: [ear.x, ear.y, ear.z],         to: [0, TABLE_Y - 0.5, startZ] },
  ] as const, [startZ, ear]);

  const totalDuration = 2.8;

  useFrame((_, delta) => {
    if (!groupRef.current || completed.current) return;

    elapsed.current += delta;
    const t = elapsed.current;

    if (t >= totalDuration) {
      completed.current = true;
      groupRef.current.visible = false;
      onComplete?.();
      return;
    }

    let currentPhase = phases[phases.length - 1];
    for (const phase of phases) {
      if (t >= phase.start && t < phase.end) {
        currentPhase = phase;
        break;
      }
    }

    const duration = currentPhase.end - currentPhase.start;
    const progress = Math.min((t - currentPhase.start) / duration, 1);
    const eased = applyEasing(progress, 'easeInOut');

    const from = currentPhase.from;
    const to = currentPhase.to;

    groupRef.current.position.set(
      THREE.MathUtils.lerp(from[0], to[0], eased),
      THREE.MathUtils.lerp(from[1], to[1], eased),
      THREE.MathUtils.lerp(from[2], to[2], eased)
    );

    // Hinge flip rotation (0° to -145° angle)
    if (hingeRef.current) {
      if (currentPhase.name === 'FLIP_OPEN') {
        const flipAngle = THREE.MathUtils.lerp(0, -2.5, applyEasing(progress, 'easeOut'));
        hingeRef.current.rotation.x = flipAngle;
      } else if (currentPhase.name === 'READ_HOLD') {
        hingeRef.current.rotation.x = -2.5; // open
      } else if (currentPhase.name === 'FLIP_CLOSE') {
        const flipAngle = THREE.MathUtils.lerp(-2.5, 0, applyEasing(progress, 'easeInOut'));
        hingeRef.current.rotation.x = flipAngle;
      } else if (currentPhase.name === 'LOWER') {
        hingeRef.current.rotation.x = 0; // closed
      }
    }

    // Vibration on hold
    if (currentPhase.name === 'READ_HOLD') {
      groupRef.current.position.x += Math.sin(t * 50) * 0.003;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Phone Base (Keypad half) */}
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[0.05, 0.08, 0.015]} />
        <meshStandardMaterial color="#1a1a24" roughness={0.6} metalness={0.8} />
      </mesh>
      {/* Keypad Buttons */}
      <mesh position={[0, -0.04, 0.009]}>
        <boxGeometry args={[0.038, 0.06, 0.002]} />
        <meshStandardMaterial color="#333344" roughness={0.4} metalness={0.9} />
      </mesh>

      {/* Hinge Joint at center */}
      <group ref={hingeRef} position={[0, 0, 0]}>
        {/* Phone Lid (Screen half) */}
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.05, 0.08, 0.012]} />
          <meshStandardMaterial color="#11111a" roughness={0.5} metalness={0.8} />
        </mesh>
        
        {/* Screen Frame */}
        <mesh position={[0, 0.04, 0.007]}>
          <planeGeometry args={[0.04, 0.055]} />
          <meshStandardMaterial color="#080c10" roughness={0.1} metalness={0.9} />
        </mesh>

        {/* PRIVATE SCREEN DISPLAY (ONLY FOR LOCAL ACTOR) */}
        {isLocalActor && elapsed.current >= 0.8 && elapsed.current < 2.1 && (
          <Html
            position={[0, 0.04, 0.015]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div className="bg-black/95 border border-amber-500/60 p-2 rounded-lg text-center font-mono select-none w-28 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <div className="text-[9px] font-bold text-amber-400 tracking-widest uppercase border-b border-amber-500/30 pb-0.5">
                SHELL #{shellNum}
              </div>
              <div className={`text-xs font-black tracking-wider mt-1 ${isLive ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`}>
                {isLive ? '🔴 LIVE' : '⚪ BLANK'}
              </div>
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}
