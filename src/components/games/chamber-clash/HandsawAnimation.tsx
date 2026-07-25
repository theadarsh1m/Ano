import React, { useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applyEasing, TABLE_Y } from './animationConfigs';
import { HandsawMesh } from './CustomItemMeshes';

interface HandsawAnimationProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh?: THREE.Mesh;
  localUserId: string | null;
  baseRotation?: [number, number, number];
  /** Called when the sawing is complete — ChamberClash3D uses this to shorten the barrel */
  onBarrelCut?: () => void;
  onComplete?: () => void;
}

/**
 * Detached Barrel Piece:
 * Spawns at the exact cut point [0.44, TABLE_Y + 0.04, 0] when barrel is severed,
 * tumbles downward with gravity, and rests on the table surface.
 */
export function DetachedBarrelPiece({ active }: { active: boolean }) {
  const pieceRef = useRef<THREE.Group>(null);
  const fallProgress = useRef(0);

  useFrame((_, delta) => {
    if (!active || !pieceRef.current) return;
    if (fallProgress.current < 1) {
      fallProgress.current = Math.min(1, fallProgress.current + delta * 3.5);
      const p = fallProgress.current;
      const startY = TABLE_Y + 0.04;
      const targetY = TABLE_Y + 0.01;
      pieceRef.current.position.y = THREE.MathUtils.lerp(startY, targetY, p * p);
      pieceRef.current.rotation.z = THREE.MathUtils.lerp(0, 0.4, p);
      pieceRef.current.rotation.y = THREE.MathUtils.lerp(0, 0.25, p);
    }
  });

  if (!active) return null;

  return (
    <group ref={pieceRef} position={[0.44, TABLE_Y + 0.04, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.24, 16]} />
        <meshStandardMaterial color="#2d303a" roughness={0.3} metalness={0.85} />
      </mesh>
    </group>
  );
}

/**
 * Dedicated Handsaw animation:
 * Aligns saw blade with front shotgun barrel at X = 0.32 and performs 6 physical sawing strokes.
 * Near stroke 5 (t = 1.75s), triggers onBarrelCut and detaches front barrel section.
 */
export function HandsawAnimation({
  animation,
  localUserId,
  onBarrelCut,
  onComplete
}: HandsawAnimationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);
  const cutTriggered = useRef(false);
  const [showDetachedPiece, setShowDetachedPiece] = useState(false);

  const isLocalActor = animation.userId === localUserId;

  // Cut point is at X = 0.32 along the front shotgun barrel
  const barrelCutPoint: [number, number, number] = [0.32, TABLE_Y + 0.04, 0];
  const startZ = isLocalActor ? 0.35 : -0.35;

  const phases = useMemo(() => [
    { name: 'LIFT',      start: 0,   end: 0.3,  from: [0.32, TABLE_Y, startZ],             to: [0.32, TABLE_Y + 0.15, startZ] },
    { name: 'APPROACH',  start: 0.3, end: 0.7,  from: [0.32, TABLE_Y + 0.15, startZ],      to: barrelCutPoint },
    { name: 'ALIGN',     start: 0.7, end: 0.9,  from: barrelCutPoint,                       to: barrelCutPoint },
    { name: 'SAWING',    start: 0.9, end: 1.9,  from: barrelCutPoint,                       to: barrelCutPoint },
    { name: 'CUT_DONE',  start: 1.9, end: 2.1,  from: barrelCutPoint,                       to: [0.32, TABLE_Y + 0.15, startZ * 0.5] },
    { name: 'REMOVE',    start: 2.1, end: 2.5,  from: [0.32, TABLE_Y + 0.15, startZ * 0.5], to: [0.32, TABLE_Y - 0.5, startZ] },
  ] as const, [startZ, barrelCutPoint]);

  const totalDuration = 2.5;
  const sawStrokes = 6;

  useFrame((_, delta) => {
    if (!groupRef.current || !innerRef.current || completed.current) return;

    elapsed.current += delta;
    const t = elapsed.current;

    // Trigger barrel cut and detached piece near end of sawing phase (t = 1.75s)
    if (t >= 1.75 && !cutTriggered.current) {
      cutTriggered.current = true;
      setShowDetachedPiece(true);
      onBarrelCut?.();
    }

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

    const phaseDuration = currentPhase.end - currentPhase.start;
    const phaseProgress = Math.min((t - currentPhase.start) / phaseDuration, 1);
    const eased = applyEasing(phaseProgress, currentPhase.name === 'SAWING' ? 'linear' : 'easeInOut');

    const from = currentPhase.from;
    const to = currentPhase.to;

    groupRef.current.position.set(
      THREE.MathUtils.lerp(from[0], to[0], eased),
      THREE.MathUtils.lerp(from[1], to[1], eased),
      THREE.MathUtils.lerp(from[2], to[2], eased)
    );

    switch (currentPhase.name) {
      case 'ALIGN': {
        const targetRotZ = -Math.PI / 2;
        innerRef.current.rotation.z = THREE.MathUtils.lerp(0, targetRotZ, applyEasing(phaseProgress, 'easeOut'));
        innerRef.current.rotation.x = THREE.MathUtils.lerp(0, 0.2, applyEasing(phaseProgress, 'easeOut'));
        break;
      }
      case 'SAWING': {
        innerRef.current.rotation.z = -Math.PI / 2;
        innerRef.current.rotation.x = 0.2;

        const sawPhase = phaseProgress * sawStrokes;
        const sawOffset = Math.sin(sawPhase * Math.PI * 2) * 0.05;
        groupRef.current.position.x += sawOffset;

        const pressureOscillation = Math.sin(sawPhase * Math.PI * 2 * 2) * 0.006;
        groupRef.current.position.y += pressureOscillation;
        break;
      }
      case 'CUT_DONE': {
        innerRef.current.rotation.z = THREE.MathUtils.lerp(-Math.PI / 2, 0, applyEasing(phaseProgress, 'easeOut'));
        innerRef.current.rotation.x = THREE.MathUtils.lerp(0.2, 0, applyEasing(phaseProgress, 'easeOut'));
        break;
      }
      case 'REMOVE': {
        groupRef.current.scale.setScalar(Math.max(0, 1 - phaseProgress));
        break;
      }
      default:
        break;
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        <group ref={innerRef}>
          <HandsawMesh />
        </group>
      </group>
      <DetachedBarrelPiece active={showDetachedPiece} />
    </group>
  );
}
