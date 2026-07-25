import React, { useState } from 'react';
import { Html } from '@react-three/drei';
import type { ChamberClashState } from '@/store/useChamberClashStore';

type Player = ChamberClashState['players'][number];

interface PlayerTargetSelectorProps {
  action: 'shoot' | 'handcuffs' | 'adrenaline' | null;
  localUserId: string | null;
  gameState: ChamberClashState | null;
  onSelectTarget: (targetId: string) => void;
}

/**
 * Reusable In-World Interactive Player Target Markers.
 * 
 * Renders 3D Html markers for valid target players, displaying authoritative health:
 * - For Shotgun ('shoot'): "YOU" (local player) AND opponent are selectable.
 * - For Handcuffs ('handcuffs'): ONLY opponent is selectable (YOU is excluded).
 */
export function PlayerTargetSelector({
  action,
  localUserId,
  gameState,
  onSelectTarget
}: PlayerTargetSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  console.log('[PlayerTargetSelector LOG]', {
    action,
    localUserId,
    hasGameState: Boolean(gameState),
    playersCount: gameState?.players?.length,
    players: gameState?.players?.map(p => ({ userId: p.userId, name: p.nickname }))
  });

  if (!action || !gameState || !gameState.players || gameState.players.length === 0) return null;

  // Resolve local player and opponent with robust fallbacks for practice/debug/offline modes
  const localPlayer = gameState.players.find(p => p.userId === localUserId) || gameState.players[0];
  const opponentPlayer = gameState.players.find(p => p.userId !== localPlayer.userId) || gameState.players[1];

  const validTargets: Array<{ player: Player; isLocal: boolean; pos: [number, number, number] }> = [];

  // For Shotgun: Local player is ALWAYS a valid target ("SHOOT SELF")
  if (localPlayer && action === 'shoot') {
    validTargets.push({
      player: localPlayer,
      isLocal: true,
      pos: [0, 0.84, 0.28] // Local camera-side table anchor (in front of shotgun)
    });
  }

  // Opponent is a valid target for all targeted actions
  if (opponentPlayer) {
    validTargets.push({
      player: opponentPlayer,
      isLocal: false,
      pos: [0, 0.94, -0.42] // Across table near opponent
    });
  }

  const maxHp = gameState.settings?.startingHp || 4;

  return (
    <group>
      {validTargets.map(({ player, isLocal, pos }) => {
        const isHovered = hoveredId === player.userId;

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
                {action === 'shoot' ? (isLocal ? 'SHOOT SELF →' : 'SHOOT OPPONENT →') : 'TARGET HANDCUFFS →'}
              </span>
            </button>
          </Html>
        );
      })}
    </group>
  );
}
