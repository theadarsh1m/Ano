"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInkDeceptionStore } from "@/store/useInkDeceptionStore";
import { useUserStore } from "@/store/useUserStore";
import { soundService } from "./SoundService";

export const RoleRevealModal: React.FC = () => {
  const { gameState, notifyRoleSeen } = useInkDeceptionStore();
  const { id: userId } = useUserStore();

  const [isFlipped, setIsFlipped] = useState(false);
  const [roleSeen, setRoleSeen] = useState(false);
  const flipScheduledRef = useRef(false);
  const prevRoundRef = useRef<number | null>(null);

  // Refs to always have the latest values inside setTimeout callbacks (avoid stale closures)
  const gameIdRef = useRef("");
  const userIdRef = useRef("");
  const roleSeenRef = useRef(false);

  const showModal = gameState?.turnState === "ROLE_REVEAL";
  const myPlayer = gameState?.players.find((p) => p.userId === userId);
  const myRole = myPlayer?.role || "ARTIST";
  const word = gameState?.word || "???";
  const category = gameState?.category || "MIXED";

  // Keep refs in sync with latest values
  useEffect(() => {
    gameIdRef.current = gameState?.gameId || "";
    userIdRef.current = userId || "";
    roleSeenRef.current = roleSeen;
  }, [gameState?.gameId, userId, roleSeen]);

  // Fire role_seen via store action (uses same socket as the rest of the game)
  const doNotifyRoleSeen = () => {
    if (roleSeenRef.current) return;
    const gId = gameIdRef.current;
    const uId = userIdRef.current;
    if (!gId || !uId) return;
    setRoleSeen(true);
    roleSeenRef.current = true;
    notifyRoleSeen(gId, uId);
  };

  // Reset + schedule auto-flip whenever modal opens for a new round
  useEffect(() => {
    if (!showModal) {
      flipScheduledRef.current = false;
      setIsFlipped(false);
      setRoleSeen(false);
      roleSeenRef.current = false;
      return;
    }

    const currentRound = gameState?.currentRound ?? 0;

    if (flipScheduledRef.current && prevRoundRef.current === currentRound) {
      return;
    }

    // New reveal — reset and schedule auto-flip
    flipScheduledRef.current = true;
    prevRoundRef.current = currentRound;
    setIsFlipped(false);
    setRoleSeen(false);
    roleSeenRef.current = false;

    const flipTimer = setTimeout(() => {
      setIsFlipped(true);
      soundService.playCardFlip();
      setTimeout(() => soundService.playReveal(), 150);
      // Auto-notify server 1s after card flips (gives player a moment to read)
      setTimeout(() => doNotifyRoleSeen(), 1000);
    }, 1500);

    return () => clearTimeout(flipTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, gameState?.currentRound]);

  if (!showModal || !myPlayer) return null;

  const handleTap = () => {
    if (!isFlipped) {
      setIsFlipped(true);
      soundService.playCardFlip();
      setTimeout(() => soundService.playReveal(), 150);
      setTimeout(() => doNotifyRoleSeen(), 600);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="role-reveal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 w-full h-full bg-[#03060c]/95 z-50 flex items-center justify-center overflow-hidden"
      >
        {/* Glowing ambient ring */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full pointer-events-none animate-pulse"
          style={{
            background: myRole === "FAKE_ARTIST"
              ? "radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
          }}
        />

        <div className="flex flex-col items-center max-w-sm w-full p-4 relative z-10">

          {/* Phase label */}
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[10px] font-mono tracking-[0.3em] text-[#6AA6FF]/60 uppercase mb-6"
          >
            Your Role Has Been Assigned
          </motion.p>

          {/* Flipping card */}
          <motion.div
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className="w-[300px] h-[420px] cursor-pointer perspective"
            onClick={handleTap}
          >
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.65, ease: [0.43, 0.13, 0.23, 0.96] }}
              className="w-full h-full relative preserve-3d"
            >
              {/* ── BACK FACE ── */}
              <div className="absolute inset-0 w-full h-full rounded-[28px] bg-[#0d1421] border-2 border-[#6AA6FF]/20 shadow-2xl flex flex-col items-center justify-center p-6 backface-hidden">
                <div className="w-24 h-24 rounded-full border-4 border-double border-[#6AA6FF]/25 flex items-center justify-center bg-slate-900/60 mb-8">
                  <span className="text-4xl text-[#6AA6FF] font-mono">墨</span>
                </div>
                <h3 className="text-[10px] font-mono tracking-[0.25em] text-[#B7C0D8]/50 uppercase mb-2">
                  Ink & Deception
                </h3>
                <h2 className="text-xl font-black tracking-[0.1em] text-white mb-10">
                  REVEAL ROLE
                </h2>

                {/* Animated tap prompt */}
                <motion.p
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="text-xs text-[#6AA6FF] font-mono tracking-widest"
                >
                  TAP TO FLIP
                </motion.p>

                {/* Auto-flip progress bar */}
                <motion.div
                  className="absolute bottom-6 left-8 right-8 h-0.5 bg-[#6AA6FF]/10 rounded-full overflow-hidden"
                >
                  <motion.div
                    className="h-full bg-[#6AA6FF]/50 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: isFlipped ? "100%" : "100%" }}
                    transition={{ duration: 1.5, ease: "linear" }}
                  />
                </motion.div>
              </div>

              {/* ── FRONT FACE ── */}
              <div className="absolute inset-0 w-full h-full rounded-[28px] bg-[#FAF8F5] text-slate-900 border-4 border-slate-900 shadow-2xl flex flex-col justify-between p-5 rotate-y-180 backface-hidden overflow-hidden">

                {/* Header strip */}
                <div className="flex justify-between items-center border-b border-slate-900/10 pb-3 flex-shrink-0">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase truncate max-w-[70%]">
                    {category}
                  </span>
                  <span className="text-sm">💮</span>
                </div>

                {/* Role body */}
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 overflow-hidden py-2">
                  {myRole === "FAKE_ARTIST" ? (
                    <>
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-[10px] font-mono font-black text-rose-600 tracking-widest uppercase px-3 py-1 bg-rose-50 border border-rose-400/40 rounded-full flex-shrink-0"
                      >
                        ⚠️ THE IMPOSTOR
                      </motion.div>
                      <motion.h1
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-2xl font-black text-slate-900 tracking-tight leading-tight flex-shrink-0"
                      >
                        You are alone.
                      </motion.h1>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.55 }}
                        className="text-xs text-slate-500 font-medium leading-relaxed flex-shrink-0"
                      >
                        Blend in. Infer the word from others. Don't get caught.
                      </motion.p>
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="border-2 border-dashed border-rose-400/30 bg-rose-50/50 px-4 py-3 rounded-2xl w-full overflow-hidden flex-shrink-0"
                      >
                        <span className="text-[9px] font-mono text-rose-500 block uppercase tracking-wider mb-1">
                          Secret Word
                        </span>
                        <span className="text-xl font-black text-rose-600 font-mono block">
                          ？？？？
                        </span>
                      </motion.div>
                    </>
                  ) : (
                    <>
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-[10px] font-mono font-black text-emerald-700 tracking-widest uppercase px-3 py-1 bg-emerald-50 border border-emerald-500/30 rounded-full flex-shrink-0"
                      >
                        🖌️ THE ARTIST
                      </motion.div>
                      <motion.h1
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-2xl font-black text-slate-900 tracking-tight leading-tight flex-shrink-0"
                      >
                        You know the truth.
                      </motion.h1>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.55 }}
                        className="text-xs text-slate-500 font-medium leading-relaxed flex-shrink-0"
                      >
                        Draw carefully. Signal the word to Artists — hide it from the Impostor.
                      </motion.p>
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="bg-emerald-500 text-white px-4 py-3 rounded-2xl w-full shadow-lg shadow-emerald-500/20 overflow-hidden flex-shrink-0"
                      >
                        <span className="text-[9px] font-mono text-emerald-100 block uppercase tracking-wider mb-1">
                          Secret Word
                        </span>
                        <span
                          className="font-black uppercase block w-full text-center break-words"
                          style={{
                            fontSize: word.length > 12 ? '0.85rem' : word.length > 8 ? '1.1rem' : '1.4rem',
                            letterSpacing: word.length > 10 ? '0.05em' : '0.12em',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            lineHeight: 1.2,
                          }}
                        >
                          {word}
                        </span>
                      </motion.div>
                    </>
                  )}
                </div>

                {/* Footer / Ready button */}
                <div className="border-t border-slate-900/10 pt-3 flex-shrink-0">
                  {isFlipped ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); doNotifyRoleSeen(); soundService.playClick(); }}
                      disabled={roleSeen}
                      className={`w-full py-2.5 rounded-xl font-mono text-[11px] font-black tracking-widest uppercase transition-all ${
                        roleSeen
                          ? 'bg-slate-200 text-slate-400 cursor-default'
                          : 'bg-slate-900 text-white hover:bg-slate-700 active:scale-95 cursor-pointer shadow-md'
                      }`}
                    >
                      {roleSeen ? '✓ READY' : "I'M READY →"}
                    </button>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-400 tracking-wider uppercase block text-center">
                      INK &amp; DECEPTION · MEMORISE YOUR ROLE
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Below-card status */}
          <AnimatePresence>
            {isFlipped && (
              <motion.div
                key="hint"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-5 text-center"
              >
                {roleSeen ? (
                  <p className="text-[10px] font-mono text-emerald-400/70 tracking-widest uppercase">
                    ✓ Waiting for other players...
                  </p>
                ) : (
                  <p className="text-[10px] font-mono text-[#B7C0D8]/40 tracking-widest uppercase">
                    Tap <span className="text-white/60">I&apos;M READY</span> when memorised
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RoleRevealModal;
