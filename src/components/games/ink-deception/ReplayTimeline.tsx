"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useInkDeceptionStore } from "@/store/useInkDeceptionStore";
import { soundService } from "./SoundService";
import { Play, Pause, SkipBack, Download, Sparkles } from "lucide-react";

interface Point {
  x: number;
  y: number;
  p?: number;
}

// Static helper defined outside of the component scope to prevent dependency recreation
const drawStrokeSegment = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  points: Point[],
  color: string,
  endIdx: number
) => {
  if (points.length < 2 || endIdx < 1) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowBlur = 1.2;
  ctx.shadowColor = color;

  const limit = Math.min(points.length - 1, endIdx);

  for (let i = 1; i <= limit; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];

    const x1 = p1.x * canvas.width;
    const y1 = p1.y * canvas.height;
    const x2 = p2.x * canvas.width;
    const y2 = p2.y * canvas.height;

    const pressure = p2.p ?? 0.5;
    const strokeWidth = 1.5 + pressure * 7;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.moveTo(x1, y1);

    if (i < points.length - 1 && i < endIdx) {
      const p3 = points[i + 1];
      const xc = (x2 + p3.x * canvas.width) / 2;
      const yc = (y2 + p3.y * canvas.height) / 2;
      ctx.quadraticCurveTo(x2, y2, xc, yc);
    } else {
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  }
  ctx.restore();
};

export const ReplayTimeline: React.FC = () => {
  const { gameState } = useInkDeceptionStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [currentStrokeIdx, setCurrentStrokeIdx] = useState(0);
  const [currentPointIdx, setCurrentPointIdx] = useState(0);

  const strokes = useMemo(() => gameState?.strokes || [], [gameState?.strokes]);

  const renderCurrentState = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Draw Japanese Minimalist cream background
    ctx.fillStyle = "#FAF8F5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = "rgba(139, 92, 26, 0.03)";
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw fully completed past strokes
    for (let i = 0; i < currentStrokeIdx; i++) {
      const stroke = strokes[i];
      if (stroke) {
        drawStrokeSegment(ctx, canvas, stroke.points, stroke.inkColor, stroke.points.length);
      }
    }

    // Draw active stroke partially up to currentPointIdx
    const activeStroke = strokes[currentStrokeIdx];
    if (activeStroke) {
      drawStrokeSegment(ctx, canvas, activeStroke.points, activeStroke.inkColor, currentPointIdx);
    }
  }, [strokes, currentStrokeIdx, currentPointIdx]);

  // Canvas Sizing and Initial Render
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      renderCurrentState();
    };

    window.addEventListener("resize", resize);
    resize();

    return () => window.removeEventListener("resize", resize);
  }, [renderCurrentState]);

  // Redraw when scrubbing
  useEffect(() => {
    renderCurrentState();
  }, [renderCurrentState]);

  // Replay playback ticker
  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = now - lastTime;
      const pointsToDraw = Math.max(1, Math.floor((dt / 16) * speed));

      if (currentStrokeIdx >= strokes.length) {
        setIsPlaying(false);
        return;
      }

      const activeStroke = strokes[currentStrokeIdx];
      if (!activeStroke) {
        setCurrentStrokeIdx(strokes.length);
        setIsPlaying(false);
        return;
      }

      const newPointIdx = currentPointIdx + pointsToDraw;
      
      if (newPointIdx >= activeStroke.points.length) {
        setCurrentStrokeIdx((prev) => prev + 1);
        setCurrentPointIdx(0);
      } else {
        setCurrentPointIdx(newPointIdx);
      }

      lastTime = now;
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, currentStrokeIdx, currentPointIdx, speed, strokes]);

  const handlePlayToggle = () => {
    if (currentStrokeIdx >= strokes.length) {
      setCurrentStrokeIdx(0);
      setCurrentPointIdx(0);
    }
    setIsPlaying(!isPlaying);
    soundService.playClick();
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStrokeIdx(0);
    setCurrentPointIdx(0);
    soundService.playClick();
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    soundService.playClick();
    soundService.playCorrect();

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `ink-deception-round-${gameState?.currentRound || 1}.png`;
    link.href = url;
    link.click();
  };

  const handleTimelineScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setIsPlaying(false);

    let cumulativePoints = 0;
    let targetStroke = 0;
    let targetPoint = 0;

    for (let i = 0; i < strokes.length; i++) {
      const strokePoints = strokes[i].points.length;
      if (cumulativePoints + strokePoints >= val) {
        targetStroke = i;
        targetPoint = val - cumulativePoints;
        break;
      }
      cumulativePoints += strokePoints;
      
      if (i === strokes.length - 1) {
        targetStroke = i;
        targetPoint = strokePoints;
      }
    }

    setCurrentStrokeIdx(targetStroke);
    setCurrentPointIdx(targetPoint);
  };

  const totalPlaybackPoints = strokes.reduce((acc, s) => acc + s.points.length, 0);
  
  const currentProgressValue = strokes
    .slice(0, currentStrokeIdx)
    .reduce((acc, s) => acc + s.points.length, 0) + currentPointIdx;

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Canvas viewport */}
      <div 
        ref={containerRef}
        className="flex-1 w-full relative bg-[#FAF8F5] rounded-3xl overflow-hidden border-4 border-slate-900/40 shadow-2xl"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* HUD Overlay */}
        <div className="absolute top-4 right-4 bg-slate-900/80 text-amber-400 text-[10px] font-mono font-bold tracking-widest px-3 py-1.5 rounded-full border border-amber-400/20 backdrop-blur-sm z-10 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> REPLAY HUD
        </div>
      </div>

      {/* Control panel */}
      <div className="bg-[#111827] border border-slate-800 p-4 rounded-2xl flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayToggle}
              className="p-3 bg-[#6AA6FF]/20 hover:bg-[#6AA6FF]/35 text-[#6AA6FF] rounded-xl transition-all cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-[#6AA6FF]" />}
            </button>
            
            <button
              onClick={handleReset}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-[#B7C0D8] rounded-xl transition-all cursor-pointer"
              title="Reset Timeline"
            >
              <SkipBack className="w-5 h-5" />
            </button>
          </div>

          {/* Timeline scrub slider */}
          <div className="flex-1 flex items-center gap-3">
            <input
              type="range"
              min="0"
              max={totalPlaybackPoints}
              value={currentProgressValue}
              onChange={handleTimelineScrub}
              className="flex-1 accent-[#6AA6FF] bg-slate-800 h-1.5 rounded-full outline-none appearance-none cursor-pointer"
            />
            <span className="text-[10px] font-mono text-slate-500 w-12 text-right">
              {currentStrokeIdx + (currentPointIdx > 0 ? 1 : 0)} / {strokes.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed Multiplier */}
            <button
              onClick={() => {
                const nextSpeed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
                setSpeed(nextSpeed);
                soundService.playClick();
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-[#FAF8F5] rounded-xl text-xs font-mono font-bold tracking-widest cursor-pointer transition-colors"
            >
              {speed}x
            </button>

            {/* PNG export */}
            <button
              onClick={handleExportPNG}
              disabled={strokes.length === 0}
              className="p-3 bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-400 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Export as PNG"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
export default ReplayTimeline;
