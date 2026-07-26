import React, { useState } from 'react';
import { Html } from '@react-three/drei';
import type { ChamberClashState } from '@/store/useChamberClashStore';
import type { SeatLayout } from './seatLayout';

type Player = ChamberClashState['players'][number];

interface PlayerTargetSelectorProps {
  action: 'shoot' | 'handcuffs' | 'adrenaline' | null;
  localUserId: string | null;
  gameState: ChamberClashState | null;
  seatMap?: Record<string, SeatLayout>;
  isStealSelectionMode?: boolean;
  isSpectating?: boolean;
  onSelectTarget: (targetId: string) => void;
}

/**
 * Dynamic In-World Interactive Player Target Markers for 2P, 3P & 4P Matches.
 * 
 * Renders 3D Html markers for valid target players using seat layout anchors:
 * - Shotgun ('shoot'): "YOU" (local player) AND every living opponent are selectable.
 * - Handcuffs ('handcuffs'): ONLY living opponents are selectable (YOU is excluded).
 * - Adrenaline victim selection ('adrenaline'): ONLY living opponents with stealable items are selectable.
 */
export function PlayerTargetSelector({
  action,
  localUserId,
  gameState,
  seatMap,
  isStealSelectionMode,
  isSpectating,
  onSelectTarget
}: PlayerTargetSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!action || !gameState || !gameState.players || gameState.players.length === 0 || isStealSelectionMode || isSpectating) return null;

  const localPlayer = gameState.players.find(p => p.userId === localUserId) || gameState.players[0];

  const validTargets: Array<{ player: Player; isLocal: boolean; pos: [number, number, number] }> = [];

  // For Shotgun: Local player is ALWAYS a valid target ("SHOOT SELF") if alive
  if (localPlayer && localPlayer.isAlive && action === 'shoot') {
    const defaultPos: [number, number, number] = [0, 0.84, 0.28];
    const pos = seatMap?.[localPlayer.userId]?.anchors?.targetButton || defaultPos;
    validTargets.push({
      player: localPlayer,
      isLocal: true,
      pos
    });
  }

  // Opponents: Living opponents are valid targets for shooting, handcuffs, or adrenaline steal
  const opponents = gameState.players.filter(p => p.userId !== localPlayer.userId && p.isAlive);

  opponents.forEach((oppPlayer) => {
    // If Adrenaline steal, verify opponent has at least 1 non-adrenaline stealable item
    if (action === 'adrenaline') {
      const stealableItems = (oppPlayer.inventory || []).filter(item => item !== 'adrenaline');
      if (stealableItems.length === 0) return; // Skip opponents with no stealable items
    }

    const defaultPos: [number, number, number] = [0, 0.94, -0.42];
    const pos = seatMap?.[oppPlayer.userId]?.anchors?.targetButton || defaultPos;

    validTargets.push({
      player: oppPlayer,
      isLocal: false,
      pos
    });
  });

  return (
    <group>
      {validTargets.map(({ player, isLocal, pos }) => {
        const isHovered = hoveredId === player.userId;

        let labelText = '';
        if (action === 'shoot') {
          labelText = isLocal ? 'SHOOT SELF →' : `SHOOT ${player.nickname || 'OPPONENT'} →`;
        } else if (action === 'handcuffs') {
          labelText = `HANDCUFF ${player.nickname || 'OPPONENT'} →`;
        } else if (action === 'adrenaline') {
          labelText = `STEAL FROM ${player.nickname || 'OPPONENT'} →`;
        }

        return (
          <Html
            key={`target-marker-${player.userId}-${isLocal ? 'local' : 'opp'}`}
            position={pos}
            center
            zIndexRange={[100, 0]}
            style={{ pointerEvents: 'auto' }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectTarget(player.userId);
              }}
              onMouseEnter={() => setHoveredId(player.userId)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                px-3 py-2 rounded-xl font-mono text-xs font-black tracking-wider uppercase flex flex-col items-center gap-1
                transition-all duration-200 cursor-pointer shadow-2xl select-none backdrop-blur-md border
                ${isHovered 
                  ? 'bg-amber-500 text-black border-amber-300 scale-110 shadow-[0_0_25px_rgba(245,158,11,0.8)]' 
                  : isLocal
                    ? 'bg-zinc-950/85 text-zinc-100 border-zinc-700 hover:border-amber-500/80 shadow-[0_0_15px_rgba(0,0,0,0.8)]'
                    : 'bg-red-950/85 text-red-100 border-red-800/80 hover:border-amber-500/80 shadow-[0_0_15px_rgba(153,27,27,0.6)]'
                }
              `}
            >
              <span className="text-[10px] tracking-wider text-zinc-300 font-bold uppercase">
                {isLocal ? (player.nickname ? `YOU (${player.nickname})` : 'YOU') : (player.nickname || 'OPPONENT')}
              </span>
              <span className="text-[9px] tracking-widest text-amber-400 font-bold uppercase">
                {labelText}
              </span>
            </button>
          </Html>
        );
      })}
    </group>
  );
}
