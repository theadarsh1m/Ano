"use client";

import { Suspense } from 'react';
import { ArrowMazeGameHub } from '@/components/games/arrow-maze/ArrowMazeGameHub';

export default function ArrowMazePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1d] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-3xl font-bold text-white tracking-tight">
            Arrow<span className="text-blue-500">Maze</span>
          </div>
          <div className="text-slate-500 text-sm">Loading...</div>
        </div>
      </div>
    }>
      <ArrowMazeGameHub />
    </Suspense>
  );
}
