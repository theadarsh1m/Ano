"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Arrow, ArrowDirection, Point } from './types';
import type { ArrowMazeEngine } from './ArrowMazeEngine';

interface ArrowMazeBoardProps {
  engine: ArrowMazeEngine;
  onArrowClick: (arrowId: number) => void;
  hintArrowId?: number | null;
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────

function getRotation(dir: ArrowDirection) {
  switch (dir) {
    case 'UP': return -90;
    case 'DOWN': return 90;
    case 'LEFT': return 180;
    case 'RIGHT': return 0;
  }
}

function getBumpTransform(dir: ArrowDirection, distance: number): string {
  switch (dir) {
    case 'UP': return `translateY(-${distance}px)`;
    case 'DOWN': return `translateY(${distance}px)`;
    case 'LEFT': return `translateX(-${distance}px)`;
    case 'RIGHT': return `translateX(${distance}px)`;
  }
}

function getExitTransform(dir: ArrowDirection, distance: number) {
  switch (dir) {
    case 'UP': return `translateY(-${distance}px)`;
    case 'DOWN': return `translateY(${distance}px)`;
    case 'LEFT': return `translateX(-${distance}px)`;
    case 'RIGHT': return `translateX(${distance}px)`;
  }
}

// ── Constants ────────────────────────────────────────────
const CELL_SIZE = 100; // Internal SVG coordinate size

function computeSlitheredPath(path: Point[], dir: ArrowDirection, progress: number): { d: string, headX: number, headY: number } {
  const pts = path.map(p => ({
    x: p.c * CELL_SIZE + CELL_SIZE / 2,
    y: p.r * CELL_SIZE + CELL_SIZE / 2
  }));
  
  const moveDist = progress * (path.length + 3) * CELL_SIZE; 
  if (moveDist <= 0) {
    return { d: pointsToD(pts), headX: pts[pts.length - 1].x, headY: pts[pts.length - 1].y };
  }

  const head = pts[pts.length - 1];
  let dx = 0, dy = 0;
  if (dir === 'UP') dy = -1;
  if (dir === 'DOWN') dy = 1;
  if (dir === 'LEFT') dx = -1;
  if (dir === 'RIGHT') dx = 1;
  
  const newHead = { x: head.x + dx * moveDist, y: head.y + dy * moveDist };
  pts.push(newHead);
  
  let budget = moveDist;
  const resultPts = [];
  
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i+1];
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    
    if (budget >= segLen - 0.001) { 
      budget -= segLen; 
    } else {
      const ratio = budget / segLen;
      const newX = p1.x + (p2.x - p1.x) * ratio;
      const newY = p1.y + (p2.y - p1.y) * ratio;
      
      resultPts.push({ x: newX, y: newY });
      for (let j = i + 1; j < pts.length; j++) {
        resultPts.push(pts[j]);
      }
      break;
    }
  }
  
  if (resultPts.length === 0) resultPts.push(newHead);
  return { d: pointsToD(resultPts), headX: newHead.x, headY: newHead.y };
}

function pointsToD(pts: {x:number, y:number}[]) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

// ── Arrow Component ──────────────────────────────────────
function ArrowPath({
  arrow,
  onClick,
  isHinted,
  boardWidth,
  boardHeight,
}: {
  arrow: Arrow;
  onClick: () => void;
  isHinted: boolean;
  boardWidth: number;
  boardHeight: number;
}) {
  const pathRef = React.useRef<SVGPathElement>(null);
  const invisiblePathRef = React.useRef<SVGPathElement>(null);
  const headRef = React.useRef<SVGPolygonElement>(null);

  React.useEffect(() => {
    if (!arrow.isAnimating) {
      const { d, headX, headY } = computeSlitheredPath(arrow.path, arrow.direction, 0);
      if (pathRef.current) pathRef.current.setAttribute('d', d);
      if (invisiblePathRef.current) invisiblePathRef.current.setAttribute('d', d);
      if (headRef.current) headRef.current.setAttribute('transform', `translate(${headX}, ${headY}) rotate(${getRotation(arrow.direction)})`);
      return;
    }

    let startTime = performance.now();
    let frameId: number;

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / 500, 1);
      
      const { d, headX, headY } = computeSlitheredPath(arrow.path, arrow.direction, progress);
      
      if (pathRef.current) pathRef.current.setAttribute('d', d);
      if (invisiblePathRef.current) invisiblePathRef.current.setAttribute('d', d);
      if (headRef.current) headRef.current.setAttribute('transform', `translate(${headX}, ${headY}) rotate(${getRotation(arrow.direction)})`);
      
      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };
    
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [arrow.isAnimating, arrow.path, arrow.direction]);

  if (arrow.isCleared) return null;

  const { d, headX, headY } = computeSlitheredPath(arrow.path, arrow.direction, 0);

  const bumpDistance = CELL_SIZE * 0.2; 
  let currentTransform = '';
  if (arrow.isShaking) {
    currentTransform = getBumpTransform(arrow.direction, bumpDistance);
  }
  
  const strokeWidth = CELL_SIZE * 0.28; // Thicker arrow body
  const isBlocked = arrow.isBlocked;
  
  const color = isBlocked ? '#ef4444' : isHinted ? '#34d399' : '#07164a';

  return (
    <g
      onClick={onClick}
      className={`cursor-pointer outline-none`}
      style={{
        transform: currentTransform,
        transition: arrow.isShaking
            ? 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)' 
            : 'transform 0.15s ease',
      }}
    >
      {/* Invisible thicker path for easier clicking on mobile */}
      <path
        ref={invisiblePathRef}
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={CELL_SIZE * 0.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      
      {/* Main visible body - Smooth and Unified */}
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{
          transition: 'stroke 0.15s ease',
        }}
      />

      {/* Custom Arrowhead - Soft rounded triangle */}
      <polygon
        ref={headRef}
        points="-8,-22 28,0 -8,22"
        fill={color}
        stroke={color}
        strokeWidth={8}
        strokeLinejoin="round"
        transform={`translate(${headX}, ${headY}) rotate(${getRotation(arrow.direction)})`}
        style={{
          transition: 'fill 0.15s ease, stroke 0.15s ease',
        }}
      />
    </g>
  );
}

// ── Particle Effects ─────────────────────────────────────
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  gridW: number;
  gridH: number;
}

function ParticleLayer({ particles }: { particles: Particle[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 30 }}>
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${(p.x / p.gridW) * 100}%`,
            top: `${(p.y / p.gridH) * 100}%`,
            width: `${(p.size / p.gridW) * 100}%`,
            height: `${(p.size / p.gridH) * 100}%`,
            backgroundColor: p.color,
            opacity: p.life,
            transition: 'none',
          }}
        />
      ))}
    </div>
  );
}


// ── Main Board Component ─────────────────────────────────
export default function ArrowMazeBoard({
  engine,
  onArrowClick,
  hintArrowId,
  className = '',
}: ArrowMazeBoardProps) {
  const [particles, setParticles] = useState<(Particle & { gridW: number, gridH: number })[]>([]);
  const [, forceUpdate] = useState(0);
  const particleIdRef = useRef(0);
  const animFrameRef = useRef<number>(0);

  // Listen for engine state changes
  useEffect(() => {
    engine.onStateChange = () => forceUpdate(v => v + 1);
    return () => { engine.onStateChange = undefined; };
  }, [engine]);

  // Particle system update loop
  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      setParticles(prev => {
        const next = prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.15, // gravity
            life: p.life - 0.02,
          }))
          .filter(p => p.life > 0);
        return next.length !== prev.length || next.length > 0 ? next : prev;
      });
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(animFrameRef.current); };
  }, []);

  const gridWidth = engine.gridCols * CELL_SIZE;
  const gridHeight = engine.gridRows * CELL_SIZE;

  // Spawn particles on arrow clear
  const spawnClearParticles = useCallback((arrow: Arrow) => {
    const head = arrow.path[arrow.path.length - 1];
    const cx = head.c * CELL_SIZE + CELL_SIZE / 2;
    const cy = head.r * CELL_SIZE + CELL_SIZE / 2;
    const colors = ['#07164a', '#1e3a8a', '#3b82f6'];
    const newParticles: (Particle & { gridW: number, gridH: number })[] = [];

    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const speed = 5 + Math.random() * 10;
      newParticles.push({
        id: particleIdRef.current++,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        life: 0.8 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 15 + Math.random() * 20,
        gridW: gridWidth,
        gridH: gridHeight,
      });
    }

    setParticles(prev => [...prev, ...newParticles]);
  }, [gridWidth, gridHeight]);

  useEffect(() => {
    engine.onArrowCleared = (arrow) => {
      spawnClearParticles(arrow);
    };
    return () => { engine.onArrowCleared = undefined; };
  }, [engine, spawnClearParticles]);

  return (
    <div className={`relative flex items-center justify-center w-full h-full ${className}`}>
      {/* Container aspect ratio to maintain square/rectangular grid proportionally */}
      <div 
        className="relative bg-white shadow-lg rounded-2xl md:rounded-3xl overflow-hidden border border-slate-100"
        style={{
          aspectRatio: `${engine.gridCols} / ${engine.gridRows}`,
          maxHeight: '100%',
          maxWidth: '100%',
          width: engine.gridCols >= engine.gridRows ? '100%' : 'auto',
          height: engine.gridRows >= engine.gridCols ? '100%' : 'auto',
        }}
      >
        {/* SVG Board using viewBox for flawless responsive scaling */}
        <svg 
          viewBox={`0 0 ${gridWidth} ${gridHeight}`}
          className="absolute inset-0 w-full h-full pointer-events-auto"
        >
          {/* Subtle grid dots for a clean game board feel */}
          <defs>
            <pattern id="dotGrid" x="0" y="0" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
              <circle cx={CELL_SIZE/2} cy={CELL_SIZE/2} r="3" fill="#e2e8f0" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotGrid)" />

          {/* Render all arrows */}
          {engine.arrows.map(arrow => (
            <ArrowPath
              key={arrow.id}
              arrow={arrow}
              onClick={() => onArrowClick(arrow.id)}
              isHinted={hintArrowId === arrow.id}
              boardWidth={gridWidth}
              boardHeight={gridHeight}
            />
          ))}
        </svg>

        {/* Particles */}
        <ParticleLayer particles={particles} />
      </div>
    </div>
  );
}
