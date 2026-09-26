import { useMemo } from 'react';
import * as THREE from 'three';
import { Edges } from '@react-three/drei';
import {
  CHARGING_PADS, DROP_ZONES, LANES, WAYPOINTS,
} from '../../../data/warehouseLayout';
import { GRID_SIZE, ScenePalette } from './constants';

export interface WarehouseFloorProps {
  palette: ScenePalette;
}

export default function WarehouseFloor({ palette }: WarehouseFloorProps) {
  // Checkerboard tiles — subtle in light mode, subtle in dark
  const tiles = useMemo(() => {
    const arr: Array<{ x: number; z: number; alt: boolean }> = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        arr.push({ x: x + 0.5, z: z + 0.5, alt: (x + z) % 2 === 0 });
      }
    }
    return arr;
  }, []);

  // Lane segments as line geometry
  const laneGeometry = useMemo(() => {
    const points: number[] = [];
    // Vertical lanes (constant x, varying z)
    for (const x of LANES.x) {
      points.push(x, 0.02, 0);
      points.push(x, 0.02, GRID_SIZE);
    }
    // Horizontal lanes (constant z, varying x)
    for (const z of LANES.z) {
      points.push(0, 0.02, z);
      points.push(GRID_SIZE, 0.02, z);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(points, 3)
    );
    return geom;
  }, []);

  return (
    <group>
      {/* Checkerboard base */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[GRID_SIZE / 2, 0, GRID_SIZE / 2]}
        receiveShadow
      >
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshStandardMaterial
          color={palette.floor}
          roughness={0.95}
          metalness={0}
        />
      </mesh>

      {/* Alternate tile pattern — a very subtle offset plane per tile */}
      {tiles.map((t) => {
        if (!t.alt) return null;
        return (
          <mesh
            key={`${t.x}-${t.z}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[t.x, 0.005, t.z]}
          >
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial
              color={palette.floorAlt}
              roughness={0.95}
              metalness={0}
            />
          </mesh>
        );
      })}

      {/* Faint 1m grid — helps convey scale without noise */}
      <lineSegments position={[0, 0.01, 0]}>
        <edgesGeometry
          args={[new THREE.BoxGeometry(GRID_SIZE, 0.001, GRID_SIZE)]}
        />
        <lineBasicMaterial
          color={palette.gridLine}
          transparent
          opacity={0.15}
        />
      </lineSegments>

      {/* PROMINENT LANE GRID — yellow lines at LANES.x and LANES.z */}
      <lineSegments geometry={laneGeometry}>
        <lineBasicMaterial
          color={palette.laneLine}
          transparent
          opacity={0.9}
          linewidth={2}
        />
      </lineSegments>

      {/* Lane intersection markers — only where a waypoint exists */}
      {LANES.x.flatMap((x) =>
        LANES.z.filter((z) =>
          WAYPOINTS.some((w) =>
            Math.abs(w.x - x) < 0.1 && Math.abs(w.z - z) < 0.1
          )
        ).map((z) => (
          <mesh
            key={`dot-${x}-${z}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[x, 0.03, z]}
          >
            <circleGeometry args={[0.12, 12]} />
            <meshBasicMaterial
              color={palette.laneLine}
              transparent
              opacity={0.7}
            />
          </mesh>
        ))
      )}

      {/* Charging pads */}
      {CHARGING_PADS.map((pad) => (
        <group key={pad.id} position={[pad.x, 0.02, pad.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2, 2]} />
            <meshBasicMaterial
              color={palette.chargingPad}
              transparent
              opacity={0.35}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <planeGeometry args={[2, 2]} />
            <Edges
              color={palette.chargingBorder}
              threshold={15}
            />
          </mesh>
        </group>
      ))}

      {/* Drop zones */}
      {DROP_ZONES.map((zone) => (
        <group
          key={zone.id}
          position={[zone.x + zone.width / 2, 0.02,
                     zone.z + zone.depth / 2]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[zone.width, zone.depth]} />
            <meshBasicMaterial
              color={palette.dropZone}
              transparent
              opacity={0.18}
            />
          </mesh>
          {/* 4-box dashed border */}
          {[
            { pos: [0, 0, -zone.depth / 2] as const,
              size: [zone.width, 0.04] as const },
            { pos: [0, 0,  zone.depth / 2] as const,
              size: [zone.width, 0.04] as const },
            { pos: [-zone.width / 2, 0, 0] as const,
              size: [0.04, zone.depth] as const },
            { pos: [ zone.width / 2, 0, 0] as const,
              size: [0.04, zone.depth] as const },
          ].map((edge, i) => (
            <mesh
              key={i}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[edge.pos[0], 0.005, edge.pos[2]]}
            >
              <planeGeometry args={[edge.size[0], edge.size[1]]} />
              <meshBasicMaterial color={palette.dropZoneBorder} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
