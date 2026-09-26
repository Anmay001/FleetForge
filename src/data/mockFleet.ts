import { AMR } from '../types/fleet';

export const initialFleet: AMR[] = [
  {
    id: 'AMR-01', numericId: '01', color: '#f97316',
    position: { x: 2, y: 0, z: 2 },
    targetPosition: { x: 2, y: 0, z: 2 },
    battery: 92, status: 'IDLE', speed: 0, distanceTravelled: 0,
    currentTask: null, destination: 'CHARGE-01',
    payload: null, isEmergencyStopped: false,
  },
  {
    id: 'AMR-02', numericId: '02', color: '#3b82f6',
    position: { x: 6, y: 0, z: 2 },
    targetPosition: { x: 6, y: 0, z: 2 },
    battery: 78, status: 'IDLE', speed: 0, distanceTravelled: 0,
    currentTask: null, destination: 'CHARGE-01',
    payload: null, isEmergencyStopped: false,
  },
  {
    id: 'AMR-03', numericId: '03', color: '#a855f7',
    position: { x: 2, y: 0, z: 18 },
    targetPosition: { x: 2, y: 0, z: 18 },
    battery: 85, status: 'IDLE', speed: 0, distanceTravelled: 0,
    currentTask: null, destination: 'CHARGE-02',
    payload: null, isEmergencyStopped: false,
  },
  {
    id: 'AMR-04', numericId: '04', color: '#10b981',
    position: { x: 6, y: 0, z: 18 },
    targetPosition: { x: 6, y: 0, z: 18 },
    battery: 64, status: 'IDLE', speed: 0, distanceTravelled: 0,
    currentTask: null, destination: 'CHARGE-02',
    payload: null, isEmergencyStopped: false,
  },
  {
    id: 'AMR-05', numericId: '05', color: '#eab308',
    position: { x: 2, y: 0, z: 14 },
    targetPosition: { x: 2, y: 0, z: 14 },
    battery: 100, status: 'IDLE', speed: 0, distanceTravelled: 0,
    currentTask: null, destination: 'CHARGE-02',
    payload: null, isEmergencyStopped: false,
  },
];
