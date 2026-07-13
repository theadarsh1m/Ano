"use client";
import { API_URL } from "@/lib/config";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { ArrowLeft, Loader2, MessageSquare, Trophy, Medal, ChevronUp, X } from "lucide-react";
import { Game2048 } from "@/components/games/Game2048";
import { Minesweeper } from "@/components/games/Minesweeper";
import { GlassCard } from "@/components/layout/GlassCard";



export default function SinglePlayerGamePage() {
  const params = useParams();
  const router = useRouter();
  const gameType = params.gameType as string;
  const { id: userId } = useUserStore();
  
  const [stats, setStats] = useState<{ highScore: number; totalPlayTimeSeconds: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [showMobileLeaderboard, setShowMobileLeaderboard] = useState(false);

  const fetchLeaderboard = () => {
    fetch(`${API_URL}/api/games/leaderboard/${gameType}`)
      .then(res => res.json())
      .then(data => setLeaderboard(data))
      .catch(console.error);
  };

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
      
    fetchLeaderboard();
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
      fetchLeaderboard(); // Refresh leaderboard on save
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
      <div className="flex flex-wrap items-center justify-between p-3 md:p-4 bg-white/5 border-b border-white/10 flex-shrink-0 gap-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/dashboard/games")}
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-wide">Ano</span>
          </button>
          
          <div className="ml-2 border-l border-white/20 pl-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              {getGameName()}
            </h1>
          </div>
        </div>
        
        {stats && (
          <div className="flex gap-3 md:gap-4 text-xs md:text-sm text-gray-400">
            <div>High Score: <span className="text-yellow-400 font-bold">{stats.highScore}</span></div>
            <div className="hidden sm:block">Play Time: <span className="text-blue-400 font-bold">{Math.floor(stats.totalPlayTimeSeconds / 60)}m</span></div>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-2 md:p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black overflow-y-auto">
          {renderGame()}
        </div>

        {/* Global Leaderboard Sidebar — desktop */}
        <div className="w-80 border-l border-white/10 bg-neutral-900 flex flex-col justify-between overflow-hidden hidden lg:flex">
          <div className="p-4 border-b border-white/10 bg-black/20 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h2 className="font-bold text-white tracking-wide uppercase text-sm">Global High Scores</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {leaderboard.map((entry, index) => (
              <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <div className={`w-6 text-center font-black ${index === 0 ? 'text-yellow-400 text-lg' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-white/30 text-xs'}`}>
                  #{index + 1}
                </div>
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden shadow-inner">
                    {entry.user?.avatar ? (
                      <img src={entry.user.avatar} alt={entry.user.nickname} className="w-full h-full object-cover" />
                    ) : (
                      entry.user?.nickname?.[0]?.toUpperCase() || '?'
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-white/90 truncate">{entry.user?.nickname || 'Unknown Player'}</div>
                  <div className="text-xs text-white/40 flex items-center gap-1 truncate">
                    <span>{new Date(entry.lastPlayed).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-black text-emerald-400">{entry.highScore}</div>
                  <div className="text-[10px] text-white/30 uppercase tracking-wide">Score</div>
                </div>
              </div>
            ))}
            
            {leaderboard.length === 0 && (
              <div className="text-center py-10 text-white/30 text-sm">
                <Medal className="w-12 h-12 mx-auto mb-3 opacity-20" />
                No scores recorded yet. Be the first!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Leaderboard Toggle Button */}
      <button
        onClick={() => setShowMobileLeaderboard(true)}
        className="lg:hidden fixed bottom-5 right-5 z-30 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 p-3 rounded-full shadow-lg transition-all hover:scale-105"
        aria-label="Show leaderboard"
      >
        <Trophy className="w-5 h-5" />
      </button>

      {/* Mobile Leaderboard Sheet */}
      {showMobileLeaderboard && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileLeaderboard(false)} />
          <div className="relative bg-neutral-900 border-t border-white/10 rounded-t-2xl max-h-[70vh] flex flex-col z-10">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <h2 className="font-bold text-white text-sm uppercase tracking-wide">Global High Scores</h2>
              </div>
              <button onClick={() => setShowMobileLeaderboard(false)} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {leaderboard.map((entry, index) => (
                <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className={`w-6 text-center font-black ${index === 0 ? 'text-yellow-400 text-lg' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-white/30 text-xs'}`}>
                    #{index + 1}
                  </div>
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden shadow-inner">
                      {entry.user?.avatar ? (
                        <img src={entry.user.avatar} alt={entry.user.nickname} className="w-full h-full object-cover" />
                      ) : (
                        entry.user?.nickname?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-white/90 truncate">{entry.user?.nickname || 'Unknown Player'}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-black text-emerald-400">{entry.highScore}</div>
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <div className="text-center py-10 text-white/30 text-sm">
                  <Medal className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  No scores recorded yet. Be the first!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
