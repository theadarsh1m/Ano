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
  type: 'brush' | 'eraser';
}

interface ScribbleCanvasProps {
  isDrawer: boolean;
  gameId: string;
  selectedColor: string;
  selectedSize: number;
  selectedTool: 'brush' | 'eraser';
  onClear: () => void;
  clearTrigger: number;
  undoTrigger: number;
  redoTrigger: number;
  setCanUndo: (val: boolean) => void;
  setCanRedo: (val: boolean) => void;
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
      // Save current content
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
        // Fill white background initially
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
    if (!targetCtx || !targetCanvas || stroke.points.length < 2) return;

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

    setIsDrawing(true);
    setCurrentStroke([coords]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawer) return;
    e.preventDefault(); // prevent scrolling on touch
    
    const coords = getCoordinates(e);
    if (!coords) return;

    const newStroke = [...currentStroke, coords];
    setCurrentStroke(newStroke);

    // Draw locally immediately
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
    if (!isDrawing || !isDrawer) return;
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

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-white rounded-xl shadow-inner relative overflow-hidden cursor-crosshair touch-none"
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
