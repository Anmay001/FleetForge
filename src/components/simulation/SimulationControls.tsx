import { useState } from 'react';
import { Play, Pause, RotateCcw, Plus, Maximize, Map as MapIcon, Box, Crosshair } from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import { AMR, Obstacle } from '../../types/fleet';
import {
  LANES, RACKS, CHARGING_PADS, DROP_ZONES, isOnLane,
} from '../../data/warehouseLayout';
import { GRID_SIZE } from './three/constants';

/**
 * Cell centres derived from the lane grid — the same source of truth
 * used by the floor renderer and the path planner. A cell spans two
 * consecutive lane lines, so its centre is their midpoint.
 */
function laneCenters(lanes: number[]): number[] {
  const centers: number[] = [];
  for (let i = 0; i < lanes.length - 1; i++) {
    centers.push((lanes[i] + lanes[i + 1]) / 2);
  }
  return centers;
}

function insideRect(
  px: number, pz: number,
  x: number, z: number, w: number, d: number
): boolean {
  return px >= x && px <= x + w && pz >= z && pz <= z + d;
}

/**
 * Pick a walkable cell centre that is free of racks, lanes, charging
 * pads, drop zones, other obstacles and AMRs. Returns null when the
 * warehouse is full.
 */
function pickFreeCell(
  robots: AMR[],
  obstacles: Obstacle[]
): { x: number; z: number } | null {
  const xs = laneCenters(LANES.x);
  const zs = laneCenters(LANES.z);
  const free: Array<{ x: number; z: number }> = [];

  for (const x of xs) {
    for (const z of zs) {
      if (x < 0 || z < 0 || x > GRID_SIZE || z > GRID_SIZE) continue;
      if (isOnLane(x, z)) continue;
      if (RACKS.some((r) => insideRect(x, z, r.x, r.z, r.width, r.depth))) continue;
      if (CHARGING_PADS.some((p) => Math.hypot(p.x - x, p.z - z) < 1.5)) continue;
      if (DROP_ZONES.some((d) => insideRect(x, z, d.x, d.z, d.width, d.depth))) continue;
      if (obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < 1.5)) continue;
      if (robots.some((r) => Math.hypot(r.position.x - x, r.position.z - z) < 1.5)) continue;

      free.push({ x, z });
    }
  }

  if (free.length === 0) return null;
  return free[Math.floor(Math.random() * free.length)];
}

function GroupDivider() {
  return (
    <span className="w-px h-5 bg-slate-200 dark:bg-slate-700
                     flex-shrink-0 hidden sm:block" />
  );
}

export interface SimulationControlsProps {
  onNewTask: () => void;
  onViewModeChange: (mode: '3d' | 'top') => void;
  onFollowChange: (follow: boolean) => void;
  onResetCamera: () => void;
}

export default function SimulationControls({
  onNewTask,
  onViewModeChange,
  onFollowChange,
  onResetCamera,
}: SimulationControlsProps) {
  const isRunning = useFleetStore((s) => s.isRunning);
  const setRunning = useFleetStore((s) => s.setRunning);
  const resetSimulation = useFleetStore((s) => s.resetSimulation);
  const addObstacle = useFleetStore((s) => s.addObstacle);
  const robots = useFleetStore((s) => s.robots);
  const obstacles = useFleetStore((s) => s.obstacles);

  const [viewMode, setViewMode] = useState<'3d' | 'top'>('3d');
  const [follow, setFollow] = useState(false);

  const handleAddObstacle = () => {
    const cell = pickFreeCell(robots, obstacles);
    if (!cell) return;
    addObstacle({ x: cell.x, z: cell.z, radius: 0.5 });
  };

  const handleViewMode = (mode: '3d' | 'top') => {
    setViewMode(mode);
    onViewModeChange(mode);
  };

  const handleFollow = (val: boolean) => {
    setFollow(val);
    onFollowChange(val);
  };

  return (
    <div className="ff-band min-h-10 px-3 sm:px-4 py-1.5
                    flex items-center gap-2 flex-wrap">

      {/* ---------- GROUP 1 · simulation state (primary + secondary) ---------- */}
      <button
        type="button"
        onClick={() => setRunning(!isRunning)}
        className={[
          'ff-control min-w-[86px]',
          isRunning ? 'ff-control-primary' : 'ff-control-neutral',
        ].join(' ')}
      >
        {isRunning ? <Pause size={13} /> : <Play size={13} />}
        {isRunning ? 'Pause' : 'Resume'}
      </button>

      <button
        type="button"
        onClick={() => resetSimulation()}
        className="ff-control ff-control-quiet"
        title="Reset simulation"
      >
        <RotateCcw size={13} />
        Reset
      </button>

      <GroupDivider />

      {/* ---------- GROUP 2 · simulation actions (tertiary) ---------- */}
      <button
        type="button"
        onClick={onNewTask}
        className="ff-control ff-control-neutral"
      >
        <Plus size={13} />
        New task
      </button>

      <button
        type="button"
        onClick={handleAddObstacle}
        className="ff-control ff-control-warn"
        title="Place an obstacle in a free floor cell"
      >
        <Plus size={13} />
        Add obstacle
      </button>

      {/* ---------- GROUP 3 · view controls ---------- */}
      <div className="ml-auto flex items-center gap-2">
        <GroupDivider />

        <div className="ff-seg" role="group" aria-label="Camera view">
          <button
            type="button"
            onClick={() => handleViewMode('top')}
            className={[
              'ff-seg-item flex items-center gap-1.5',
              viewMode === 'top' ? 'ff-seg-item-active' : '',
            ].join(' ')}
          >
            <MapIcon size={12} />
            <span className="hidden sm:inline">Top</span>
          </button>
          <button
            type="button"
            onClick={() => handleViewMode('3d')}
            className={[
              'ff-seg-item flex items-center gap-1.5',
              viewMode === '3d' ? 'ff-seg-item-active' : '',
            ].join(' ')}
          >
            <Box size={12} />
            <span className="hidden sm:inline">3D</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleFollow(!follow)}
          aria-pressed={follow}
          className={[
            'ff-control',
            follow ? 'ff-control-primary' : 'ff-control-neutral',
          ].join(' ')}
          title="Keep the camera on the selected robot"
        >
          <Crosshair size={13} />
          <span className="hidden sm:inline">Follow</span>
        </button>

        <button
          type="button"
          onClick={onResetCamera}
          className="ff-icon-btn"
          title="Reset camera"
        >
          <RotateCcw size={14} />
        </button>

        <button
          type="button"
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              document.documentElement.requestFullscreen();
            }
          }}
          className="ff-icon-btn"
          title="Fullscreen"
        >
          <Maximize size={14} />
        </button>
      </div>
    </div>
  );
}
