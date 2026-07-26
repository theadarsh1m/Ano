import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applyEasing, TABLE_Y } from './animationConfigs';
import type { SeatLayout } from './seatLayout';

interface HandcuffsAnimationProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh?: THREE.Mesh;
  localUserId?: string | null;
  actorSeat?: SeatLayout;
  targetSeat?: SeatLayout;
  baseRotation?: [number, number, number];
  targetWristPos?: THREE.Vector3;
  onComplete?: () => void;
}

/**
 * Handcuffs Animation Component:
 * Flies from actor inventory/wrist -> locks onto target seat wrist.
 */
export function HandcuffsAnimation({
  animation,
  sourceMesh,
  actorSeat,
  targetSeat,
  baseRotation = [0, 0, 0],
  targetWristPos,
  onComplete
}: HandcuffsAnimationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);

  const startCenter = actorSeat?.anchors.wrist || actorSeat?.inventoryCenter || new THREE.Vector3(0, TABLE_Y, -0.52);
  const targetWrist = targetSeat?.anchors.wrist || targetWristPos || new THREE.Vector3(0, 0.95, -0.65);

  const normalizedMesh = useMemo(() => {
    if (!sourceMesh) return null;
    const cloned = sourceMesh.clone();
    cloned.position.set(0, 0, 0);
    cloned.rotation.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.set(-center.x, -center.y, -center.z);

    const rotGroup = new THREE.Group();
    rotGroup.rotation.set(baseRotation[0], baseRotation[1], baseRotation[2]);
    rotGroup.add(cloned);
    return rotGroup;
  }, [sourceMesh, baseRotation]);

  const phases = useMemo(() => {
    const startX = startCenter.x;
    const startY = startCenter.y || TABLE_Y;
    const startZ = startCenter.z;
    return [
      { name: 'LIFT',        start: 0,   end: 0.25, from: [startX, startY, startZ],                             to: [startX, startY + 0.15, startZ] },
      { name: 'FLY',         start: 0.25, end: 0.75, from: [startX, startY + 0.15, startZ],                    to: [targetWrist.x, targetWrist.y + 0.1, targetWrist.z] },
      { name: 'CLAMP_LOCK',  start: 0.75, end: 1.25, from: [targetWrist.x, targetWrist.y + 0.1, targetWrist.z], to: [targetWrist.x, targetWrist.y, targetWrist.z] },
      { name: 'REMOVE',      start: 1.25, end: 1.50, from: [targetWrist.x, targetWrist.y, targetWrist.z],   to: [targetWrist.x, TABLE_Y - 0.5, targetWrist.z] },
    ] as const;
  }, [startCenter, targetWrist]);

  const totalDuration = 1.50;

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

    if (innerRef.current) {
      if (currentPhase.name === 'FLY') {
        innerRef.current.rotation.y = t * 6;
      } else if (currentPhase.name === 'CLAMP_LOCK') {
        innerRef.current.rotation.y = 0;
        // Snap lock effect
        innerRef.current.rotation.z = Math.sin(t * 40) * 0.05;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        {normalizedMesh ? (
          <primitive object={normalizedMesh} />
        ) : (
          <mesh>
            <torusGeometry args={[0.04, 0.008, 12, 24]} />
            <meshStandardMaterial color="#888899" metalness={0.9} roughness={0.2} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/**
 * Persistent Handcuff Prop for Restrained Players.
 * Renders at player seat's handcuffProp anchor position with seat rotation.
 */
export function RestrainedHandcuffs({
  position,
  rotation = [0, 0, 0],
  isLocal = false
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  isLocal?: boolean;
}) {
  const groupPos: [number, number, number] = position || (isLocal
    ? [0.0, 0.85, 0.42]  // Low in local camera view
    : [0.0, 0.78, -0.55]); // Opponent side of table

  return (
    <group position={groupPos} rotation={rotation} scale={[1.2, 1.2, 1.2]}>
      {/* Left cuff ring */}
      <mesh position={[-0.06, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.035, 0.007, 12, 24]} />
        <meshStandardMaterial color="#777788" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Right cuff ring */}
      <mesh position={[0.06, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.035, 0.007, 12, 24]} />
        <meshStandardMaterial color="#777788" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Connecting Chain link */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.004, 0.004, 0.08, 8]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.95} roughness={0.1} />
      </mesh>
    </group>
  );
}
