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

export default function Header({}: HeaderProps) {
  const isRunning = useFleetStore((s) => s.isRunning);
  const setRunning = useFleetStore((s) => s.setRunning);
  const resetSimulation = useFleetStore((s) => s.resetSimulation);
  const isEmergencyStopped = useFleetStore((s) => s.isEmergencyStopped);

  const [now, setNow] = useState<Date>(() => new Date());

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

        <div className="flex items-center gap-2 pl-2
                        border-l border-slate-200 dark:border-slate-800">
          <div className="w-6 h-6 rounded bg-emerald-500
                          text-white text-[10px] font-bold
                          flex items-center justify-center">
            A
          </div>
          <span className="text-xs font-mono text-slate-700
                           dark:text-slate-300 hidden sm:inline">
            Admin
          </span>
        </div>
      </div>
    </header>
  );
}
