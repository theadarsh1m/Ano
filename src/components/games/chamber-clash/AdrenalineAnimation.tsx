import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applyEasing, TABLE_Y } from './animationConfigs';
import { AdrenalineMesh } from './CustomItemMeshes';
import type { SeatLayout } from './seatLayout';

interface AdrenalineAnimationProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh?: THREE.Mesh;
  localUserId?: string | null;
  actorSeat?: SeatLayout;
  baseRotation?: [number, number, number];
  onSelfInjectComplete?: () => void;
  onComplete?: () => void;
}

/**
 * Adrenaline Animation: Self-Injection with Emergency Injector Mesh
 */
export function AdrenalineAnimation({
  animation,
  actorSeat,
  onSelfInjectComplete,
  onComplete
}: AdrenalineAnimationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);

  const chest = actorSeat?.anchors.chest || new THREE.Vector3(0, 1.00, -0.78);
  const startCenter = actorSeat?.inventoryCenter || new THREE.Vector3(0, TABLE_Y, -0.52);

  const phases = useMemo(() => {
    const startX = startCenter.x;
    const startZ = startCenter.z;
    return [
      { name: 'LIFT',       start: 0,    end: 0.25, from: [startX, TABLE_Y, startZ],            to: [startX, TABLE_Y + 0.15, startZ] },
      { name: 'TO_CHEST',   start: 0.25, end: 0.65, from: [startX, TABLE_Y + 0.15, startZ],     to: [chest.x, chest.y, chest.z] },
      { name: 'INJECT',     start: 0.65, end: 0.95, from: [chest.x, chest.y, chest.z],     to: [chest.x, chest.y - 0.04, chest.z] },
      { name: 'HOLD',       start: 0.95, end: 1.25, from: [chest.x, chest.y - 0.04, chest.z], to: [chest.x, chest.y - 0.04, chest.z] },
      { name: 'REMOVE',     start: 1.25, end: 1.50, from: [chest.x, chest.y - 0.04, chest.z], to: [startX, TABLE_Y - 0.5, startZ] },
    ] as const;
  }, [startCenter, chest]);

  const totalDuration = 1.50;

  useFrame((_, delta) => {
    if (!groupRef.current || completed.current) return;

    elapsed.current += delta;
    const t = elapsed.current;

    if (t >= totalDuration) {
      completed.current = true;
      groupRef.current.visible = false;
      onSelfInjectComplete?.();
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

    const isLocalActor = actorSeat ? actorSeat.role === 'LOCAL' : false;
    if (innerRef.current) {
      if (currentPhase.name === 'INJECT') {
        innerRef.current.rotation.x = THREE.MathUtils.lerp(0, isLocalActor ? 0.6 : -0.6, applyEasing(progress, 'easeOut'));
      } else if (currentPhase.name === 'HOLD') {
        groupRef.current.position.x += Math.sin(t * 60) * 0.002;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        <AdrenalineMesh />
      </group>
    </group>
  );
}
