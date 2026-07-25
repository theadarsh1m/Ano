import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  dampV3, dampQ,
  type ShotgunVisualState,
  SHOTGUN_REST, SHOTGUN_LOCAL_FORWARD, SHOTGUN_MUZZLE_LOCAL,
  SELF_SHOT_TARGET, OPPONENT_SHOT_TARGET,
  SHOTGUN_SEQUENCE_PHASES,
  computeShotgunAimQuaternion,
  TABLE_Y,
} from './animationConfigs';

export type GunStateInput = 'idle' | 'pointing' | 'pump' | 'firing';

interface InteractiveShotgunProps {
  sourceScene: THREE.Group;
  position: [number, number, number];
  scale: [number, number, number];
  gunState: GunStateInput;
  target: 'local' | 'opponent' | null;
  shellType?: 'LIVE' | 'BLANK' | null;
  isBarrelShortened?: boolean;
  showDebugArrows?: boolean;
  onFireMoment?: () => void;
  onSequenceComplete?: () => void;
}

/**
 * Physical first-person Shotgun component.
 * 
 * Remington 870 GLB model local forward axis (stock -> muzzle) is +X.
 * Muzzle tip is located at local offset [0.575, 0, 0].
 * 
 * Visual State Machine:
 * RESTING -> PICKING_UP -> ROTATING_TOWARD_TARGET -> AIMING -> AIM_SETTLE -> FIRING -> RECOILING -> RECOVERING -> RETURNING
 * 
 * Firing is STRICTLY BLOCKED until alignment > 0.98 AND minimum settle duration is reached.
 * Recoil moves backward along -actualForward.
 */
export function InteractiveShotgun({
  sourceScene,
  position,
  scale,
  gunState,
  target,
  shellType,
  isBarrelShortened = false,
  showDebugArrows = true,
  onFireMoment,
  onSequenceComplete
}: InteractiveShotgunProps) {
  const groupRef = useRef<THREE.Group>(null);
  const barrelRef = useRef<THREE.Group>(null);
  const muzzleAnchorRef = useRef<THREE.Group>(null);

  // Visual state machine
  const visualState = useRef<ShotgunVisualState>('RESTING');
  const phaseElapsed = useRef(0);
  const firedThisSequence = useRef(false);
  const sequenceComplete = useRef(false);
  const triggerFireRequested = useRef(false);

  // Muzzle flash visibility state
  const [showMuzzleFlash, setShowMuzzleFlash] = useState(false);
  const [debugAlignment, setDebugAlignment] = useState(0);

  // Damping targets
  const targetPosition = useRef(new THREE.Vector3(...position));
  const targetQuaternion = useRef(new THREE.Quaternion());
  const currentLerpSpeed = useRef(5);

  // Recoil offset vector
  const recoilOffset = useRef(new THREE.Vector3());

  // Rest transforms
  const restPosition = useMemo(() => new THREE.Vector3(...position), [position]);
  const restQuaternion = useMemo(() => new THREE.Quaternion(), []);

  // Normalize mesh (center at origin)
  const normalizedScene = useMemo(() => {
    const s = sourceScene.clone();
    const box = new THREE.Box3().setFromObject(s);
    const center = new THREE.Vector3();
    box.getCenter(center);
    s.position.set(-center.x, -center.y, -center.z);
    return s;
  }, [sourceScene]);

  // Positions
  const pickupPos = useMemo(() => new THREE.Vector3(0, TABLE_Y + 0.15, 0.05), []);
  const aimOpponentPos = useMemo(() => new THREE.Vector3(0, TABLE_Y + 0.18, -0.05), []);
  const aimSelfPos = useMemo(() => new THREE.Vector3(0, TABLE_Y + 0.16, 0.22), []);

  // Compute aim target world positions
  const aimTargetWorldPos = useMemo(() => {
    if (target === 'local') return SELF_SHOT_TARGET.clone();
    return OPPONENT_SHOT_TARGET.clone();
  }, [target]);

  // Debug ArrowHelpers
  const actualArrowRef = useRef<THREE.ArrowHelper>(null);
  const desiredArrowRef = useRef<THREE.ArrowHelper>(null);

  // State Machine Input Handlers
  useEffect(() => {
    if (gunState === 'idle' && visualState.current !== 'RESTING') {
      if (visualState.current !== 'RETURNING' && visualState.current !== 'RECOVERING') {
        visualState.current = 'RETURNING';
        phaseElapsed.current = 0;
        targetPosition.current.copy(restPosition);
        targetQuaternion.current.copy(restQuaternion);
        currentLerpSpeed.current = 5;
      }
    }

    if (gunState === 'pointing' && target && visualState.current === 'RESTING') {
      // Start sequence
      phaseElapsed.current = 0;
      firedThisSequence.current = false;
      sequenceComplete.current = false;
      triggerFireRequested.current = false;
      visualState.current = 'PICKING_UP';

      targetPosition.current.copy(pickupPos);
      targetQuaternion.current.copy(restQuaternion);
      currentLerpSpeed.current = 8;
    }

    if (gunState === 'firing') {
      triggerFireRequested.current = true;
    }
  }, [gunState, target, position, restPosition, restQuaternion, pickupPos]);

  // Main animation frame loop
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const dt = Math.min(delta, 0.05);
    phaseElapsed.current += dt;

    const state = visualState.current;
    const isSelf = target === 'local';
    const aimPos = isSelf ? aimSelfPos : aimOpponentPos;
    const targetWorldPos = isSelf ? SELF_SHOT_TARGET : OPPONENT_SHOT_TARGET;

    // Calculate current vectors for alignment check
    const currentQuat = groupRef.current.quaternion;
    const actualForward = SHOTGUN_LOCAL_FORWARD.clone().applyQuaternion(currentQuat).normalize();
    const desiredForward = new THREE.Vector3().subVectors(targetWorldPos, groupRef.current.position).normalize();
    const alignment = actualForward.dot(desiredForward);
    setDebugAlignment(alignment);

    // Update debug arrows if rendered
    if (actualArrowRef.current && desiredArrowRef.current) {
      actualArrowRef.current.setDirection(actualForward);
      desiredArrowRef.current.setDirection(desiredForward);
      actualArrowRef.current.position.copy(groupRef.current.position);
      desiredArrowRef.current.position.copy(groupRef.current.position);
    }

    // ── State Machine Phase Logic ──
    switch (state) {
      case 'RESTING': {
        targetPosition.current.copy(restPosition);
        targetQuaternion.current.copy(restQuaternion);
        currentLerpSpeed.current = 5;
        recoilOffset.current.set(0, 0, 0);
        break;
      }

      case 'PICKING_UP': {
        targetPosition.current.copy(pickupPos);
        const aimQuat = computeShotgunAimQuaternion(pickupPos, targetWorldPos);
        targetQuaternion.current.copy(aimQuat);
        currentLerpSpeed.current = 12;

        if (phaseElapsed.current >= 0.20) {
          visualState.current = 'ROTATING_TOWARD_TARGET';
          phaseElapsed.current = 0;
        }
        break;
      }

      case 'ROTATING_TOWARD_TARGET': {
        targetPosition.current.copy(aimPos);
        const aimQuat = computeShotgunAimQuaternion(aimPos, targetWorldPos);
        targetQuaternion.current.copy(aimQuat);
        currentLerpSpeed.current = 14;

        if (phaseElapsed.current >= 0.25) {
          visualState.current = 'AIMING';
          phaseElapsed.current = 0;
        }
        break;
      }

      case 'AIMING': {
        targetPosition.current.copy(aimPos);
        const aimQuat = computeShotgunAimQuaternion(aimPos, targetWorldPos);
        targetQuaternion.current.copy(aimQuat);
        currentLerpSpeed.current = 16;

        if (phaseElapsed.current >= 0.25) {
          visualState.current = 'AIM_SETTLE';
          phaseElapsed.current = 0;
        }
        break;
      }

      case 'AIM_SETTLE': {
        targetPosition.current.copy(aimPos);
        const aimQuat = computeShotgunAimQuaternion(aimPos, targetWorldPos);
        targetQuaternion.current.copy(aimQuat);
        currentLerpSpeed.current = 20;

        // STRICT ALIGNMENT GUARD: Must be aligned (> 0.98) AND minimum settle time (0.2s)
        const isAligned = alignment > 0.98;
        const settleTimeReached = phaseElapsed.current >= 0.20;

        if ((triggerFireRequested.current || firedThisSequence.current === false) && isAligned && settleTimeReached) {
          if (!firedThisSequence.current) {
            firedThisSequence.current = true;
            visualState.current = 'FIRING';
            phaseElapsed.current = 0;
            onFireMoment?.();
          }
        }
        break;
      }

      case 'FIRING': {
        targetPosition.current.copy(aimPos);
        currentLerpSpeed.current = 35;

        // SINGLE FIRE IMPULSE
        if (phaseElapsed.current <= 0.05 && !showMuzzleFlash) {
          setShowMuzzleFlash(true);
          setTimeout(() => setShowMuzzleFlash(false), 150);
        }

        const isLive = shellType === 'LIVE';
        const recoilMag = isLive ? 0.14 : 0.05;

        // Recoil vector = -actualForward (opposite of barrel direction)
        const recoilDir = actualForward.clone().negate().multiplyScalar(recoilMag);

        const kickProgress = Math.min(phaseElapsed.current / 0.08, 1);
        recoilOffset.current.copy(recoilDir).multiplyScalar(kickProgress);

        if (phaseElapsed.current >= 0.08) {
          visualState.current = 'RECOILING';
          phaseElapsed.current = 0;
        }
        break;
      }

      case 'RECOILING': {
        const isLive = shellType === 'LIVE';
        const decay = Math.exp(-phaseElapsed.current * 10);
        const maxRecoil = isLive ? 0.14 : 0.05;
        const recoilDir = actualForward.clone().negate().multiplyScalar(maxRecoil);

        recoilOffset.current.copy(recoilDir).multiplyScalar(decay);

        if (phaseElapsed.current >= 0.25) {
          visualState.current = 'RECOVERING';
          phaseElapsed.current = 0;
        }
        break;
      }

      case 'RECOVERING': {
        targetPosition.current.copy(aimPos);
        const aimQuat = computeShotgunAimQuaternion(aimPos, targetWorldPos);
        targetQuaternion.current.copy(aimQuat);
        currentLerpSpeed.current = 6;
        recoilOffset.current.multiplyScalar(Math.max(0, 1 - dt * 10));

        if (phaseElapsed.current >= 0.40) {
          visualState.current = 'RETURNING';
          phaseElapsed.current = 0;
        }
        break;
      }

      case 'RETURNING': {
        targetPosition.current.copy(restPosition);
        targetQuaternion.current.copy(restQuaternion);
        currentLerpSpeed.current = 5;
        recoilOffset.current.multiplyScalar(Math.max(0, 1 - dt * 8));

        if (phaseElapsed.current >= 0.55) {
          visualState.current = 'RESTING';
          phaseElapsed.current = 0;
          firedThisSequence.current = false;
          triggerFireRequested.current = false;
          if (!sequenceComplete.current) {
            sequenceComplete.current = true;
            onSequenceComplete?.();
          }
        }
        break;
      }
    }

    // Apply frame-rate-independent exponential decay damping
    dampV3(groupRef.current.position, targetPosition.current, currentLerpSpeed.current, dt);
    groupRef.current.position.add(recoilOffset.current);
    dampQ(groupRef.current.quaternion, targetQuaternion.current, currentLerpSpeed.current, dt);
  });

  return (
    <>
      <group ref={groupRef}>
        <group scale={scale}>
          {/* Main Shotgun Mesh */}
          <group ref={barrelRef}>
            <primitive object={normalizedScene} />
          </group>

          {/* Physical Muzzle Anchor Tip (+X = 0.575) */}
          <group ref={muzzleAnchorRef} position={[SHOTGUN_MUZZLE_LOCAL.x, SHOTGUN_MUZZLE_LOCAL.y, SHOTGUN_MUZZLE_LOCAL.z]}>
            {/* Muzzle Flash Overlay */}
            {showMuzzleFlash && (
              <group>
                {/* Intense central flash sphere */}
                <mesh position={[0.05, 0, 0]}>
                  <sphereGeometry args={[0.06, 16, 16]} />
                  <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
                </mesh>
                {/* Outer orange cone/spark glow */}
                <mesh position={[0.15, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                  <coneGeometry args={[0.08, 0.25, 16]} />
                  <meshBasicMaterial color="#ff7700" transparent opacity={0.7} />
                </mesh>
                {/* Point light centered at muzzle tip */}
                <pointLight color="#ffaa33" intensity={25} distance={3} />
              </group>
            )}
          </group>
        </group>
      </group>

      {/* Visual Debug Arrows for Aim Direction */}
      {showDebugArrows && (
        <>
          <arrowHelper ref={actualArrowRef} args={[SHOTGUN_LOCAL_FORWARD, new THREE.Vector3(), 0.4, 0x00ff00]} />
          <arrowHelper ref={desiredArrowRef} args={[SHOTGUN_LOCAL_FORWARD, new THREE.Vector3(), 0.4, 0xff0000]} />
        </>
      )}
    </>
  );
}
