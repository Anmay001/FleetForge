import { useState } from 'react';
import { ChevronDown, ChevronUp, ScrollText } from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import { SimulationEvent } from '../../types/fleet';
import { TONE_HEX, Tone, toneOfStatus } from '../common/status';

export interface LiveEventFeedProps {
  variant?: 'compact' | 'full';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * The source column already names the robot, so strip a redundant
 * leading "AMR-0x " from the message. The stored message is never
 * modified — this is presentation only.
 */
function displayMessage(message: string, robotId: string): string {
  if (robotId && message.startsWith(`${robotId} `)) {
    const rest = message.slice(robotId.length + 1);
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return message;
}

function severityTone(type: SimulationEvent['type']): Tone {
  switch (type) {
    case 'DANGER':  return 'danger';
    case 'WARN':    return 'warn';
    case 'SUCCESS': return 'ok';
    default:        return 'info';
  }
}

function robotSourceColor(id: string): string {
  const robot = useFleetStore.getState().robots.find((r) => r.id === id);
  if (robot) return robot.color;
  return TONE_HEX[toneOfStatus(id)];
}

export default function LiveEventFeed({
  variant = 'compact',
}: LiveEventFeedProps) {
  const events = useFleetStore((s) => s.events);
  const [expanded, setExpanded] = useState(true);

  const isFull = variant === 'full';
  const isCollapsed = !isFull && !expanded;
  const isEmpty = events.length === 0;

  return (
    <div
      className={[
        'bg-white dark:bg-slate-900 flex flex-col min-h-0',
        isFull ? 'h-full' : 'flex-shrink-0',
      ].join(' ')}
      style={isFull || isCollapsed
        ? undefined
        : { height: isEmpty ? undefined : 176 }}
    >
      {/* ---------- Header ---------- */}
      <div
        className={[
          'h-9 px-4 flex items-center justify-between gap-3 flex-shrink-0',
          'border-b ff-rule',
          isFull ? '' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
        ].join(' ')}
        onClick={isFull ? undefined : () => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="ff-label">Event log</span>
          <span className="font-mono text-[11px] text-slate-400
                           dark:text-slate-500 tabular-nums">
            {events.length}
          </span>
        </div>

        {!isFull && (
          <button
            type="button"
            className="text-slate-400 hover:text-slate-700
                       dark:hover:text-white transition-colors flex-shrink-0"
            aria-label={expanded ? 'Collapse event log' : 'Expand event log'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        )}
      </div>

      {/* ---------- Body ---------- */}
      {!isCollapsed && (
        <div className={[
          'overflow-y-auto min-h-0',
          isFull ? 'flex-1' : '',
        ].join(' ')}>
          {isEmpty ? (
            <div className="px-4 py-3 flex items-center gap-2
                            text-[11px] text-slate-400
                            dark:text-slate-500">
              <ScrollText size={13} />
              Waiting for events…
            </div>
          ) : (
            events.map((e) => {
              const tone = severityTone(e.type);
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-3 px-4 py-1.5
                             border-b border-slate-100 dark:border-slate-800/70
                             border-l-2
                             hover:bg-slate-50 dark:hover:bg-slate-800/40
                             transition-colors"
                  style={{ borderLeftColor: TONE_HEX[tone] }}
                >
                  <span className="font-mono text-[11px] text-slate-400
                                   dark:text-slate-500 tabular-nums
                                   flex-shrink-0">
                    {formatTime(e.timestamp)}
                  </span>

                  <span className="font-mono text-[11px] font-semibold
                                   flex-shrink-0 w-16 truncate"
                        style={{ color: robotSourceColor(e.robotId) }}>
                    {e.robotId}
                  </span>

                  <span className="text-xs text-slate-700
                                   dark:text-slate-300 truncate">
                    {displayMessage(e.message, e.robotId)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
