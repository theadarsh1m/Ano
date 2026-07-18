"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { useInkDeceptionStore } from "@/store/useInkDeceptionStore";
import { useUserStore } from "@/store/useUserStore";
import { soundService } from "./SoundService";
import { Check, Vote, ShieldAlert } from "lucide-react";

interface Connection {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export const VotingDashboard: React.FC = () => {
  const { gameState, castVote } = useInkDeceptionStore();
  const { id: userId } = useUserStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const [confirmedTarget, setConfirmedTarget] = useState<string | null>(null);
  const [revealAnimationIndex, setRevealAnimationIndex] = useState(-1);
  const [connections, setConnections] = useState<Connection[]>([]);

  const activePhase = gameState?.turnState;
  const isVoting = activePhase === "VOTING";
  const isReveal = activePhase === "REVEAL";
  const players = useMemo(() => gameState?.players || [], [gameState?.players]);
  const myPlayer = useMemo(() => players.find((p) => p.userId === userId), [players, userId]);

  // Reset local states when entering voting stage
  useEffect(() => {
    if (isVoting) {
      Promise.resolve().then(() => {
        setConfirmedTarget(null);
        setRevealAnimationIndex(-1);
        setConnections([]);
      });
      soundService.startVotingSuspense();
    } else {
      soundService.stopVotingSuspense();
    }
  }, [activePhase, isVoting]);

  // Handle staggered flip & draw connections line by line in Reveal stage
  useEffect(() => {
    if (isReveal) {
      soundService.playReveal();
      Promise.resolve().then(() => {
        setRevealAnimationIndex(-1);
        setConnections([]);
      });

      let currentIdx = 0;
      const interval = setInterval(() => {
        if (currentIdx < players.length) {
          setRevealAnimationIndex(currentIdx);
          soundService.playVoteCast();
          currentIdx++;
        } else {
          clearInterval(interval);
        }
      }, 1200);

      return () => clearInterval(interval);
    }
  }, [isReveal, players.length]);

  // Recalculate connection coordinate paths when reveal animation advances or on window resize
  useEffect(() => {
    if (!isReveal || revealAnimationIndex < 0 || !containerRef.current) {
      setConnections([]);
      return;
    }

    const updateLines = () => {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      const newConnections: Connection[] = [];

      for (let i = 0; i <= revealAnimationIndex; i++) {
        const voter = players[i];
        if (!voter || !voter.votedFor) continue;

        const voterEl = document.getElementById(`voter-card-${voter.userId}`);
        const targetEl = document.getElementById(`voter-card-${voter.votedFor}`);

        if (voterEl && targetEl) {
          const vRect = voterEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();

          const x1 = vRect.left + vRect.width / 2 - containerRect.left;
          const y1 = vRect.top + vRect.height / 2 - containerRect.top;
          const x2 = tRect.left + tRect.width / 2 - containerRect.left;
          const y2 = tRect.top + tRect.height / 2 - containerRect.top;

          newConnections.push({
            id: `${voter.userId}-${voter.votedFor}`,
            x1,
            y1,
            x2,
            y2,
            color: voter.inkColor
          });
        }
      }
      setConnections(newConnections);
    };

    updateLines();
    window.addEventListener("resize", updateLines);
    return () => window.removeEventListener("resize", updateLines);
  }, [revealAnimationIndex, isReveal, players]);

  if (!isVoting && !isReveal) return null;

  // Single click directly submits and locks the vote
  const handleSelectCard = (targetId: string) => {
    if (!gameState || !isVoting || myPlayer?.hasVoted || confirmedTarget) return;
    setConfirmedTarget(targetId);
    castVote(gameState.gameId, userId!, targetId);
    soundService.playVoteCast();
  };

  const getVoteCount = (targetId: string) => {
    return players.filter((p) => p.votedFor === targetId).length;
  };

  const hasUserVoted = !!(confirmedTarget || myPlayer?.hasVoted);

  return (
    <div ref={containerRef} className="w-full flex flex-col items-center p-4 relative" id="voting-container">
      
      {/* SVG connection lines layer */}
      {isReveal && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {connections.map((conn) => (
            <g key={conn.id}>
              <defs>
                <marker
                  id={`arrow-${conn.id}`}
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill={conn.color} />
                </marker>
              </defs>
              <line
                x1={conn.x1}
                y1={conn.y1}
                x2={conn.x2}
                y2={conn.y2}
                stroke={conn.color}
                strokeWidth="3.5"
                strokeDasharray="8 6"
                markerEnd={`url(#arrow-${conn.id})`}
                className="animate-dash"
              />
            </g>
          ))}
        </svg>
      )}

      {/* Header instructions */}
      <div className="text-center mb-8 max-w-md z-20">
        <h2 className="text-2xl font-black tracking-widest text-[#FAF8F5] uppercase">
          {isVoting ? "Who is the Fake Artist?" : "Voting Results"}
        </h2>
        <p className="text-xs text-[#6AA6FF] font-mono tracking-widest mt-2 uppercase">
          {isVoting
            ? hasUserVoted
              ? "✓ You have voted! Waiting for other players..."
              : "TAP A PLAYER CARD TO CAST YOUR ACCUSATION."
            : "VOTE REVEAL IN PROGRESS..."}
        </p>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-4xl justify-center z-20 mb-8">
        {players.map((p, idx) => {
          const isSelf = p.userId === userId;
          const isVoteDisabled = !isVoting || isSelf || hasUserVoted;
          const isVotedForThis = confirmedTarget === p.userId || myPlayer?.votedFor === p.userId;
          const isTargetMostVoted = isReveal && gameState?.mostVotedId === p.userId;
          const isFlipped = isReveal && idx <= revealAnimationIndex;
          const targetName = players.find(t => t.userId === p.votedFor)?.nickname || "Nobody";

          return (
            <div 
              key={p.userId}
              id={`voter-card-${p.userId}`}
              className={`w-full h-44 perspective ${isVoteDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => !isVoteDisabled && handleSelectCard(p.userId)}
            >
              <motion.div
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className="w-full h-full relative preserve-3d"
              >
                
                {/* FRONT FACE */}
                <div 
                  className={`absolute inset-0 w-full h-full rounded-2xl p-4 border-2 flex flex-col items-center justify-between backface-hidden transition-all duration-300 ${
                      isVotedForThis
                        ? "bg-emerald-500/15 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.25)] scale-[1.04]"
                        : isVoting && hasUserVoted
                        ? "bg-[#111827]/40 border-slate-900 text-slate-500 opacity-40 scale-[0.96]"
                        : "bg-[#111827]/85 border-slate-800 text-[#B7C0D8] hover:border-slate-600 hover:scale-[1.02]"
                    }`}
                >
                  {/* YOUR VOTE Badge */}
                  {isVotedForThis && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[8px] font-mono font-black tracking-widest px-3 py-1 rounded-full border border-emerald-300 shadow-md flex items-center gap-1 z-10 whitespace-nowrap">
                      <Check className="w-2.5 h-2.5" /> YOU VOTED
                    </div>
                  )}

                  {/* Status lights */}
                  <div className="absolute top-2.5 right-2.5">
                    {isVoting && (
                      p.hasVoted ? (
                        <span className="flex items-center gap-1 text-[8px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <Check className="w-2.5 h-2.5" /> LOCKED
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[8px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">
                          <Vote className="w-2.5 h-2.5" /> VOTING...
                        </span>
                      )
                    )}
                  </div>

                  {/* Avatar bubble */}
                  <div 
                    className={`w-14 h-14 rounded-full border-2 flex items-center justify-center bg-slate-900/80 mt-2 ${
                      isVotedForThis ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900' : ''
                    }`}
                    style={{ borderColor: isVotedForThis ? '#34d399' : p.inkColor }}
                  >
                    {isVotedForThis ? (
                      <Check className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <span className="text-xl font-bold uppercase" style={{ color: p.inkColor }}>
                        {p.nickname.substring(0, 2)}
                      </span>
                    )}
                  </div>

                  {/* Nickname */}
                  <div className="text-center w-full mt-1">
                    <h4 className={`font-bold truncate text-sm ${ isVotedForThis ? 'text-emerald-300' : 'text-[#FAF8F5]' }`}>
                      {p.nickname}
                    </h4>
                    <p className="text-[9px] font-mono tracking-wider text-slate-500 mt-0.5 uppercase">
                      {isSelf ? "YOU" : isVotedForThis ? "ACCUSED" : "PAINTER"}
                    </p>
                  </div>
                </div>

                {/* BACK FACE */}
                <div 
                  className={`absolute inset-0 w-full h-full rounded-2xl p-4 border-2 flex flex-col items-center justify-center rotate-y-180 backface-hidden transition-all duration-300 ${
                    isTargetMostVoted
                      ? "bg-rose-500/15 border-rose-500 shadow-[0_0_25px_rgba(239,68,68,0.25)]"
                      : "bg-slate-900 border-slate-700 text-[#FAF8F5]"
                  }`}
                >
                  <div className="text-center flex flex-col items-center gap-1">
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                      VOTED FOR
                    </span>
                    <span 
                      className="text-base font-black truncate max-w-[150px] uppercase font-mono px-3 py-1 bg-slate-950/40 rounded-full border"
                      style={{ color: players.find(t => t.userId === p.votedFor)?.inkColor || "#FFF", borderColor: players.find(t => t.userId === p.votedFor)?.inkColor || "#555" }}
                    >
                      {targetName}
                    </span>
                    
                    {/* Tally counter bubble */}
                    <div className="mt-3 flex flex-col items-center">
                      <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full">
                        🗳️ {getVoteCount(p.userId)} {getVoteCount(p.userId) === 1 ? "VOTE" : "VOTES"}
                      </span>
                    </div>
                  </div>

                  {/* Target crown/alert highlight banner */}
                  {isTargetMostVoted && (
                    <div className="absolute -top-3 bg-rose-500 text-white text-[8px] font-mono font-black tracking-widest px-3 py-0.5 rounded-full border border-rose-400 shadow-md flex items-center gap-1">
                      <ShieldAlert className="w-2.5 h-2.5" /> ACCUSED
                    </div>
                  )}
                </div>

              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Confirmed display */}
      {isVoting && hasUserVoted && (
        <div className="text-center bg-[#111827]/60 border border-slate-850 px-6 py-3.5 rounded-2xl max-w-sm z-20 animate-pulse text-xs font-mono text-emerald-400">
          ✓ Vote Submitted! Waiting for remaining painters to lock...
        </div>
      )}

    </div>
  );
};

export default VotingDashboard;
