import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, ShieldAlert } from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import { TONE_BG, TONE_SURFACE, Tone } from './status';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
];

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export interface HeaderProps {
  onLogout: () => void;
}

export default function Header({ onLogout }: HeaderProps) {
  const isRunning = useFleetStore((s) => s.isRunning);
  const setRunning = useFleetStore((s) => s.setRunning);
  const resetSimulation = useFleetStore((s) => s.resetSimulation);
  const isEmergencyStopped = useFleetStore((s) => s.isEmergencyStopped);

  const [now, setNow] = useState<Date>(() => new Date());
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const stateTone: Tone = isEmergencyStopped
    ? 'danger'
    : isRunning ? 'ok' : 'info';

  const stateLabel = isEmergencyStopped
    ? 'E-stop'
    : isRunning ? 'Running' : 'Paused';

  const iconButton =
    'p-2 rounded text-slate-500 dark:text-slate-400 ' +
    'hover:text-slate-900 dark:hover:text-white ' +
    'hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors';

  return (
    <header className="h-14 bg-white dark:bg-slate-900
                       border-b border-slate-200 dark:border-slate-800
                       px-4 flex items-center justify-between gap-4
                       flex-shrink-0">

      {/* LEFT — FleetForge brand */}
      <div className="flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"
             width="26" height="26">
          <polygon
            points="16,2 28.12,9 28.12,23 16,30 3.88,23 3.88,9"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line x1="16" y1="10" x2="10" y2="21" stroke="#06b6d4" strokeWidth="1.2" />
          <line x1="16" y1="10" x2="22" y2="21" stroke="#06b6d4" strokeWidth="1.2" />
          <line x1="10" y1="21" x2="22" y2="21" stroke="#06b6d4" strokeWidth="1.2" />
          <circle cx="16" cy="10" r="2.4" fill="#06b6d4" />
          <circle cx="10" cy="21" r="2.4" fill="#06b6d4" />
          <circle cx="22" cy="21" r="2.4" fill="#06b6d4" />
        </svg>
        <div className="flex flex-col leading-none">
          <span className="text-base font-semibold text-slate-900
                           dark:text-white">
            FleetForge
          </span>
          <span className="text-[10px] font-mono text-slate-500
                           dark:text-slate-500 mt-0.5">
            Autonomous Fleet Command
          </span>
        </div>
      </div>

      {/* CENTER — Live clock */}
      <div className="font-mono text-sm text-slate-700 dark:text-slate-300
                      tabular-nums">
        {formatTime(now)} - {formatDate(now)}
      </div>

      {/* RIGHT — Global state + controls */}
      <div className="flex items-center gap-2">
        {/* Global simulation state chip */}
        <span
          className={[
            'ff-status border border-slate-200 dark:border-slate-800',
            TONE_SURFACE[stateTone],
          ].join(' ')}
        >
          <span className={['ff-status-dot', TONE_BG[stateTone]].join(' ')} />
          {isEmergencyStopped && <ShieldAlert size={12} />}
          {stateLabel}
        </span>

        <button
          type="button"
          className={iconButton}
          title={isRunning ? 'Pause simulation' : 'Resume simulation'}
          onClick={() => setRunning(!isRunning)}
        >
          {isRunning ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button
          type="button"
          className={iconButton}
          title="Reset simulation"
          onClick={() => resetSimulation()}
        >
          <RotateCcw size={16} />
        </button>

        {/* Admin profile dropdown */}
        <div className="relative pl-2 border-l border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Operator profile"
            aria-expanded={profileOpen}
          >
            <div className="w-6 h-6 rounded bg-emerald-500
                            text-white text-[10px] font-bold
                            flex items-center justify-center">
              A
            </div>
            <span className="text-xs font-mono text-slate-700
                             dark:text-slate-300 hidden sm:inline">
              Admin
            </span>
          </button>

          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 py-2">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/60">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    Operations Dispatcher
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    admin@fleetforge.local
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      Stand-alone Offline Mode
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      resetSimulation();
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    Reset Active Session
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                  >
                    Clear Cache &amp; Reload
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
