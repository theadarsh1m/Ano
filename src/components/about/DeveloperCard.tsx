"use client";

import { useState } from "react";
import { Developer, ABOUT_GAMES } from "@/data/aboutData";
import { Globe, Gamepad2, Play } from "lucide-react";
import { GithubIcon, LinkedinIcon } from "./SocialIcons";
import Link from "next/link";

interface DeveloperCardProps {
  developer: Developer;
}

export function DeveloperCard({ developer }: DeveloperCardProps) {
  const [imgError, setImgError] = useState(false);

  const initials = developer.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Resolve full game objects
  const developedGames = developer.games.map((gRef) => {
    const game = ABOUT_GAMES.find((g) => g.id === gRef.gameId);
    return {
      id: gRef.gameId,
      name: game?.name || gRef.gameId.replace("-", " "),
      icon: game?.icon || "🎮",
      href: game?.href || `/dashboard/games/${gRef.gameId}`,
    };
  });

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-xl transition-all duration-300 hover:border-blue-500/30 shadow-2xl flex flex-col justify-between">
      {/* Background ambient lighting */}
      <div 
        className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 group-hover:bg-blue-500/20 rounded-full blur-3xl transition-all duration-500" 
        aria-hidden="true" 
      />

      <div>
        {/* 1. Large Photo Showcase Banner at Top */}
        <div className="relative w-full h-72 sm:h-80 md:h-96 overflow-hidden bg-black/40 border-b border-white/10">
          {developer.avatar && !imgError ? (
            <img
              src={developer.avatar}
              alt={`${developer.name}'s profile photo`}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500 ease-out"
            />
          ) : (
            <div 
              className="w-full h-full bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 flex items-center justify-center text-white font-extrabold text-6xl sm:text-7xl select-none"
            >
              {initials}
            </div>
          )}

          {/* Soft gradient overlay on image */}
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent opacity-90" />

          {/* Badge Overlay on Image */}
          <div className="absolute bottom-4 left-4 z-10">
            <span className="px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-xs font-semibold text-blue-300 shadow-lg">
              {developer.tagline || developer.roles[0]}
            </span>
          </div>
        </div>

        {/* 2. Details Section below photo */}
        <div className="p-6 sm:p-8 space-y-6 relative z-10">
          {/* Name & Role Subtitle */}
          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight group-hover:text-blue-300 transition-colors">
              {developer.name}
            </h3>
            <p className="text-sm sm:text-base font-semibold text-blue-400 tracking-wide">
              {developer.tagline || developer.roles[0]}
            </p>
          </div>

          {/* Games Developed: Scrollable List */}
          <div className="space-y-2.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400">
              <div className="flex items-center gap-2 text-gray-300">
                <Gamepad2 className="w-4 h-4 text-purple-400" />
                <span>Games Developed ({developedGames.length})</span>
              </div>
              <span className="text-[11px] text-gray-500 lowercase font-medium">scroll to view →</span>
            </div>

            {/* Horizontal scrollable game list */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-hide custom-scrollbar">
              {developedGames.map((game) => (
                <Link
                  key={game.id}
                  href={game.href}
                  className="group/game inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/40 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 text-xs sm:text-sm font-semibold text-white whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 shadow-sm flex-shrink-0"
                >
                  <span className="text-base group-hover/game:scale-110 transition-transform">{game.icon}</span>
                  <span className="group-hover/game:text-purple-300 transition-colors">{game.name}</span>
                  <Play className="w-3 h-3 text-gray-500 group-hover/game:text-purple-400 fill-transparent group-hover/game:fill-purple-400 transition-colors ml-0.5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Social Links Footer (Direct Logos Without Containers) */}
      <div className="p-6 sm:p-8 pt-0 flex items-center gap-4 relative z-10">
        {developer.socials.portfolio && (
          <a
            href={developer.socials.portfolio}
            target="_blank"
            rel="noopener noreferrer"
            title="Portfolio Website"
            aria-label={`${developer.name}'s Portfolio Website`}
            className="text-purple-400 hover:text-purple-300 transition-all duration-200 hover:scale-125 p-1"
          >
            <Globe className="w-6 h-6" />
          </a>
        )}

        {developer.socials.github && (
          <a
            href={developer.socials.github}
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub Profile"
            aria-label={`${developer.name}'s GitHub Profile`}
            className="text-gray-300 hover:text-white transition-all duration-200 hover:scale-125 p-1"
          >
            <GithubIcon className="w-6 h-6" />
          </a>
        )}

        {developer.socials.linkedin && (
          <a
            href={developer.socials.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            title="LinkedIn Profile"
            aria-label={`${developer.name}'s LinkedIn Profile`}
            className="text-blue-400 hover:text-blue-300 transition-all duration-200 hover:scale-125 p-1"
          >
            <LinkedinIcon className="w-6 h-6" />
          </a>
        )}
      </div>
    </article>
  );
}
