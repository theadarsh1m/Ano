import React, { useRef, useState, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface InteractiveItemProps {
  id: string;
  sourceMesh: THREE.Mesh;
  position: [number, number, number];
  rotation: [number, number, number];
  isLocal: boolean;
  onClick?: (id: string) => void;
  tableY?: number;
}

export function InteractiveItem({
  id,
  sourceMesh,
  position,
  rotation,
  isLocal,
  onClick,
  tableY = 0.77
}: InteractiveItemProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [clickScale, setClickScale] = useState(1);

  // Compute the resting Y offset so the item physically touches the table
  const { geometry, meshCenter, size } = useMemo(() => {
    // Clone to manipulate
    const cloned = sourceMesh.clone();
    // Zero out baked GLB position/rotation
    cloned.position.set(0, 0, 0);
    cloned.rotation.set(0, 0, 0);
    
    // Apply the intended rotation to compute the accurate bounding box
    cloned.rotation.set(rotation[0], rotation[1], rotation[2]);
    cloned.updateMatrixWorld();

    const box = new THREE.Box3().setFromObject(cloned);
    const min = box.min;
    const max = box.max;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    return {
      geometry: sourceMesh.geometry, // Share geometry
      meshCenter: center,
      size,
      // We want the item's lowest point (min.y) to sit exactly at 0 local Y
      // so when the group is placed at tableY, the bottom touches the table.
      yOffset: -min.y
    };
  }, [sourceMesh, rotation]);

  const yOffset = -size.y / 2; // Actually wait, if we center the mesh, the bottom is at -size.y/2.
  // Better approach:
  const normalizedMesh = useMemo(() => {
    const cloned = sourceMesh.clone();
    cloned.position.set(0, 0, 0);
    cloned.rotation.set(0, 0, 0);
    
    const box = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // Center the mesh at origin
    cloned.position.set(-center.x, -center.y, -center.z);
    
    // Apply intended rotation
    const rotGroup = new THREE.Group();
    rotGroup.rotation.set(rotation[0], rotation[1], rotation[2]);
    rotGroup.add(cloned);
    rotGroup.updateMatrixWorld(true);
    
    const rotatedBox = new THREE.Box3().setFromObject(rotGroup);
    
    return {
      mesh: cloned,
      bottomY: rotatedBox.min.y,
      size: new THREE.Vector3().subVectors(rotatedBox.max, rotatedBox.min)
    };
  }, [sourceMesh, rotation]);

  // We need to inject an emissive color to the mesh when hovered
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    // Smooth hover animation (lift by 1.5cm = 0.015 units)
    const targetY = (isLocal && hovered) ? 0.015 : 0;
    meshRef.current.position.y += (targetY - meshRef.current.position.y) * 12 * delta;
    
    // Smooth rotation on Y axis when hovered for an extra tactile feel
    const targetRot = (isLocal && hovered) ? 0.1 : 0;
    meshRef.current.rotation.y += (targetRot - meshRef.current.rotation.y) * 8 * delta;

    // Emissive glow logic
    meshRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        // Only apply if the material supports emissive (like MeshStandardMaterial)
        if (child.material.emissive !== undefined) {
          const targetEmissive = (isLocal && hovered) ? 0.2 : 0;
          const currentIntensity = child.material.emissiveIntensity || 0;
          child.material.emissive.setHex(0xffffff); // White glow
          child.material.emissiveIntensity = currentIntensity + (targetEmissive - currentIntensity) * 10 * delta;
        }
      }
    });
    
    // Click scale animation
    meshRef.current.scale.setScalar(clickScale);
    if (clickScale < 1) {
      setClickScale(prev => Math.min(1, prev + delta * 8));
    }
  });

  const handlePointerOver = (e: any) => {
    if (!isLocal) return;
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e: any) => {
    if (!isLocal) return;
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const handleClick = (e: any) => {
    if (!isLocal) return;
    e.stopPropagation();
    setClickScale(0.9);
    onClick?.(id);
  };
  
  // Base material (can be overridden if needed)
  const material = sourceMesh.material as THREE.Material;

  return (
    <group 
      ref={groupRef}
      position={[position[0], tableY, position[2]]} 
    >
      <group rotation={rotation}>
        {/* Animate this group up and down for hover */}
        <group ref={meshRef} position={[0, -normalizedMesh.bottomY, 0]}>
          <primitive object={normalizedMesh.mesh} />
          
          {/* Forgiving invisible hitbox */}
          <mesh 
            visible={false} 
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
            onClick={handleClick}
          >
            <boxGeometry args={[
              Math.max(normalizedMesh.size.x * 1.5, 0.1), 
              Math.max(normalizedMesh.size.y * 1.5, 0.1), 
              Math.max(normalizedMesh.size.z * 1.5, 0.1)
            ]} />
            <meshBasicMaterial transparent opacity={0.1} color="red" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
