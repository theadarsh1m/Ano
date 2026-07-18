"use client";

import React from 'react';
import { useScribbleStore } from '@/store/useScribbleStore';
import { Paintbrush, Trophy, CheckCircle2 } from 'lucide-react';

export const PlayerList: React.FC = () => {
  const { gameState } = useScribbleStore();
  
  if (!gameState) return null;

  // Sort by score
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 md:p-4 backdrop-blur-md w-full">
      <h3 className="text-white font-semibold mb-3 md:mb-4 flex items-center justify-between">
        <span>Players</span>
        <Trophy className="w-4 h-4 text-yellow-400" />
      </h3>
      
      <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto custom-scrollbar w-full">
        {sortedPlayers.map((player, idx) => {
          const isDrawing = player.userId === gameState.currentDrawerId;
          const hasGuessed = player.hasGuessed;

          return (
            <div 
              key={player.userId}
              className={`flex items-center justify-between p-2 rounded-lg transition-all flex-shrink-0 min-w-[140px] lg:min-w-0 lg:w-full ${
                isDrawing ? 'bg-sky-500/20 border-2 border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.4)] transform scale-[1.02]' : 
                hasGuessed ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-white/5 border border-white/5'
              } ${!player.isOnline ? 'opacity-40 grayscale' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 flex items-center justify-center text-sm font-bold text-gray-400">
                  #{idx + 1}
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-medium text-sm flex items-center gap-2">
                    {player.nickname}
                    {!player.isOnline && <span className="text-[10px] text-red-400 px-1 rounded bg-red-400/10">Offline</span>}
                  </span>
                  <span className="text-gray-400 text-xs font-bold">{player.score} pts</span>
                </div>
              </div>
              
              <div className="flex items-center ml-2">
                {isDrawing && (
                  <span className="text-xl" title="Drawing">🎨</span>
                )}
                {hasGuessed && !isDrawing && (
                  <span className="text-xl text-emerald-400 font-bold" title="Guessed Correctly">✓</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
