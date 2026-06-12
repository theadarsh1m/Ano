"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Flag, Bomb, Volume2, VolumeX } from "lucide-react";
import { sounds } from "@/lib/sounds";
import { motion, AnimatePresence } from "framer-motion";

const ROWS = 10;
const COLS = 10;
const MINES = 15;

type Cell = {
  r: number;
  c: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
};

type Board = Cell[][];

const createEmptyBoard = (): Board => {
  return Array.from({ length: ROWS }, (_, r) => 
    Array.from({ length: COLS }, (_, c) => ({
      r, c, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0
    }))
  );
};

export function Minesweeper({ onGameEnd }: { onGameEnd: (score: number, playTimeSeconds: number) => void }) {
  const [board, setBoard] = useState<Board>(createEmptyBoard());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const [minesLeft, setMinesLeft] = useState(MINES);
  const [firstClick, setFirstClick] = useState(true);
  const [isMuted, setIsMuted] = useState(sounds.isMuted);

  const toggleMute = () => {
    setIsMuted(sounds.toggleMute());
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && !isGameOver && !isWon) {
      timer = setInterval(() => {
        setPlayTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, isGameOver, isWon]);

  const placeMines = (startR: number, startC: number, currentBoard: Board) => {
    let minesPlaced = 0;
    while (minesPlaced < MINES) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if (!currentBoard[r][c].isMine && !(r === startR && c === startC)) {
        currentBoard[r][c].isMine = true;
        minesPlaced++;
      }
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!currentBoard[r][c].isMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && currentBoard[nr][nc].isMine) {
                count++;
              }
            }
          }
          currentBoard[r][c].neighborMines = count;
        }
      }
    }
    return currentBoard;
  };

  const checkWinCondition = (currentBoard: Board) => {
    let revealedCount = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (currentBoard[r][c].isRevealed) revealedCount++;
      }
    }
    return revealedCount === ROWS * COLS - MINES;
  };

  const revealCell = (r: number, c: number) => {
    if (!isPlaying || isGameOver || isWon || board[r][c].isRevealed || board[r][c].isFlagged) return;

    let newBoard = board.map(row => row.map(cell => ({ ...cell })));

    if (firstClick) {
      newBoard = placeMines(r, c, newBoard);
      setFirstClick(false);
    }

    if (newBoard[r][c].isMine) {
      sounds.playExplosion();
      newBoard.forEach(row => {
        row.forEach(cell => {
          if (cell.isMine) cell.isRevealed = true;
        });
      });
      setBoard(newBoard);
      setIsGameOver(true);
      onGameEnd(0, playTime);
      return;
    }

    let revealedCountThisTurn = 0;
    const revealEmpty = (row: number, col: number) => {
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS || newBoard[row][col].isRevealed || newBoard[row][col].isFlagged) return;
      
      newBoard[row][col].isRevealed = true;
      revealedCountThisTurn++;
      
      if (newBoard[row][col].neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            revealEmpty(row + dr, col + dc);
          }
        }
      }
    };

    revealEmpty(r, c);
    setBoard(newBoard);
    
    if (revealedCountThisTurn > 0) {
      sounds.playReveal();
    }

    if (checkWinCondition(newBoard)) {
      sounds.playWin();
      setIsWon(true);
      onGameEnd(1000 - playTime, playTime);
    }
  };

  const toggleFlag = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (!isPlaying || isGameOver || isWon || board[r][c].isRevealed) return;

    setBoard(prev => {
      const newBoard = prev.map(row => row.map(cell => ({ ...cell })));
      const cell = newBoard[r][c];
      
      if (!cell.isFlagged && minesLeft > 0) {
        cell.isFlagged = true;
        setMinesLeft(m => m - 1);
        sounds.playFlag();
      } else if (cell.isFlagged) {
        cell.isFlagged = false;
        setMinesLeft(m => m + 1);
        sounds.playFlag();
      }
      
      return newBoard;
    });
  };

  const startGame = () => {
    setBoard(createEmptyBoard());
    setPlayTime(0);
    setMinesLeft(MINES);
    setFirstClick(true);
    setIsGameOver(false);
    setIsWon(false);
    setIsPlaying(true);
    sounds.playWin(); // Startup sound
  };

  const getCellColor = (neighborMines: number) => {
    switch (neighborMines) {
      case 1: return "text-blue-400";
      case 2: return "text-green-400";
      case 3: return "text-red-400";
      case 4: return "text-purple-400";
      case 5: return "text-yellow-400";
      case 6: return "text-cyan-400";
      case 7: return "text-white";
      case 8: return "text-gray-400";
      default: return "";
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 w-full flex justify-between items-center px-4">
        <div className="flex gap-8 text-xl font-bold text-white">
          <div className="flex items-center gap-2 text-red-400"><Flag className="w-5 h-5"/> {minesLeft}</div>
          <div className="text-blue-400">Time: {playTime}s</div>
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
        className="relative p-4 bg-gray-600 rounded-xl shadow-2xl border-4 border-gray-500 inline-block"
      >
        <div 
          className="grid gap-[2px] bg-gray-800 border-2 border-gray-700 p-1 rounded relative" 
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {board.map((row, rIdx) => 
            row.map((cell, cIdx) => (
              <motion.div 
                key={`${rIdx}-${cIdx}`}
                whileHover={!cell.isRevealed && isPlaying && !isGameOver && !isWon ? { scale: 1.1, zIndex: 10 } : {}}
                whileTap={!cell.isRevealed && isPlaying && !isGameOver && !isWon ? { scale: 0.9 } : {}}
                onClick={() => revealCell(rIdx, cIdx)}
                onContextMenu={(e) => toggleFlag(e, rIdx, cIdx)}
                className={`relative w-8 h-8 md:w-10 md:h-10 flex items-center justify-center font-bold text-lg select-none cursor-pointer transition-colors
                  ${cell.isRevealed 
                    ? cell.isMine ? 'bg-red-500 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]' : 'bg-gray-300 shadow-[inset_0_0_5px_rgba(0,0,0,0.2)]' 
                    : 'bg-gray-400 hover:bg-gray-300 border-t-2 border-l-2 border-t-gray-300 border-l-gray-300 border-b-2 border-r-2 border-b-gray-600 border-r-gray-600'}
                `}
              >
                {cell.isRevealed ? (
                  cell.isMine ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1.2 }}>
                      <Bomb className="w-6 h-6 text-black drop-shadow-md" />
                    </motion.div>
                  ) : 
                  cell.neighborMines > 0 ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className={getCellColor(cell.neighborMines)}>
                      {cell.neighborMines}
                    </motion.span>
                  ) : ''
                ) : (
                  cell.isFlagged ? (
                    <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }}>
                      <Flag className="w-5 h-5 text-red-600 fill-red-600 drop-shadow-sm" />
                    </motion.div>
                  ) : ''
                )}
              </motion.div>
            ))
          )}
        </div>

        <AnimatePresence>
          {(!isPlaying || isGameOver || isWon) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm rounded-xl z-20"
            >
              {isGameOver && (
                <motion.div 
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="text-red-500 text-5xl font-black mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]"
                >
                  BOOM!
                </motion.div>
              )}
              {isWon && (
                <motion.div 
                  initial={{ scale: 0, y: 50 }}
                  animate={{ scale: 1, y: 0 }}
                  className="text-green-500 text-5xl font-black mb-6 drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]"
                >
                  YOU WIN!
                </motion.div>
              )}
              <Button 
                onClick={startGame} 
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-gray-500 text-lg transition-transform hover:scale-105 active:scale-95"
              >
                {isGameOver || isWon ? 'Play Again' : 'Start Game'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="mt-6 text-gray-400 text-sm flex gap-4">
        <span>Left Click: Reveal</span>
        <span>Right Click: Flag</span>
      </div>
    </div>
  );
}
