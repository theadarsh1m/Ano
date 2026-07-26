import React, { useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applyEasing, TABLE_Y, SHOTGUN_BREECH } from './animationConfigs';
import { InverterMesh } from './CustomItemMeshes';

import type { SeatLayout } from './seatLayout';

interface InverterAnimationProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh?: THREE.Mesh;
  localUserId?: string | null;
  actorSeat?: SeatLayout;
  baseRotation?: [number, number, number];
  onComplete?: () => void;
}

/**
 * Inverter Animation Component:
 * Hovers over shotgun breech, physically flips its central switch, and emits an electrical pulse.
 */
export function InverterAnimation({
  animation,
  actorSeat,
  onComplete
}: InverterAnimationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);
  const [toggleRot, setToggleRot] = useState(0);

  const startCenter = actorSeat?.inventoryCenter || new THREE.Vector3(0, TABLE_Y, -0.52);
  const breech = SHOTGUN_BREECH;

  const phases = useMemo(() => {
    const startX = startCenter.x;
    const startZ = startCenter.z;
    return [
      { name: 'LIFT',        start: 0,   end: 0.25, from: [startX, TABLE_Y, startZ],                to: [startX, TABLE_Y + 0.15, startZ] },
      { name: 'TO_BREECH',   start: 0.25, end: 0.60, from: [startX, TABLE_Y + 0.15, startZ],        to: [breech.x, breech.y + 0.1, breech.z] },
      { name: 'FLIP_SWITCH', start: 0.60, end: 1.20, from: [breech.x, breech.y + 0.1, breech.z], to: [breech.x, breech.y + 0.1, breech.z] },
      { name: 'REMOVE',      start: 1.20, end: 1.45, from: [breech.x, breech.y + 0.1, breech.z], to: [startX, TABLE_Y - 0.5, startZ] },
    ] as const;
  }, [startCenter, breech]);

  const totalDuration = 1.45;

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

    if (currentPhase.name === 'FLIP_SWITCH') {
      // Physically flip central toggle switch 180°
      const targetAngle = THREE.MathUtils.lerp(0, Math.PI, applyEasing(progress, 'spring'));
      setToggleRot(targetAngle);
      // Subtle electrical vibration
      groupRef.current.position.x += Math.sin(t * 50) * 0.002;
    }
  });

  return (
    <group ref={groupRef}>
      <InverterMesh toggleRotation={toggleRot} />

      {/* Electrical pulse light during switch flip */}
      {elapsed.current >= 0.60 && elapsed.current < 1.20 && (
        <pointLight color="#00e5ff" intensity={10} distance={1.2} />
      )}
    </group>
  );
}
