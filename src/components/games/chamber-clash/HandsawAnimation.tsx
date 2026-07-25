import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applyEasing, TABLE_Y } from './animationConfigs';

interface HandsawAnimationProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh: THREE.Mesh;
  localUserId: string | null;
  baseRotation?: [number, number, number];
  /** Called when the sawing is complete — ChamberClash3D uses this to shorten the barrel */
  onBarrelCut?: () => void;
  onComplete?: () => void;
}

/**
 * Dedicated Handsaw animation:
 * 
 * 1. LIFT saw off table
 * 2. MOVE to shotgun barrel front
 * 3. ALIGN with barrel (rotate 90° to be perpendicular)
 * 4. SAW back and forth (6 strokes)
 * 5. CUT COMPLETE (trigger barrel shortening)
 * 6. REMOVE saw (pull away and drop)
 * 
 * The saw must visibly contact the FRONT/BARREL section of the shotgun,
 * NOT the center or breech.
 */
export function HandsawAnimation({
  animation,
  sourceMesh,
  localUserId,
  baseRotation = [0, 0, 0],
  onBarrelCut,
  onComplete
}: HandsawAnimationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);
  const cutTriggered = useRef(false);

  const isLocalActor = animation.userId === localUserId;

  // Normalize the source mesh
  const normalizedMesh = useMemo(() => {
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

  // The barrel front is roughly at Z = -0.2 (far side of the shotgun)
  // The shotgun rests at [0, TABLE_Y, 0.05]
  const barrelFront: [number, number, number] = [0, TABLE_Y + 0.05, -0.15];
  const startZ = isLocalActor ? 0.35 : -0.35;

  const phases = useMemo(() => [
    { name: 'LIFT',      start: 0,   end: 0.3,  from: [0, TABLE_Y, startZ],             to: [0, TABLE_Y + 0.15, startZ] },
    { name: 'APPROACH',  start: 0.3, end: 0.7,  from: [0, TABLE_Y + 0.15, startZ],      to: barrelFront },
    { name: 'ALIGN',     start: 0.7, end: 0.9,  from: barrelFront,                       to: barrelFront },
    { name: 'SAWING',    start: 0.9, end: 1.9,  from: barrelFront,                       to: barrelFront },
    { name: 'CUT_DONE',  start: 1.9, end: 2.1,  from: barrelFront,                       to: [0, TABLE_Y + 0.15, startZ * 0.5] },
    { name: 'REMOVE',    start: 2.1, end: 2.5,  from: [0, TABLE_Y + 0.15, startZ * 0.5], to: [0, TABLE_Y - 0.5, startZ] },
  ] as const, [startZ, barrelFront]);

  const totalDuration = 2.5;
  const sawStrokes = 6;

  useFrame((_, delta) => {
    if (!groupRef.current || !innerRef.current || completed.current) return;

    elapsed.current += delta;
    const t = elapsed.current;

    if (t >= totalDuration) {
      completed.current = true;
      groupRef.current.visible = false;
      onComplete?.();
      return;
    }

    // Find current phase
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
        // Rotate saw to be perpendicular to barrel (Z-axis = along barrel)
        const targetRotZ = -Math.PI / 2;
        innerRef.current.rotation.z = THREE.MathUtils.lerp(0, targetRotZ, applyEasing(phaseProgress, 'easeOut'));
        // Slight tilt toward barrel
        innerRef.current.rotation.x = THREE.MathUtils.lerp(0, 0.2, applyEasing(phaseProgress, 'easeOut'));
        break;
      }
      case 'SAWING': {
        // Keep aligned rotation
        innerRef.current.rotation.z = -Math.PI / 2;
        innerRef.current.rotation.x = 0.2;

        // Sawing back-and-forth motion on X axis
        const sawPhase = phaseProgress * sawStrokes;
        const sawOffset = Math.sin(sawPhase * Math.PI * 2) * 0.06;
        groupRef.current.position.x += sawOffset;

        // Subtle vertical oscillation from physical sawing pressure
        const pressureOscillation = Math.sin(sawPhase * Math.PI * 2 * 2) * 0.008;
        groupRef.current.position.y += pressureOscillation;
        break;
      }
      case 'CUT_DONE': {
        // Trigger barrel cut event once
        if (!cutTriggered.current) {
          cutTriggered.current = true;
          onBarrelCut?.();
        }
        // Return saw rotation to neutral
        innerRef.current.rotation.z = THREE.MathUtils.lerp(-Math.PI / 2, 0, applyEasing(phaseProgress, 'easeOut'));
        innerRef.current.rotation.x = THREE.MathUtils.lerp(0.2, 0, applyEasing(phaseProgress, 'easeOut'));
        break;
      }
      case 'REMOVE': {
        // Fade out
        groupRef.current.scale.setScalar(Math.max(0, 1 - phaseProgress));
        break;
      }
      default:
        break;
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        <primitive object={normalizedMesh} />
      </group>
    </group>
  );
}
