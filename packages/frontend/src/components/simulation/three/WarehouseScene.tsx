import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useThemeStore } from '../../../store/useThemeStore';
import { useFleetStore } from '../../../store/useFleetStore';
import { PALETTES, GRID_SIZE } from './constants';
import Lights from './Lights';
import WarehouseFloor from './WarehouseFloor';
import WarehouseRacks from './WarehouseRacks';
import Obstacles from './Obstacles';
import AMRs from './AMRs';

export interface WarehouseSceneProps {
  viewMode?: '3d' | 'top';
  follow?: boolean;
  resetKey?: number;
}

interface ControlsRef {
  target: THREE.Vector3;
  update: () => void;
}

export default function WarehouseScene({
  viewMode = '3d',
  follow = false,
  resetKey = 0,
}: WarehouseSceneProps) {
  const theme = useThemeStore((s) => s.theme);
  const palette = PALETTES[theme];

  const controlsRef = useRef<ControlsRef | null>(null);

  // Reset camera whenever resetKey changes
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.target.set(10, 0, 10);
    c.update();
  }, [resetKey]);

  // Default camera position depends on viewMode
  const cameraPos: [number, number, number] =
    viewMode === 'top' ? [10, 22, 10.01] : [16, 14, 16];

  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{ position: cameraPos, fov: viewMode === 'top' ? 40 : 42 }}
        style={{ background: palette.bg }}
      >
        <color attach="background" args={[palette.bg]} />
        <fog attach="fog" args={[palette.bg, 30, 60]} />
        <Lights palette={palette} />

        {/* Invisible click-to-deselect plane */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[GRID_SIZE / 2, -0.01, GRID_SIZE / 2]}
          onClick={() => useFleetStore.getState().selectRobot(null)}
        >
          <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
          <meshBasicMaterial visible={false} />
        </mesh>

        <WarehouseFloor palette={palette} />
        <WarehouseRacks palette={palette} />
        <Obstacles palette={palette} />
        <AMRs palette={palette} />

        <FollowerTarget
          controlsRef={controlsRef}
          follow={follow && viewMode === '3d'}
        />

        <OrbitControls
          ref={controlsRef as never}
          enabled={viewMode === '3d'}
          enablePan
          enableZoom
          enableRotate
          minDistance={8}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2.4}
          target={[10, 0, 10]}
          makeDefault
        />
      </Canvas>
    </div>
  );
}

/**
 * FollowerTarget runs inside the Canvas. Each frame, if `follow` is
 * true and a robot is selected, it eases the OrbitControls target
 * toward that robot's position. Otherwise it does nothing.
 *
 * We extract this into its own component so useFrame is called
 * legally (hooks rules).
 */
function FollowerTarget({
  controlsRef,
  follow,
}: {
  controlsRef: React.MutableRefObject<ControlsRef | null>;
  follow: boolean;
}) {
  // Local ref to avoid creating new Vector3 every frame
  const tmp = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!follow) return;
    const c = controlsRef.current;
    if (!c) return;

    const selectedId = useFleetStore.getState().selectedRobotId;
    if (!selectedId) return;

    const robot = useFleetStore
      .getState()
      .robots.find((r) => r.id === selectedId);
    if (!robot) return;

    tmp.current.set(robot.position.x, 0, robot.position.z);
    // Lerp for smooth trailing
    c.target.lerp(tmp.current, 0.08);
    c.update();
  });

  return null;
}
