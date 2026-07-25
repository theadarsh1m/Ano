import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { SHOTGUN_EJECTION_PORT, TABLE_Y } from './animationConfigs';

interface EjectedShellProps {
  shellType: 'LIVE' | 'BLANK';
  onComplete?: () => void;
}

/**
 * Visual shell model that ejects from the shotgun, tumbles through the air,
 * hits the table surface, and rests visibly on the table for a period of time.
 * 
 * LIVE: Red casing + brass head
 * BLANK: Dark grey/black casing
 * 
 * PRESENTATION ONLY — does not alter game state.
 */
export function EjectedShell({ shellType, onComplete }: EjectedShellProps) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);
  const isLanded = useRef(false);
  const landedPosition = useRef(new THREE.Vector3());

  const isLive = shellType === 'LIVE';

  // Casing colors
  const shellColor = isLive ? '#cc2222' : '#333b42';
  const shellTipColor = isLive ? '#dd8833' : '#66737d';

  // Random ejection velocities
  const ejectionVelocity = useMemo(() => new THREE.Vector3(
    0.6 + Math.random() * 0.3,   // rightward
    1.1 + Math.random() * 0.3,   // upward arc
    0.15 + Math.random() * 0.2   // slight forward
  ), []);

  const tumbleSpeed = useMemo(() => new THREE.Vector3(
    10 + Math.random() * 6,
    14 + Math.random() * 8,
    6 + Math.random() * 4
  ), []);

  const startPos = useMemo(() => SHOTGUN_EJECTION_PORT.clone(), []);
  const gravity = -5.0;
  const landedY = TABLE_Y + 0.012; // Sitting right on new table plane
  const totalDuration = 4.0; // Stay visible on table for 4s total

  useFrame((_, delta) => {
    if (!groupRef.current || completed.current) return;

    elapsed.current += delta;
    const t = elapsed.current;

    if (t >= totalDuration) {
      completed.current = true;
      groupRef.current.visible = false;
      onComplete?.();
      return;
    }

    if (!isLanded.current) {
      // Free-flight physics: pos = start + v0*t + 0.5*g*t²
      const currentY = startPos.y + ejectionVelocity.y * t + 0.5 * gravity * t * t;

      if (currentY <= landedY) {
        // Impact table surface: lock landed position
        isLanded.current = true;
        landedPosition.current.set(
          startPos.x + ejectionVelocity.x * t,
          landedY,
          startPos.z + ejectionVelocity.z * t
        );
        groupRef.current.position.copy(landedPosition.current);
        // Lie flat on table
        groupRef.current.rotation.set(0, Math.random() * Math.PI * 2, Math.PI / 2);
      } else {
        groupRef.current.position.set(
          startPos.x + ejectionVelocity.x * t,
          currentY,
          startPos.z + ejectionVelocity.z * t
        );
        // Free tumble
        groupRef.current.rotation.set(
          tumbleSpeed.x * t,
          tumbleSpeed.y * t,
          tumbleSpeed.z * t
        );
      }
    } else {
      // Resting on table
      groupRef.current.position.copy(landedPosition.current);
      // Subtle fade out in last 20%
      const fadeStart = totalDuration * 0.8;
      if (t > fadeStart) {
        const fade = 1 - (t - fadeStart) / (totalDuration - fadeStart);
        groupRef.current.scale.setScalar(Math.max(0, fade));
      }
    }
  });

  return (
    <group ref={groupRef} position={[startPos.x, startPos.y, startPos.z]}>
      {/* Shell casing body */}
      <mesh>
        <cylinderGeometry args={[0.012, 0.012, 0.055, 12]} />
        <meshStandardMaterial 
          color={shellColor} 
          metalness={0.6} 
          roughness={0.3} 
          emissive={isLive ? '#551111' : '#111822'}
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Shell rim / cap */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.011, 0.013, 0.012, 12]} />
        <meshStandardMaterial 
          color={shellTipColor} 
          metalness={0.7} 
          roughness={0.3} 
        />
      </mesh>
      {/* Brass primer */}
      <mesh position={[0, -0.03, 0]}>
        <cylinderGeometry args={[0.008, 0.012, 0.005, 12]} />
        <meshStandardMaterial 
          color="#aa8844" 
          metalness={0.9} 
          roughness={0.2} 
        />
      </mesh>
    </group>
  );
}
