import { useMemo } from 'react';
import * as THREE from 'three';
import { RACKS } from '@fleetforge/shared';
import { useFleetStore } from '../../../store/useFleetStore';
import type { ScenePalette } from './constants';

export interface WarehouseRacksProps {
  palette: ScenePalette;
}

const SHELF_HEIGHTS = [0.4, 0.8, 1.2, 1.6];

/**
 * Deterministic pseudo-random from an integer seed. Same seed → same 
 * result across renders. Used for stable box placement and rotation.
 */
function seededRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

interface BoxSpec {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  width: number;
  height: number;
  depth: number;
}

/**
 * Build the list of shelf boxes for one rack. Deterministic — no 
 * shuffling between renders.
 *
 * Placement rules:
 *  - Each shelf may have 0, 1, or 2 boxes
 *  - If 2 boxes: they occupy the left and right halves of the shelf 
 *    (offset ±0.3 along local X)
 *  - If 1 box: randomly left or right
 *  - A small deterministic jitter (±0.04) prevents every box from 
 *    sitting at exactly the same coordinates
 *  - Boxes are ALWAYS centered on the shelf's local Z (no offset)
 */
function buildShelfBoxes(rackIndex: number): BoxSpec[] {
  const out: BoxSpec[] = [];

  SHELF_HEIGHTS.forEach((shelfY, level) => {
    // 40% of shelves are empty
    const occupancySeed = rackIndex * 100 + level * 17;
    if (seededRand(occupancySeed) < 0.4) return;

    // 1 or 2 boxes on this shelf?
    const countSeed = rackIndex * 200 + level * 31;
    const count = seededRand(countSeed) > 0.55 ? 2 : 1;

    // If 1 box, decide which side
    const sideSeed = rackIndex * 300 + level * 47;
    const singleOnRight = seededRand(sideSeed) > 0.5;

    // Small jitter per box (deterministic)
    for (let i = 0; i < count; i++) {
      const jitterSeedX = rackIndex * 1000 + level * 100 + i * 11;
      const jitterSeedZ = rackIndex * 1000 + level * 100 + i * 13;
      const jitterSeedR = rackIndex * 1000 + level * 100 + i * 17;

      const jitterX = (seededRand(jitterSeedX) - 0.5) * 0.08;
      const jitterZ = (seededRand(jitterSeedZ) - 0.5) * 0.08;
      const rotY = (seededRand(jitterSeedR) - 0.5) * 0.5;

      // Position along local X: -0.3 (left) or +0.3 (right)
      let localX: number;
      if (count === 2) {
        localX = i === 0 ? -0.3 : 0.3;
      } else {
        localX = singleOnRight ? 0.3 : -0.3;
      }

      out.push({
        id: `rack-${rackIndex}-shelf-${level}-box-${i}`,
        x: localX + jitterX,
        // Box bottom sits on the shelf surface + half-height
        y: shelfY + 0.15,
        // Centered on the shelf's local Z
        z: jitterZ,
        rotY,
        width: 0.38,
        height: 0.22,
        depth: 0.38,
      });
    }
  });

  return out;
}

export default function WarehouseRacks({ palette }: WarehouseRacksProps) {
  // AMRs with an active payload — used to hide the shelf box they 
  // visually "picked up"
  const carriers = useFleetStore((s) =>
    s.robots.filter((r) => r.payload !== null)
  );

  // Precompute box layouts once per rack — deterministic, no re-shuffle
  const rackBoxes = useMemo(
    () => RACKS.map((_, i) => buildShelfBoxes(i)),
    []
  );

  // Compute world positions of every box, then which are hidden by 
  // an overlapping carrying AMR
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    if (carriers.length === 0) return hidden;

    for (let r = 0; r < RACKS.length; r++) {
      const rack = RACKS[r];
      const centerX = rack.x + rack.width / 2;
      const centerZ = rack.z + rack.depth / 2;

      for (const box of rackBoxes[r]) {
        const wx = centerX + box.x;
        const wz = centerZ + box.z;

        for (const amr of carriers) {
          const dx = amr.position.x - wx;
          const dz = amr.position.z - wz;
          if (Math.hypot(dx, dz) < 0.7) {
            hidden.add(box.id);
            break;
          }
        }
      }
    }
    return hidden;
  }, [carriers, rackBoxes]);

  // Shared materials
  const metalMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.rackMetal,
        roughness: 0.6,
        metalness: 0.15,
      }),
    [palette.rackMetal]
  );

  const shelfMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.rackWood,
        roughness: 0.85,
        metalness: 0.0,
      }),
    [palette.rackWood]
  );

  const boxMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.box,
        roughness: 0.9,
        metalness: 0.0,
      }),
    [palette.box]
  );

  return (
    <group>
      {RACKS.map((rack, rackIndex) => {
        const cx = rack.x + rack.width / 2;
        const cz = rack.z + rack.depth / 2;
        const hw = rack.width / 2;
        const hd = rack.depth / 2;

        // Corner posts
        const posts: Array<[number, number]> = [
          [-hw, -hd],
          [hw, -hd],
          [-hw, hd],
          [hw, hd],
        ];

        return (
          <group key={rack.id} position={[cx, 0, cz]}>
            {/* Corner posts */}
            {posts.map(([px, pz], i) => (
              <mesh
                key={`post-${i}`}
                position={[px, 1, pz]}
                castShadow
                material={metalMaterial}
              >
                <boxGeometry args={[0.08, 2, 0.08]} />
              </mesh>
            ))}

            {/* Shelves + pallets + boxes */}
            {SHELF_HEIGHTS.map((y, level) => (
              <group key={`shelf-${level}`}>
                {/* Shelf surface */}
                <mesh
                  position={[0, y, 0]}
                  castShadow
                  material={shelfMaterial}
                >
                  <boxGeometry
                    args={[rack.width - 0.1, 0.03, rack.depth - 0.1]}
                  />
                </mesh>

                {/* Pallet on the shelf */}
                <mesh
                  position={[0, y + 0.045, 0]}
                  castShadow
                  material={shelfMaterial}
                >
                  <boxGeometry args={[1.6, 0.06, 1.6]} />
                </mesh>
              </group>
            ))}

            {/* Boxes on shelves — hidden if "picked up" */}
            {rackBoxes[rackIndex].map((box) => {
              if (hiddenIds.has(box.id)) return null;
              return (
                <mesh
                  key={box.id}
                  position={[box.x, box.y, box.z]}
                  rotation={[0, box.rotY, 0]}
                  castShadow
                  material={boxMaterial}
                >
                  <boxGeometry
                    args={[box.width, box.height, box.depth]}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
