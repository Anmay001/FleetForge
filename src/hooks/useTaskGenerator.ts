import { useEffect } from 'react';
import { useFleetStore } from '../store/useFleetStore';
import { WAYPOINTS, DROP_ZONES } from '../data/warehouseLayout';

const MIN_INTERVAL_MS = 10_000;
const MAX_INTERVAL_MS = 30_000;
const MAX_ACTIVE_TASKS = 20;

const PICKUP_NODES = WAYPOINTS
  .filter((w) => w.id.startsWith('RACK-'))
  .map((w) => w.id);

function randomBoxId(): string {
  const n = 200 + Math.floor(Math.random() * 800);
  return `BOX-D${n}`;
}

function randomPickup(): string {
  return PICKUP_NODES[Math.floor(Math.random() * PICKUP_NODES.length)];
}

function randomDrop(): string {
  return DROP_ZONES[Math.floor(Math.random() * DROP_ZONES.length)].id;
}

function randomRobotId(): string {
  const robots = useFleetStore.getState().robots;
  if (robots.length === 0) return 'AMR-01';
  return robots[Math.floor(Math.random() * robots.length)].id;
}

export function useTaskGenerator(): void {
  useEffect(() => {
    let cancelled = false;
    let timerId: number | null = null;

    const scheduleNext = () => {
      const delay =
        MIN_INTERVAL_MS +
        Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
      timerId = window.setTimeout(() => {
        if (cancelled) return;

        const store = useFleetStore.getState();
        const activeCount = store.tasks.filter(
          (t) => t.status !== 'COMPLETED'
        ).length;

        if (activeCount < MAX_ACTIVE_TASKS && store.isRunning) {
          const boxId = randomBoxId();
          const pickupNode = randomPickup();
          const dropLocation = randomDrop();
          const assignedRobotId = randomRobotId();

          store.addTask({
            boxId,
            pickupNode,
            dropLocation,
            assignedRobotId,
            status: 'QUEUED',
          });

          store.addEvent({
            robotId: assignedRobotId,
            message: `Task auto-generated for ${boxId} → ${dropLocation}`,
            type: 'INFO',
          });
        }

        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, []);
}
