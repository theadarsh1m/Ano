"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 1, y: 0 };
const GAME_SPEED = 150;

export function SnakeGame({ onGameEnd }: { onGameEnd: (score: number, playTimeSeconds: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [food, setFood] = useState({ x: 15, y: 15 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [playTime, setPlayTime] = useState(0);

  // Time tracking
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && !isGameOver) {
      timer = setInterval(() => {
        setPlayTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, isGameOver]);

  // Game Loop
  useEffect(() => {
    if (!isPlaying || isGameOver) return;

    const moveSnake = () => {
      setSnake(prevSnake => {
        const head = prevSnake[0];
        const newHead = { x: head.x + direction.x, y: head.y + direction.y };

        // Collision detection
        if (
          newHead.x < 0 || newHead.x >= GRID_SIZE || 
          newHead.y < 0 || newHead.y >= GRID_SIZE ||
          prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)
        ) {
          setIsGameOver(true);
          onGameEnd(score, playTime);
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        // Eat food
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore(s => s + 10);
          setFood({
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
          });
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    };

    const interval = setInterval(moveSnake, GAME_SPEED);
    return () => clearInterval(interval);
  }, [isPlaying, isGameOver, direction, food, score, playTime, onGameEnd]);

  // Key controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          if (direction.y === 0) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
        case 's':
          if (direction.y === 0) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
        case 'a':
          if (direction.x === 0) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
        case 'd':
          if (direction.x === 0) setDirection({ x: 1, y: 0 });
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction, isPlaying]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1f2937'; // bg-gray-800
    ctx.fillRect(0, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE);

    // Draw food
    ctx.fillStyle = '#ef4444'; // red-500
    ctx.beginPath();
    ctx.arc(food.x * CELL_SIZE + CELL_SIZE / 2, food.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, 2 * Math.PI);
    ctx.fill();

    // Draw snake
    snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#10b981' : '#34d399'; // green head, lighter green body
      ctx.fillRect(segment.x * CELL_SIZE, segment.y * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
    });
  }, [snake, food]);

  const startGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setScore(0);
    setPlayTime(0);
    setIsGameOver(false);
    setIsPlaying(true);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 text-xl font-bold text-white flex gap-8">
        <div>Score: <span className="text-green-400">{score}</span></div>
        <div>Time: <span className="text-blue-400">{playTime}s</span></div>
      </div>
      
      <div className="relative border-4 border-white/10 rounded-lg overflow-hidden shadow-2xl">
        <canvas 
          ref={canvasRef} 
          width={GRID_SIZE * CELL_SIZE} 
          height={GRID_SIZE * CELL_SIZE}
          className="bg-gray-800"
        />
        
        {(!isPlaying || isGameOver) && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm">
            {isGameOver && <div className="text-red-500 text-3xl font-bold mb-4">Game Over!</div>}
            <Button onClick={startGame} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-full">
              {isGameOver ? 'Play Again' : 'Start Game'}
            </Button>
          </div>
        )}
      </div>
      
      <div className="mt-6 text-gray-400 text-sm flex gap-4">
        <span>WASD or Arrows to move</span>
      </div>
    </div>
  );
}
