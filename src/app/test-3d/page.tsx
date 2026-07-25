"use client";

import dynamic from "next/dynamic";

const ChamberClash3D = dynamic(() => import("@/components/games/chamber-clash/ChamberClash3D").then((m) => m.ChamberClash3D), { ssr: false });

export default function Test3DPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <ChamberClash3D 
        gameState={null} 
        userId={"test"} 
        eventQueue={[]} 
        isAnimating={false} 
      />
    </div>
  );
}
