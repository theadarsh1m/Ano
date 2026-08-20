"use client";

import { motion } from "framer-motion";
import { Gamepad2, MessageSquare, ArrowRight, Heart } from "lucide-react";
import { GithubIcon } from "./SocialIcons";
import Link from "next/link";

export function AboutFooterCTA() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-indigo-900/20 p-8 sm:p-10 md:p-12 backdrop-blur-xl shadow-2xl text-center space-y-6">
      {/* Background ambient lighting */}
      <div 
        className="pointer-events-none absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" 
        aria-hidden="true" 
      />
      <div 
        className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" 
        aria-hidden="true" 
      />

      <div className="relative z-10 max-w-2xl mx-auto space-y-4">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
          Ready to play and connect?
        </h2>
        <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
          Create a room with friends, jump into matchmaking, or contribute to the open-source platform.
        </p>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="/dashboard/games"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/30 transition-all duration-200 hover:-translate-y-0.5"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Play Games</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/dashboard/rooms"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Create a Room</span>
          </Link>

          <a
            href="https://github.com/theadarsh1m"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-gray-300 hover:text-white text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
          >
            <GithubIcon className="w-4 h-4" />
            <span>GitHub</span>
          </a>
        </div>
      </div>

      <div className="pt-4 border-t border-white/5 flex items-center justify-center gap-1.5 text-xs text-gray-400">
        <span>Crafted with</span>
        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
        <span>for players & developers everywhere.</span>
      </div>
    </section>
  );
}
