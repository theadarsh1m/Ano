import React, { useMemo } from 'react';
import * as THREE from 'three';

interface TableSurfaceProps {
  yPos: number;
}

export function TableSurface({ yPos }: TableSurfaceProps) {
  // Generate a procedural CanvasTexture for the table top
  const tableTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Base dark desaturated green/charcoal background
    ctx.fillStyle = '#1c2420'; // Dark charcoal green
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Add worn noise/scratches
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.02)';
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const w = Math.random() * 4;
      const h = Math.random() * 4;
      ctx.fillRect(x, y, w, h);
    }
    
    // Scratches
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 100; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineWidth = Math.random() * 2;
      ctx.stroke();
    }

    // 3. Subtle Chalk Boundaries
    ctx.strokeStyle = 'rgba(200, 210, 200, 0.15)'; // Faded chalk
    ctx.lineWidth = 3;
    ctx.setLineDash([15, 10]); // Broken lines

    // Coordinate mapping: 
    // Plane is 2.4 wide (X), 1.8 deep (Z).
    // Center is (0,0) -> Canvas (512, 512).
    // X scale: 1024 / 2.4 = 426.6 px/unit
    // Z scale: 1024 / 1.8 = 568.8 px/unit
    const px = (val: number) => 512 + val * (1024 / 2.4);
    const pz = (val: number) => 512 + val * (1024 / 1.8);

    // Draw Opponent Inventory Zone Outline (Far)
    // Approx Z = -0.45 to -0.25, X = -0.7 to 0.7
    ctx.strokeRect(px(-0.6), pz(-0.42), px(0.6) - px(-0.6), pz(-0.28) - pz(-0.42));
    
    // Draw Local Inventory Zone Outline (Near)
    // Approx Z = 0.25 to 0.45, X = -0.7 to 0.7
    ctx.strokeRect(px(-0.6), pz(0.28), px(0.6) - px(-0.6), pz(0.42) - pz(0.28));

    // Draw Central Weapon Area
    // Oval / Broken boundary
    ctx.beginPath();
    ctx.ellipse(512, 512, 350, 150, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Minor decorative marks (measurement ticks)
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(200, 210, 200, 0.1)';
    for (let i = -5; i <= 5; i++) {
      if (i === 0) continue;
      // top ticks
      ctx.fillRect(px(i * 0.1) - 1, pz(-0.15), 2, 10);
      // bottom ticks
      ctx.fillRect(px(i * 0.1) - 1, pz(0.15) - 10, 2, 10);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 16;
    return tex;
  }, []);

  return (
    <group position={[0, yPos, 0]}>
      {/* Table Surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.4, 1.8]} />
        <meshStandardMaterial 
          map={tableTexture} 
          roughness={0.9} 
          metalness={0.1}
          color="#cccccc" // Slightly darken the map
        />
      </mesh>

      {/* Near Edge Trim (Physical thickness) */}
      <mesh position={[0, -0.05, 0.9]}>
        <boxGeometry args={[2.4, 0.1, 0.05]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.7} metalness={0.5} />
      </mesh>
      
      {/* Side Edges */}
      <mesh position={[-1.2, -0.05, 0]}>
        <boxGeometry args={[0.05, 0.1, 1.8]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.7} metalness={0.5} />
      </mesh>
      <mesh position={[1.2, -0.05, 0]}>
        <boxGeometry args={[0.05, 0.1, 1.8]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.7} metalness={0.5} />
      </mesh>
    </group>
  );
}
