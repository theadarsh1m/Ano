import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applyEasing, TABLE_Y } from './animationConfigs';
import { MedkitBottleMesh } from './CustomItemMeshes';
import type { SeatLayout } from './seatLayout';

interface MedkitAnimationProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh?: THREE.Mesh;
  localUserId?: string | null;
  actorSeat?: SeatLayout;
  baseRotation?: [number, number, number];
  onComplete?: () => void;
}

/**
 * Medkit Bottle Animation Component:
 * Picks up medical bottle, brings to actor chest, tilts bottle to apply/drink emergency medicine.
 */
export function MedkitAnimation({
  animation,
  actorSeat,
  onComplete
}: MedkitAnimationProps) {
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
      { name: 'LIFT',        start: 0,    end: 0.25, from: [startX, TABLE_Y, startZ],            to: [startX, TABLE_Y + 0.15, startZ] },
      { name: 'TO_CHEST',    start: 0.25, end: 0.65, from: [startX, TABLE_Y + 0.15, startZ],     to: [chest.x, chest.y + 0.05, chest.z] },
      { name: 'DRINK',       start: 0.65, end: 1.30, from: [chest.x, chest.y + 0.05, chest.z], to: [chest.x, chest.y + 0.08, chest.z] },
      { name: 'REMOVE',      start: 1.30, end: 1.55, from: [chest.x, chest.y + 0.08, chest.z], to: [startX, TABLE_Y - 0.5, startZ] },
    ] as const;
  }, [startCenter, chest]);

  const totalDuration = 1.55;

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

    const isLocalActor = actorSeat ? actorSeat.role === 'LOCAL' : false;
    if (innerRef.current) {
      if (currentPhase.name === 'DRINK') {
        const tiltDirection = isLocalActor ? 1.0 : -1.0;
        innerRef.current.rotation.x = THREE.MathUtils.lerp(0, tiltDirection * 0.8, applyEasing(progress, 'easeOut'));
        innerRef.current.rotation.y = Math.sin(t * 12) * 0.1;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        <MedkitBottleMesh />
        {/* Green Healing Pulse Aura */}
        <pointLight position={[0, 0.05, 0]} color="#22c55e" intensity={2} distance={0.5} />
      </group>
    </group>
  );
}
