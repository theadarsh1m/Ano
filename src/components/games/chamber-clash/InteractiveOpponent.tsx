import React, { useState } from 'react';

interface InteractiveOpponentProps {
  position: [number, number, number];
  size: [number, number, number];
  isActive: boolean;
  onClick: () => void;
}

export function InteractiveOpponent({ position, size, isActive, onClick }: InteractiveOpponentProps) {
  const [hovered, setHovered] = useState(false);

  // If not in a targeting mode, we don't render the hitbox at all
  if (!isActive) return null;

  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
        document.body.style.cursor = 'default';
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'crosshair';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <boxGeometry args={size} />
      {/* Invisible material but catches raycasts, or very subtle highlight on hover */}
      <meshBasicMaterial 
        color="#ef4444" 
        transparent 
        opacity={hovered ? 0.05 : 0.0} 
        depthWrite={false}
      />
    </mesh>
  );
}
