"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { getGamesWithDevs } from "@/data/aboutData";
import { AboutGameCard } from "./AboutGameCard";
import { Gamepad2, Sparkles, Layers, Users, User } from "lucide-react";

type GameFilter = "ALL" | "FEATURED" | "MULTIPLAYER" | "SOLO";

export function GamesSection() {
  const [filter, setFilter] = useState<GameFilter>("ALL");
  const allGames = useMemo(() => getGamesWithDevs(), []);

  const filteredGames = useMemo(() => {
    if (filter === "FEATURED") {
      return allGames.filter((g) => g.featured);
    }
    if (filter === "MULTIPLAYER") {
      return allGames.filter((g) => g.supportedModes === "MULTIPLAYER" || g.supportedModes === "BOTH");
    }
    if (filter === "SOLO") {
      return allGames.filter((g) => g.supportedModes === "SOLO" || g.supportedModes === "BOTH");
    }
    return allGames;
  }, [allGames, filter]);

  return (
    <section className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Ano Game Studio</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
            Games Built at Ano
          </h2>
          <p className="text-sm sm:text-base text-gray-400 max-w-xl leading-relaxed">
            From strategic turn-based mind games and 3D chambers to rapid canvas social deduction party games.
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "ALL", label: "All Games", icon: Layers },
              { id: "FEATURED", label: "Flagships", icon: Sparkles },
              { id: "MULTIPLAYER", label: "Multiplayer", icon: Users },
              { id: "SOLO", label: "Solo & Duels", icon: User },
            ] as const
          ).map((chip) => {
            const Icon = chip.icon;
            const isActive = filter === chip.id;

            return (
              <button
                key={chip.id}
                onClick={() => setFilter(chip.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
                  isActive
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-105"
                    : "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGames.map((game, index) => (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.35, delay: (index % 3) * 0.1 }}
          >
            <AboutGameCard game={game} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
