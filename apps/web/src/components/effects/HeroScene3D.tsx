"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";

import { useMotionPaused } from "@/lib/motion-preference";
import {
  TETROMINO_CELLS,
  TETROMINO_COLORS,
  type TetrominoId,
} from "@/lib/tetromino";

interface FloatingPiece {
  readonly id: TetrominoId;
  readonly position: readonly [number, number, number];
  readonly scale: number;
  readonly speed: number;
  readonly phase: number;
}

/** Posiciones fijas, repartidas por los bordes para no tapar el texto. */
const PIECES: readonly FloatingPiece[] = [
  { id: "T", position: [-7.2, 3.2, -2], scale: 0.55, speed: 0.35, phase: 0 },
  { id: "L", position: [6.8, 3.6, -3], scale: 0.5, speed: 0.28, phase: 1.3 },
  { id: "I", position: [-5.8, -3.4, -1], scale: 0.5, speed: 0.4, phase: 2.1 },
  { id: "S", position: [7.4, -2.2, -2], scale: 0.6, speed: 0.3, phase: 0.7 },
  { id: "O", position: [0.5, 4.6, -5], scale: 0.7, speed: 0.22, phase: 3.2 },
  { id: "J", position: [3.6, -4.4, -4], scale: 0.55, speed: 0.33, phase: 4.4 },
  { id: "Z", position: [-2.6, -4.8, -3], scale: 0.45, speed: 0.38, phase: 5.1 },
];

function Piece({ piece }: { readonly piece: FloatingPiece }) {
  const group = useRef<Group>(null);
  const color = TETROMINO_COLORS[piece.id];
  const cells = TETROMINO_CELLS[piece.id];
  const offset = useMemo(() => {
    const cols = Math.max(...cells.map(([c]) => c)) + 1;
    const rows = Math.max(...cells.map(([, r]) => r)) + 1;
    return [cols / 2 - 0.5, rows / 2 - 0.5] as const;
  }, [cells]);

  useFrame(({ clock, pointer }) => {
    const node = group.current;
    if (!node) return;
    const t = clock.elapsedTime * piece.speed + piece.phase;
    node.rotation.x = Math.sin(t) * 0.6;
    node.rotation.y = t;
    node.position.y = piece.position[1] + Math.sin(t * 1.3) * 0.35;
    node.position.x = piece.position[0] + pointer.x * 0.4 * (piece.scale + 0.3);
  });

  return (
    <group
      ref={group}
      position={[...piece.position]}
      scale={piece.scale}
    >
      {cells.map(([c, r]) => (
        <mesh key={`${c}-${r}`} position={[c - offset[0], offset[1] - r, 0]}>
          <boxGeometry args={[0.92, 0.92, 0.92]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.35}
            metalness={0.3}
            roughness={0.25}
            transparent
            opacity={0.55}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Piezas de Tetris 3D flotando detrás del Hero. Se carga solo en pantallas grandes. */
export default function HeroScene3D() {
  const paused = useMotionPaused();

  return (
    <Canvas
      frameloop={paused ? "demand" : "always"}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 10], fov: 45 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} />
      <pointLight position={[-6, -2, 4]} intensity={18} color="#38bdf8" />
      {PIECES.map((piece) => (
        <Piece key={piece.id} piece={piece} />
      ))}
    </Canvas>
  );
}
