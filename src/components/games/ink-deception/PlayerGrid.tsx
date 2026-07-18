"use client";

import React from "react";
import { useInkDeceptionStore } from "@/store/useInkDeceptionStore";
import { Crown, Brush, ShieldAlert, WifiOff } from "lucide-react";
import { motion } from "framer-motion";

export const PlayerGrid: React.FC = () => {
  const { gameState } = useInkDeceptionStore();
  const players = gameState?.players || [];
  const activeDrawerId = gameState?.activeDrawerId;
  const turnState = gameState?.turnState;

  return (
    <div className="flex flex-col gap-2 md:gap-3 w-full">
      <h3 className="text-xs font-mono font-bold tracking-[0.2em] text-[#B7C0D8]/40 uppercase mb-1">
        Players ({players.length})
      </h3>

      <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto custom-scrollbar w-full pb-1 lg:pb-0">
        {players.map((p) => {
          const isActive = turnState === "DRAWING" && activeDrawerId === p.userId;
          const isFA = p.role === "FAKE_ARTIST" && (
            turnState === "REVEAL" || 
            turnState === "GAME_END" || 
            turnState === "ROUND_END"
          );
          
          return (
            <motion.div
              key={p.userId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-2.5 lg:p-3 rounded-2xl border flex items-center justify-between transition-all duration-300 relative flex-shrink-0 min-w-[140px] lg:min-w-0 lg:w-full ${
                isActive
                  ? "bg-[#6AA6FF]/10 border-[#6AA6FF] shadow-[0_0_15px_rgba(106,166,255,0.15)]"
                  : p.isOnline 
                  ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20" 
                  : "bg-white/5 border-white/5 text-slate-500 opacity-50 grayscale"
              }`}
            >
              {/* Active Drawer breathing neon pulse */}
              {isActive && (
                <div className="absolute inset-0 rounded-2xl border border-[#6AA6FF]/40 animate-pulse-glow -z-10" />
              )}

              <div className="flex items-center gap-3">
                {/* Avatar with dynamic border color matching their assigned ink color */}
                <div
                  className="w-9 h-9 rounded-full border-2 flex items-center justify-center bg-black/40 flex-shrink-0 relative"
                  style={{ borderColor: p.isOnline ? p.inkColor : "#475569" }}
                >
                  <span className="text-xs font-bold uppercase" style={{ color: p.isOnline ? p.inkColor : "#64748b" }}>
                    {p.nickname.substring(0, 2)}
                  </span>
                  
                  {/* Offline dot */}
                  {!p.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 border-2 border-slate-900 flex items-center justify-center">
                      <WifiOff className="w-1.5 h-1.5 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-white truncate max-w-[100px]">
                      {p.nickname}
                    </span>

                    {/* Host Badge */}
                    {p.isHost && (
                      <span title="Host">
                        <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                      </span>
                    )}

                    {/* Fake Artist reveal indicator (only at reveal/end stages) */}
                    {isFA && (
                      <span title="Fake Artist">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                      </span>
                    )}
                  </div>
                  
                  <span className="text-[10px] font-mono text-slate-500">
                    {p.score} pts
                  </span>
                </div>
              </div>

              {/* Status indicators */}
              <div className="flex items-center">
                {isActive && (
                  <span className="text-[9px] font-mono font-bold text-[#6AA6FF] bg-[#6AA6FF]/10 border border-[#6AA6FF]/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Brush className="w-2.5 h-2.5 animate-bounce" /> DRAWING
                  </span>
                )}

                {!isActive && (
                  <div className="w-4 h-4 rounded-full border border-dashed border-slate-700 flex items-center justify-center bg-slate-900/40">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.isOnline ? p.inkColor : "#475569" }} />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
export default PlayerGrid;
