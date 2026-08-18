"use client";

import { Suspense } from 'react';
import { ArrowMazeGameHub } from '@/components/games/arrow-maze/ArrowMazeGameHub';

export default function ArrowMazePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-slate-950 to-black flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl font-bold text-white">
            Arrow<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Maze</span>
          </div>
          <div className="text-gray-500 text-sm">Loading...</div>
        </div>
      </div>
    }>
      <ArrowMazeGameHub />
    </Suspense>
  );
}
