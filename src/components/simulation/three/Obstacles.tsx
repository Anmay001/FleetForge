import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFleetStore } from '../../../store/useFleetStore';
import { Obstacle } from '../../../types/fleet';
import { ScenePalette } from './constants';

export interface ObstaclesProps {
  palette: ScenePalette;
}

function ObstacleMarker({
  obstacle,
  palette,
}: {
  obstacle: Obstacle;
  palette: ScenePalette;
}) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const material = ringRef.current?.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      const t = state.clock.getElapsedTime();
      material.opacity = 0.4 + 0.25 * (1 + Math.sin(t * 3));
    }
  });

  return (
    <group>
      {/* Red cylinder body */}
      <mesh position={[obstacle.x, 0.4, obstacle.z]} castShadow>
        <cylinderGeometry args={[obstacle.radius * 0.5, obstacle.radius * 0.5, 0.8]} />
        <meshStandardMaterial
          color={palette.obstacle}
          roughness={0.5}
          metalness={0.1}
        />
      </mesh>

      {/* Pulsing ground ring */}
      <mesh
        ref={ringRef}
        rotation-x={-Math.PI / 2}
        position={[obstacle.x, 0.01, obstacle.z]}
      >
        <ringGeometry args={[obstacle.radius * 0.8, obstacle.radius * 1.0]} />
        <meshBasicMaterial
          color={palette.obstacle}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export default function Obstacles({ palette }: ObstaclesProps) {
  const obstacles = useFleetStore((s) => s.obstacles);

  return (
    <group>
      {obstacles.map((o) => (
        <ObstacleMarker key={o.id} obstacle={o} palette={palette} />
      ))}
    </group>
  );
}
