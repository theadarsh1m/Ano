import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { applyEasing, TABLE_Y, SHOTGUN_BREECH } from './animationConfigs';

interface MagnifierAnimationProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh?: THREE.Mesh;
  localUserId: string | null;
  baseRotation?: [number, number, number];
  privatePayload?: { shellType?: 'LIVE' | 'BLANK' } | null;
  onComplete?: () => void;
}

/**
 * Magnifier Animation Component:
 * Inspects the shotgun breech chamber.
 * Displays private shell result ONLY to the local actor.
 */
export function MagnifierAnimation({
  animation,
  sourceMesh,
  localUserId,
  baseRotation = [0, 0, 0],
  privatePayload,
  onComplete
}: MagnifierAnimationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);

  const isLocalActor = animation.userId === localUserId;
  const startZ = isLocalActor ? 0.35 : -0.35;
  const chamberPos = SHOTGUN_BREECH;

  const shellType = privatePayload?.shellType || 'LIVE';
  const isLive = shellType === 'LIVE';

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
    { name: 'LIFT',        start: 0,   end: 0.25, from: [0, TABLE_Y, startZ],                    to: [0, TABLE_Y + 0.15, startZ] },
    { name: 'TO_CHAMBER',  start: 0.25, end: 0.65, from: [0, TABLE_Y + 0.15, startZ],            to: [chamberPos.x, chamberPos.y + 0.1, chamberPos.z] },
    { name: 'PEER',        start: 0.65, end: 1.55, from: [chamberPos.x, chamberPos.y + 0.1, chamberPos.z], to: [chamberPos.x, chamberPos.y + 0.08, chamberPos.z] },
    { name: 'REMOVE',      start: 1.55, end: 1.80, from: [chamberPos.x, chamberPos.y + 0.08, chamberPos.z], to: [0, TABLE_Y - 0.5, startZ] },
  ] as const, [startZ, chamberPos]);

  const totalDuration = 1.80;

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

    if (innerRef.current && currentPhase.name === 'PEER') {
      // Peer lens wobble
      innerRef.current.rotation.z = Math.sin(t * 3) * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        {normalizedMesh ? (
          <primitive object={normalizedMesh} />
        ) : (
          <mesh>
            <cylinderGeometry args={[0.04, 0.04, 0.01, 16]} />
            <meshStandardMaterial color="#88aaee" transparent opacity={0.6} />
          </mesh>
        )}
      </group>

      {/* PRIVATE RESULT DISPLAY ONLY FOR LOCAL ACTOR */}
      {isLocalActor && elapsed.current >= 0.65 && elapsed.current < 1.55 && (
        <Html
          position={[0, 0.15, 0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div className="bg-black/95 border border-cyan-500/60 p-2 rounded-lg text-center font-mono select-none w-32 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <div className="text-[8px] font-bold text-cyan-400 tracking-widest uppercase border-b border-cyan-500/30 pb-0.5">
              CHAMBER INSPECT
            </div>
            <div className={`text-xs font-black tracking-wider mt-1 ${isLive ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`}>
              {isLive ? '🔴 LIVE' : '⚪ BLANK'}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
