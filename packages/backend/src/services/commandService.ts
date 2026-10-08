import type { CommandResult, RobotCommand } from '@fleetforge/shared';
import { db } from '../db/index.js';
import { robots, events } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Apply a command to the database and log an audit event.
 * All operations happen inside a single transaction — either the
 * command applies completely or not at all.
 */
export function dispatchCommand(
  command: RobotCommand
): CommandResult {
  const timestamp = new Date();

  return db.transaction((tx) => {
    switch (command.command) {
      case 'STOP': {
        const robot = tx
          .select()
          .from(robots)
          .where(eq(robots.id, command.robotId))
          .get();
        if (!robot) {
          return {
            accepted: false,
            robotId: command.robotId,
            command: 'STOP',
            message: `Robot ${command.robotId} not found`,
          };
        }
        tx.update(robots)
          .set({
            speed: 0,
            status: 'IDLE',
            destination: 'IDLE',
            updatedAt: timestamp,
          })
          .where(eq(robots.id, command.robotId))
          .run();
        tx.insert(events)
          .values({
            robotId: command.robotId,
            message: `${command.robotId} stopped by operator`,
            type: 'WARN',
            createdAt: timestamp,
          })
          .run();
        return {
          accepted: true,
          robotId: command.robotId,
          command: 'STOP',
          message: 'Robot stopped',
        };
      }

      case 'PAUSE': {
        const robot = tx
          .select()
          .from(robots)
          .where(eq(robots.id, command.robotId))
          .get();
        if (!robot) {
          return {
            accepted: false,
            robotId: command.robotId,
            command: 'PAUSE',
            message: `Robot ${command.robotId} not found`,
          };
        }
        tx.update(robots)
          .set({
            speed: 0,
            status: 'WAITING',
            updatedAt: timestamp,
          })
          .where(eq(robots.id, command.robotId))
          .run();
        tx.insert(events)
          .values({
            robotId: command.robotId,
            message: `${command.robotId} paused by operator`,
            type: 'INFO',
            createdAt: timestamp,
          })
          .run();
        return {
          accepted: true,
          robotId: command.robotId,
          command: 'PAUSE',
          message: 'Robot paused',
        };
      }

      case 'RESUME': {
        const robot = tx
          .select()
          .from(robots)
          .where(eq(robots.id, command.robotId))
          .get();
        if (!robot) {
          return {
            accepted: false,
            robotId: command.robotId,
            command: 'RESUME',
            message: `Robot ${command.robotId} not found`,
          };
        }
        tx.update(robots)
          .set({
            status: 'IDLE',
            isEmergencyStopped: false,
            updatedAt: timestamp,
          })
          .where(eq(robots.id, command.robotId))
          .run();
        tx.insert(events)
          .values({
            robotId: command.robotId,
            message: `${command.robotId} resumed by operator`,
            type: 'SUCCESS',
            createdAt: timestamp,
          })
          .run();
        return {
          accepted: true,
          robotId: command.robotId,
          command: 'RESUME',
          message: 'Robot resumed',
        };
      }

      case 'CHARGE': {
        const robot = tx
          .select()
          .from(robots)
          .where(eq(robots.id, command.robotId))
          .get();
        if (!robot) {
          return {
            accepted: false,
            robotId: command.robotId,
            command: 'CHARGE',
            message: `Robot ${command.robotId} not found`,
          };
        }
        tx.update(robots)
          .set({
            status: 'GOING_TO_CHARGE',
            destination: 'CHARGE-01',
            updatedAt: timestamp,
          })
          .where(eq(robots.id, command.robotId))
          .run();
        tx.insert(events)
          .values({
            robotId: command.robotId,
            message: `${command.robotId} routed to charge by operator`,
            type: 'INFO',
            createdAt: timestamp,
          })
          .run();
        return {
          accepted: true,
          robotId: command.robotId,
          command: 'CHARGE',
          message: 'Robot routed to charging station',
        };
      }

      case 'REROUTE': {
        const robot = tx
          .select()
          .from(robots)
          .where(eq(robots.id, command.robotId))
          .get();
        if (!robot) {
          return {
            accepted: false,
            robotId: command.robotId,
            command: 'REROUTE',
            message: `Robot ${command.robotId} not found`,
          };
        }
        tx.update(robots)
          .set({
            destination: 'REROUTING',
            status: 'MOVING_TO_PICKUP',
            updatedAt: timestamp,
          })
          .where(eq(robots.id, command.robotId))
          .run();
        tx.insert(events)
          .values({
            robotId: command.robotId,
            message: `${command.robotId} rerouted by operator`,
            type: 'WARN',
            createdAt: timestamp,
          })
          .run();
        return {
          accepted: true,
          robotId: command.robotId,
          command: 'REROUTE',
          message: 'Robot rerouting',
        };
      }

      case 'EMERGENCY_STOP': {
        const allRobots = tx.select().from(robots).all();
        tx.update(robots)
          .set({
            isEmergencyStopped: true,
            speed: 0,
            updatedAt: timestamp,
          })
          .run();
        for (const robot of allRobots) {
          tx.insert(events)
            .values({
              robotId: robot.id,
              message: `${robot.id} emergency stopped`,
              type: 'DANGER',
              createdAt: timestamp,
            })
            .run();
        }
        return {
          accepted: true,
          robotId: null,
          command: 'EMERGENCY_STOP',
          message: `Emergency stop applied to ${allRobots.length} robots`,
        };
      }

      case 'CLEAR_EMERGENCY': {
        const allRobots = tx.select().from(robots).all();
        tx.update(robots)
          .set({
            isEmergencyStopped: false,
            status: 'IDLE',
            speed: 0,
            updatedAt: timestamp,
          })
          .run();
        for (const robot of allRobots) {
          tx.insert(events)
            .values({
              robotId: robot.id,
              message: `${robot.id} cleared from emergency`,
              type: 'SUCCESS',
              createdAt: timestamp,
            })
            .run();
        }
        return {
          accepted: true,
          robotId: null,
          command: 'CLEAR_EMERGENCY',
          message: `Emergency cleared for ${allRobots.length} robots`,
        };
      }
    }
  });
}