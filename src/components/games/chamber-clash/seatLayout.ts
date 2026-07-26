import * as THREE from 'three';
import { TABLE_Y } from './animationConfigs';

export type SeatRole = 'LOCAL' | 'FAR' | 'LEFT' | 'RIGHT';

export interface SeatLayout {
  userId: string;
  role: SeatRole;
  characterPosition: [number, number, number];
  characterRotation: [number, number, number];
  inventorySlots: Array<[number, number, number]>;
  inventoryCenter: THREE.Vector3;
  anchors: {
    face: THREE.Vector3;
    chest: THREE.Vector3;
    ear: THREE.Vector3;
    wrist: THREE.Vector3;
    inventory: THREE.Vector3;
    targetButton: [number, number, number];
    healthIndicator: [number, number, number];
    handcuffProp: [number, number, number];
  };
}

/**
 * Generates horizontal or vertical inventory slots along outer table edges.
 * Spacing = 0.22m for clean non-overlapping item raycasts.
 * Central Safe Zone (X ∈ [-0.55, +0.55], Z ∈ [-0.35, +0.35]) remains completely empty.
 */
export function computeEdgeInventorySlots(
  role: SeatRole,
  count: number = 5
): { slots: Array<[number, number, number]>; center: THREE.Vector3 } {
  const slots: Array<[number, number, number]> = [];
  const start = -0.44;
  const step = 0.22;

  if (role === 'LOCAL') {
    const center = new THREE.Vector3(0, TABLE_Y, 0.78);
    for (let s = 0; s < count; s++) {
      slots.push([start + s * step, TABLE_Y, 0.78]);
    }
    return { slots, center };
  } else if (role === 'FAR') {
    const center = new THREE.Vector3(0, TABLE_Y, -0.78);
    for (let s = 0; s < count; s++) {
      slots.push([start + s * step, TABLE_Y, -0.78]);
    }
    return { slots, center };
  } else if (role === 'LEFT') {
    const center = new THREE.Vector3(-0.98, TABLE_Y, 0);
    // Vertical arrangement along Z edge
    for (let s = 0; s < count; s++) {
      slots.push([-0.98, TABLE_Y, start + s * step]);
    }
    return { slots, center };
  } else {
    // RIGHT
    const center = new THREE.Vector3(0.98, TABLE_Y, 0);
    // Vertical arrangement along Z edge
    for (let s = 0; s < count; s++) {
      slots.push([0.98, TABLE_Y, start + s * step]);
    }
    return { slots, center };
  }
}

/**
 * Computes client-relative seat layouts for N players (2P, 3P, 4P).
 * The local player is ALWAYS assigned to the camera-side LOCAL seat (bottom of screen).
 * 
 * 2 Players: LOCAL + FAR
 * 3 Players: LOCAL + LEFT + RIGHT
 * 4 Players: LOCAL + LEFT + FAR + RIGHT
 */
export function getClientRelativeSeats(
  players: Array<{ userId: string; nickname?: string }>,
  localUserId: string | null
): Record<string, SeatLayout> {
  const result: Record<string, SeatLayout> = {};

  if (!players || players.length === 0) {
    return result;
  }

  // Find local player index
  const localIndex = players.findIndex(p => p.userId === localUserId);
  const resolvedLocalIdx = localIndex >= 0 ? localIndex : 0;

  // Reorder players array so local player is first element
  const orderedPlayers: Array<{ userId: string }> = [];
  for (let i = 0; i < players.length; i++) {
    const idx = (resolvedLocalIdx + i) % players.length;
    orderedPlayers.push(players[idx]);
  }

  const playerCount = players.length;
  let roles: SeatRole[] = ['LOCAL', 'FAR'];
  if (playerCount === 3) {
    roles = ['LOCAL', 'LEFT', 'RIGHT'];
  } else if (playerCount >= 4) {
    roles = ['LOCAL', 'LEFT', 'FAR', 'RIGHT'];
  }

  orderedPlayers.forEach((player, relativeIdx) => {
    const role = roles[relativeIdx < roles.length ? relativeIdx : roles.length - 1];
    const { slots: invSlots, center: invCenter } = computeEdgeInventorySlots(role, 5);

    if (role === 'LOCAL') {
      result[player.userId] = {
        userId: player.userId,
        role: 'LOCAL',
        characterPosition: [0, 0, 0],
        characterRotation: [0, 0, 0],
        inventoryCenter: invCenter,
        inventorySlots: invSlots,
        anchors: {
          face: new THREE.Vector3(0, 1.15, 0.85),
          chest: new THREE.Vector3(0, 0.95, 0.65),
          ear: new THREE.Vector3(0.15, 1.10, 0.63),
          wrist: new THREE.Vector3(0.15, 0.90, 0.40),
          inventory: invCenter,
          targetButton: [0, 0.84, 0.28],
          healthIndicator: [0, 1.1, 0.8],
          handcuffProp: [0, TABLE_Y + 0.01, 0.38]
        }
      };
    } else if (role === 'FAR') {
      result[player.userId] = {
        userId: player.userId,
        role: 'FAR',
        characterPosition: [0, 0.68, -1.05],
        characterRotation: [0, 0, 0], // Facing camera
        inventoryCenter: invCenter,
        inventorySlots: invSlots,
        anchors: {
          face: new THREE.Vector3(0, 1.20, -0.92),
          chest: new THREE.Vector3(0, 1.00, -0.78),
          ear: new THREE.Vector3(-0.15, 1.15, -0.88),
          wrist: new THREE.Vector3(-0.15, 0.95, -0.65),
          inventory: invCenter,
          targetButton: [0, 0.94, -0.42],
          healthIndicator: [0, 1.32, -0.95],
          handcuffProp: [0, TABLE_Y + 0.01, -0.48]
        }
      };
    } else if (role === 'LEFT') {
      result[player.userId] = {
        userId: player.userId,
        role: 'LEFT',
        characterPosition: [-1.42, 0.68, 0],
        characterRotation: [0, Math.PI / 2, 0], // Rotated +90° facing center table
        inventoryCenter: invCenter,
        inventorySlots: invSlots,
        anchors: {
          face: new THREE.Vector3(-1.22, 1.20, 0),
          chest: new THREE.Vector3(-1.08, 1.00, 0),
          ear: new THREE.Vector3(-1.22, 1.15, -0.15),
          wrist: new THREE.Vector3(-0.88, 0.95, 0),
          inventory: invCenter,
          targetButton: [-0.88, 0.94, 0],
          healthIndicator: [-1.32, 1.32, 0],
          handcuffProp: [-0.60, TABLE_Y + 0.01, 0]
        }
      };
    } else {
      // RIGHT
      result[player.userId] = {
        userId: player.userId,
        role: 'RIGHT',
        characterPosition: [1.42, 0.68, 0],
        characterRotation: [0, -Math.PI / 2, 0], // Rotated -90° facing center table
        inventoryCenter: invCenter,
        inventorySlots: invSlots,
        anchors: {
          face: new THREE.Vector3(1.22, 1.20, 0),
          chest: new THREE.Vector3(1.08, 1.00, 0),
          ear: new THREE.Vector3(1.22, 1.15, -0.15),
          wrist: new THREE.Vector3(0.88, 0.95, 0),
          inventory: invCenter,
          targetButton: [0.88, 0.94, 0],
          healthIndicator: [1.32, 1.32, 0],
          handcuffProp: [0.60, TABLE_Y + 0.01, 0]
        }
      };
    }
  });

  return result;
}

/**
 * Resolves absolute 3D world anchor vector for a specified player ID.
 * Falls back to default OPPONENT_FAR anchors if player is not found.
 */
export function getPlayerAnchor(
  playerId: string | null,
  anchorType: 'face' | 'chest' | 'ear' | 'wrist' | 'inventory',
  seatMap: Record<string, SeatLayout>
): THREE.Vector3 {
  if (playerId && seatMap[playerId]) {
    return seatMap[playerId].anchors[anchorType].clone();
  }

  // Fallback defaults
  switch (anchorType) {
    case 'face': return new THREE.Vector3(0, 1.20, -0.80);
    case 'chest': return new THREE.Vector3(0, 1.00, -0.65);
    case 'ear': return new THREE.Vector3(-0.15, 1.15, -0.75);
    case 'wrist': return new THREE.Vector3(-0.15, 0.95, -0.60);
    case 'inventory': return new THREE.Vector3(0, TABLE_Y, -0.36);
    default: return new THREE.Vector3(0, TABLE_Y, -0.36);
  }
}
