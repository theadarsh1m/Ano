"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInkDeceptionStore } from "@/store/useInkDeceptionStore";
import { useUserStore } from "@/store/useUserStore";
import { soundService } from "./SoundService";

export const RoleRevealModal: React.FC = () => {
  const { gameState, notifyRoleSeen } = useInkDeceptionStore();
  const { id: userId } = useUserStore();

  const [isFlipped, setIsFlipped] = useState(true);
  const [roleSeen, setRoleSeen] = useState(false);
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

  // Fire role_seen via store action
  const doNotifyRoleSeen = () => {
    if (roleSeenRef.current) return;
    const gId = gameIdRef.current;
    const uId = userIdRef.current;
    if (!gId || !uId) return;
    setRoleSeen(true);
    roleSeenRef.current = true;
    notifyRoleSeen(gId, uId);
  };

  // Auto-notify server 1s after modal opens so that the game transitions smoothly
  useEffect(() => {
    if (!showModal) {
      setRoleSeen(false);
      roleSeenRef.current = false;
      return;
    }

    const currentRound = gameState?.currentRound ?? 0;
    prevRoundRef.current = currentRound;
    setRoleSeen(false);
    roleSeenRef.current = false;

    // Play card flip sound automatically on open
    soundService.playCardFlip();
    const flipSoundTimer = setTimeout(() => {
      soundService.playReveal();
    }, 150);

    // Auto notify server seen state
    const notifyTimer = setTimeout(() => {
      doNotifyRoleSeen();
    }, 1000);

    return () => {
      clearTimeout(flipSoundTimer);
      clearTimeout(notifyTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, gameState?.currentRound]);

  if (!showModal || !myPlayer) return null;

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

          {/* Card View */}
          <motion.div
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className="w-[300px] h-[420px] perspective"
          >
            <motion.div
              className="w-full h-full relative"
            >
              {/* Card Face */}
              <div className="absolute inset-0 w-full h-full rounded-[28px] bg-[#FAF8F5] text-slate-900 border-4 border-slate-900 shadow-2xl flex flex-col justify-between p-5 overflow-hidden">

                {/* Header strip */}
                <div className="flex justify-between items-center border-b border-slate-900/10 pb-3 flex-shrink-0">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase truncate max-w-[70%]">
                    Category: {category}
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

                {/* Footer status text */}
                <div className="border-t border-slate-900/10 pt-3 flex-shrink-0">
                  <span className="text-[9px] font-mono text-slate-500 tracking-widest uppercase block text-center animate-pulse">
                    Game starting in {gameState?.timeLeft}s...
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <div className="mt-5 text-center">
            <p className="text-[10px] font-mono text-[#6AA6FF]/60 tracking-widest uppercase animate-pulse">
              Memorise your role card
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RoleRevealModal;
