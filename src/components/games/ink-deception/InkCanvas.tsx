"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { socketService } from "@/lib/socket";
import { useInkDeceptionStore } from "@/store/useInkDeceptionStore";
import { useUserStore } from "@/store/useUserStore";
import { soundService } from "./SoundService";

interface Point {
  x: number;
  y: number;
  p?: number; // pressure (0 to 1)
}

interface InkCanvasProps {
  isDrawer: boolean;
  gameId: string;
  inkColor: string;
  isActiveTurn: boolean;
  onStrokeComplete: (points: Point[]) => void;
}

export const InkCanvas: React.FC<InkCanvasProps> = ({
  isDrawer,
  gameId,
  inkColor,
  isActiveTurn,
  onStrokeComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const { id: userId } = useUserStore();
  const { gameState } = useInkDeceptionStore();

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const currentStrokeRef = useRef<Point[]>([]);
  const lastTimeRef = useRef(0);
  const lastPointRef = useRef<Point | null>(null);

  // High-DPI and Real-time Prediction Refs
  const lastServerStrokesCountRef = useRef(0);
  const committedStrokeRef = useRef<Point[] | null>(null);
  const remoteStrokeRef = useRef<{ points: Point[]; color: string } | null>(null);
  const lastPressureRef = useRef(0.5);

  // Helper to draw a complete stroke with dynamic thickness
  const drawStroke = useCallback((points: Point[], color: string) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx || points.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 1.2;
    ctx.shadowColor = color;

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];

      const x1 = p1.x * width;
      const y1 = p1.y * height;
      const x2 = p2.x * width;
      const y2 = p2.y * height;

      // Determine width based on pressure/velocity simulation
      const pressure = p2.p ?? 0.5;
      const strokeWidth = 1.5 + pressure * 7;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.moveTo(x1, y1);

      // Quadratic curve smooth
      if (i < points.length - 1) {
        const p3 = points[i + 1];
        const xc = (x2 + p3.x * width) / 2;
        const yc = (y2 + p3.y * height) / 2;
        ctx.quadraticCurveTo(x2, y2, xc, yc);
      } else {
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  // Redraw the entire canvas background & strokes history
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Draw Japanese Minimalist cream parchment paper color
    ctx.fillStyle = "#FAF8F5";
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines (subtle Japanese shoji screen lines)
    ctx.strokeStyle = "rgba(139, 92, 26, 0.04)";
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Redraw all strokes from game history
    if (gameState && gameState.strokes) {
      gameState.strokes.forEach((stroke) => {
        drawStroke(stroke.points, stroke.inkColor);
      });
    }

    // Draw active local stroke if drawing
    if (isDrawing && currentStrokeRef.current.length > 0) {
      drawStroke(currentStrokeRef.current, inkColor);
    }

    // Draw predicted/committed local stroke that has not arrived from server yet (flicker prediction)
    if (committedStrokeRef.current) {
      drawStroke(committedStrokeRef.current, inkColor);
    }

    // Draw active remote stroke if present
    if (remoteStrokeRef.current && remoteStrokeRef.current.points.length > 0) {
      drawStroke(remoteStrokeRef.current.points, remoteStrokeRef.current.color);
    }
  }, [gameState, drawStroke, isDrawing, inkColor]);

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;

      // Save current pixels
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx && canvas.width > 0) {
        tempCtx.drawImage(canvas, 0, 0);
      }

      // Update resolution
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctxRef.current = ctx;
      }
      
      redrawCanvas();
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    return () => window.removeEventListener("resize", resizeCanvas);
  }, [redrawCanvas]);

  // Redraw when strokes list updates and handle committed stroke clear
  useEffect(() => {
    if (gameState && gameState.strokes) {
      if (gameState.strokes.length > lastServerStrokesCountRef.current) {
        committedStrokeRef.current = null;
        lastServerStrokesCountRef.current = gameState.strokes.length;
      }
    } else {
      lastServerStrokesCountRef.current = 0;
      committedStrokeRef.current = null;
    }
    redrawCanvas();
  }, [gameState, redrawCanvas]);

  // Reset drawing block when active turn changes
  useEffect(() => {
    if (isActiveTurn) {
      Promise.resolve().then(() => {
        setHasDrawn(false);
      });
    }
  }, [isActiveTurn]);

  // Listen for socket events from OTHER players drawing in real-time
  useEffect(() => {
    const socket = socketService.getSocket();

    const onRemoteCanvasEvent = ({ action, data }: { action: string; data: { point: Point; color: string } }) => {
      if (action === "stroke_start") {
        remoteStrokeRef.current = { points: [data.point], color: data.color };
        redrawCanvas();
      } else if (action === "stroke_draw") {
        if (remoteStrokeRef.current) {
          const newPoints = [...remoteStrokeRef.current.points, data.point];
          remoteStrokeRef.current.points = newPoints;
          // Draw coordinate chunk locally
          drawStroke(newPoints.slice(-2), remoteStrokeRef.current.color);
        }
      } else if (action === "stroke_end") {
        remoteStrokeRef.current = null;
        redrawCanvas();
      }
    };

    socket.on("ink_deception_canvas_event", onRemoteCanvasEvent);

    return () => {
      socket.off("ink_deception_canvas_event", onRemoteCanvasEvent);
    };
  }, [drawStroke, redrawCanvas]);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Simulate pressure from pointer pressure, falling back to speed velocity
    let pressure = 0.5;
    if (e.pressure && e.pointerType === "pen") {
      pressure = e.pressure;
    } else {
      // Calculate velocity
      const now = Date.now();
      if (lastPointRef.current && lastTimeRef.current > 0) {
        const dt = now - lastTimeRef.current;
        if (dt > 0) {
          const dx = (x - lastPointRef.current.x) * rect.width;
          const dy = (y - lastPointRef.current.y) * rect.height;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const vel = dist / dt;
          // Faster speed = less pressure = thinner brush
          pressure = Math.max(0.1, 1 - vel * 0.18);
        }
      }
      lastTimeRef.current = now;
    }

    // Apply exponential moving average filter for pressure smoothing
    const lastPressure = lastPressureRef.current;
    const smoothPressure = lastPressure + (pressure - lastPressure) * 0.35;
    lastPressureRef.current = smoothPressure;

    return { x, y, p: smoothPressure };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isActiveTurn || hasDrawn || isDrawing) return;
    e.preventDefault();
    
    const coords = getCoordinates(e);
    if (!coords) return;

    canvasRef.current?.setPointerCapture(e.pointerId);

    setIsDrawing(true);
    currentStrokeRef.current = [coords];
    lastPointRef.current = coords;
    lastTimeRef.current = Date.now();
    lastPressureRef.current = coords.p ?? 0.5;

    // Broadcast stroke start to others
    const socket = socketService.getSocket();
    socket.emit("ink_deception_canvas_event", {
      gameId,
      userId,
      action: "stroke_start",
      data: { point: coords, color: inkColor }
    });

    soundService.playClick();
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords) return;

    const prevPoints = [...currentStrokeRef.current];
    const newPoints = [...prevPoints, coords];
    currentStrokeRef.current = newPoints;
    
    // Draw segment in real-time
    drawStroke(newPoints.slice(-2), inkColor);
    
    // Broadcast stroke progress
    const socket = socketService.getSocket();
    socket.emit("ink_deception_canvas_event", {
      gameId,
      userId,
      action: "stroke_draw",
      data: { point: coords }
    });

    // Play textured ink sound modulated by velocity
    const speed = coords.p ? (1 - coords.p) * 20 : 5;
    soundService.playStroke(speed);

    lastPointRef.current = coords;
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setHasDrawn(true); // Lock the single continuous stroke!

    canvasRef.current?.releasePointerCapture(e.pointerId);

    // Broadcast stroke end
    const socket = socketService.getSocket();
    socket.emit("ink_deception_canvas_event", {
      gameId,
      userId,
      action: "stroke_end",
      data: {}
    });

    // Trigger stroke completion callback
    if (currentStrokeRef.current.length > 1) {
      committedStrokeRef.current = currentStrokeRef.current;
      onStrokeComplete(currentStrokeRef.current);
    }
    
    currentStrokeRef.current = [];
    lastPointRef.current = null;
    lastTimeRef.current = 0;

    soundService.playReveal(); // Lock sound
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#FAF8F5] rounded-3xl overflow-hidden relative shadow-2xl border-4 border-slate-900/40 select-none"
    >
      {/* Immersive drawing lock overlay indicators */}
      {!isActiveTurn && gameState?.turnState === "DRAWING" && (
        <div className="absolute top-4 left-4 bg-slate-900/75 text-[#FAF8F5] text-xs font-mono font-bold tracking-wider px-3.5 py-1.5 rounded-full border border-white/10 backdrop-blur-md z-10 animate-pulse">
          🖌️ {gameState.players.find(p => p.userId === gameState.activeDrawerId)?.nickname || 'Artist'}{"'s"} Turn...
        </div>
      )}

      {isActiveTurn && !hasDrawn && (
        <div className="absolute top-4 left-4 bg-emerald-500/90 text-[#FAF8F5] text-xs font-mono font-bold tracking-wider px-3.5 py-1.5 rounded-full border border-emerald-400/30 backdrop-blur-md z-10 animate-bounce">
          ✍️ YOUR TURN: DRAW ONE CONTINUOUS STROKE
        </div>
      )}

      {isActiveTurn && hasDrawn && (
        <div className="absolute top-4 left-4 bg-rose-500/90 text-[#FAF8F5] text-xs font-mono font-bold tracking-wider px-3.5 py-1.5 rounded-full border border-rose-400/30 backdrop-blur-md z-10 animate-pulse">
          🔒 STROKE LOCKED
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        className={`w-full h-full touch-none block ${
          isActiveTurn && !hasDrawn ? "cursor-crosshair" : "cursor-not-allowed"
        }`}
      />
    </div>
  );
};
export default InkCanvas;
