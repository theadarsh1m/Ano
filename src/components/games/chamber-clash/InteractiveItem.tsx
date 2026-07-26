import React, { useRef, useState, useMemo } from 'react';
import { AdrenalineMesh, MedkitBottleMesh, HandsawMesh, InverterMesh, BeerCanMesh, BurnerPhoneMesh } from './CustomItemMeshes';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';

const ITEM_NAMES: Record<string, string> = {
  beer: "BEER",
  magnifier: "MAGNIFIER",
  handsaw: "HANDSAW",
  inverter: "INVERTER",
  medkit: "MEDKIT",
  burner_phone: "BURNER PHONE",
  handcuffs: "HANDCUFFS",
  adrenaline: "ADRENALINE"
};

interface InteractiveItemProps {
  id: string;
  sourceMesh: THREE.Mesh;
  position: [number, number, number];
  rotation: [number, number, number];
  isLocal: boolean;
  isSelectable?: boolean;
  isDisabled?: boolean;
  onClick?: (id: string) => void;
  tableY?: number;
}

export function InteractiveItem({
  id,
  sourceMesh,
  position,
  rotation,
  isLocal,
  isSelectable = false,
  isDisabled = false,
  onClick,
  tableY = 0.77
}: InteractiveItemProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [clickScale, setClickScale] = useState(1);

  const canInteract = !isDisabled && (isLocal || isSelectable);

  const normalizedMesh = useMemo(() => {
    const cloned = sourceMesh.clone();
    cloned.position.set(0, 0, 0);
    cloned.rotation.set(0, 0, 0);
    
    const box = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    cloned.position.set(-center.x, -center.y, -center.z);
    
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

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    // Smooth hover animation (lift by 2.5cm)
    const targetY = (canInteract && hovered) ? 0.025 : 0;
    meshRef.current.position.y += (targetY - meshRef.current.position.y) * 12 * delta;
    
    // Smooth rotation on Y axis when hovered
    const targetRot = (canInteract && hovered) ? 0.12 : 0;
    meshRef.current.rotation.y += (targetRot - meshRef.current.rotation.y) * 8 * delta;

    // Emissive glow logic (Cyan glow for stealable opponent items)
    meshRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (child.material.emissive !== undefined) {
          const targetEmissive = (canInteract && hovered) ? (isSelectable ? 0.4 : 0.2) : 0;
          const currentIntensity = child.material.emissiveIntensity || 0;
          child.material.emissive.setHex(isSelectable ? 0x00f0ff : 0xffffff);
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
    if (!canInteract) return;
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e: any) => {
    if (!canInteract) return;
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const handleClick = (e: any) => {
    if (!canInteract) return;
    e.stopPropagation();
    setClickScale(0.85);
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
          {id === 'adrenaline' ? (
            <AdrenalineMesh />
          ) : id === 'medkit' ? (
            <MedkitBottleMesh />
          ) : id === 'handsaw' ? (
            <HandsawMesh />
          ) : id === 'inverter' ? (
            <InverterMesh />
          ) : id === 'beer' ? (
            <BeerCanMesh />
          ) : id === 'burner_phone' ? (
            <BurnerPhoneMesh />
          ) : (
            <primitive object={normalizedMesh.mesh} />
          )}
          
          {/* Forgiving invisible hitbox */}
          <mesh 
            visible={false} 
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
            onClick={handleClick}
          >
            <boxGeometry args={[
              Math.min(Math.max(normalizedMesh.size.x * 1.2, 0.1), 0.18), 
              Math.min(Math.max(normalizedMesh.size.y * 1.2, 0.1), 0.18), 
              Math.min(Math.max(normalizedMesh.size.z * 1.2, 0.1), 0.18)
            ]} />
            <meshBasicMaterial transparent opacity={0.1} color="red" />
          </mesh>

          {/* Floating Tooltip when hovered during steal selection */}
          {isSelectable && hovered && (
            <Html position={[0, normalizedMesh.size.y + 0.08, 0]} center style={{ pointerEvents: 'none' }}>
              <div className="bg-cyan-950/95 border border-cyan-400 p-1.5 rounded-lg font-mono text-[9px] font-bold text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.6)] uppercase tracking-wider whitespace-nowrap">
                STEAL {ITEM_NAMES[id] || id.toUpperCase()} ➔
              </div>
            </Html>
          )}
        </group>
      </group>
    </group>
  );
}
