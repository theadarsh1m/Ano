"use client";

import React from 'react';
import { Trophy, Medal, Paintbrush, Clock, CheckCircle2, RotateCcw, Home } from 'lucide-react';
import { ScribbleGameState } from '@/store/useScribbleStore';
import { Button } from '@/components/ui/button';

interface EndGameScreenProps {
  gameState: ScribbleGameState;
  onPlayAgain: () => void;
  onLeave: () => void;
  isHost: boolean;
}

export const EndGameScreen: React.FC<EndGameScreenProps> = ({ gameState, onPlayAgain, onLeave, isHost }) => {
  // Sort players by score for podium
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
  const top3 = sortedPlayers.slice(0, 3);
  const others = sortedPlayers.slice(3);

  // Parse stats from gameState if available
  const statsArray: any[] = (gameState as any).stats || [];
  
  let bestArtist = { nickname: '-', points: 0 };
  let fastestGuess = { nickname: '-', time: Infinity };
  let mostCorrect = { nickname: '-', count: 0 };

  statsArray.forEach(stat => {
    const player = gameState.players.find(p => p.userId === stat.userId);
    if (!player) return;

    if (stat.drawerPoints > bestArtist.points) {
      bestArtist = { nickname: player.nickname, points: stat.drawerPoints };
    }
    if (stat.correctGuesses > mostCorrect.count) {
      mostCorrect = { nickname: player.nickname, count: stat.correctGuesses };
    }
    if (stat.guessTimes && stat.guessTimes.length > 0) {
      const minTime = Math.min(...stat.guessTimes);
      if (minTime < fastestGuess.time) {
        fastestGuess = { nickname: player.nickname, time: minTime };
      }
    }
  });

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500 py-12">
      
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-sky-500 tracking-wider">
          GAME OVER
        </h1>
        <p className="text-gray-400 text-lg">Here are the final results!</p>
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-4 h-64 mt-12 w-full">
        {/* 2nd Place */}
        {top3[1] && (
          <div className="flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 delay-150">
            <span className="text-xl font-bold text-white mb-2">{top3[1].nickname}</span>
            <span className="text-sm text-gray-400 font-bold mb-4">{top3[1].score} pts</span>
            <div className="w-32 h-32 bg-gradient-to-t from-gray-300/20 to-gray-300/40 rounded-t-xl border-t-4 border-gray-300 flex items-center justify-center shadow-[0_0_30px_rgba(209,213,219,0.2)]">
              <span className="text-4xl font-black text-gray-300">2</span>
            </div>
          </div>
        )}

        {/* 1st Place */}
        {top3[0] && (
          <div className="flex flex-col items-center z-10 animate-in slide-in-from-bottom-12 duration-700">
            <Trophy className="w-12 h-12 text-yellow-400 mb-2 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
            <span className="text-2xl font-black text-yellow-400 mb-1">{top3[0].nickname}</span>
            <span className="text-sm text-yellow-400/80 font-bold mb-4">{top3[0].score} pts</span>
            <div className="w-40 h-44 bg-gradient-to-t from-yellow-400/20 to-yellow-400/40 rounded-t-xl border-t-4 border-yellow-400 flex items-start justify-center pt-6 shadow-[0_0_50px_rgba(250,204,21,0.3)]">
              <span className="text-6xl font-black text-yellow-400 drop-shadow-md">1</span>
            </div>
          </div>
        )}

        {/* 3rd Place */}
        {top3[2] && (
          <div className="flex flex-col items-center animate-in slide-in-from-bottom-4 duration-700 delay-300">
            <span className="text-xl font-bold text-white mb-2">{top3[2].nickname}</span>
            <span className="text-sm text-gray-400 font-bold mb-4">{top3[2].score} pts</span>
            <div className="w-32 h-24 bg-gradient-to-t from-orange-400/20 to-orange-400/40 rounded-t-xl border-t-4 border-orange-400 flex items-center justify-center shadow-[0_0_30px_rgba(251,146,60,0.2)]">
              <span className="text-4xl font-black text-orange-400">3</span>
            </div>
          </div>
        )}
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-8 px-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col items-center text-center transition-transform hover:scale-105">
          <Paintbrush className="w-8 h-8 text-sky-400 mb-3" />
          <h3 className="text-sm text-gray-400 uppercase tracking-wider font-bold mb-1">Best Artist</h3>
          <span className="text-xl font-bold text-white">{bestArtist.nickname}</span>
          <span className="text-sm text-sky-400 font-medium mt-1">{bestArtist.points} drawing pts</span>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col items-center text-center transition-transform hover:scale-105">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-3" />
          <h3 className="text-sm text-gray-400 uppercase tracking-wider font-bold mb-1">Most Correct</h3>
          <span className="text-xl font-bold text-white">{mostCorrect.nickname}</span>
          <span className="text-sm text-emerald-400 font-medium mt-1">{mostCorrect.count} words</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col items-center text-center transition-transform hover:scale-105">
          <Clock className="w-8 h-8 text-purple-400 mb-3" />
          <h3 className="text-sm text-gray-400 uppercase tracking-wider font-bold mb-1">Fastest Guess</h3>
          <span className="text-xl font-bold text-white">{fastestGuess.nickname}</span>
          <span className="text-sm text-purple-400 font-medium mt-1">
            {fastestGuess.time === Infinity ? '-' : `${fastestGuess.time}s`}
          </span>
        </div>
      </div>

      {/* Other Players */}
      {others.length > 0 && (
        <div className="w-full bg-white/5 border border-white/10 rounded-xl p-4 flex flex-wrap gap-4 justify-center mx-4">
          {others.map((p, idx) => (
            <div key={p.userId} className="flex items-center gap-3 bg-black/20 px-4 py-2 rounded-lg">
              <span className="text-gray-500 font-bold">#{idx + 4}</span>
              <span className="text-white font-medium">{p.nickname}</span>
              <span className="text-gray-400 text-sm">{p.score} pts</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-8">
        <Button onClick={onLeave} variant="ghost" className="border border-white/20 text-gray-300 hover:bg-white/10 px-8 py-6 rounded-xl font-bold text-lg">
          <Home className="w-5 h-5 mr-2" />
          Leave Match
        </Button>
        {isHost ? (
          <Button onClick={onPlayAgain} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-6 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105 transition-transform">
            <RotateCcw className="w-5 h-5 mr-2" />
            Play Again
          </Button>
        ) : (
          <div className="px-8 py-4 bg-white/5 text-gray-400 rounded-xl italic border border-white/10 font-bold">
            Waiting for host to restart...
          </div>
        )}
      </div>

    </div>
  );
};
