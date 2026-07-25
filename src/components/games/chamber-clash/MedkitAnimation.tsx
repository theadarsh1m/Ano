import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applyEasing, TABLE_Y, LOCAL_CHEST, OPPONENT_CHEST } from './animationConfigs';

interface MedkitAnimationProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh?: THREE.Mesh;
  localUserId: string | null;
  baseRotation?: [number, number, number];
  onComplete?: () => void;
}

/**
 * Medkit Animation Component:
 * Opens and brings treatment toward actor chest with green healing glow feedback.
 */
export function MedkitAnimation({
  animation,
  sourceMesh,
  localUserId,
  baseRotation = [0, 0, 0],
  onComplete
}: MedkitAnimationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);

  const isLocalActor = animation.userId === localUserId;
  const chest = isLocalActor ? LOCAL_CHEST : OPPONENT_CHEST;
  const startZ = isLocalActor ? 0.35 : -0.35;

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
    { name: 'LIFT',        start: 0,   end: 0.25, from: [0, TABLE_Y, startZ],            to: [0, TABLE_Y + 0.15, startZ] },
    { name: 'TO_CHEST',    start: 0.25, end: 0.65, from: [0, TABLE_Y + 0.15, startZ],     to: [chest.x, chest.y, chest.z] },
    { name: 'TREATMENT',   start: 0.65, end: 1.30, from: [chest.x, chest.y, chest.z],     to: [chest.x, chest.y + 0.05, chest.z] },
    { name: 'REMOVE',      start: 1.30, end: 1.55, from: [chest.x, chest.y + 0.05, chest.z], to: [0, TABLE_Y - 0.5, startZ] },
  ] as const, [startZ, chest]);

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

    if (innerRef.current && currentPhase.name === 'TREATMENT') {
      // Healing aura spin
      innerRef.current.rotation.y = t * 5;
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        {normalizedMesh ? (
          <primitive object={normalizedMesh} />
        ) : (
          <mesh>
            <boxGeometry args={[0.08, 0.06, 0.04]} />
            <meshStandardMaterial color="#22cc44" metalness={0.4} roughness={0.4} />
          </mesh>
        )}
      </group>

      {/* Green healing point light during treatment */}
      {elapsed.current >= 0.65 && elapsed.current < 1.30 && (
        <pointLight color="#33ff55" intensity={12} distance={2.0} />
      )}
    </group>
  );
}
