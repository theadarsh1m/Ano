import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  dampV3, dampQ,
  type ShotgunVisualState,
  SHOTGUN_LOCAL_FORWARD, SHOTGUN_MUZZLE_LOCAL,
  SELF_SHOT_TARGET, OPPONENT_SHOT_TARGET,
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
  customTargetPos?: THREE.Vector3;
  shellType?: 'LIVE' | 'BLANK' | null;
  isBarrelShortened?: boolean;
  showDebugArrows?: boolean;
  isClickable?: boolean;
  onClick?: () => void;
  onFireMoment?: () => void;
  onSequenceComplete?: () => void;
}

/**
 * Physical first-person Shotgun component with 90° Roll Correction, Shot Identity Freeze,
 * and LIVE vs BLANK differentiation.
 * 
 * Remington 870 GLB model local forward axis (stock -> muzzle) is +X.
 * Local offset of barrel tip is [0.575, 0, 0].
 */
export function InteractiveShotgun({
  sourceScene,
  position,
  scale,
  gunState,
  target,
  customTargetPos,
  shellType = 'LIVE',
  isBarrelShortened = false,
  showDebugArrows = true,
  isClickable = true,
  onClick,
  onFireMoment,
  onSequenceComplete
}: InteractiveShotgunProps) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const barrelRef = useRef<THREE.Group>(null);
  const muzzleAnchorRef = useRef<THREE.Group>(null);

  // Visual state machine
  const visualState = useRef<ShotgunVisualState>('RESTING');
  const phaseElapsed = useRef(0);
  const firedThisSequence = useRef(false);
  const sequenceComplete = useRef(false);
  const triggerFireRequested = useRef(false);

  // Frozen Shot Identity (prevents state mutation mid-sequence)
  const activeShot = useRef<{
    targetType: 'local' | 'opponent' | null;
    isLive: boolean;
    aimPosition: THREE.Vector3;
    aimQuaternion: THREE.Quaternion;
    targetWorldPos?: THREE.Vector3;
  }>({
    targetType: null,
    isLive: true,
    aimPosition: new THREE.Vector3(),
    aimQuaternion: new THREE.Quaternion(),
    targetWorldPos: undefined
  });

  // Muzzle flash visibility state
  const [showMuzzleFlash, setShowMuzzleFlash] = useState(false);

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

  // Debug ArrowHelpers
  const actualArrowRef = useRef<THREE.ArrowHelper>(null);
  const desiredArrowRef = useRef<THREE.ArrowHelper>(null);
  const topArrowRef = useRef<THREE.ArrowHelper>(null);

  // Barrel-only clipping plane at local X = 0.32
  const clipPlanes = useMemo(() => {
    if (!isBarrelShortened) return [];
    return [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.32)];
  }, [isBarrelShortened]);

  useEffect(() => {
    normalizedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) => {
            const m = mat.clone();
            m.clippingPlanes = clipPlanes;
            m.clipShadows = true;
            m.needsUpdate = true;
            return m;
          });
        } else if (mesh.material) {
          const m = mesh.material.clone();
          m.clippingPlanes = clipPlanes;
          m.clipShadows = true;
          m.needsUpdate = true;
          mesh.material = m;
        }
      }
    });
  }, [normalizedScene, clipPlanes]);

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

    if (gunState === 'pointing' && target) {
      if (visualState.current === 'RESTING' || visualState.current === 'RECOVERING' || visualState.current === 'RETURNING') {
        // Freeze shot identity
        activeShot.current.targetType = target;
        activeShot.current.isLive = shellType !== 'BLANK';
        const isSelf = target === 'local';
        const defaultTargetPos = isSelf ? SELF_SHOT_TARGET : OPPONENT_SHOT_TARGET;
        activeShot.current.targetWorldPos = (customTargetPos || defaultTargetPos).clone();

        phaseElapsed.current = 0;
        firedThisSequence.current = false;
        sequenceComplete.current = false;
        triggerFireRequested.current = false;
        visualState.current = 'PICKING_UP';

        targetPosition.current.copy(pickupPos);
        targetQuaternion.current.copy(restQuaternion);
        currentLerpSpeed.current = 8;

        console.log(`[SHOTGUN] START SEQUENCE: Target=${target}, ShellType=${shellType}, targetWorldPos:`, activeShot.current.targetWorldPos.toArray());
      }
    }

    if (gunState === 'firing') {
      triggerFireRequested.current = true;
    }
  }, [gunState, target, shellType, customTargetPos, position, restPosition, restQuaternion, pickupPos]);

  // Main animation frame loop
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const dt = Math.min(delta, 0.05);
    phaseElapsed.current += dt;

    const state = visualState.current;
    const isSelf = (activeShot.current.targetType || target) === 'local';
    const isLive = activeShot.current.isLive;

    const targetWorldPos = activeShot.current.targetWorldPos || (isSelf ? SELF_SHOT_TARGET : OPPONENT_SHOT_TARGET);

    const aimPos = isSelf ? aimSelfPos : aimOpponentPos;

    // Calculate current vectors for alignment check
    const currentQuat = groupRef.current.quaternion;
    const actualForward = SHOTGUN_LOCAL_FORWARD.clone().applyQuaternion(currentQuat).normalize();
    const desiredForward = new THREE.Vector3().subVectors(targetWorldPos, groupRef.current.position).normalize();
    const alignment = actualForward.dot(desiredForward);

    // Local top direction (+Y) for debugging 90° roll
    const actualUp = new THREE.Vector3(0, 1, 0).applyQuaternion(currentQuat).normalize();

    // Update debug arrows if rendered
    if (actualArrowRef.current && desiredArrowRef.current && topArrowRef.current) {
      actualArrowRef.current.setDirection(actualForward);
      desiredArrowRef.current.setDirection(desiredForward);
      topArrowRef.current.setDirection(actualUp);
      actualArrowRef.current.position.copy(groupRef.current.position);
      desiredArrowRef.current.position.copy(groupRef.current.position);
      topArrowRef.current.position.copy(groupRef.current.position);
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
        const aimQuat = computeShotgunAimQuaternion(pickupPos, targetWorldPos, -90);
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
        const aimQuat = computeShotgunAimQuaternion(aimPos, targetWorldPos, -90);
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
        const aimQuat = computeShotgunAimQuaternion(aimPos, targetWorldPos, -90);
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
        const aimQuat = computeShotgunAimQuaternion(aimPos, targetWorldPos, -90);
        targetQuaternion.current.copy(aimQuat);
        currentLerpSpeed.current = 20;

        // Snapshot aimed pose
        activeShot.current.aimPosition.copy(aimPos);
        activeShot.current.aimQuaternion.copy(aimQuat);

        // STRICT ALIGNMENT GUARD: Must be aligned (> 0.98) AND minimum settle time (0.2s)
        const isAligned = alignment > 0.98;
        const settleTimeReached = phaseElapsed.current >= 0.20;

        if ((triggerFireRequested.current || firedThisSequence.current === false) && isAligned && settleTimeReached) {
          if (!firedThisSequence.current) {
            firedThisSequence.current = true;
            visualState.current = 'FIRING';
            phaseElapsed.current = 0;
            onFireMoment?.();
            console.log(`[SHOTGUN] FIRE MOMENT: isLive=${isLive}, alignment=${alignment.toFixed(4)}`);
          }
        }
        break;
      }

      case 'FIRING': {
        // PRESERVE AIM POSE — DO NOT FALL BACK TO TABLE REST
        targetPosition.current.copy(activeShot.current.aimPosition);
        targetQuaternion.current.copy(activeShot.current.aimQuaternion);
        currentLerpSpeed.current = 35;

        if (isLive) {
          // LIVE SHOT: Bright Muzzle Flash + Strong Single Recoil
          if (phaseElapsed.current <= 0.05 && !showMuzzleFlash) {
            setShowMuzzleFlash(true);
            setTimeout(() => setShowMuzzleFlash(false), 180);
          }
          const recoilMag = 0.14;
          const recoilDir = actualForward.clone().negate().multiplyScalar(recoilMag);
          const kickProgress = Math.min(phaseElapsed.current / 0.08, 1);
          recoilOffset.current.copy(recoilDir).multiplyScalar(kickProgress);
        } else {
          // BLANK SHOT: Tiny Mechanical Jerk, NO Flash
          const recoilMag = 0.03;
          const recoilDir = actualForward.clone().negate().multiplyScalar(recoilMag);
          const kickProgress = Math.min(phaseElapsed.current / 0.06, 1);
          recoilOffset.current.copy(recoilDir).multiplyScalar(kickProgress);
        }

        if (phaseElapsed.current >= 0.08) {
          visualState.current = 'RECOILING';
          phaseElapsed.current = 0;
        }
        break;
      }

      case 'RECOILING': {
        targetPosition.current.copy(activeShot.current.aimPosition);
        targetQuaternion.current.copy(activeShot.current.aimQuaternion);

        const decay = Math.exp(-phaseElapsed.current * 10);
        const maxRecoil = isLive ? 0.14 : 0.03;
        const recoilDir = actualForward.clone().negate().multiplyScalar(maxRecoil);

        recoilOffset.current.copy(recoilDir).multiplyScalar(decay);

        if (phaseElapsed.current >= (isLive ? 0.25 : 0.15)) {
          visualState.current = 'RECOVERING';
          phaseElapsed.current = 0;
        }
        break;
      }

      case 'RECOVERING': {
        targetPosition.current.copy(activeShot.current.aimPosition);
        targetQuaternion.current.copy(activeShot.current.aimQuaternion);
        currentLerpSpeed.current = 8;
        recoilOffset.current.multiplyScalar(Math.max(0, 1 - dt * 10));

        if (phaseElapsed.current >= 0.35) {
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

    // Emissive hover glow logic
    if (groupRef.current) {
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (child.material.emissive !== undefined) {
            const targetEmissive = (hovered && isClickable && visualState.current === 'RESTING') ? 0.35 : 0;
            const currentIntensity = child.material.emissiveIntensity || 0;
            child.material.emissive.setHex(0x336699);
            child.material.emissiveIntensity = currentIntensity + (targetEmissive - currentIntensity) * 10 * dt;
          }
        }
      });
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
            {/* Cut Barrel End Cap (visible only when isBarrelShortened is true) */}
            {isBarrelShortened && (
              <mesh position={[0.32, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <ringGeometry args={[0.008, 0.018, 16]} />
                <meshStandardMaterial color="#111218" roughness={0.6} metalness={0.8} />
              </mesh>
            )}
          </group>

          {/* Invisible forgiving raycast hitbox around resting shotgun */}
          {isClickable && (
            <mesh 
              visible={false} 
              position={[0, 0.05, 0]}
              onPointerOver={(e) => {
                if (visualState.current !== 'RESTING') return;
                e.stopPropagation();
                setHovered(true);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHovered(false);
                document.body.style.cursor = 'auto';
              }}
              onClick={(e) => {
                if (visualState.current !== 'RESTING') return;
                e.stopPropagation();
                onClick?.();
              }}
            >
              <boxGeometry args={[1.2, 0.25, 0.25]} />
              <meshBasicMaterial transparent opacity={0.1} color="red" />
            </mesh>
          )}

          {/* Physical Muzzle Anchor Tip (X = 0.575 for normal, X = 0.32 for shortened barrel) */}
          <group ref={muzzleAnchorRef} position={[isBarrelShortened ? 0.32 : SHOTGUN_MUZZLE_LOCAL.x, SHOTGUN_MUZZLE_LOCAL.y, SHOTGUN_MUZZLE_LOCAL.z]}>
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

      {/* Visual Debug Arrows for Aim & Roll Direction */}
      {showDebugArrows && (
        <>
          <arrowHelper ref={actualArrowRef} args={[SHOTGUN_LOCAL_FORWARD, new THREE.Vector3(), 0.4, 0x00ff00]} />
          <arrowHelper ref={desiredArrowRef} args={[SHOTGUN_LOCAL_FORWARD, new THREE.Vector3(), 0.4, 0xff0000]} />
          <arrowHelper ref={topArrowRef} args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.3, 0x0088ff]} />
        </>
      )}
    </>
  );
}
