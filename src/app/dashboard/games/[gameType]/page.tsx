"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Game2048 } from "@/components/games/Game2048";
import { Minesweeper } from "@/components/games/Minesweeper";

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export default function SinglePlayerGamePage() {
  const params = useParams();
  const router = useRouter();
  const gameType = params.gameType as string;
  const { id: userId } = useUserStore();
  
  const [stats, setStats] = useState<{ highScore: number; totalPlayTimeSeconds: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    // Fetch stats for this game
    fetch(`${API_URL}/api/games/stats/${userId}`)
      .then(res => res.json())
      .then(data => {
        const gameStat = data.find((s: any) => s.gameType === gameType);
        if (gameStat) {
          setStats({
            highScore: gameStat.highScore,
            totalPlayTimeSeconds: gameStat.totalPlayTimeSeconds
          });
        }
      })
      .catch(console.error);
  }, [userId, gameType]);

  const handleSaveResult = async (score: number, playTimeSeconds: number) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_URL}/api/games/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, gameType, score, playTimeSeconds })
      });
      const updated = await res.json();
      setStats({
        highScore: updated.highScore,
        totalPlayTimeSeconds: updated.totalPlayTimeSeconds
      });
    } catch (error) {
      console.error('Failed to save score:', error);
    }
  };

  const renderGame = () => {
    switch (gameType) {
      case '2048':
        return <Game2048 onGameEnd={handleSaveResult} />;
      case 'minesweeper':
        return <Minesweeper onGameEnd={handleSaveResult} />;
      default:
        return <div className="text-white text-xl">Game not found</div>;
    }
  };

  const getGameName = () => {
    switch (gameType) {
      case '2048': return '2048';
      case 'minesweeper': return 'Minesweeper';
      default: return 'Game';
    }
  };

  return (
    <div className="flex flex-col h-full bg-black min-h-screen">
      {/* Top Banner */}
      <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/dashboard/games")}
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <span className="text-white font-bold text-xs">A</span>
            </div>
          </button>
          
          <div className="ml-2 border-l border-white/20 pl-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              {getGameName()}
            </h1>
          </div>
        </div>
        
        {stats && (
          <div className="flex gap-4 text-sm text-gray-400">
            <div>High Score: <span className="text-yellow-400 font-bold">{stats.highScore}</span></div>
            <div>Play Time: <span className="text-blue-400 font-bold">{Math.floor(stats.totalPlayTimeSeconds / 60)}m</span></div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Game Area */}
        <div className="flex-1 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black overflow-y-auto">
          {renderGame()}
        </div>
      </div>
    </div>
  );
}
