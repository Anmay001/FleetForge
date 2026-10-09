import { useEffect } from 'react';
import { useFleetStore } from '../store/useFleetStore';
import { useThemeStore } from '../store/useThemeStore';

export interface ShortcutHandlers {
  onToggleHelp: () => void;
  onCloseHelp: () => void;
}

/**
 * Global keyboard shortcuts. Ignores keystrokes that occur while 
 * focus is inside an input, textarea, or contenteditable element.
 *
 * Shortcuts:
 *   Space      → toggle play/pause
 *   R          → reset simulation
 *   E          → toggle emergency stop
 *   1-5        → select robot AMR-01 through AMR-05
 *   T          → switch to Top view (when in simulation)
 *   3          → switch to 3D view (when in simulation) — not 
 *                currently wired, reserved
 *   D          → toggle dark/light theme
 *   ?          → open help overlay (Shift+/)
 *   Esc        → close help overlay
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const isTypingInInput = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return true;
      }
      if (target.isContentEditable) return true;
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;

      const store = useFleetStore.getState();
      const theme = useThemeStore.getState();

      switch (e.key) {
        case ' ': {
          e.preventDefault();
          store.setRunning(!store.isRunning);
          return;
        }

        case 'r':
        case 'R': {
          e.preventDefault();
          store.resetSimulation();
          return;
        }

        case 'e':
        case 'E': {
          e.preventDefault();
          store.toggleEmergencyStop();
          return;
        }

        case '1':
        case '2':
        case '3':
        case '4':
        case '5': {
          const numericId = `0${e.key}`;
          const robot = store.robots.find(
            (r) => r.numericId === numericId
          );
          if (robot) {
            e.preventDefault();
            store.selectRobot(robot.id);
          }
          return;
        }

        case 'd':
        case 'D': {
          e.preventDefault();
          theme.toggle();
          return;
        }

        case '?': {
          e.preventDefault();
          handlers.onToggleHelp();
          return;
        }

        case 'Escape': {
          handlers.onCloseHelp();
          return;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
