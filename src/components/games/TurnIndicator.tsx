"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";
import { sounds } from "@/lib/sounds";

interface TurnIndicatorProps {
  isMyTurn: boolean;
}

const playChime = () => {
  try {
    if (sounds.isMuted) return;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    osc.type = "sine";
    
    // Nice retro synth chime: C5 -> E5 -> G5
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.start(now);
    osc.stop(now + 0.4);
  } catch (e) {
    console.error("Failed to play turn chime", e);
  }
};

export function TurnIndicator({ isMyTurn }: TurnIndicatorProps) {
  const prevIsMyTurnRef = useRef(false);

  useEffect(() => {
    if (isMyTurn && !prevIsMyTurnRef.current) {
      playChime();
    }
    prevIsMyTurnRef.current = isMyTurn;
  }, [isMyTurn]);

  if (!isMyTurn) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none border-[3px] border-amber-500/40 rounded-none shadow-[inset_0_0_30px_rgba(245,158,11,0.15)] z-[9999] animate-[pulse_3s_infinite_ease-in-out]"
    />
  );
}
