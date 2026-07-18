"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInkDeceptionStore } from "@/store/useInkDeceptionStore";
import { useUserStore } from "@/store/useUserStore";
import { soundService } from "./SoundService";
import { HelpCircle, Clock, Send } from "lucide-react";

export const GuessOverlay: React.FC = () => {
  const { gameState, submitWordGuess } = useInkDeceptionStore();
  const { id: userId } = useUserStore();
  const [guess, setGuess] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const activePhase = gameState?.turnState;
  const isGuessPhase = activePhase === "FAKE_GUESS";
  const isFA = gameState?.fakeArtistId === userId;
  const timeLeft = gameState?.timeLeft ?? 0;
  const category = gameState?.category || "MIXED";

  // Reset state when entering phase
  useEffect(() => {
    if (isGuessPhase) {
      Promise.resolve().then(() => {
        setGuess("");
        setSubmitted(false);
      });
    }
  }, [isGuessPhase]);

  // Reset submitted state on close guesses (new log items during guess phase)
  useEffect(() => {
    if (isGuessPhase) {
      setSubmitted(false);
      setGuess("");
    }
  }, [gameState?.historyLogs?.length, isGuessPhase]);

  // Tick clock sound on countdown
  useEffect(() => {
    if (isGuessPhase && timeLeft <= 5 && timeLeft > 0) {
      // Soft high hover click sound for ticking clock
      soundService.playHover();
    }
  }, [isGuessPhase, timeLeft]);

  if (!isGuessPhase) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameState || !guess.trim() || submitted) return;
    
    setSubmitted(true);
    submitWordGuess(gameState.gameId, userId!, guess);
    soundService.playClick();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 w-full h-full bg-black/80 z-40 flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4 backdrop-blur-md"
      >
        <div className="absolute w-[350px] h-[350px] rounded-full bg-rose-500/10 blur-[90px] pointer-events-none animate-pulse" />

        <motion.div
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          className="bg-neutral-900 border border-white/10 rounded-[32px] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
        >
          {/* Cyber Neon alert line */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500" />

          {isFA ? (
            // Active Guess Form for the Impostor
            <form onSubmit={handleSubmit} className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-6 text-rose-500 animate-bounce">
                <HelpCircle className="w-8 h-8" />
              </div>

              <h2 className="text-2xl font-black tracking-widest text-white uppercase text-center">
                YOU WERE CAUGHT!
              </h2>
              <p className="text-xs text-slate-400 font-mono tracking-wider mt-2 text-center">
                GUESS THE SECRET WORD TO STEAL THE VICTORY!
              </p>
              
              <div className="text-xs text-rose-400 font-mono mt-2 bg-rose-500/5 px-3 py-1 rounded-full border border-rose-500/15">
                Category: {category}
              </div>

              {/* Timer clock */}
              <div className="flex items-center gap-2 text-rose-500 font-mono font-bold mt-6 text-2xl animate-pulse">
                <Clock className="w-5 h-5" />
                <span>{timeLeft}s</span>
              </div>

              <div className="w-full mt-8">
                <input
                  type="text"
                  value={guess}
                  disabled={submitted}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="TYPE SECRET WORD..."
                  className="w-full bg-white/5 border border-white/10 focus:border-rose-500 rounded-2xl py-4 px-6 text-white text-center font-bold tracking-widest outline-none transition-all placeholder:text-slate-600 disabled:opacity-50"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={!guess.trim() || submitted}
                className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white rounded-2xl font-bold tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 mt-6 cursor-pointer active:scale-95"
              >
                <Send className="w-5 h-5" />
                {submitted ? "SUBMITTING..." : "SUBMIT GUESS"}
              </button>
            </form>
          ) : (
            // Waiting View for the Artists
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-6 text-rose-500 animate-pulse">
                <Clock className="w-8 h-8" />
              </div>

              <h2 className="text-2xl font-black tracking-widest text-white uppercase">
                IMPOSTOR CAUGHT!
              </h2>
              <p className="text-xs text-rose-400 font-mono tracking-widest mt-2">
                THE FAKE ARTIST IS GUESSING THE SECRET WORD...
              </p>

              <div className="text-xs text-slate-500 font-mono mt-3 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                Category: {category}
              </div>

              {/* Timer clock */}
              <div className="flex items-center gap-2 text-rose-500 font-mono font-bold mt-8 text-3xl animate-pulse">
                <span>{timeLeft}s</span>
              </div>

              <div className="mt-8 flex items-center gap-1.5 justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-bounce" />
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
export default GuessOverlay;
