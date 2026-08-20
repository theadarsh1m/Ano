"use client";

import { motion } from "framer-motion";
import { Sparkles, Gamepad2, Users, Cpu, Shield } from "lucide-react";
import Link from "next/link";

export function AboutHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] via-white/[0.02] to-transparent p-8 md:p-12 lg:p-16 backdrop-blur-xl shadow-2xl">
      {/* Background Ambient Glow & Grid Texture */}
      <div 
        className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" 
        aria-hidden="true" 
      />
      <div 
        className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" 
        aria-hidden="true" 
      />
      <div 
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:20px_20px] opacity-70" 
        aria-hidden="true" 
      />

      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
        {/* Eyebrow badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold uppercase tracking-widest text-blue-300 shadow-inner backdrop-blur-md"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
          <span>About Ano Platform</span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]"
        >
          Built by developers. <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Played by everyone.
          </span>
        </motion.h1>

        {/* Hero Description */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-base sm:text-lg md:text-xl text-gray-300/90 max-w-2xl mx-auto font-normal leading-relaxed"
        >
          Ano is a modern social and multiplayer web gaming platform. Connect with friends, 
          join live rooms, play instant turn-based and real-time games, and interact with an open, active community — with zero installs or friction.
        </motion.p>

        {/* Quick Stat / Architecture Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="pt-4 flex flex-wrap items-center justify-center gap-3"
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs sm:text-sm text-gray-300 backdrop-blur-md">
            <Gamepad2 className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-white">10+ Playable Games</span>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs sm:text-sm text-gray-300 backdrop-blur-md">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-white">Real-Time WebSockets</span>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs sm:text-sm text-gray-300 backdrop-blur-md">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-white">Social Feed & Voice Rooms</span>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs sm:text-sm text-gray-300 backdrop-blur-md">
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-white">Authoritative Server State</span>
          </div>
        </motion.div>

        {/* Action button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="pt-4 flex items-center justify-center gap-4"
        >
          <Link
            href="/dashboard/games"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 hover:-translate-y-0.5"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Explore Arcade Games</span>
          </Link>
          <Link
            href="/feed"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
          >
            <Users className="w-4 h-4" />
            <span>Community Feed</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
