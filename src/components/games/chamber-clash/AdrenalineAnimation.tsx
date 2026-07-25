import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applyEasing, TABLE_Y, LOCAL_CHEST, OPPONENT_CHEST } from './animationConfigs';

interface AdrenalineAnimationProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh?: THREE.Mesh;
  localUserId: string | null;
  baseRotation?: [number, number, number];
  onComplete?: () => void;
}

/**
 * Adrenaline Animation: Self-Injection
 * 
 * The player using Adrenaline injects THEMSELVES (LOCAL_CHEST for local player,
 * OPPONENT_CHEST for opponent), NOT the opponent.
 * 
 * Sequence:
 * PICK_UP -> MOVE_TO_ACTOR_CHEST -> ALIGN -> INJECT_SELF (plunge) -> HOLD -> PULL_AWAY -> REMOVE
 */
export function AdrenalineAnimation({
  animation,
  sourceMesh,
  localUserId,
  baseRotation = [0, 0, 0],
  onComplete
}: AdrenalineAnimationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);

  const isLocalActor = animation.userId === localUserId;
  const chest = isLocalActor ? LOCAL_CHEST : OPPONENT_CHEST;
  const startZ = isLocalActor ? 0.35 : -0.35;

  // Normalize source mesh if provided
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

  const phases = useMemo(() => [
    { name: 'LIFT',       start: 0,   end: 0.25, from: [0, TABLE_Y, startZ],            to: [0, TABLE_Y + 0.15, startZ] },
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
        // Tilt injector needle into chest
        innerRef.current.rotation.x = THREE.MathUtils.lerp(0, isLocalActor ? 0.6 : -0.6, applyEasing(progress, 'easeOut'));
      } else if (currentPhase.name === 'HOLD') {
        // High frequency vibration pulse during injection
        groupRef.current.position.x += Math.sin(t * 60) * 0.002;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        {normalizedMesh ? (
          <primitive object={normalizedMesh} />
        ) : (
          /* Procedural Syringe / Injector fallback */
          <group>
            <mesh>
              <cylinderGeometry args={[0.01, 0.01, 0.12, 12]} />
              <meshStandardMaterial color="#ffaa00" roughness={0.3} metalness={0.7} />
            </mesh>
            <mesh position={[0, 0.06, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.03, 12]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}
