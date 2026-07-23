"use client";

import React, { useRef, useEffect, useState } from 'react';
import { socketService } from '@/lib/socket';
import { useScribbleStore } from '@/store/useScribbleStore';
import { useUserStore } from '@/store/useUserStore';

export interface Point {
  x: number;
  y: number;
}

export interface StrokeData {
  points: Point[];
  color: string;
  size: number;
  type: 'brush' | 'eraser' | 'fill';
}

interface ScribbleCanvasProps {
  isDrawer: boolean;
  gameId: string;
  selectedColor: string;
  selectedSize: number;
  selectedTool: 'brush' | 'eraser' | 'fill';
  onClear: () => void;
  clearTrigger: number;
  undoTrigger: number;
  redoTrigger: number;
  setCanUndo: (val: boolean) => void;
  setCanRedo: (val: boolean) => void;
}

// Custom SVG Cursors for maximum visibility on white backgrounds
const PENCIL_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24' fill='%2310b981' stroke='%23000000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'/></svg>") 0 24, crosshair`;
const BUCKET_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24' fill='%230284c7' stroke='%23000000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0L19 11Z'/><path d='m5 2 5 5'/><path d='M2 13h15'/></svg>") 2 22, pointer`;
const ERASER_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24' fill='%23f43f5e' stroke='%23000000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'/><path d='M22 21H7'/></svg>") 4 20, pointer`;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  if (c.length !== 6) return null;
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function floodFill(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  fillColorHex: string
) {
  const width = canvas.width;
  const height = canvas.height;
  if (width === 0 || height === 0) return;

  const x = Math.floor(startX);
  const y = Math.floor(startY);
  if (x < 0 || x >= width || y < 0 || y >= height) return;

  const fillRGB = hexToRgb(fillColorHex);
  if (!fillRGB) return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const targetIdx = (y * width + x) * 4;
  const targetR = data[targetIdx];
  const targetG = data[targetIdx + 1];
  const targetB = data[targetIdx + 2];
  const targetA = data[targetIdx + 3];

  if (
    targetR === fillRGB.r &&
    targetG === fillRGB.g &&
    targetB === fillRGB.b &&
    targetA === 255
  ) {
    return;
  }

  const colorMatch = (idx: number) => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    const diff = Math.abs(r - targetR) + Math.abs(g - targetG) + Math.abs(b - targetB) + Math.abs(a - targetA);
    return diff < 64;
  };

  const pixelStack: [number, number][] = [[x, y]];

  while (pixelStack.length > 0) {
    const [px, py] = pixelStack.pop()!;
    let currentIdx = (py * width + px) * 4;

    let currentY = py;
    while (currentY >= 0 && colorMatch(currentIdx)) {
      currentY--;
      currentIdx -= width * 4;
    }
    currentY++;
    currentIdx += width * 4;

    let reachLeft = false;
    let reachRight = false;

    while (currentY < height && colorMatch(currentIdx)) {
      data[currentIdx] = fillRGB.r;
      data[currentIdx + 1] = fillRGB.g;
      data[currentIdx + 2] = fillRGB.b;
      data[currentIdx + 3] = 255;

      if (px > 0) {
        if (colorMatch(currentIdx - 4)) {
          if (!reachLeft) {
            pixelStack.push([px - 1, currentY]);
            reachLeft = true;
          }
        } else if (reachLeft) {
          reachLeft = false;
        }
      }

      if (px < width - 1) {
        if (colorMatch(currentIdx + 4)) {
          if (!reachRight) {
            pixelStack.push([px + 1, currentY]);
            reachRight = true;
          }
        } else if (reachRight) {
          reachRight = false;
        }
      }

      currentY++;
      currentIdx += width * 4;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

export const ScribbleCanvas: React.FC<ScribbleCanvasProps> = ({ 
  isDrawer, gameId, selectedColor, selectedSize, selectedTool, clearTrigger,
  undoTrigger, redoTrigger, setCanUndo, setCanRedo
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const { id: userId } = useUserStore();

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const strokesRef = useRef<StrokeData[]>([]);
  const historyIndexRef = useRef(-1);

  const updateUndoRedoState = () => {
    setCanUndo(historyIndexRef.current >= 0);
    setCanRedo(historyIndexRef.current < strokesRef.current.length - 1);
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i <= historyIndexRef.current; i++) {
      drawStroke(strokesRef.current[i], ctx, canvas);
    }
  };

  // Handle Resize and init
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx && canvas.width > 0) {
          tempCtx.drawImage(canvas, 0, 0);
      }

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctxRef.current = ctx;
        if (canvas.width > 0 && tempCanvas.width === 0) {
           ctx.fillStyle = '#ffffff';
           ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (tempCtx && canvas.width > 0) {
           ctx.drawImage(tempCanvas, 0, 0);
        }
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Listen for clear events
  useEffect(() => {
    if (clearTrigger > 0) {
      strokesRef.current = [];
      historyIndexRef.current = -1;
      redrawCanvas();
      updateUndoRedoState();
    }
  }, [clearTrigger]);

  // Listen for undo/redo events locally
  useEffect(() => {
    if (undoTrigger > 0 && historyIndexRef.current >= 0) {
      historyIndexRef.current -= 1;
      redrawCanvas();
      updateUndoRedoState();
    }
  }, [undoTrigger]);

  useEffect(() => {
    if (redoTrigger > 0 && historyIndexRef.current < strokesRef.current.length - 1) {
      historyIndexRef.current += 1;
      redrawCanvas();
      updateUndoRedoState();
    }
  }, [redoTrigger]);

  // Listen for socket events
  useEffect(() => {
    const socket = socketService.getSocket();
    
    const onCanvasEvent = ({ action, data }: any) => {
      if (action === 'stroke') {
        const newStrokes = strokesRef.current.slice(0, historyIndexRef.current + 1);
        newStrokes.push(data);
        strokesRef.current = newStrokes;
        historyIndexRef.current = newStrokes.length - 1;
        drawStroke(data);
        updateUndoRedoState();
      } else if (action === 'undo') {
        if (historyIndexRef.current >= 0) {
          historyIndexRef.current -= 1;
          redrawCanvas();
          updateUndoRedoState();
        }
      } else if (action === 'redo') {
        if (historyIndexRef.current < strokesRef.current.length - 1) {
          historyIndexRef.current += 1;
          redrawCanvas();
          updateUndoRedoState();
        }
      } else if (action === 'clear') {
        strokesRef.current = [];
        historyIndexRef.current = -1;
        redrawCanvas();
        updateUndoRedoState();
      }
    };

    socket.on('scribble_canvas_event', onCanvasEvent);
    socket.on('scribble_clear_canvas', onCanvasEvent); 

    return () => {
      socket.off('scribble_canvas_event', onCanvasEvent);
      socket.off('scribble_clear_canvas', onCanvasEvent);
    };
  }, []);

  const drawStroke = (stroke: StrokeData, ctx?: CanvasRenderingContext2D | null, canvas?: HTMLCanvasElement | null) => {
    const targetCtx = ctx || ctxRef.current;
    const targetCanvas = canvas || canvasRef.current;
    if (!targetCtx || !targetCanvas || stroke.points.length === 0) return;

    if (stroke.type === 'fill') {
      floodFill(targetCtx, targetCanvas, stroke.points[0].x * targetCanvas.width, stroke.points[0].y * targetCanvas.height, stroke.color);
      return;
    }

    if (stroke.points.length < 2) return;

    targetCtx.beginPath();
    targetCtx.strokeStyle = stroke.type === 'eraser' ? '#ffffff' : stroke.color;
    targetCtx.lineWidth = stroke.size;
    
    const w = targetCanvas.width;
    const h = targetCanvas.height;

    targetCtx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
    for (let i = 1; i < stroke.points.length; i++) {
      targetCtx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
    }
    targetCtx.stroke();
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) / canvas.width,
      y: (clientY - rect.top) / canvas.height
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const ctx = ctxRef.current;
    const canvas = canvasRef.current;

    // Handle Bucket Fill Tool
    if (selectedTool === 'fill') {
      if (ctx && canvas) {
        floodFill(ctx, canvas, coords.x * canvas.width, coords.y * canvas.height, selectedColor);

        const strokeData: StrokeData = {
          points: [coords],
          color: selectedColor,
          size: selectedSize,
          type: 'fill'
        };

        const newStrokes = strokesRef.current.slice(0, historyIndexRef.current + 1);
        newStrokes.push(strokeData);
        strokesRef.current = newStrokes;
        historyIndexRef.current = newStrokes.length - 1;
        updateUndoRedoState();

        const socket = socketService.getSocket();
        socket.emit('scribble_canvas_event', {
          gameId,
          userId,
          action: 'stroke',
          data: strokeData
        });
      }
      return;
    }

    setIsDrawing(true);
    setCurrentStroke([coords]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawer || selectedTool === 'fill') return;
    e.preventDefault();
    
    const coords = getCoordinates(e);
    if (!coords) return;

    const newStroke = [...currentStroke, coords];
    setCurrentStroke(newStroke);

    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas) {
      ctx.beginPath();
      ctx.strokeStyle = selectedTool === 'eraser' ? '#ffffff' : selectedColor;
      ctx.lineWidth = selectedSize;
      const lastPoint = currentStroke[currentStroke.length - 1];
      ctx.moveTo(lastPoint.x * canvas.width, lastPoint.y * canvas.height);
      ctx.lineTo(coords.x * canvas.width, coords.y * canvas.height);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing || !isDrawer || selectedTool === 'fill') return;
    setIsDrawing(false);

    if (currentStroke.length > 1) {
      const strokeData: StrokeData = {
        points: currentStroke,
        color: selectedColor,
        size: selectedSize,
        type: selectedTool
      };
      
      const newStrokes = strokesRef.current.slice(0, historyIndexRef.current + 1);
      newStrokes.push(strokeData);
      strokesRef.current = newStrokes;
      historyIndexRef.current = newStrokes.length - 1;
      updateUndoRedoState();
      
      const socket = socketService.getSocket();
      socket.emit('scribble_canvas_event', {
        gameId,
        userId,
        action: 'stroke',
        data: strokeData
      });
    }
    setCurrentStroke([]);
  };

  // Determine active custom cursor for drawer
  let activeCursor = 'default';
  if (isDrawer) {
    if (selectedTool === 'fill') activeCursor = BUCKET_CURSOR;
    else if (selectedTool === 'eraser') activeCursor = ERASER_CURSOR;
    else activeCursor = PENCIL_CURSOR;
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-white rounded-xl shadow-inner relative overflow-hidden touch-none"
      style={{ cursor: activeCursor }}
    >
      {!isDrawer && (
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm z-10">
          Spectating
        </div>
      )}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="w-full h-full"
      />
    </div>
  );
};
