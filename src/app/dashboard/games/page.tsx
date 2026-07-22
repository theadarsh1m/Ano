"use client";

import { useState } from "react";
import { GlassCard } from "@/components/layout/GlassCard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Gamepad2, Play, Trophy, Clock, ArrowLeft, MessageSquare, Star } from "lucide-react";
import { getSinglePlayerGames, getMultiplayerGames } from "@/config/gamesRegistry";
import { GameRatingModal } from "@/components/feedback/GameRatingModal";

export default function GamesHubPage() {
  const [ratingOpen, setRatingOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState({ id: "", title: "" });

  const openRating = (id: string, title: string) => {
    setSelectedGame({ id, title });
    setRatingOpen(true);
  };

  const singlePlayerGames = getSinglePlayerGames();
  const multiplayerGames = getMultiplayerGames();

  return (
    <div className="flex flex-col h-full space-y-4 md:space-y-6 max-w-6xl mx-auto w-full p-3 pb-12 md:p-6 md:pb-12">
      {/* Global Navbar for Games Hub */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 md:p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <div className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white tracking-wide">Ano</span>
            </div>
          </Link>
        </div>
        
        <Link href="/dashboard">
          <Button variant="ghost" className="text-gray-400 hover:text-white text-xs sm:text-sm">
            <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </Link>
      </div>

      {/* Multiplayer Games Section */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
            <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-wide">Multiplayer Games</h1>
            <p className="text-gray-400 text-sm mt-1">Play cards and social games with other users in real time!</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {multiplayerGames.map(game => (
          <GlassCard key={game.id} className="p-6 flex flex-col hover:border-emerald-500/50 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity animate-pulse">
              <div className="text-8xl">{game.icon}</div>
            </div>
            
            <div className={`w-16 h-16 bg-gradient-to-br ${game.color} rounded-2xl flex items-center justify-center text-white text-3xl mb-4 group-hover:scale-105 transition-transform shadow-lg relative z-10`}>
              {game.icon}
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2 relative z-10">{game.title}</h2>
            <p className="text-gray-400 text-sm mb-6 flex-1 relative z-10">
              {game.description}
            </p>
            
            <div className="flex gap-2 relative z-10">
              <Link href={game.href} className="flex-grow">
                <button className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 group-hover:bg-emerald-500 group-hover:text-white">
                  <Play className="w-4 h-4" /> Play Now
                </button>
              </Link>
              <button 
                onClick={() => openRating(game.id, game.title)}
                className="px-3 bg-white/5 hover:bg-yellow-500/10 border border-white/10 hover:border-yellow-500/30 text-yellow-500 rounded-lg transition-colors flex items-center justify-center"
                title={`Rate ${game.title}`}
              >
                <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Single Player Section */}
      <div className="flex items-center justify-between pt-8 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
            <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-wide">Single Player Games</h1>
            <p className="text-gray-400 text-sm mt-1">Play games while staying connected to your friends!</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {singlePlayerGames.map(game => (
          <GlassCard key={game.id} className="p-6 flex flex-col hover:border-purple-500/50 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <div className="text-8xl">{game.icon}</div>
            </div>
            
            <div className={`w-16 h-16 bg-gradient-to-br ${game.color} rounded-2xl flex items-center justify-center text-white text-3xl mb-4 group-hover:scale-105 transition-transform shadow-lg relative z-10`}>
              {game.icon}
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2 relative z-10">{game.title}</h2>
            <p className="text-gray-400 text-sm mb-6 flex-1 relative z-10">
              {game.description}
            </p>
            
            <div className="grid grid-cols-2 gap-2 mb-6 text-xs text-gray-500 relative z-10">
              <div className="bg-white/5 rounded-lg p-2 flex flex-col items-center justify-center">
                <Trophy className="w-4 h-4 mb-1 text-yellow-500" />
                <span>High Score: --</span>
              </div>
              <div className="bg-white/5 rounded-lg p-2 flex flex-col items-center justify-center">
                <Clock className="w-4 h-4 mb-1 text-blue-400" />
                <span>Play Time: --</span>
              </div>
            </div>
            
            <div className="flex gap-2 relative z-10">
              <Link href={game.href} className="flex-grow">
                <button className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 group-hover:bg-purple-500 group-hover:text-white">
                  <Play className="w-4 h-4" /> Play Now
                </button>
              </Link>
              <button 
                onClick={() => openRating(game.id, game.title)}
                className="px-3 bg-white/5 hover:bg-yellow-500/10 border border-white/10 hover:border-yellow-500/30 text-yellow-500 rounded-lg transition-colors flex items-center justify-center"
                title={`Rate ${game.title}`}
              >
                <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
              </button>
            </div>
          </GlassCard>
        ))}
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
