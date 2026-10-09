import { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { chargerRegistry, CHARGING_PADS } from '@fleetforge/shared';
import type { ChargerState } from '@fleetforge/shared';
import type { ScenePalette } from './constants';

export interface ChargerPadsProps {
  palette: ScenePalette;
}

const POLL_INTERVAL_MS = 100;

/**
 * Poll the charger registry at a fixed rate. Returns the latest 
 * snapshot. Charger state lives in a singleton, not the Zustand 
 * store, so we poll instead of subscribing.
 */
function useChargerState(): ChargerState[] {
  const [state, setState] = useState<ChargerState[]>(() =>
    chargerRegistry.snapshot()
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setState(chargerRegistry.snapshot());
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return state;
}

export default function ChargerPads({ palette }: ChargerPadsProps) {
  const chargers = useChargerState();

  return (
    <group>
      {chargers.map((c) => {
        const pad = CHARGING_PADS.find((p) => p.id === c.id);
        if (!pad) return null;
        return (
          <ChargerPad
            key={c.id}
            state={c}
            x={pad.x}
            z={pad.z}
            palette={palette}
          />
        );
      })}
    </group>
  );
}

interface ChargerPadProps {
  state: ChargerState;
  x: number;
  z: number;
  palette: ScenePalette;
}

function ChargerPad({ state, x, z, palette }: ChargerPadProps) {
  const ringRef = useRef<THREE.Mesh>(null);

  // Determine visual mode
  const isFree = state.occupiedBy === null;
  const isCharging = state.charging;
  const isReserved = !isFree && !isCharging;
  const isQueued = isReserved && state.occupiedBy !== null;

  // Pad color: brighter when charging, dimmer when free
  const padColor = isCharging
    ? palette.chargingBorder
    : isReserved
      ? '#f59e0b'    // amber when reserved
      : palette.chargingPad;

  const padOpacity = isCharging ? 0.55 : isFree ? 0.25 : 0.35;

  // Outer ring color: amber when reserved, cyan when charging, 
  // invisible when free
  const ringColor = isCharging ? palette.chargingBorder : '#f59e0b';
  const showRing = !isFree;

  // Animate the ring on frame
  useFrame((frameState) => {
    if (!ringRef.current) return;
    const t = frameState.clock.getElapsedTime();
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    if (isCharging) {
      // Fast, bright pulse
      mat.opacity = 0.55 + 0.35 * Math.abs(Math.sin(t * 3));
    } else if (isReserved) {
      // Slow, steady warning pulse
      mat.opacity = 0.35 + 0.25 * Math.abs(Math.sin(t * 1.5));
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* Pad surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial
          color={padColor}
          transparent
          opacity={padOpacity}
        />
      </mesh>

      {/* Border outline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[0.98, 1.0, 4, 1]} />
        <meshBasicMaterial color={padColor} side={THREE.DoubleSide} />
      </mesh>

      {/* Status ring (visible only when occupied) */}
      {showRing && (
        <mesh
          ref={ringRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.03, 0]}
        >
          <ringGeometry args={[1.05, 1.15, 32]} />
          <meshBasicMaterial
            color={ringColor}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Charging indicator: small central disc glows brightly */}
      {isCharging && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <circleGeometry args={[0.35, 24]} />
          <meshBasicMaterial
            color={palette.chargingBorder}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      {/* Charger ID label — always visible, small */}
      <Html
        position={[0, 0.15, 0.9]}
        center
        distanceFactor={14}
        zIndexRange={[5, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className="font-mono text-[9px] text-cyan-300 
                        bg-slate-900/70 px-1.5 py-0.5 rounded 
                        whitespace-nowrap">
          {state.id}
        </div>
      </Html>

      {/* QUEUED badge — only when a robot is en route */}
      {isQueued && (
        <Html
          position={[0, 1.4, 0]}
          center
          distanceFactor={12}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="font-mono text-[10px] text-amber-300 
                          bg-amber-900/80 border border-amber-500/60 
                          px-2 py-0.5 rounded-full whitespace-nowrap 
                          animate-pulse">
            QUEUED
          </div>
        </Html>
      )}

      {/* Charging badge — when a robot is actively charging */}
      {isCharging && state.occupiedBy && (
        <Html
          position={[0, 1.4, 0]}
          center
          distanceFactor={12}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="font-mono text-[10px] text-cyan-200 
                          bg-cyan-900/80 border border-cyan-400/60 
                          px-2 py-0.5 rounded-full whitespace-nowrap">
            {state.occupiedBy} CHARGING
          </div>
        </Html>
      )}
    </group>
  );
}
