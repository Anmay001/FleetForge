import { create } from 'zustand';
import { AMR, Obstacle, SimulationEvent, WarehouseTask } from '../types/fleet';
import { initialFleet } from '../data/mockFleet';
import { initialTasks } from '../data/mockTasks';
import { OBSTACLES } from '../data/warehouseLayout';

interface FleetState {
  robots: AMR[];
  tasks: WarehouseTask[];
  events: SimulationEvent[];
  obstacles: Obstacle[];
  selectedRobotId: string | null;
  isRunning: boolean;
  isEmergencyStopped: boolean;
  simulationSpeed: 0.5 | 1 | 2 | 5;
  simulationStartedAt: number;
  coordinationStats: {
    totalAssignments: number;
    totalConflictsResolved: number;
    peakConcurrentRoutes: number;
  };

  selectRobot: (id: string | null) => void;
  setRunning: (v: boolean) => void;
  toggleEmergencyStop: () => void;
  setSpeed: (s: 0.5 | 1 | 2 | 5) => void;
  updateRobot: (id: string, patch: Partial<AMR>) => void;
  addEvent: (e: Omit<SimulationEvent, 'id' | 'timestamp'>) => void;
  addTask: (t: Omit<WarehouseTask, 'id' | 'createdAt'>) => void;
  addObstacle: (o: Omit<Obstacle, 'id'>) => void;
  resetSimulation: () => void;
}

export const useFleetStore = create<FleetState>((set) => ({
  robots: initialFleet,
  tasks: initialTasks,
  events: [],
  obstacles: OBSTACLES,
  selectedRobotId: 'AMR-01',
  isRunning: true,
  isEmergencyStopped: false,
  simulationSpeed: 1,
  simulationStartedAt: Date.now(),
  coordinationStats: {
    totalAssignments: 0,
    totalConflictsResolved: 0,
    peakConcurrentRoutes: 0,
  },

  selectRobot: (id) => set({ selectedRobotId: id }),
  setRunning: (v) => set({ isRunning: v }),
  toggleEmergencyStop: () => set((s) => ({ isEmergencyStopped: !s.isEmergencyStopped })),
  setSpeed: (s) => set({ simulationSpeed: s }),

  updateRobot: (id, patch) => set((s) => ({
    robots: s.robots.map(r => r.id === id ? { ...r, ...patch } : r)
  })),

  addEvent: (e) => set((s) => {
    const newEvent: SimulationEvent = {
      ...e,
      id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    const events = [newEvent, ...s.events].slice(0, 100);
    return { events };
  }),

  addTask: (t) => set((s) => {
    const newTask: WarehouseTask = {
      ...t,
      id: `TASK-${600 + s.tasks.length}`,
      createdAt: new Date().toISOString(),
    };
    return { tasks: [newTask, ...s.tasks] };
  }),

  addObstacle: (o) => set((s) => ({
    obstacles: [...s.obstacles, { ...o, id: `OBS-${Date.now()}` }]
  })),

  resetSimulation: () => set({
    robots: initialFleet,
    tasks: initialTasks,
    events: [],
    obstacles: OBSTACLES,
    selectedRobotId: 'AMR-01',
    isRunning: true,
    isEmergencyStopped: false,
    simulationSpeed: 1,
    simulationStartedAt: Date.now(),
    coordinationStats: {
      totalAssignments: 0,
      totalConflictsResolved: 0,
      peakConcurrentRoutes: 0,
    },
  }),
}));
