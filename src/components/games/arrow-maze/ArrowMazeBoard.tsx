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

function getDeltaOffset(dir: ArrowDirection): [number, number] {
  switch (dir) {
    case 'UP':    return [0, -1];
    case 'DOWN':  return [0, 1];
    case 'LEFT':  return [-1, 0];
    case 'RIGHT': return [1, 0];
  }
}

function getVisualPathPoints(path: Point[], dir: ArrowDirection): { pts: { x: number; y: number }[]; headX: number; headY: number } {
  if (!path || path.length === 0) return { pts: [], headX: 0, headY: 0 };

  const rawPts = path.map(p => ({
    x: p.c * CELL_SIZE + CELL_SIZE / 2,
    y: p.r * CELL_SIZE + CELL_SIZE / 2
  }));

  const head = rawPts[rawPts.length - 1];
  const [outDx, outDy] = getDeltaOffset(dir);

  if (rawPts.length === 1) {
    // 1-cell arrow tile
    const tailOffset = 25;
    const headOffset = 15;
    const startPt = { x: head.x - outDx * tailOffset, y: head.y - outDy * tailOffset };
    const endPt = { x: head.x + outDx * headOffset, y: head.y + outDy * headOffset };
    return {
      pts: [startPt, endPt],
      headX: endPt.x,
      headY: endPt.y,
    };
  }

  // Multi-cell arrow path
  const prev = rawPts[rawPts.length - 2];
  const inDx = Math.sign(head.x - prev.x);
  const inDy = Math.sign(head.y - prev.y);

  const pts = [...rawPts];

  if (inDx === outDx && inDy === outDy) {
    // Straight head segment: extend forward slightly for clean arrowhead seating
    const headOffset = 15;
    const endPt = { x: head.x + outDx * headOffset, y: head.y + outDy * headOffset };
    pts[pts.length - 1] = endPt;
    return { pts, headX: endPt.x, headY: endPt.y };
  } else {
    // Turning head segment: turn inside the head cell towards exit direction
    const headOffset = 25;
    const endPt = { x: head.x + outDx * headOffset, y: head.y + outDy * headOffset };
    pts.push(endPt);
    return { pts, headX: endPt.x, headY: endPt.y };
  }
}

function computeSlitheredPath(path: Point[], dir: ArrowDirection, progress: number): { d: string, headX: number, headY: number } {
  const base = getVisualPathPoints(path, dir);
  if (base.pts.length === 0) return { d: '', headX: 0, headY: 0 };

  const pts = [...base.pts];
  const moveDist = progress * (path.length + 4) * CELL_SIZE; 
  if (moveDist <= 0) {
    return { d: pointsToD(pts), headX: base.headX, headY: base.headY };
  }

  const [outDx, outDy] = getDeltaOffset(dir);
  const head = pts[pts.length - 1];
  
  const newHead = { x: head.x + outDx * moveDist, y: head.y + outDy * moveDist };
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
}: {
  arrow: Arrow;
  onClick: () => void;
  isHinted: boolean;
}) {
  const pathRef = React.useRef<SVGPathElement>(null);
  const pathOutlineRef = React.useRef<SVGPathElement>(null);
  const invisiblePathRef = React.useRef<SVGPathElement>(null);
  const headRef = React.useRef<SVGPolygonElement>(null);
  const headOutlineRef = React.useRef<SVGPolygonElement>(null);

  React.useEffect(() => {
    if (!arrow.isAnimating) {
      const { d, headX, headY } = computeSlitheredPath(arrow.path, arrow.direction, 0);
      if (pathRef.current) pathRef.current.setAttribute('d', d);
      if (pathOutlineRef.current) pathOutlineRef.current.setAttribute('d', d);
      if (invisiblePathRef.current) invisiblePathRef.current.setAttribute('d', d);
      const transformStr = `translate(${headX}, ${headY}) rotate(${getRotation(arrow.direction)})`;
      if (headRef.current) headRef.current.setAttribute('transform', transformStr);
      if (headOutlineRef.current) headOutlineRef.current.setAttribute('transform', transformStr);
      return;
    }

    let startTime = performance.now();
    let frameId: number;

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / 360, 1);
      
      const { d, headX, headY } = computeSlitheredPath(arrow.path, arrow.direction, progress);
      const transformStr = `translate(${headX}, ${headY}) rotate(${getRotation(arrow.direction)})`;
      
      if (pathRef.current) pathRef.current.setAttribute('d', d);
      if (pathOutlineRef.current) pathOutlineRef.current.setAttribute('d', d);
      if (invisiblePathRef.current) invisiblePathRef.current.setAttribute('d', d);
      if (headRef.current) headRef.current.setAttribute('transform', transformStr);
      if (headOutlineRef.current) headOutlineRef.current.setAttribute('transform', transformStr);
      
      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };
    
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [arrow.isAnimating, arrow.path, arrow.direction]);

  if (arrow.isCleared) return null;

  const { d, headX, headY } = computeSlitheredPath(arrow.path, arrow.direction, 0);

  const bumpDistance = CELL_SIZE * 0.16; 
  let currentTransform = '';
  if (arrow.isShaking) {
    currentTransform = getBumpTransform(arrow.direction, bumpDistance);
  }
  
  const bodyWidth = CELL_SIZE * 0.20; // 20px path body
  const outlineWidth = bodyWidth + 4.5; // Outer border layer
  const isBlocked = arrow.isBlocked;
  
  // Sleek minimalist colors matching Target Screenshot 2
  const fillColor = isBlocked ? '#ef4444' : isHinted ? '#2563eb' : '#23354d';
  const outlineColor = '#ffffff';

  const transformStr = `translate(${headX}, ${headY}) rotate(${getRotation(arrow.direction)})`;

  return (
    <g
      onClick={onClick}
      className="cursor-pointer outline-none group"
      filter="url(#arrowShadow)"
      style={{
        transform: currentTransform,
        transition: arrow.isShaking
            ? 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)' 
            : 'transform 0.15s ease',
      }}
    >
      {/* Invisible thicker target for touch */}
      <path
        ref={invisiblePathRef}
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={CELL_SIZE * 0.7}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      
      {/* LAYER 1: Outer Border for Unified Puzzle Tile */}
      <path
        ref={pathOutlineRef}
        d={d}
        fill="none"
        stroke={outlineColor}
        strokeWidth={outlineWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polygon
        ref={headOutlineRef}
        points="-7,-16 17,0 -7,16"
        fill={outlineColor}
        stroke={outlineColor}
        strokeWidth={6}
        strokeLinejoin="round"
        strokeLinecap="round"
        transform={transformStr}
      />

      {/* LAYER 2: Inner Fill */}
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={fillColor}
        strokeWidth={bodyWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="group-hover:stroke-[#2e4563] transition-colors duration-150"
      />
      <polygon
        ref={headRef}
        points="-7,-16 17,0 -7,16"
        fill={fillColor}
        stroke={fillColor}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
        transform={transformStr}
        className="group-hover:fill-[#2e4563] group-hover:stroke-[#2e4563] transition-colors duration-150"
      />
    </g>
  );
}

// ── Main Board Component ─────────────────────────────────
export default function ArrowMazeBoard({
  engine,
  onArrowClick,
  hintArrowId,
  className = '',
}: ArrowMazeBoardProps) {
  const [, forceUpdate] = useState(0);

  // Listen for engine state changes
  useEffect(() => {
    engine.onStateChange = () => forceUpdate(v => v + 1);
    return () => { engine.onStateChange = undefined; };
  }, [engine]);

  const gridWidth = engine.gridCols * CELL_SIZE;
  const gridHeight = engine.gridRows * CELL_SIZE;

  return (
    <div className={`relative flex items-center justify-center w-full h-full ${className}`}>
      {/* Off-white clean surface board with rounded 20px corners & soft shadow */}
      <div 
        className="relative bg-[#f8fafc] shadow-xl shadow-black/25 rounded-2xl md:rounded-[20px] overflow-hidden border border-slate-200/90"
        style={{
          aspectRatio: `${engine.gridCols} / ${engine.gridRows}`,
          maxHeight: '100%',
          maxWidth: '100%',
          width: engine.gridCols >= engine.gridRows ? '100%' : 'auto',
          height: engine.gridRows >= engine.gridCols ? '100%' : 'auto',
        }}
      >
        {/* SVG Board using viewBox for responsive scaling */}
        <svg 
          viewBox={`0 0 ${gridWidth} ${gridHeight}`}
          className="absolute inset-0 w-full h-full pointer-events-auto"
        >
          <defs>
            {/* Soft SVG drop shadow for tile depth */}
            <filter id="arrowShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.15" />
            </filter>

            {/* Minimal grid lines and dots */}
            <pattern id="dotGrid" x="0" y="0" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
              <path d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`} fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx={CELL_SIZE/2} cy={CELL_SIZE/2} r="2.5" fill="#cbd5e1" />
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
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
