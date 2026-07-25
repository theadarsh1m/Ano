import React, { useRef, useEffect, useState } from 'react';
import type { ChamberClashPlayer } from '@/store/useChamberClashStore';

export interface PlayerHealthIndicatorProps {
  player: ChamberClashPlayer;
  maxHp?: number;
  isLocal?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Chamber Clash Authoritative Player Health Indicator
 * Displays segmented HP hearts, numerical health readout, player display name,
 * and handles damage/heal pulse animations upon authoritative health state changes.
 */
export function PlayerHealthIndicator({
  player,
  maxHp = 4,
  isLocal = false,
  compact = false,
  className = ''
}: PlayerHealthIndicatorProps) {
  const prevHp = useRef(player.hp);
  const [pulseState, setPulseState] = useState<'damage' | 'heal' | null>(null);

  useEffect(() => {
    if (player.hp < prevHp.current) {
      setPulseState('damage');
      const timer = setTimeout(() => setPulseState(null), 500);
      prevHp.current = player.hp;
      return () => clearTimeout(timer);
    } else if (player.hp > prevHp.current) {
      setPulseState('heal');
      const timer = setTimeout(() => setPulseState(null), 500);
      prevHp.current = player.hp;
      return () => clearTimeout(timer);
    }
    prevHp.current = player.hp;
  }, [player.hp]);

  const effectiveMaxHp = Math.max(maxHp, player.hp, 4);
  const currentHp = Math.max(0, player.hp);
  const displayName = isLocal ? 'YOU' : player.nickname || 'OPPONENT';

  return (
    <div className={`
      inline-flex flex-col items-center justify-center backdrop-blur-md transition-all duration-300 select-none
      ${compact ? 'px-2 py-1 rounded-lg' : 'px-3.5 py-1.5 rounded-xl'}
      ${pulseState === 'damage' 
        ? 'bg-red-950/90 border-2 border-red-500 scale-105 shadow-[0_0_20px_rgba(239,68,68,0.8)]' 
        : pulseState === 'heal'
          ? 'bg-emerald-950/90 border-2 border-emerald-500 scale-105 shadow-[0_0_20px_rgba(16,185,129,0.8)]'
          : 'bg-zinc-950/85 border border-zinc-800/80 shadow-lg'
      }
      ${className}
    `}>
      {/* Player Display Header */}
      <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-300">
        <span className="truncate max-w-[120px]">{displayName}</span>
        {isLocal && player.nickname && (
          <span className="text-[9px] text-zinc-400 font-normal">({player.nickname})</span>
        )}
      </div>

      {/* Segmented Heart / Health Bar & Readout */}
      <div className="flex items-center gap-1.5 mt-0.5">
        <div className="flex items-center gap-1">
          {Array.from({ length: effectiveMaxHp }).map((_, idx) => {
            const isFilled = idx < currentHp;
            return (
              <div
                key={idx}
                className={`
                  transition-all duration-300 rounded-sm flex items-center justify-center
                  ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}
                  ${isFilled
                    ? 'bg-gradient-to-t from-red-700 to-red-500 border border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                    : 'bg-zinc-900 border border-zinc-800 opacity-40'
                  }
                `}
              >
                <span className={`text-[9px] font-bold ${isFilled ? 'text-white' : 'text-zinc-700'}`}>
                  ♥
                </span>
              </div>
            );
          })}
        </div>

        {/* Numerical Health Readout */}
        <span className="font-mono text-xs font-black tracking-widest text-zinc-200 ml-1">
          {currentHp}/{effectiveMaxHp}
        </span>
      </div>
    </div>
  );
}
