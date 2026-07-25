import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applyEasing, TABLE_Y, SHOTGUN_BREECH } from './animationConfigs';

interface InverterAnimationProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh?: THREE.Mesh;
  localUserId: string | null;
  baseRotation?: [number, number, number];
  onComplete?: () => void;
}

/**
 * Inverter Animation Component:
 * Hovers over shotgun breech, rotates 180°, and emits an electrical pulse.
 */
export function InverterAnimation({
  animation,
  sourceMesh,
  localUserId,
  baseRotation = [0, 0, 0],
  onComplete
}: InverterAnimationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);

  const isLocalActor = animation.userId === localUserId;
  const startZ = isLocalActor ? 0.35 : -0.35;
  const breech = SHOTGUN_BREECH;

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
    { name: 'LIFT',        start: 0,   end: 0.25, from: [0, TABLE_Y, startZ],                to: [0, TABLE_Y + 0.15, startZ] },
    { name: 'TO_BREECH',   start: 0.25, end: 0.60, from: [0, TABLE_Y + 0.15, startZ],        to: [breech.x, breech.y + 0.1, breech.z] },
    { name: 'FLIP_PULSE',  start: 0.60, end: 1.20, from: [breech.x, breech.y + 0.1, breech.z], to: [breech.x, breech.y + 0.1, breech.z] },
    { name: 'REMOVE',      start: 1.20, end: 1.45, from: [breech.x, breech.y + 0.1, breech.z], to: [0, TABLE_Y - 0.5, startZ] },
  ] as const, [startZ, breech]);

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

    if (innerRef.current && currentPhase.name === 'FLIP_PULSE') {
      // 180° flip rotation on X axis
      innerRef.current.rotation.x = THREE.MathUtils.lerp(0, Math.PI, applyEasing(progress, 'spring'));
      // Electrical vibration
      groupRef.current.position.x += Math.sin(t * 40) * 0.004;
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        {normalizedMesh ? (
          <primitive object={normalizedMesh} />
        ) : (
          <mesh>
            <boxGeometry args={[0.04, 0.04, 0.04]} />
            <meshStandardMaterial color="#00ccff" metalness={0.8} roughness={0.2} />
          </mesh>
        )}
      </group>

      {/* Electrical pulse light during flip */}
      {elapsed.current >= 0.60 && elapsed.current < 1.20 && (
        <pointLight color="#00ffff" intensity={15} distance={1.5} />
      )}
    </group>
  );
}
