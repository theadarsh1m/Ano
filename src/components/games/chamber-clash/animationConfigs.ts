/**
 * animationConfigs.ts
 * 
 * Central source-of-truth for all Chamber Clash 3D animation sequences.
 */

import * as THREE from 'three';

// ─── Frame-Rate-Independent Interpolation ───────────────────────────────

export function damp(current: number, target: number, speed: number, delta: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));
}

export function dampV3(current: THREE.Vector3, target: THREE.Vector3, speed: number, delta: number): void {
  current.x = damp(current.x, target.x, speed, delta);
  current.y = damp(current.y, target.y, speed, delta);
  current.z = damp(current.z, target.z, speed, delta);
}

export function dampQ(current: THREE.Quaternion, target: THREE.Quaternion, speed: number, delta: number): void {
  const t = 1 - Math.exp(-speed * delta);
  current.slerp(target, t);
}

// ─── Easing Functions ───────────────────────────────────────────────────

export type EasingType = 'linear' | 'easeOut' | 'easeIn' | 'easeInOut' | 'spring';

export function applyEasing(t: number, easing: EasingType): number {
  const c = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'linear': return c;
    case 'easeOut': return 1 - Math.pow(1 - c, 3);
    case 'easeIn': return Math.pow(c, 3);
    case 'easeInOut': return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
    case 'spring': {
      const s = Math.sin(c * Math.PI * 1.2);
      return c < 1 ? c + 0.08 * s : 1;
    }
    default: return c;
  }
}

// ─── Spatial Constants ──────────────────────────────────────────────────

export const TABLE_Y = 0.771;

/** REAL local forward axis of Remington 870 GLB (stock = -X, barrel/muzzle = +X) */
export const SHOTGUN_LOCAL_FORWARD = new THREE.Vector3(1, 0, 0);

/** Local offset of the muzzle tip relative to centered mesh origin */
export const SHOTGUN_MUZZLE_LOCAL = new THREE.Vector3(0.575, 0, 0);

export const SHOTGUN_REST = {
  position: new THREE.Vector3(0, TABLE_Y, 0.05),
  quaternion: new THREE.Quaternion(),
};

export const SHOTGUN_BREECH = new THREE.Vector3(0, TABLE_Y + 0.03, 0.05);
export const SHOTGUN_EJECTION_PORT = new THREE.Vector3(0.08, TABLE_Y + 0.08, 0.05);

export const LOCAL_FACE = new THREE.Vector3(0, 1.11, 0.63);
export const OPPONENT_FACE = new THREE.Vector3(0, 1.2, -0.8);
export const LOCAL_CHEST = new THREE.Vector3(0, 0.95, 0.65);
export const OPPONENT_CHEST = new THREE.Vector3(0, 1.0, -0.65);
export const LOCAL_EAR = new THREE.Vector3(0.15, 1.10, 0.63);
export const OPPONENT_EAR = new THREE.Vector3(-0.15, 1.15, -0.75);
export const LOCAL_WRIST = new THREE.Vector3(0.15, 0.9, 0.4);
export const OPPONENT_WRIST = new THREE.Vector3(-0.15, 0.95, -0.6);

// Explicit targets for shotgun aiming
export const CAMERA_POSITION = new THREE.Vector3(0, 1.3, 1.2);
export const SELF_SHOT_TARGET = new THREE.Vector3(0, 1.15, 0.85); // Camera / local face
export const OPPONENT_SHOT_TARGET = new THREE.Vector3(0, 1.15, -0.85); // Opponent head/upper chest

// ─── Aim Quaternion Calculation ───────────────────────────────────────

/**
 * Calculates exact quaternion rotating SHOTGUN_LOCAL_FORWARD (+X) onto target direction,
 * using a right-handed basis matrix to guarantee +X points at target while local +Y stays upright.
 */
export function computeShotgunAimQuaternion(
  gunPosition: THREE.Vector3,
  targetPosition: THREE.Vector3
): THREE.Quaternion {
  const F = new THREE.Vector3().subVectors(targetPosition, gunPosition).normalize();
  const upRef = new THREE.Vector3(0, 1, 0);
  
  if (Math.abs(F.dot(upRef)) > 0.99) {
    upRef.set(0, 0, 1);
  }
  
  const S = new THREE.Vector3().crossVectors(F, upRef).normalize();
  const U = new THREE.Vector3().crossVectors(S, F).normalize();
  
  const mat = new THREE.Matrix4();
  mat.makeBasis(F, U, S);
  
  const q = new THREE.Quaternion();
  q.setFromRotationMatrix(mat);
  return q;
}

// ─── Item Animation Types & Configs ─────────────────────────────────────

export interface AnimPhase {
  duration: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  easing: EasingType;
  overlay?: 'none' | 'saw' | 'vibrate' | 'tilt_back' | 'spin_y' | 'spin_heal' | 'inject';
  overlayParams?: Record<string, number>;
}

export interface ItemAnimConfig {
  phases: AnimPhase[];
  totalDuration: number;
  hasDedicatedComponent?: boolean;
}

function getActorFace(isLocalActor: boolean): [number, number, number] {
  const v = isLocalActor ? LOCAL_FACE : OPPONENT_FACE;
  return [v.x, v.y, v.z];
}

function getActorChest(isLocalActor: boolean): [number, number, number] {
  const v = isLocalActor ? LOCAL_CHEST : OPPONENT_CHEST;
  return [v.x, v.y, v.z];
}

function getActorEar(isLocalActor: boolean): [number, number, number] {
  const v = isLocalActor ? LOCAL_EAR : OPPONENT_EAR;
  return [v.x, v.y, v.z];
}

function getTargetChest(isLocalTarget: boolean): [number, number, number] {
  const v = isLocalTarget ? LOCAL_CHEST : OPPONENT_CHEST;
  return [v.x, v.y, v.z];
}

function getTargetWrist(isLocalTarget: boolean): [number, number, number] {
  const v = isLocalTarget ? LOCAL_WRIST : OPPONENT_WRIST;
  return [v.x, v.y, v.z];
}

function startPos(isLocalActor: boolean): [number, number, number] {
  return [0, TABLE_Y, isLocalActor ? 0.35 : -0.35];
}

export function getItemAnimConfig(
  itemId: string,
  isLocalActor: boolean,
  isLocalTarget: boolean
): ItemAnimConfig {
  const start = startPos(isLocalActor);
  const liftPos: [number, number, number] = [start[0], start[1] + 0.15, start[2]];

  switch (itemId) {
    case 'beer': {
      const face = getActorFace(isLocalActor);
      return {
        hasDedicatedComponent: true,
        totalDuration: 2.8,
        phases: [
          { duration: 0.3, position: liftPos, easing: 'easeOut' },
          { duration: 0.5, position: face, easing: 'easeInOut' },
          { duration: 0.4, position: face, easing: 'linear', overlay: 'tilt_back', overlayParams: { angle: -1.0 } },
          { duration: 0.6, position: face, easing: 'linear', overlay: 'tilt_back', overlayParams: { angle: -1.0 } },
          { duration: 0.3, position: [face[0], face[1] - 0.2, face[2]], easing: 'easeIn' },
          { duration: 0.7, position: [0, TABLE_Y - 0.5, 0], easing: 'easeIn' },
        ]
      };
    }

    case 'handsaw': {
      return {
        hasDedicatedComponent: true,
        totalDuration: 2.5,
        phases: [
          { duration: 0.3, position: liftPos, easing: 'easeOut' },
          { duration: 0.4, position: [0, TABLE_Y + 0.05, -0.15], easing: 'easeInOut' },
          { duration: 0.2, position: [0, TABLE_Y + 0.03, -0.18], rotation: [0, 0, -Math.PI/2], easing: 'easeOut' },
          { duration: 1.0, position: [0, TABLE_Y + 0.03, -0.18], easing: 'linear', overlay: 'saw', overlayParams: { amplitude: 0.06, frequency: 12 } },
          { duration: 0.3, position: liftPos, easing: 'easeOut' },
          { duration: 0.3, position: [start[0], TABLE_Y - 0.3, start[2]], easing: 'easeIn' },
        ]
      };
    }

    case 'magnifier': {
      return {
        totalDuration: 1.6,
        phases: [
          { duration: 0.25, position: liftPos, easing: 'easeOut' },
          { duration: 0.4, position: [0, TABLE_Y + 0.12, 0.05], easing: 'easeInOut' },
          { duration: 0.6, position: [0, TABLE_Y + 0.10, 0.02], easing: 'linear', overlay: 'spin_y', overlayParams: { speed: 2, amplitude: 0.15 } },
          { duration: 0.15, position: liftPos, easing: 'easeOut' },
          { duration: 0.2, position: [start[0], TABLE_Y - 0.3, start[2]], easing: 'easeIn' },
        ]
      };
    }

    case 'inverter': {
      return {
        totalDuration: 1.4,
        phases: [
          { duration: 0.2, position: liftPos, easing: 'easeOut' },
          { duration: 0.35, position: [0, TABLE_Y + 0.12, 0.05], easing: 'easeInOut' },
          { duration: 0.5, position: [0, TABLE_Y + 0.12, 0.05], easing: 'spring', overlay: 'spin_y', overlayParams: { speed: 8, amplitude: Math.PI } },
          { duration: 0.15, position: liftPos, easing: 'easeOut' },
          { duration: 0.2, position: [start[0], TABLE_Y - 0.3, start[2]], easing: 'easeIn' },
        ]
      };
    }

    case 'medkit': {
      const chest = getActorChest(isLocalActor);
      return {
        totalDuration: 1.5,
        phases: [
          { duration: 0.25, position: liftPos, easing: 'easeOut' },
          { duration: 0.4, position: chest, easing: 'easeInOut' },
          { duration: 0.5, position: chest, easing: 'linear', overlay: 'spin_heal', overlayParams: { speed: 6 } },
          { duration: 0.15, position: [chest[0], chest[1] + 0.1, chest[2]], easing: 'easeOut' },
          { duration: 0.2, position: [start[0], TABLE_Y - 0.3, start[2]], easing: 'easeIn' },
        ]
      };
    }

    case 'burner_phone': {
      const ear = getActorEar(isLocalActor);
      return {
        totalDuration: 1.5,
        phases: [
          { duration: 0.2, position: liftPos, easing: 'easeOut' },
          { duration: 0.35, position: ear, easing: 'easeInOut' },
          { duration: 0.6, position: ear, easing: 'linear', overlay: 'vibrate', overlayParams: { intensity: 0.015, frequency: 40 } },
          { duration: 0.15, position: [ear[0], ear[1] - 0.1, ear[2]], easing: 'easeOut' },
          { duration: 0.2, position: [start[0], TABLE_Y - 0.3, start[2]], easing: 'easeIn' },
        ]
      };
    }

    case 'handcuffs': {
      const wrist = getTargetWrist(isLocalTarget);
      return {
        totalDuration: 1.5,
        phases: [
          { duration: 0.2, position: liftPos, easing: 'easeOut' },
          { duration: 0.5, position: [wrist[0], wrist[1] + 0.15, wrist[2]], easing: 'easeInOut' },
          { duration: 0.4, position: wrist, easing: 'spring', overlay: 'spin_y', overlayParams: { speed: 3, amplitude: 0.3 } },
          { duration: 0.2, position: wrist, easing: 'linear' },
          { duration: 0.2, position: [start[0], TABLE_Y - 0.3, start[2]], easing: 'easeIn' },
        ]
      };
    }

    case 'adrenaline': {
      const targetChest = getTargetChest(isLocalTarget);
      return {
        totalDuration: 1.3,
        phases: [
          { duration: 0.2, position: liftPos, easing: 'easeOut' },
          { duration: 0.3, position: targetChest, easing: 'easeIn' },
          { duration: 0.4, position: [targetChest[0], targetChest[1] - 0.02, targetChest[2] + (isLocalTarget ? -0.05 : 0.05)], easing: 'linear', overlay: 'inject' },
          { duration: 0.2, position: [targetChest[0], targetChest[1] + 0.1, targetChest[2]], easing: 'easeOut' },
          { duration: 0.2, position: [start[0], TABLE_Y - 0.3, start[2]], easing: 'easeIn' },
        ]
      };
    }

    default: {
      return {
        totalDuration: 1.0,
        phases: [
          { duration: 0.3, position: liftPos, easing: 'easeOut' },
          { duration: 0.4, position: [0, TABLE_Y + 0.2, 0], easing: 'easeInOut', overlay: 'spin_y', overlayParams: { speed: 5, amplitude: Math.PI } },
          { duration: 0.3, position: [start[0], TABLE_Y - 0.3, start[2]], easing: 'easeIn' },
        ]
      };
    }
  }
}

// ─── Shotgun State Machine Definitions ──────────────────────────────────

export type ShotgunVisualState = 
  | 'RESTING'
  | 'PICKING_UP'
  | 'ROTATING_TOWARD_TARGET'
  | 'AIMING'
  | 'AIM_SETTLE'
  | 'FIRING'
  | 'RECOILING'
  | 'RECOVERING'
  | 'RETURNING';

export interface ShotgunPhase {
  state: ShotgunVisualState;
  duration: number;
  lerpSpeed: number;
}

export const SHOTGUN_SEQUENCE_PHASES: ShotgunPhase[] = [
  { state: 'PICKING_UP',             duration: 0.35, lerpSpeed: 8 },
  { state: 'ROTATING_TOWARD_TARGET', duration: 0.45, lerpSpeed: 7 },
  { state: 'AIMING',                 duration: 0.45, lerpSpeed: 8 },
  { state: 'AIM_SETTLE',             duration: 0.40, lerpSpeed: 12 },
  { state: 'FIRING',                 duration: 0.08, lerpSpeed: 35 },
  { state: 'RECOILING',              duration: 0.25, lerpSpeed: 18 },
  { state: 'RECOVERING',             duration: 0.40, lerpSpeed: 6 },
  { state: 'RETURNING',              duration: 0.55, lerpSpeed: 5 },
];
