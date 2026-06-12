"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { sounds } from "@/lib/sounds";
import { Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const GRID_SIZE = 4;

type Tile = {
  id: string;
  r: number;
  c: number;
  val: number;
  isNew?: boolean;
  isMerged?: boolean;
};

// Generate unique ID
const getUid = () => Math.random().toString(36).substr(2, 9);

const getRandomEmptyCell = (tiles: Tile[]) => {
  const emptyCells: { r: number, c: number }[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!tiles.find(t => t.r === r && t.c === c)) {
        emptyCells.push({ r, c });
      }
    }
  }
  if (emptyCells.length === 0) return null;
  return emptyCells[Math.floor(Math.random() * emptyCells.length)];
};

const spawnTile = (tiles: Tile[]): Tile[] => {
  const cell = getRandomEmptyCell(tiles);
  if (cell) {
    return [...tiles, { id: getUid(), r: cell.r, c: cell.c, val: Math.random() < 0.9 ? 2 : 4, isNew: true }];
  }
  return tiles;
};

export function Game2048({ onGameEnd }: { onGameEnd: (score: number, playTimeSeconds: number) => void }) {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [playTime, setPlayTime] = useState(0);
  const [isMuted, setIsMuted] = useState(sounds.isMuted);
  const pendingMoveRef = useRef(false);

  const toggleMute = () => {
    setIsMuted(sounds.toggleMute());
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && !isGameOver) {
      timer = setInterval(() => {
        setPlayTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, isGameOver]);

  const checkGameOver = (currentTiles: Tile[]) => {
    if (currentTiles.length < GRID_SIZE * GRID_SIZE) return false;
    
    // Check for possible merges
    const grid: number[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    currentTiles.forEach(t => grid[t.r][t.c] = t.val);

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const val = grid[r][c];
        if (r < GRID_SIZE - 1 && grid[r + 1][c] === val) return false;
        if (c < GRID_SIZE - 1 && grid[r][c + 1] === val) return false;
      }
    }
    return true;
  };

  const move = useCallback((direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    if (!isPlaying || isGameOver || pendingMoveRef.current) return;
    pendingMoveRef.current = true;

    setTiles(prevTiles => {
      // Clear old isNew and isMerged flags
      let currentTiles = prevTiles.map(t => ({ ...t, isNew: false, isMerged: false }));
      let moved = false;
      let mergedThisTurn = false;
      let newScore = score;

      // Group by row or col depending on direction
      const getLine = (i: number) => {
        if (direction === 'LEFT' || direction === 'RIGHT') {
          return currentTiles.filter(t => t.r === i).sort((a, b) => a.c - b.c);
        } else {
          return currentTiles.filter(t => t.c === i).sort((a, b) => a.r - b.r);
        }
      };

      const newTiles: Tile[] = [];

      for (let i = 0; i < GRID_SIZE; i++) {
        let line = getLine(i);
        if (direction === 'RIGHT' || direction === 'DOWN') {
          line.reverse();
        }

        let newLine: Tile[] = [];
        let skipNext = false;

        for (let j = 0; j < line.length; j++) {
          if (skipNext) {
            skipNext = false;
            continue;
          }
          if (j < line.length - 1 && line[j].val === line[j + 1].val) {
            // Merge!
            newScore += line[j].val * 2;
            mergedThisTurn = true;
            newLine.push({
              id: line[j].id, // Keep the ID of the first one to animate it into the merged spot
              val: line[j].val * 2,
              isMerged: true,
              r: direction === 'LEFT' || direction === 'RIGHT' ? i : 0,
              c: direction === 'UP' || direction === 'DOWN' ? i : 0,
            });
            // We don't add the second one, it visually disappears (you could improve this by tracking disappearing tiles, but this is simple and works okay with framer-motion)
            skipNext = true;
            moved = true;
          } else {
            newLine.push(line[j]);
          }
        }

        // Assign new coordinates based on position in newLine
        for (let j = 0; j < newLine.length; j++) {
          const targetPos = direction === 'RIGHT' || direction === 'DOWN' ? GRID_SIZE - 1 - j : j;
          const targetR = direction === 'LEFT' || direction === 'RIGHT' ? i : targetPos;
          const targetC = direction === 'UP' || direction === 'DOWN' ? i : targetPos;

          if (newLine[j].r !== targetR || newLine[j].c !== targetC) {
            moved = true;
            newLine[j].r = targetR;
            newLine[j].c = targetC;
          }
        }

        newTiles.push(...newLine);
      }

      if (moved) {
        if (mergedThisTurn) sounds.playMerge();
        else sounds.playSlide();

        const spawnedTiles = spawnTile(newTiles);
        setScore(newScore);
        if (checkGameOver(spawnedTiles)) {
          sounds.playCrash();
          setIsGameOver(true);
          onGameEnd(newScore, playTime);
        }
        
        // Prevent multiple moves instantly
        setTimeout(() => { pendingMoveRef.current = false; }, 100);
        return spawnedTiles;
      }

      pendingMoveRef.current = false;
      return currentTiles;
    });
  }, [isPlaying, isGameOver, score, playTime, onGameEnd]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case 'ArrowUp': move('UP'); break;
        case 'ArrowDown': move('DOWN'); break;
        case 'ArrowLeft': move('LEFT'); break;
        case 'ArrowRight': move('RIGHT'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move, isPlaying]);

  const startGame = () => {
    let initialTiles = spawnTile([]);
    initialTiles = spawnTile(initialTiles);
    setTiles(initialTiles);
    setScore(0);
    setPlayTime(0);
    setIsGameOver(false);
    setIsPlaying(true);
    sounds.playWin(); // Startup sound
  };

  const getColor = (val: number) => {
    const colors: Record<number, string> = {
      2: "bg-orange-100 text-orange-900",
      4: "bg-orange-200 text-orange-900",
      8: "bg-orange-400 text-white",
      16: "bg-orange-500 text-white",
      32: "bg-red-400 text-white",
      64: "bg-red-500 text-white",
      128: "bg-yellow-400 text-white shadow-[0_0_15px_rgba(250,204,21,0.5)]",
      256: "bg-yellow-500 text-white shadow-[0_0_20px_rgba(234,179,8,0.6)]",
      512: "bg-yellow-600 text-white shadow-[0_0_25px_rgba(202,138,4,0.7)]",
      1024: "bg-yellow-700 text-white shadow-[0_0_30px_rgba(161,98,7,0.8)]",
      2048: "bg-yellow-800 text-white shadow-[0_0_40px_rgba(113,63,18,1)]"
    };
    return colors[val] || "bg-yellow-900 text-white";
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 w-full flex justify-between items-center px-4">
        <div className="text-xl font-bold text-white flex gap-8">
          <div>Score: <motion.span key={score} initial={{ scale: 1.5, color: '#facc15' }} animate={{ scale: 1, color: '#eab308' }} className="inline-block text-yellow-400">{score}</motion.span></div>
          <div>Time: <span className="text-blue-400">{playTime}s</span></div>
        </div>
        <button 
          onClick={toggleMute} 
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          title={isMuted ? "Unmute sounds" : "Mute sounds"}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
      
      <motion.div 
        animate={isGameOver ? { x: [-10, 10, -10, 10, 0], transition: { duration: 0.4 } } : {}}
        className="relative p-3 bg-amber-900/60 rounded-xl shadow-[0_0_30px_rgba(120,53,15,0.4)] border border-amber-500/20"
      >
        <div className="grid grid-cols-4 gap-3 bg-amber-950/80 p-3 rounded-lg relative w-[316px] h-[316px] md:w-[380px] md:h-[380px]">
          {/* Background Empty Cells */}
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => (
            <div key={`bg-${i}`} className="w-16 h-16 md:w-20 md:h-20 bg-amber-900/40 rounded"></div>
          ))}

          {/* Animated Tiles */}
          {tiles.map(tile => (
            <motion.div 
              key={tile.id}
              layout
              initial={tile.isNew ? { scale: 0.5, opacity: 0 } : false}
              animate={tile.isMerged ? { scale: [1, 1.2, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
              transition={{ 
                type: 'spring', 
                stiffness: 400, 
                damping: 30,
                scale: tile.isMerged ? { duration: 0.2 } : { type: 'spring', stiffness: 300, damping: 20 }
              }}
              style={{
                position: 'absolute',
                top: 12 + tile.r * (64 + 12), // 12px padding, 64px cell width + 12px gap
                left: 12 + tile.c * (64 + 12),
                width: 64,
                height: 64,
              }}
              className={`rounded flex items-center justify-center text-2xl font-black md:hidden ${getColor(tile.val)} shadow-md`}
            >
              {tile.val}
            </motion.div>
          ))}
          
          {/* Desktop Sized Animated Tiles */}
          {tiles.map(tile => (
            <motion.div 
              key={`${tile.id}-desktop`}
              layout
              initial={tile.isNew ? { scale: 0.5, opacity: 0 } : false}
              animate={tile.isMerged ? { scale: [1, 1.2, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
              transition={{ 
                type: 'spring', 
                stiffness: 400, 
                damping: 30,
                scale: tile.isMerged ? { duration: 0.2 } : { type: 'spring', stiffness: 300, damping: 20 }
              }}
              style={{
                position: 'absolute',
                top: 12 + tile.r * (80 + 12), // 12px padding, 80px cell width + 12px gap
                left: 12 + tile.c * (80 + 12),
                width: 80,
                height: 80,
              }}
              className={`rounded flex items-center justify-center text-3xl font-black hidden md:flex ${getColor(tile.val)} shadow-md`}
            >
              {tile.val}
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {(!isPlaying || isGameOver) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm rounded-xl z-20"
            >
              {isGameOver && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-red-500 text-4xl font-black mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]"
                >
                  GAME OVER
                </motion.div>
              )}
              <Button onClick={startGame} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-8 rounded-full shadow-[0_0_20px_rgba(202,138,4,0.4)] text-lg transition-transform hover:scale-105 active:scale-95">
                {isGameOver ? 'Try Again' : 'Start 2048'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="mt-6 text-gray-400 text-sm">
        Use Arrow Keys to slide tiles.
      </div>
    </div>
  );
}
