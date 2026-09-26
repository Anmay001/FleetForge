import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Boxes, Truck, ClipboardList, Zap, BarChart3, Settings
} from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import { routeRegistry } from '../../engine/routeRegistry';
import { WAYPOINT_GRAPH } from '../../engine/waypointGraph';
import { TONE_BG, TONE_TEXT } from './status';

export type View = 'dashboard' | 'simulation' | 'fleet' | 'tasks'
                  | 'events' | 'analytics' | 'settings';

export interface SidebarProps {
  activeView: View;
  onNavigate: (v: View) => void;
}

interface NavItem {
  id: View;
  label: string;
  Icon: typeof LayoutDashboard;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Monitoring',
    items: [
      { id: 'dashboard',  label: 'Dashboard',        Icon: LayoutDashboard },
      { id: 'simulation', label: '3D Simulation',    Icon: Boxes },
      { id: 'fleet',      label: 'Fleet Management', Icon: Truck },
      { id: 'tasks',      label: 'Task Management',  Icon: ClipboardList },
      { id: 'events',     label: 'Event Feed',       Icon: Zap },
      { id: 'analytics',  label: 'Analytics',        Icon: BarChart3 },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'settings',   label: 'Settings',         Icon: Settings },
    ],
  },
];

export default function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const isRunning = useFleetStore((s) => s.isRunning);
  const isEmergencyStopped = useFleetStore((s) => s.isEmergencyStopped);

  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1280px)').matches
      : true
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /* Live coordinator counters — polled, not simulated. */
  const [health, setHealth] = useState({ nodes: 0, locks: 0, reserved: 0 });

  useEffect(() => {
    const read = () => setHealth({
      nodes: Object.keys(WAYPOINT_GRAPH).length,
      locks: routeRegistry.lockCount(),
      reserved: routeRegistry.reservedSegments().size,
    });
    read();
    const id = window.setInterval(read, 1000);
    return () => window.clearInterval(id);
  }, []);

  const stateTone = isEmergencyStopped
    ? 'danger'
    : isRunning ? 'ok' : 'info';

  const stateLabel = isEmergencyStopped
    ? 'E-stop'
    : isRunning ? 'Running' : 'Paused';

  return (
    <aside className={[
      isWide ? 'w-60' : 'w-16',
      'bg-white dark:bg-slate-900',
      'border-r border-slate-200 dark:border-slate-800',
      'flex flex-col h-full flex-shrink-0 transition-[width] duration-200',
    ].join(' ')}>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            {isWide && (
              <div className="px-3 mb-1.5 ff-label">{group.label}</div>
            )}
            {group.items.map(({ id, label, Icon }) => {
              const isActive = id === activeView;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onNavigate(id)}
                  title={label}
                  className={[
                    'w-full h-9 flex items-center text-sm font-medium',
                    'text-left transition-colors border-l-2',
                    isWide
                      ? 'gap-3 px-3'
                      : 'px-0 justify-center',
                    isActive
                      ? 'bg-emerald-500/10 border-emerald-500 ' +
                        'text-emerald-700 dark:text-emerald-400'
                      : 'border-transparent ' +
                        'text-slate-600 hover:text-slate-900 ' +
                        'hover:bg-slate-100 ' +
                        'dark:text-slate-400 dark:hover:text-white ' +
                        'dark:hover:bg-slate-800/60',
                  ].join(' ')}
                >
                  <Icon size={17} className="flex-shrink-0" />
                  {isWide && <span className="truncate">{label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Live coordinator status — replaces the old static blurb */}
      {isWide ? (
        <div className="px-4 py-3 border-t border-slate-200
                        dark:border-slate-800">
          <div className="ff-label mb-2">Coordinator</div>

          <div className="flex items-center gap-2 mb-2.5">
            <span className={[
              'w-1.5 h-1.5 rounded-full',
              TONE_BG[stateTone],
              isRunning && !isEmergencyStopped ? 'animate-pulse' : '',
            ].join(' ')} />
            <span className={[
              'text-xs font-mono font-medium',
              TONE_TEXT[stateTone],
            ].join(' ')}>
              {stateLabel}
            </span>
          </div>

          <div className="space-y-1">
            <Counter label="Waypoints" value={health.nodes} />
            <Counter label="Locks" value={health.locks} />
            <Counter label="Reserved" value={health.reserved} />
          </div>
        </div>
      ) : (
        <div className="py-3 border-t border-slate-200
                        dark:border-slate-800 flex justify-center"
             title={`Coordinator: ${stateLabel}`}>
          <span className={[
            'w-1.5 h-1.5 rounded-full',
            TONE_BG[stateTone],
            isRunning && !isEmergencyStopped ? 'animate-pulse' : '',
          ].join(' ')} />
        </div>
      )}
    </aside>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="ff-field-label">{label}</span>
      <span className="font-mono text-xs text-slate-900 dark:text-white
                       tabular-nums">
        {value}
      </span>
    </div>
  );
}
