import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applyEasing, TABLE_Y, LOCAL_FACE, OPPONENT_FACE } from './animationConfigs';
import { BeerCanMesh } from './CustomItemMeshes';

interface BeerAnimationProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh?: THREE.Mesh;
  localUserId: string | null;
  baseRotation?: [number, number, number];
  ejectedShellType?: 'LIVE' | 'BLANK' | null;
  onShotgunPump?: () => void;
  onComplete?: () => void;
}

/**
 * Dedicated Beer animation:
 * 
 * 1. LIFT off table
 * 2. MOVE to actor face
 * 3. TILT back (drinking, top opening toward actor mouth)
 * 4. HOLD/DRINK
 * 5. LOWER beer
 * 6. SHOTGUN PUMP / EJECTION
 * 7. COMPLETE
 */
export function BeerAnimation({
  animation,
  localUserId,
  onShotgunPump,
  onComplete
}: BeerAnimationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);
  const pumpTriggered = useRef(false);

  const isLocalActor = animation.userId === localUserId;
  const face = isLocalActor ? LOCAL_FACE : OPPONENT_FACE;

  // Phase definitions with cumulative times
  const phases = useMemo(() => {
    const startZ = isLocalActor ? 0.35 : -0.35;
    return [
      { name: 'LIFT',          start: 0,   end: 0.3,  from: [0, TABLE_Y, startZ],            to: [0, TABLE_Y + 0.15, startZ] },
      { name: 'TO_FACE',       start: 0.3, end: 0.8,  from: [0, TABLE_Y + 0.15, startZ],     to: [face.x, face.y, face.z] },
      { name: 'TILT',          start: 0.8, end: 1.2,  from: [face.x, face.y, face.z],         to: [face.x, face.y, face.z] },
      { name: 'DRINK_HOLD',    start: 1.2, end: 1.7,  from: [face.x, face.y, face.z],         to: [face.x, face.y, face.z] },
      { name: 'LOWER',         start: 1.7, end: 2.0,  from: [face.x, face.y, face.z],         to: [face.x, face.y - 0.3, face.z] },
      { name: 'EJECT',         start: 2.0, end: 2.5,  from: [face.x, face.y - 0.3, face.z],   to: [0, TABLE_Y - 0.5, 0] },
      { name: 'DONE',          start: 2.5, end: 2.8,  from: [0, TABLE_Y - 0.5, 0],            to: [0, TABLE_Y - 1.0, 0] },
    ] as const;
  }, [isLocalActor, face]);

  const totalDuration = 2.8;

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

    const phaseProgress = Math.min((t - currentPhase.start) / (currentPhase.end - currentPhase.start), 1);

    // Position interpolation
    const eased = applyEasing(phaseProgress, 'easeInOut');
    const from = currentPhase.from;
    const to = currentPhase.to;

    groupRef.current.position.set(
      THREE.MathUtils.lerp(from[0], to[0], eased),
      THREE.MathUtils.lerp(from[1], to[1], eased),
      THREE.MathUtils.lerp(from[2], to[2], eased)
    );

    // Phase-specific behavior (Actor-relative tilt direction)
    const tiltDirection = isLocalActor ? 1.1 : -1.1;

    switch (currentPhase.name) {
      case 'TILT': {
        // Tilt the top of the can toward actor mouth
        const tiltAngle = tiltDirection * applyEasing(phaseProgress, 'easeOut');
        innerRef.current.rotation.x = tiltAngle;
        break;
      }
      case 'DRINK_HOLD': {
        // Hold tilted position with subtle sway
        innerRef.current.rotation.x = tiltDirection;
        innerRef.current.rotation.z = Math.sin(t * 8) * 0.05;
        break;
      }
      case 'LOWER': {
        // Return tilt to upright
        innerRef.current.rotation.x = THREE.MathUtils.lerp(tiltDirection, 0, applyEasing(phaseProgress, 'easeOut'));
        innerRef.current.rotation.z = 0;
        break;
      }
      case 'EJECT': {
        // Trigger shotgun pump & single physical shell ejection
        if (!pumpTriggered.current) {
          pumpTriggered.current = true;
          onShotgunPump?.();
        }
        // Fade out the beer mesh during this phase
        groupRef.current.scale.setScalar(Math.max(0, 1 - phaseProgress));
        break;
      }
      case 'DONE': {
        groupRef.current.visible = false;
        break;
      }
      default:
        break;
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        <BeerCanMesh />
      </group>
    </group>
  );
}
