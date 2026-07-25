"use client";

import React, { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, Html, useProgress } from "@react-three/drei";
import * as THREE from "three";
import type { ChamberClashState } from "@/store/useChamberClashStore";

export function preloadChamberClashAssets() {
  useGLTF.preload("/chamber-clash/3d/environment.glb");
  useGLTF.preload("/chamber-clash/3d/character-upper.glb");
  useGLTF.preload("/chamber-clash/3d/shotgun-clean.glb");
  useGLTF.preload("/chamber-clash/3d/items-clean.glb");
  useGLTF.preload("/chamber-clash/3d/fp-arms.glb");
}

interface ChamberClash3DProps {
  gameState: ChamberClashState | null;
  userId: string | null;
  eventQueue: any[];
  isAnimating: boolean;
  onUseItem?: (itemId: string, targetId?: string) => void;
  onShootTarget?: (targetId: string) => void;
}

// Hardcoded STATIC positions from Blender
const ITEM_MESH_MAP: Record<string, string> = {
  magnifier: "ITEM_MAGNIFIER",
  medkit: "ITEM_MEDKIT",
  handcuffs: "ITEM_HANDCUFFS",
  inverter: "ITEM_INVERTER",
  burner_phone: "ITEM_BURNER_PHONE",
  adrenaline: "ITEM_ADRENALINE",
  handsaw: "ITEM_HANDSAW",
  beer: "ITEM_BEER"
};

const ITEM_ROTATIONS: Record<string, [number, number, number]> = {
  // Blender rot: (x, y, z)
  // Three.js rot is standard Euler Y-up. But since they are directly applied:
  magnifier: [0, 0, 0],
  medkit: [0, Math.PI, 0],
  handcuffs: [0, 0, 0],
  inverter: [0, 0, 0],
  burner_phone: [0, Math.PI, 0],
  adrenaline: [0, 0, 0],
  handsaw: [0, Math.PI/4, 0],
  beer: [0, 0, 0]
};

import { TableSurface } from "./TableSurface";
import { InteractiveItem } from "./InteractiveItem";

const WEAPON_TABLE_REST = {
  position: [0, 0.77, 0.05] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1.2, 1.2, 1.2] as [number, number, number]
};

const LOCAL_ITEM_SLOTS = [
  { id: "slot-0", position: [-0.4, 0.77, 0.35] as [number, number, number] },
  { id: "slot-1", position: [-0.2, 0.77, 0.35] as [number, number, number] },
  { id: "slot-2", position: [0.0, 0.77, 0.35] as [number, number, number] },
  { id: "slot-3", position: [0.2, 0.77, 0.35] as [number, number, number] },
  { id: "slot-4", position: [0.4, 0.77, 0.35] as [number, number, number] },
];

const OPPONENT_ITEM_SLOTS = [
  { id: "opp-slot-0", position: [-0.4, 0.77, -0.35] as [number, number, number] },
  { id: "opp-slot-1", position: [-0.2, 0.77, -0.35] as [number, number, number] },
  { id: "opp-slot-2", position: [0.0, 0.77, -0.35] as [number, number, number] },
  { id: "opp-slot-3", position: [0.2, 0.77, -0.35] as [number, number, number] },
  { id: "opp-slot-4", position: [0.4, 0.77, -0.35] as [number, number, number] },
];

const OPPONENT_TARGET_HITBOX = {
  position: [0, 1.0, -0.55] as [number, number, number],
  size: [0.4, 0.6, 0.4] as [number, number, number]
};

function LoaderOverlay() {
  const { progress, active } = useProgress();
  if (!active) return null;
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3 bg-zinc-950/90 border border-red-500/30 p-6 rounded-2xl backdrop-blur-md shadow-2xl text-white select-none">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        <div className="font-mono text-sm font-bold tracking-widest text-red-400">
          LOADING CHAMBER CLASH 3D ({Math.round(progress)}%)
        </div>
      </div>
    </Html>
  );
}

function StaticScene({ gameState, userId }: { gameState: ChamberClashState | null, userId: string | null }) {
  const envGLTF = useGLTF("/chamber-clash/3d/environment.glb");
  const charGLTF = useGLTF("/chamber-clash/3d/character-upper.glb");
  const shotgunGLTF = useGLTF("/chamber-clash/3d/shotgun-clean.glb");
  const itemsGLTF = useGLTF("/chamber-clash/3d/items-clean.glb");
  const fpArmsGLTF = useGLTF("/chamber-clash/3d/fp-arms.glb");

  const localPlayer = gameState?.players.find(p => p.userId === userId);
  const opponent = gameState?.players.find(p => p.userId !== userId);

  const localInventory = localPlayer?.inventory || [];
  const opponentInventory = opponent?.inventory || [];

  const handleItemClick = (itemId: string) => {
    console.log(`[Interaction] Selected physical item: ${itemId}`);
  };

  return (
    <>
      {/* Moody atmospheric lighting */}
      <ambientLight intensity={0.2} color="#445555" />
      
      {/* Central spot on the table (Shotgun area) */}
      <spotLight 
        position={[0, 2.0, 0]} 
        color="#ffe5bf" 
        intensity={60} 
        angle={Math.PI / 3} 
        penumbra={0.8} 
        distance={4}
      />
      {/* Subtle rim light for opponent */}
      <pointLight 
        position={[0, 1.2, -1.0]} 
        color="#88aaff" 
        intensity={5} 
        distance={3}
      />

      {/* Environment (Room) */}
      <primitive object={envGLTF.scene} />

      {/* NEW Game Table Surface (Y=0.771 to overlay original table) */}
      <TableSurface yPos={0.771} />

      {/* Opponent Character */}
      {(() => {
        const c = charGLTF.scene.clone();
        
        // Center mesh
        const box = new THREE.Box3().setFromObject(c);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        
        c.position.set(-center.x, -center.y, -center.z);
        
        // We scale the opponent up slightly to make them feel more human-sized across the table
        // We push Z further back (-0.9) to sit behind the opponent inventory and far edge
        const scale = 1.15;
        const groupY = 0.77 - (size.y * scale) * 0.25; // Push them slightly lower so table cuts chest
        
        return (
          <group 
            position={[0, groupY, -0.9]} 
            scale={[scale, scale, scale]}
          >
            <primitive object={c} />
            {/* Future Target Hitbox */}
            <mesh position={[0, size.y * 0.25, 0]} visible={false}>
              <boxGeometry args={OPPONENT_TARGET_HITBOX.size} />
              <meshBasicMaterial color="red" wireframe />
            </mesh>
          </group>
        );
      })()}

      {/* Shotgun */}
      {(() => {
        const s = shotgunGLTF.scene.clone();
        
        // Auto-center the shotgun
        const box = new THREE.Box3().setFromObject(s);
        const center = new THREE.Vector3();
        box.getCenter(center);
        s.position.set(-center.x, -center.y, -center.z);

        return (
          <group 
            position={WEAPON_TABLE_REST.position} 
            scale={WEAPON_TABLE_REST.scale} 
            rotation={WEAPON_TABLE_REST.rotation}
          >
            <primitive object={s} />
          </group>
        );
      })()}

      {/* Opponent Items */}
      {opponentInventory.map((itemId, idx) => {
        const meshName = ITEM_MESH_MAP[itemId];
        const sourceMesh = itemsGLTF.nodes[meshName] as THREE.Mesh;
        if (!sourceMesh) return null;
        
        const slot = OPPONENT_ITEM_SLOTS[idx];
        const rot = ITEM_ROTATIONS[itemId];
        
        return (
          <InteractiveItem 
            key={`opponent-${itemId}-${idx}`}
            id={itemId}
            sourceMesh={sourceMesh}
            position={slot.position}
            rotation={rot}
            isLocal={false}
            tableY={0.771} // Rest exactly on new table plane
          />
        );
      })}

      {/* Local Items */}
      {localInventory.map((itemId, idx) => {
        const meshName = ITEM_MESH_MAP[itemId];
        const sourceMesh = itemsGLTF.nodes[meshName] as THREE.Mesh;
        if (!sourceMesh) return null;
        
        const slot = LOCAL_ITEM_SLOTS[idx];
        const rot = ITEM_ROTATIONS[itemId];

        return (
          <InteractiveItem 
            key={`local-${itemId}-${idx}`}
            id={itemId}
            sourceMesh={sourceMesh}
            position={slot.position}
            rotation={rot}
            isLocal={true}
            onClick={handleItemClick}
            tableY={0.771} // Rest exactly on new table plane
          />
        );
      })}

      {/* FP Arms - Pushed back and down to avoid covering the local inventory */}
      <group position={[0, -0.3, 0.4]}>
        <primitive object={fpArmsGLTF.scene} />
      </group>
    </>
  );
}

export function ChamberClash3D(props: ChamberClash3DProps) {
  useEffect(() => {
    preloadChamberClashAssets();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__GAME_STATE = props.gameState;
    }
  }, [props.gameState]);

  return (
    <div className="w-full h-full relative bg-black overflow-hidden rounded-xl">
      <Canvas
        camera={{
          position: [0, 1.3, 1.2],
          fov: 78.5,
          near: 0.1,
          far: 50,
        }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0.77, -0.4);
        }}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={<LoaderOverlay />}>
          <StaticScene gameState={props.gameState} userId={props.userId} />
        </Suspense>
      </Canvas>
    </div>
  );
}
