"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

export function Game2048({ onGameEnd }: { onGameEnd: (score: number, playTimeSeconds: number) => void }) {
  // Placeholder implementation for brevity
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [playTime, setPlayTime] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && !isGameOver) {
      timer = setInterval(() => {
        setPlayTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, isGameOver]);

  const startGame = () => {
    setScore(0);
    setPlayTime(0);
    setIsGameOver(false);
    setIsPlaying(true);
  };

  const simulateWin = () => {
    setScore(2048);
    setIsGameOver(true);
    onGameEnd(2048, playTime);
  };

  return (
    <div className="flex flex-col items-center text-white">
      <h2 className="text-2xl font-bold mb-4">2048</h2>
      <div className="mb-4 flex gap-8">
        <div>Score: <span className="text-yellow-400 font-bold">{score}</span></div>
        <div>Time: <span className="text-blue-400 font-bold">{playTime}s</span></div>
      </div>
      
      <div className="w-64 h-64 bg-yellow-900/20 border border-yellow-500/30 rounded-xl flex items-center justify-center p-4 text-center">
        {!isPlaying ? (
          <Button onClick={startGame} className="bg-yellow-600 hover:bg-yellow-500">Start 2048</Button>
        ) : isGameOver ? (
          <div>
            <div className="text-xl mb-4 text-green-400 font-bold">Game Finished!</div>
            <Button onClick={startGame} className="bg-yellow-600 hover:bg-yellow-500">Play Again</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-400">Game logic is a placeholder for this demo.</p>
            <Button onClick={simulateWin} className="bg-green-600 hover:bg-green-500">Simulate Win (Score 2048)</Button>
          </div>
        )}
      </div>
    </div>
  );
}
