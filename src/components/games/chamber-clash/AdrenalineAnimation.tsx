import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applyEasing, TABLE_Y, LOCAL_CHEST, OPPONENT_CHEST } from './animationConfigs';

import { AdrenalineMesh } from './CustomItemMeshes';

interface AdrenalineAnimationProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh?: THREE.Mesh;
  localUserId: string | null;
  baseRotation?: [number, number, number];
  onSelfInjectComplete?: () => void;
  onComplete?: () => void;
}

/**
 * Adrenaline Animation: Self-Injection with Emergency Injector Mesh
 */
export function AdrenalineAnimation({
  animation,
  localUserId,
  onSelfInjectComplete,
  onComplete
}: AdrenalineAnimationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);

  const isLocalActor = animation.userId === localUserId;
  const chest = isLocalActor ? LOCAL_CHEST : OPPONENT_CHEST;
  const startZ = isLocalActor ? 0.35 : -0.35;

  const phases = useMemo(() => [
    { name: 'LIFT',       start: 0,    end: 0.25, from: [0, TABLE_Y, startZ],            to: [0, TABLE_Y + 0.15, startZ] },
    { name: 'TO_CHEST',   start: 0.25, end: 0.65, from: [0, TABLE_Y + 0.15, startZ],     to: [chest.x, chest.y, chest.z] },
    { name: 'INJECT',     start: 0.65, end: 0.95, from: [chest.x, chest.y, chest.z],     to: [chest.x, chest.y - 0.04, chest.z + (isLocalActor ? -0.04 : 0.04)] },
    { name: 'HOLD',       start: 0.95, end: 1.25, from: [chest.x, chest.y - 0.04, chest.z + (isLocalActor ? -0.04 : 0.04)], to: [chest.x, chest.y - 0.04, chest.z + (isLocalActor ? -0.04 : 0.04)] },
    { name: 'REMOVE',     start: 1.25, end: 1.50, from: [chest.x, chest.y - 0.04, chest.z + (isLocalActor ? -0.04 : 0.04)], to: [0, TABLE_Y - 0.5, startZ] },
  ] as const, [startZ, chest, isLocalActor]);

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
