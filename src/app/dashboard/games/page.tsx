"use client";

import { useState, useMemo } from "react";
import { GlassCard } from "@/components/layout/GlassCard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  Gamepad2, Play, ArrowLeft, MessageSquare, Star, 
  Search, X, Sparkles, User, Users, Layers
} from "lucide-react";
import { 
  getAllGames, 
  supportsSolo, 
  supportsMultiplayer
} from "@/config/gamesRegistry";
import { GameRatingModal } from "@/components/feedback/GameRatingModal";

type FilterType = "ALL" | "SOLO" | "MULTIPLAYER" | "BOTH";

export default function GamesHubPage() {
  const [ratingOpen, setRatingOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState({ id: "", title: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");

  const openRating = (id: string, title: string) => {
    setSelectedGame({ id, title });
    setRatingOpen(true);
  };

  const allGames = useMemo(() => getAllGames(), []);

  // Filter & Search logic
  const filteredGames = useMemo(() => {
    return allGames.filter((game) => {
      // Filter Chip logic
      let matchesFilter = true;
      if (activeFilter === "SOLO") {
        matchesFilter = supportsSolo(game);
      } else if (activeFilter === "MULTIPLAYER") {
        matchesFilter = supportsMultiplayer(game);
      } else if (activeFilter === "BOTH") {
        matchesFilter = game.supportedModes === "BOTH";
      }

      // Search Query logic (by game name or description)
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        game.name.toLowerCase().includes(q) ||
        game.title.toLowerCase().includes(q) ||
        game.description.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [allGames, activeFilter, searchQuery]);

  return (
    <div className="flex flex-col h-full space-y-6 max-w-6xl mx-auto w-full p-3 pb-12 md:p-6 md:pb-12">
      {/* Global Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <div className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-white tracking-wide block leading-tight">
                  Ano Arcade
                </span>
                <span className="text-xs text-gray-400">Game-Centric Hub</span>
              </div>
            </div>
          </Link>
        </div>

        <Link href="/dashboard">
          <Button
            variant="ghost"
            className="text-gray-400 hover:text-white text-xs sm:text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </Link>
      </div>

      {/* Controls Bar: Search & Filter Chips */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search games by name or description..."
            className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "ALL", label: "All", icon: Layers },
              { id: "SOLO", label: "Solo", icon: User },
              { id: "MULTIPLAYER", label: "Multiplayer", icon: Users },
              { id: "BOTH", label: "Both", icon: Sparkles }
            ] as const
          ).map((chip) => {
            const Icon = chip.icon;
            const isActive = activeFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id)}
                className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all ${
                  isActive
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-105"
                    : "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Game Grid Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-gray-400 px-1">
          <span>
            Showing <strong className="text-white">{filteredGames.length}</strong> {filteredGames.length === 1 ? 'game' : 'games'}
          </span>
          {activeFilter !== "ALL" && (
            <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-semibold">
              Filter: {activeFilter}
            </span>
          )}
        </div>

        {filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames.map((game) => {
              const soloSupported = supportsSolo(game);
              const multiplayerSupported = supportsMultiplayer(game);

              return (
                <GlassCard
                  key={game.id}
                  className="p-6 flex flex-col hover:border-purple-500/50 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <div className="text-8xl">{game.icon}</div>
                  </div>

                  {/* Thumbnail / Icon Container */}
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div
                      className={`w-16 h-16 bg-gradient-to-br ${game.color} rounded-2xl flex items-center justify-center text-white text-3xl group-hover:scale-105 transition-transform shadow-lg`}
                    >
                      {game.icon}
                    </div>

                    {/* Supported Mode Badges */}
                    <div className="flex flex-col items-end gap-1">
                      {soloSupported && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Solo
                        </span>
                      )}
                      {multiplayerSupported && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          Multiplayer
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Game Info */}
                  <h2 className="text-xl font-bold text-white mb-2 relative z-10">
                    {game.name}
                  </h2>
                  <p className="text-gray-400 text-sm mb-6 flex-1 relative z-10 leading-relaxed">
                    {game.description}
                  </p>

                  {/* Card Action Buttons */}
                  <div className="flex gap-2.5 relative z-10">
                    <Link href={game.href} className="flex-1">
                      <button className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 group-hover:bg-purple-600 group-hover:text-white text-sm">
                        <Play className="w-4 h-4 fill-white" /> View Game
                      </button>
                    </Link>
                    <button
                      onClick={() => openRating(game.id, game.name)}
                      className="px-3.5 py-2.5 bg-white/5 hover:bg-yellow-500/10 border border-white/10 hover:border-yellow-500/30 text-yellow-400 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-semibold hover:scale-105"
                      title={`Rate ${game.name}`}
                    >
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400/20" />
                      <span>Rate</span>
                    </button>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl p-8">
            <Gamepad2 className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-40" />
            <h3 className="text-lg font-bold text-white mb-1">No games found</h3>
            <p className="text-gray-400 text-sm mb-4">
              Try adjusting your search query or filter selection.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveFilter("ALL");
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-xl font-semibold transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      <GameRatingModal
        isOpen={ratingOpen}
        onClose={() => setRatingOpen(false)}
        gameId={selectedGame.id}
        gameTitle={selectedGame.title}
      />
    </div>
  );
}
