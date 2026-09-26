import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useFleetStore } from '../../../store/useFleetStore';
import { ScenePalette } from './constants';
import { AMR } from '../../../types/fleet';
import {
  TONE_HEX, needsAttention, statusLabel, toneOfStatus,
} from '../../common/status';

export interface AMRsProps {
  palette: ScenePalette;
}

function EmergencyDot() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.3 + 0.7 * Math.abs(Math.sin(t * 3));
  });
  return (
    <mesh ref={ref} position={[0, 1.4, 0]}>
      <sphereGeometry args={[0.08, 12, 12]} />
      <meshBasicMaterial color={TONE_HEX.danger} transparent />
    </mesh>
  );
}

export default function AMRs({ palette }: AMRsProps) {
  const robots = useFleetStore((s) => s.robots);
  const selectedId = useFleetStore((s) => s.selectedRobotId);

  return (
    <group>
      {robots.map((robot) => {
        const isSelected = selectedId === robot.id;

        const dx = robot.targetPosition.x - robot.position.x;
        const dz = robot.targetPosition.z - robot.position.z;
        const hasDirection = Math.hypot(dx, dz) > 0.05;
        const angle = Math.atan2(dx, dz);

        return (
          <group
            key={robot.id}
            position={[robot.position.x, 0, robot.position.z]}
          >
            {/* Chassis */}
            <mesh position={[0, 0.2, 0]} castShadow>
              <boxGeometry args={[0.8, 0.4, 0.8]} />
              <meshStandardMaterial
                color={robot.color}
                roughness={0.4}
                metalness={0.3}
              />
            </mesh>

            {/* Wheels */}
            {[[0.4, 0.1, 0.28], [-0.4, 0.1, 0.28], [0.4, 0.1, -0.28], [-0.4, 0.1, -0.28]].map(
              ([wx, wy, wz], i) => (
                <mesh
                  key={`wheel-${i}`}
                  position={[wx, wy, wz]}
                  rotation={[0, 0, Math.PI / 2]}
                  castShadow
                >
                  <cylinderGeometry args={[0.1, 0.1, 0.08, 12]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.8} />
                </mesh>
              )
            )}

            {/* Direction cone */}
            {hasDirection && (
              <group position={[0, 0.4, 0.5]} rotation={[0, angle, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <coneGeometry args={[0.12, 0.2, 4]} />
                  <meshStandardMaterial color="#f8fafc" />
                </mesh>
              </group>
            )}

            {/* Payload */}
            {robot.payload !== null && (
              <mesh position={[0, 0.55, 0]} castShadow>
                <boxGeometry args={[0.5, 0.3, 0.5]} />
                <meshStandardMaterial color={palette.box} roughness={0.9} />
              </mesh>
            )}

            {/* Selection ring */}
            {isSelected && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[0.6, 0.75, 32]} />
                <meshBasicMaterial color={TONE_HEX.ok} transparent opacity={0.9} />
              </mesh>
            )}

            {/* Emergency indicator */}
            {robot.isEmergencyStopped && <EmergencyDot />}

            {/* Destination marker — selected unit only */}
            {isSelected && Math.hypot(dx, dz) > 0.1 && (
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[dx, 0.02, dz]}
              >
                <ringGeometry args={[0.34, 0.44, 32]} />
                <meshBasicMaterial
                  color={TONE_HEX.info}
                  transparent
                  opacity={0.95}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {/* Click hitbox */}
            <mesh
              position={[0, 0.2, 0]}
              onClick={(e) => {
                e.stopPropagation();
                useFleetStore.getState().selectRobot(robot.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'default';
              }}
            >
              <boxGeometry args={[1.0, 0.5, 1.0]} />
              <meshBasicMaterial visible={false} />
            </mesh>

            {/* Floating label */}
            <Html
              position={[0, 1.1, 0]}
              center
              distanceFactor={12}
              zIndexRange={[10, 0]}
              style={{ pointerEvents: 'none' }}
            >
              <RobotLabel robot={robot} isSelected={isSelected} />
            </Html>
          </group>
        );
      })}
    </group>
  );
}

/**
 * Label hierarchy — prominence follows operational need:
 * selected → solid chip with status; needs-attention → dark chip with a
 * tone-coloured status; everything else → unit id only.
 */
function RobotLabel({
  robot, isSelected,
}: { robot: AMR; isSelected: boolean }) {
  const attention = needsAttention(robot.status, robot.isEmergencyStopped);
  const tone = toneOfStatus(robot.status);
  const statusText = robot.isEmergencyStopped
    ? 'E-stop'
    : statusLabel(robot.status);

  const base = 'rounded px-2 py-1 whitespace-nowrap font-mono leading-none';

  if (isSelected) {
    return (
      <div className={`${base} flex items-center gap-1.5 text-[11px]
                        bg-emerald-500 text-white`}>
        <span className="font-semibold">{robot.id}</span>
        <span className="opacity-70">·</span>
        <span>{statusText}</span>
      </div>
    );
  }

  if (attention) {
    return (
      <div className={`${base} flex items-center gap-1.5 text-[11px]
                        bg-slate-900/90 border border-slate-700 text-white`}>
        <span className="font-semibold">{robot.id}</span>
        <span className="opacity-50">·</span>
        <span style={{ color: TONE_HEX[tone] }}>{statusText}</span>
      </div>
    );
  }

  if (robot.status === 'IDLE') {
    return (
      <div className={`${base} text-[10px] bg-slate-900/45 text-white/65
                        border border-slate-700/40`}>
        {robot.id}
      </div>
    );
  }

  return (
    <div className={`${base} text-[10px] bg-slate-900/85 text-white/90
                      border border-slate-700/60`}>
      {robot.id}
    </div>
  );
}
