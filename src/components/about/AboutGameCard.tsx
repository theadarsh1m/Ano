"use client";

import { AboutGame, Developer } from "@/data/aboutData";
import { Play, Sparkles, User, Layers } from "lucide-react";
import Link from "next/link";

interface AboutGameCardProps {
  game: AboutGame & {
    devDetails: { developer: Developer; role: string; contribution: string }[];
  };
}

export function AboutGameCard({ game }: AboutGameCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-6 sm:p-7 backdrop-blur-xl transition-all duration-300 hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/10 flex flex-col justify-between">
      {/* Background ambient lighting on hover */}
      <div 
        className="pointer-events-none absolute -top-16 -right-16 w-36 h-36 bg-purple-500/10 group-hover:bg-purple-500/20 rounded-full blur-2xl transition-all duration-500" 
        aria-hidden="true" 
      />

      <div className="space-y-5 relative z-10">
        {/* Top: Icon + Status & Mode Badges */}
        <div className="flex items-start justify-between gap-3">
          <div
            className={`w-14 h-14 bg-gradient-to-br ${game.color} rounded-2xl flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform duration-300 ring-1 ring-white/20`}
            aria-hidden="true"
          >
            {game.icon}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {game.status && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {game.status}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-300 border border-blue-500/30">
              {game.supportedModes === "BOTH" ? "Solo & Multiplayer" : game.supportedModes}
            </span>
          </div>
        </div>

        {/* Name & Tagline */}
        <div className="space-y-1">
          <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
            {game.name}
          </h3>
          <p className="text-xs font-semibold text-purple-400">
            {game.tagline}
          </p>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-gray-300/80 leading-relaxed">
          {game.description}
        </p>

        {/* Developer Credit & Contribution */}
        {game.devDetails.length > 0 && (
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <User className="w-3 h-3 text-blue-400" />
              <span>Developed by</span>
            </div>
            {game.devDetails.map((devCredit, idx) => (
              <div key={idx} className="space-y-0.5">
                <p className="text-xs font-bold text-white">
                  {devCredit.developer.name}{" "}
                  <span className="text-gray-400 font-normal text-[11px]">
                    — {devCredit.role}
                  </span>
                </p>
                <p className="text-[11px] text-gray-400 leading-snug">
                  {devCredit.contribution}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tech Stack */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            <Layers className="w-3 h-3 text-purple-400" />
            <span>Technologies</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {game.technologies.map((tech) => (
              <span
                key={tech}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/5 text-gray-300 border border-white/10"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action Play Button */}
      <div className="pt-5 mt-5 border-t border-white/10 relative z-10">
        <Link
          href={game.href}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-purple-600 text-white text-xs sm:text-sm font-semibold transition-all duration-200 shadow-md group/btn"
        >
          <Play className="w-3.5 h-3.5 fill-white group-hover/btn:scale-110 transition-transform" />
          <span>Launch Game</span>
        </Link>
      </div>
    </article>
  );
}
