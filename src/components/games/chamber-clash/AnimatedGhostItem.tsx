import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getItemAnimConfig, applyEasing, type AnimPhase } from './animationConfigs';

interface AnimatedGhostItemProps {
  animation: { itemId: string; userId: string; targetId: string | null };
  sourceMesh: THREE.Mesh;
  localUserId: string | null;
  baseRotation?: [number, number, number];
  onComplete?: () => void;
}

/**
 * Generic multi-phase keyframe animation player for items.
 * 
 * Steps through an ordered list of AnimPhase keyframes from animationConfigs.
 * Each phase interpolates position using the specified easing over its duration,
 * with optional additive overlay effects (sawing, vibrating, tilting, etc.).
 * 
 * For items with `hasDedicatedComponent: true` (Beer, Handsaw), this component
 * is NOT used — their dedicated components handle the animation instead.
 * 
 * Calls `onComplete()` when all phases finish.
 */
export function AnimatedGhostItem({
  animation,
  sourceMesh,
  localUserId,
  baseRotation = [0, 0, 0],
  onComplete
}: AnimatedGhostItemProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);

  // Phase tracking
  const phaseIndex = useRef(0);
  const phaseElapsed = useRef(0);
  const totalElapsed = useRef(0);
  const completed = useRef(false);
  const prevPosition = useRef(new THREE.Vector3());

  const isLocalActor = animation.userId === localUserId;
  const isLocalTarget = animation.targetId === localUserId;

  // Get the keyframe config for this item
  const config = useMemo(
    () => getItemAnimConfig(animation.itemId, isLocalActor, isLocalTarget),
    [animation.itemId, isLocalActor, isLocalTarget]
  );

  // Normalize the source mesh (center at origin, apply base rotation)
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

  // Set initial position on mount
  useEffect(() => {
    if (groupRef.current && config.phases.length > 0) {
      const startPos = config.phases[0].position;
      groupRef.current.position.set(startPos[0], startPos[1], startPos[2]);
      prevPosition.current.set(startPos[0], startPos[1], startPos[2]);
    }
    return () => {
      // Cleanup
    };
  }, [config]);

  useFrame((state, delta) => {
    if (!groupRef.current || !innerRef.current || completed.current) return;

    const phases = config.phases;
    if (phaseIndex.current >= phases.length) {
      completed.current = true;
      onComplete?.();
      return;
    }

    totalElapsed.current += delta;
    phaseElapsed.current += delta;

    const currentPhase = phases[phaseIndex.current];
    const progress = Math.min(phaseElapsed.current / currentPhase.duration, 1);
    const easedProgress = applyEasing(progress, currentPhase.easing);

    // Get previous phase end position (or current phase start for first phase)
    const fromPos = phaseIndex.current > 0
      ? phases[phaseIndex.current - 1].position
      : (isLocalActor ? [0, 0.771, 0.35] : [0, 0.771, -0.35]) as [number, number, number];
    const toPos = currentPhase.position;

    // Interpolate position
    const x = THREE.MathUtils.lerp(fromPos[0], toPos[0], easedProgress);
    const y = THREE.MathUtils.lerp(fromPos[1], toPos[1], easedProgress);
    const z = THREE.MathUtils.lerp(fromPos[2], toPos[2], easedProgress);

    groupRef.current.position.set(x, y, z);

    // Apply rotation if specified
    if (currentPhase.rotation) {
      const fromRot = phaseIndex.current > 0 && phases[phaseIndex.current - 1].rotation
        ? phases[phaseIndex.current - 1].rotation!
        : [0, 0, 0] as [number, number, number];
      innerRef.current.rotation.set(
        THREE.MathUtils.lerp(fromRot[0], currentPhase.rotation[0], easedProgress),
        THREE.MathUtils.lerp(fromRot[1], currentPhase.rotation[1], easedProgress),
        THREE.MathUtils.lerp(fromRot[2], currentPhase.rotation[2], easedProgress)
      );
    }

    // Apply overlay effects (additive)
    const t = totalElapsed.current;
    const overlay = currentPhase.overlay || 'none';
    const params = currentPhase.overlayParams || {};

    switch (overlay) {
      case 'vibrate': {
        const intensity = params.intensity || 0.01;
        const freq = params.frequency || 30;
        groupRef.current.position.x += Math.sin(t * freq * Math.PI * 2) * intensity;
        groupRef.current.position.y += Math.cos(t * freq * Math.PI * 2 * 1.3) * intensity * 0.5;
        break;
      }
      case 'tilt_back': {
        const angle = params.angle || -0.8;
        innerRef.current.rotation.x = THREE.MathUtils.lerp(
          innerRef.current.rotation.x,
          angle,
          easedProgress
        );
        break;
      }
      case 'spin_y': {
        const speed = params.speed || 3;
        const amp = params.amplitude || Math.PI;
        innerRef.current.rotation.y = Math.sin(t * speed) * amp;
        break;
      }
      case 'spin_heal': {
        const speed = params.speed || 6;
        innerRef.current.rotation.y = t * speed;
        break;
      }
      case 'inject': {
        // Slight forward push motion
        const pushDepth = 0.03;
        const pushProgress = Math.sin(easedProgress * Math.PI);
        groupRef.current.position.z += (isLocalTarget ? -pushDepth : pushDepth) * pushProgress;
        break;
      }
      case 'saw': {
        const amp = params.amplitude || 0.05;
        const freq = params.frequency || 10;
        groupRef.current.position.x += Math.sin(t * freq * Math.PI * 2) * amp;
        break;
      }
      default:
        break;
    }

    // Advance phase if complete
    if (progress >= 1) {
      phaseIndex.current++;
      phaseElapsed.current = 0;
      // Store the position we ended at for next phase's fromPos
      prevPosition.current.copy(groupRef.current.position);
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
