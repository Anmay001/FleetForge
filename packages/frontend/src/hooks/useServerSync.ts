import { useEffect, useRef } from 'react';
import { useFleetStore } from '../store/useFleetStore';
import type { ServerMessage } from '@fleetforge/shared';
import {
  isServerModeEnabled,
  getApiBase,
  pushFleetSnapshot,
  appendEventsBulk,
} from '../lib/api';
import { WsClient, buildWsUrl } from '../lib/ws';

export function useServerSync(): void {
  const wsRef = useRef<WsClient | null>(null);
  const sentEventHashesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!isServerModeEnabled()) return;

    const wsUrl = buildWsUrl(getApiBase());
    if (!wsUrl) return;

    const onMessage = (msg: ServerMessage) => {
      const store = useFleetStore.getState();

      switch (msg.type) {
        case 'event:new': {
          const e = msg.event;
          const hash = `${e.robotId}|${e.type}|${e.message}`;

          const sentAt = sentEventHashesRef.current.get(hash);
          const now = Date.now();
          if (sentAt !== undefined && now - sentAt < 10_000) {
            return;
          }

          const recent = store.events.slice(0, 30);
          const duplicate = recent.some(
            (local) =>
              local.robotId === e.robotId &&
              local.message === e.message &&
              local.type === e.type
          );
          if (duplicate) return;

          store.addEvent({
            robotId: e.robotId,
            message: e.message,
            type: e.type,
          });
          return;
        }

        case 'task:update': {
          void msg.task;
          return;
        }

        case 'fleet:update':
        case 'command:result':
        case 'welcome':
        case 'subscribed':
        case 'unsubscribed':
        case 'pong':
        case 'error':
        default:
          return;
      }
    };

    const ws = new WsClient({
      url: wsUrl,
      topics: ['fleet', 'events', 'tasks', 'commands'],
      onMessage,
    });
    ws.connect();
    wsRef.current = ws;

    const pushOnce = async () => {
      const store = useFleetStore.getState();
      if (store.robots.length === 0) return;

      try {
        const payload = store.robots.map(function (amr) {
          return {
            id: amr.id,
            numericId: amr.numericId,
            color: amr.color,
            battery: amr.battery,
            status: amr.status,
            positionX: amr.position.x,
            positionZ: amr.position.z,
            targetX: amr.targetPosition.x,
            targetZ: amr.targetPosition.z,
            speed: amr.speed,
            distanceTravelled: amr.distanceTravelled,
            payload: amr.payload,
            currentTask: amr.currentTask,
            destination: amr.destination,
            isEmergencyStopped: amr.isEmergencyStopped,
          };
        });

        await pushFleetSnapshot(payload);
      } catch (err) {
        void err;
      }

      const currentEvents = useFleetStore.getState().events;
      if (currentEvents.length === 0) return;

      const boundaryIdx = -1;
      const newEvents =
        boundaryIdx === -1
          ? currentEvents.slice(0, 20)
          : currentEvents.slice(0, boundaryIdx);

      if (newEvents.length === 0) return;

      try {
        await appendEventsBulk(
          newEvents.map(function (e) {
            return {
              robotId: e.robotId,
              message: e.message,
              type: e.type,
            };
          })
        );
      } catch (err) {
        void err;
      }
    };

    const pushTimerRef = { current: null as number | null };
    pushTimerRef.current = window.setInterval(function () {
      pushOnce();
    }, 5000);

    return function () {
      ws.close();
    };
  }, []);
}