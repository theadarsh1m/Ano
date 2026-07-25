import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * 1. ADRENALINE INJECTOR MESH
 * Compact chunky industrial emergency injector:
 * - Dark gunmetal/black casing with ribbed grip
 * - Steel mechanical accents
 * - Translucent fluid cartridge window (desaturated orange/red fluid)
 * - Steel plunger & injector tip
 */
export function AdrenalineMesh() {
  return (
    <group scale={[1, 1, 1]}>
      {/* Main Outer Gunmetal Body Casing */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.07, 16]} />
        <meshStandardMaterial color="#1c1e24" roughness={0.5} metalness={0.85} />
      </mesh>

      {/* Ribbed Rubber Grip Rings */}
      {[-0.02, 0.0, 0.02].map((y, idx) => (
        <mesh key={idx} position={[0, y, 0]}>
          <cylinderGeometry args={[0.0175, 0.0175, 0.007, 16]} />
          <meshStandardMaterial color="#0f1013" roughness={0.9} metalness={0.2} />
        </mesh>
      ))}

      {/* Fluid Reservoir Window (Glass) */}
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.035, 16]} />
        <meshStandardMaterial color="#1a0800" roughness={0.1} metalness={0.3} transparent opacity={0.65} />
      </mesh>

      {/* Emergency Fluid Core */}
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.011, 0.011, 0.03, 16]} />
        <meshStandardMaterial color="#cc4400" emissive="#441100" emissiveIntensity={0.6} roughness={0.2} />
      </mesh>

      {/* Top Metallic Cap */}
      <mesh position={[0, 0.058, 0]}>
        <cylinderGeometry args={[0.015, 0.016, 0.012, 16]} />
        <meshStandardMaterial color="#555866" roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Injector Needle / Tip at top */}
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.002, 0.003, 0.015, 8]} />
        <meshStandardMaterial color="#aaaaaa" roughness={0.1} metalness={0.95} />
      </mesh>

      {/* Bottom Plunger Cap */}
      <mesh position={[0, -0.042, 0]}>
        <cylinderGeometry args={[0.014, 0.015, 0.015, 16]} />
        <meshStandardMaterial color="#333540" roughness={0.4} metalness={0.8} />
      </mesh>
    </group>
  );
}

/**
 * 2. MEDKIT MEDICINE BOTTLE MESH
 * Compact cylindrical medical bottle:
 * - Dark desaturated green bottle body
 * - Short neck & ribbed dark cap
 * - Aged off-white paper label with red cross motif
 */
export function MedkitBottleMesh() {
  return (
    <group scale={[1, 1, 1]}>
      {/* Main Bottle Body */}
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.022, 0.024, 0.07, 24]} />
        <meshStandardMaterial color="#122b1c" roughness={0.35} metalness={0.25} />
      </mesh>

      {/* Shoulder Transition */}
      <mesh position={[0, 0.073, 0]}>
        <cylinderGeometry args={[0.013, 0.022, 0.01, 24]} />
        <meshStandardMaterial color="#122b1c" roughness={0.35} metalness={0.25} />
      </mesh>

      {/* Bottle Neck */}
      <mesh position={[0, 0.082, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.01, 24]} />
        <meshStandardMaterial color="#122b1c" roughness={0.35} metalness={0.25} />
      </mesh>

      {/* Cap */}
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.014, 24]} />
        <meshStandardMaterial color="#1a1c22" roughness={0.6} metalness={0.8} />
      </mesh>

      {/* Aged Paper Label Wrapper */}
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.0228, 0.0248, 0.045, 24, 1, true, 0, Math.PI * 2]} />
        <meshStandardMaterial color="#dcd5c7" roughness={0.85} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* Medical Cross Motif on Label (Vertical Bar) */}
      <mesh position={[0, 0.035, 0.0232]}>
        <planeGeometry args={[0.008, 0.022]} />
        <meshBasicMaterial color="#991b1b" side={THREE.DoubleSide} />
      </mesh>

      {/* Medical Cross Motif on Label (Horizontal Bar) */}
      <mesh position={[0, 0.035, 0.0233]}>
        <planeGeometry args={[0.022, 0.008]} />
        <meshBasicMaterial color="#991b1b" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * 3. HANDSAW / HACKSAW MESH
 * Compact hand-operated hacksaw:
 * - Steel saw blade with serrated lower edge
 * - Top reinforcing spine frame
 * - Dark industrial D-handle at back
 */
export function HandsawMesh() {
  return (
    <group scale={[1, 1, 1]}>
      {/* Wooden Handle Base */}
      <mesh position={[-0.07, 0.015, 0]}>
        <boxGeometry args={[0.035, 0.05, 0.014]} />
        <meshStandardMaterial color="#4a2519" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Wooden Handle Ergonomic Top Extension */}
      <mesh position={[-0.08, 0.038, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.045, 0.014, 0.014]} />
        <meshStandardMaterial color="#4a2519" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Wooden Handle Ergonomic Bottom Extension */}
      <mesh position={[-0.08, -0.008, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.045, 0.014, 0.014]} />
        <meshStandardMaterial color="#4a2519" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Dark Steel U-Frame Top Bar */}
      <mesh position={[0.02, 0.042, 0]}>
        <boxGeometry args={[0.16, 0.008, 0.008]} />
        <meshStandardMaterial color="#22242b" roughness={0.5} metalness={0.85} />
      </mesh>

      {/* Dark Steel U-Frame Front Vertical Drop */}
      <mesh position={[0.098, 0.02, 0]}>
        <boxGeometry args={[0.008, 0.05, 0.008]} />
        <meshStandardMaterial color="#22242b" roughness={0.5} metalness={0.85} />
      </mesh>

      {/* Thin Silver Cutting Blade (Bottom edge) */}
      <mesh position={[0.015, -0.004, 0]}>
        <boxGeometry args={[0.17, 0.004, 0.003]} />
        <meshStandardMaterial color="#b0b5c2" roughness={0.25} metalness={0.95} />
      </mesh>

      {/* Blade Tension Screws / Pins */}
      <mesh position={[-0.065, -0.004, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.008, 12]} />
        <meshStandardMaterial color="#888c98" roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0.098, -0.004, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.008, 12]} />
        <meshStandardMaterial color="#888c98" roughness={0.3} metalness={0.9} />
      </mesh>
    </group>
  );
}

/**
 * 6. BURNER PHONE MESH
 * Compact dark old-school flip phone with perfect hinge alignment:
 * - Lower Body Half (Keypad Base)
 * - Hinge Joint Pivot at top axis
 * - Upper Lid Half (Screen) matching keypad base dimensions when closed
 */
export function BurnerPhoneMesh({ hingeAngle = 0 }: { hingeAngle?: number }) {
  return (
    <group scale={[1, 1, 1]}>
      {/* Lower Keypad Base (Z from -0.024 to +0.024) */}
      <mesh position={[0, 0.007, 0]}>
        <boxGeometry args={[0.046, 0.014, 0.048]} />
        <meshStandardMaterial color="#16171d" roughness={0.6} metalness={0.7} />
      </mesh>
      {/* Lower Base Rounded Bottom Edge (at Z = +0.024) */}
      <mesh position={[0, 0.007, 0.024]}>
        <cylinderGeometry args={[0.023, 0.023, 0.014, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#16171d" roughness={0.6} metalness={0.7} />
      </mesh>
      {/* Keypad Buttons Surface */}
      <mesh position={[0, 0.0145, 0.002]}>
        <boxGeometry args={[0.038, 0.002, 0.040]} />
        <meshStandardMaterial color="#2d303b" roughness={0.4} metalness={0.8} />
      </mesh>

      {/* Hinge Joint Pivot at Z = -0.024 (Exact top edge axis) */}
      <group position={[0, 0.014, -0.024]} rotation={[hingeAngle, 0, 0]}>
        {/* Upper Screen Lid (extends forward from hinge along +Z when closed) */}
        <mesh position={[0, 0.006, 0.024]}>
          <boxGeometry args={[0.046, 0.012, 0.048]} />
          <meshStandardMaterial color="#111217" roughness={0.5} metalness={0.8} />
        </mesh>
        {/* Upper Lid Rounded Bottom Edge */}
        <mesh position={[0, 0.006, 0.048]}>
          <cylinderGeometry args={[0.023, 0.023, 0.012, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#111217" roughness={0.5} metalness={0.8} />
        </mesh>
        {/* Screen Display Frame */}
        <mesh position={[0, 0.0125, 0.022]}>
          <planeGeometry args={[0.036, 0.036]} />
          <meshStandardMaterial color="#070a0d" roughness={0.1} metalness={0.95} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * 4. INVERTER ELECTRICAL CONTROL BOX MESH
 * Compact worn industrial electrical polarity/inverter device:
 * - Dark charcoal/black rectangular metal casing with screws & wire channels
 * - Recessed central circular dial plate
 * - Physical central toggle/lever switch that can rotate/flip (toggleRotation prop)
 */
export function InverterMesh({ toggleRotation = 0 }: { toggleRotation?: number }) {
  return (
    <group scale={[1, 1, 1]}>
      {/* Main Outer Dark Metal Casing */}
      <mesh position={[0, 0.011, 0]}>
        <boxGeometry args={[0.085, 0.022, 0.11]} />
        <meshStandardMaterial color="#1c1e24" roughness={0.6} metalness={0.75} />
      </mesh>

      {/* Top Raised Frame Rim */}
      <mesh position={[0, 0.022, 0]}>
        <boxGeometry args={[0.087, 0.003, 0.112]} />
        <meshStandardMaterial color="#121318" roughness={0.8} metalness={0.5} />
      </mesh>

      {/* 4 Corner Bolts/Screws */}
      {[
        [-0.036, 0.048],
        [0.036, 0.048],
        [-0.036, -0.048],
        [0.036, -0.048]
      ].map(([x, z], idx) => (
        <mesh key={idx} position={[x, 0.023, z]}>
          <cylinderGeometry args={[0.0035, 0.0035, 0.004, 12]} />
          <meshStandardMaterial color="#7a7d8c" roughness={0.3} metalness={0.9} />
        </mesh>
      ))}

      {/* Side Wiring Details / Channels */}
      <mesh position={[-0.038, 0.023, 0]}>
        <boxGeometry args={[0.004, 0.004, 0.08]} />
        <meshStandardMaterial color="#0b0c0e" roughness={0.9} metalness={0.1} />
      </mesh>
      <mesh position={[0.038, 0.023, 0]}>
        <boxGeometry args={[0.004, 0.004, 0.08]} />
        <meshStandardMaterial color="#0b0c0e" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Recessed Dial Outer Ring */}
      <mesh position={[0, 0.023, 0]}>
        <cylinderGeometry args={[0.032, 0.032, 0.003, 32]} />
        <meshStandardMaterial color="#2d303a" roughness={0.4} metalness={0.8} />
      </mesh>

      {/* Aged Off-White Metallic Dial Plate (Matching Reference Image) */}
      <mesh position={[0, 0.0245, 0]}>
        <cylinderGeometry args={[0.029, 0.029, 0.003, 32]} />
        <meshStandardMaterial color="#cfc9b8" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Dial Degree Markings Motif (Subtle dark tick rings) */}
      <mesh position={[0, 0.0261, 0]}>
        <ringGeometry args={[0.024, 0.027, 24]} />
        <meshBasicMaterial color="#333333" side={THREE.DoubleSide} />
      </mesh>

      {/* Physical Central Toggle / Lever Switch (Animatable Node) */}
      <group position={[0, 0.026, 0]} rotation={[0, toggleRotation, 0]}>
        {/* Toggle Bar Base */}
        <mesh position={[0, 0.006, 0]}>
          <boxGeometry args={[0.044, 0.012, 0.012]} />
          <meshStandardMaterial color="#121419" roughness={0.5} metalness={0.8} />
        </mesh>
        {/* Toggle Top Raised Grip Handle */}
        <mesh position={[0, 0.014, 0]}>
          <boxGeometry args={[0.038, 0.007, 0.008]} />
          <meshStandardMaterial color="#282a33" roughness={0.6} metalness={0.7} />
        </mesh>
        {/* Central Pivot Nut */}
        <mesh position={[0, 0.018, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.004, 12]} />
          <meshStandardMaterial color="#888a99" roughness={0.2} metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * 5. BEER CAN MESH
 * Short dark brown drink container with metallic circular top lid & pull tab:
 * - Dark brown / reddish-brown cylindrical body
 * - Dented silver metallic top rim & lid
 * - Pull tab & opening details on top lid
 */
export function BeerCanMesh() {
  return (
    <group scale={[1, 1, 1]}>
      {/* Main Dark Brown Can Body */}
      <mesh position={[0, 0.057, 0]}>
        <cylinderGeometry args={[0.033, 0.032, 0.115, 24]} />
        <meshStandardMaterial color="#381d16" roughness={0.45} metalness={0.25} />
      </mesh>

      {/* Bottom Metal Rim */}
      <mesh position={[0, 0.002, 0]}>
        <cylinderGeometry args={[0.0325, 0.0325, 0.005, 24]} />
        <meshStandardMaterial color="#7a7e88" roughness={0.35} metalness={0.85} />
      </mesh>

      {/* Top Shoulder Taper */}
      <mesh position={[0, 0.114, 0]}>
        <cylinderGeometry args={[0.031, 0.033, 0.006, 24]} />
        <meshStandardMaterial color="#381d16" roughness={0.45} metalness={0.25} />
      </mesh>

      {/* Top Silver Metal Rim */}
      <mesh position={[0, 0.118, 0]}>
        <cylinderGeometry args={[0.033, 0.033, 0.005, 24]} />
        <meshStandardMaterial color="#9a9ea8" roughness={0.3} metalness={0.88} />
      </mesh>

      {/* Top Recessed Silver Metal Lid */}
      <mesh position={[0, 0.1195, 0]}>
        <cylinderGeometry args={[0.030, 0.030, 0.003, 24]} />
        <meshStandardMaterial color="#b0b4c0" roughness={0.25} metalness={0.92} />
      </mesh>

      {/* Pull Tab Detail on Top Lid */}
      <mesh position={[0, 0.1215, 0.007]}>
        <boxGeometry args={[0.01, 0.002, 0.016]} />
        <meshStandardMaterial color="#d0d4e0" roughness={0.2} metalness={0.95} />
      </mesh>

      {/* Can Mouth Opening Detail on Top Lid */}
      <mesh position={[0, 0.1211, -0.01]}>
        <cylinderGeometry args={[0.006, 0.006, 0.001, 12]} />
        <meshBasicMaterial color="#111215" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
