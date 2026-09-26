import { useMemo } from 'react';
import * as THREE from 'three';
import { RACKS } from '../../../data/warehouseLayout';
import { ScenePalette } from './constants';

export interface WarehouseRacksProps {
  palette: ScenePalette;
}

const SHELF_HEIGHTS = [0.5, 1.0, 1.5, 2.0];

function seededRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

interface BoxSpec {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

function buildBoxes(width: number, depth: number, rackIndex: number, shelfY: number): BoxSpec[] {
  const out: BoxSpec[] = [];
  SHELF_HEIGHTS.forEach((height, level) => {
    if (height !== shelfY) return;
    if (seededRand(rackIndex * 10 + level) > 0.6) return;

    const count = seededRand(rackIndex * 17 + level * 3) > 0.5 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const seed = rackIndex * 31 + level * 7 + i * 13;
      const jitterX = (seededRand(seed) - 0.5) * 0.1;
      const jitterZ = (seededRand(seed + 1) - 0.5) * 0.1;
      out.push({
        x: (i === 0 ? -0.35 : 0.35) + jitterX + (width - 2) / 2,
        y: height + 0.065 + 0.05 + 0.25,
        z: jitterZ + (depth - 4) / 2,
        rotY: (seededRand(seed + 2) - 0.5) * 0.4,
      });
    }
  });
  return out;
}

export default function WarehouseRacks({ palette }: WarehouseRacksProps) {
  const metal = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.rackMetal,
        roughness: 0.6,
        metalness: 0.15,
      }),
    [palette.rackMetal]
  );
  const shelf = useMemo(
    () => new THREE.MeshStandardMaterial({ color: palette.rackMetal, roughness: 0.7, metalness: 0.1 }),
    [palette.rackMetal]
  );
  const wood = useMemo(
    () => new THREE.MeshStandardMaterial({ color: palette.rackWood, roughness: 0.85, metalness: 0 }),
    [palette.rackWood]
  );
  const cardboard = useMemo(
    () => new THREE.MeshStandardMaterial({ color: palette.box, roughness: 0.9, metalness: 0 }),
    [palette.box]
  );

  return (
    <group>
      {RACKS.map((rack, rackIndex) => {
        const cx = rack.x + rack.width / 2;
        const cz = rack.z + rack.depth / 2;
        const hw = rack.width / 2;
        const hd = rack.depth / 2;

        return (
          <group key={rack.id} position={[cx, 0, cz]}>
            {/* Four vertical corner posts */}
            {[[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].map(([px, pz], i) => (
              <mesh key={`post-${i}`} position={[px, 1, pz]} castShadow material={metal}>
                <boxGeometry args={[0.1, 2, 0.1]} />
              </mesh>
            ))}

            {SHELF_HEIGHTS.map((y, level) => (
              <group key={`shelf-${level}`}>
                {/* Shelf surface */}
                <mesh position={[0, y, 0]} castShadow material={shelf}>
                  <boxGeometry args={[rack.width, 0.03, rack.depth]} />
                </mesh>

                {/* Front + back beams */}
                <mesh position={[0, y + 0.05, -hd]} castShadow material={metal}>
                  <boxGeometry args={[rack.width, 0.08, 0.08]} />
                </mesh>
                <mesh position={[0, y + 0.05, hd]} castShadow material={metal}>
                  <boxGeometry args={[rack.width, 0.08, 0.08]} />
                </mesh>

                {/* Wooden pallet */}
                <mesh position={[0, y + 0.065, 0]} castShadow material={wood}>
                  <boxGeometry args={[1.8, 0.1, 3.6]} />
                </mesh>

                {/* Cardboard boxes — deterministic, ~60% of shelves */}
                {buildBoxes(rack.width, rack.depth, rackIndex, y).map((b, bi) => (
                  <mesh
                    key={`box-${level}-${bi}`}
                    position={[b.x, b.y, b.z]}
                    rotation-y={b.rotY}
                    castShadow
                    material={cardboard}
                  >
                    <boxGeometry args={[0.5, 0.5, 0.5]} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}
