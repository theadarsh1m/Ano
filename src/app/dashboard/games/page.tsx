import { GlassCard } from "@/components/layout/GlassCard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Gamepad2, Play, Trophy, Clock, ArrowLeft, MessageSquare } from "lucide-react";

export default function GamesHubPage() {
  const games = [
    {
      id: "2048",
      title: "2048",
      description: "Slide tiles and merge them to reach 2048. A simple but addictive puzzle game.",
      icon: "🔢",
      color: "from-yellow-500 to-orange-600",
    },
    {
      id: "minesweeper",
      title: "Minesweeper",
      description: "Clear the board without detonating any hidden mines. Use logic to figure out where they are.",
      icon: "💣",
      color: "from-red-500 to-rose-700",
    }
  ];

  return (
    <div className="flex flex-col h-full space-y-6 max-w-6xl mx-auto w-full p-6">
      {/* Global Navbar for Games Hub */}
      <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4 shadow-lg backdrop-blur-md">
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
          <Button variant="ghost" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
            <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Single Player Games</h1>
            <p className="text-gray-400 text-sm mt-1">Play games while staying connected to your friends!</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map(game => (
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
            
            <Link href={`/dashboard/games/${game.id}`} className="relative z-10">
              <button className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 group-hover:bg-purple-500 group-hover:text-white">
                <Play className="w-4 h-4" /> Play Now
              </button>
            </Link>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
