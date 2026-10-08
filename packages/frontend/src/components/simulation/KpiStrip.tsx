import { useEffect, useRef, useState } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import {
  TONE_BG, TONE_TEXT, Tone, batteryLabel, toneOfBattery, toneOfStatus,
} from '../common/status';

/**
 * Briefly tints a metric cell when its value changes, so the operator
 * sees that a number moved without the number itself animating.
 */
function useFlash(value: string): boolean {
  const [flash, setFlash] = useState(false);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 700);
    return () => window.clearTimeout(id);
  }, [value]);

  return flash;
}

interface MetricProps {
  value: string;
  label: string;
  sub: string;
  /** Present only where the secondary line states a condition, not a count. */
  dot?: Tone;
  valueClassName?: string;
  index: number;
}

/** Left/top hairlines that stay correct at 2-up (mobile) and 4-up (desktop). */
const DIVIDERS = [
  '',
  'border-l',
  'border-t sm:border-t-0 sm:border-l',
  'border-t border-l sm:border-t-0',
];

function Metric({ value, label, sub, dot, valueClassName, index }: MetricProps) {
  const flash = useFlash(value);

  return (
    <div
      className={[
        'px-3 py-2 sm:px-4 sm:py-2.5 min-w-0 transition-colors duration-500',
        'border-slate-200 dark:border-slate-800',
        DIVIDERS[index],
        flash ? 'bg-emerald-500/10 dark:bg-emerald-500/[0.07]' : 'bg-transparent',
      ].join(' ')}
    >
      <div
        className={[
          'font-mono tabular-nums font-semibold leading-none tracking-tight',
          'text-xl sm:text-2xl',
          'text-slate-900 dark:text-white',
          valueClassName ?? '',
        ].join(' ')}
      >
        {value}
      </div>

      <div className="ff-label mt-1.5 truncate">{label}</div>

      <div className="ff-sub mt-1 hidden sm:flex sm:items-center sm:gap-1.5">
        {dot && <span className={['ff-status-dot', TONE_BG[dot]].join(' ')} />}
        <span className="truncate">{sub}</span>
      </div>
    </div>
  );
}

export default function KpiStrip() {
  const robots = useFleetStore((s) => s.robots);
  const tasks = useFleetStore((s) => s.tasks);
  const isEmergencyStopped = useFleetStore((s) => s.isEmergencyStopped);

  const totalRobots = robots.length;
  const activeRobots = robots.filter((r) =>
    r.status !== 'IDLE' && r.status !== 'WAITING'
  ).length;

  const inProgress = tasks.filter(
    (t) => t.status === 'MOVING_TO_PICKUP' || t.status === 'DROPPING'
  ).length;
  const queued = tasks.filter((t) => t.status === 'QUEUED').length;
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length;

  const avgBattery =
    totalRobots > 0
      ? Math.round(robots.reduce((sum, r) => sum + r.battery, 0) / totalRobots)
      : 0;

  // Secondary line for ACTIVE: what the non-active units are doing.
  const charging = robots.filter((r) => r.status === 'GOING_TO_CHARGE').length;
  const waiting = robots.filter((r) => r.status === 'WAITING').length;
  const idle = robots.filter((r) => r.status === 'IDLE').length;

  const inactiveParts = [
    charging > 0 ? `${charging} charging` : null,
    waiting > 0 ? `${waiting} waiting` : null,
    idle > 0 ? `${idle} idle` : null,
  ].filter((s): s is string => s !== null);

  const activeSub =
    activeRobots === 0
      ? 'All units idle'
      : inactiveParts.length > 0
        ? inactiveParts.join(' · ')
        : 'All units engaged';

  const activeTone = isEmergencyStopped
    ? 'danger'
    : activeRobots > 0
      ? 'ok'
      : 'idle';

  const batteryTone = toneOfBattery(avgBattery);
  const batteryCount = robots.filter(
    (r) => toneOfStatus(r.status) === 'charge'
  ).length;

  return (
    <div className="ff-band grid grid-cols-2 sm:grid-cols-4">
      <Metric
        index={0}
        value={`${activeRobots} / ${totalRobots}`}
        label="Active"
        sub={activeSub}
        dot={activeTone}
      />
      <Metric
        index={1}
        value={`${inProgress}`}
        label="Tasks"
        sub={`${queued} queued`}
      />
      <Metric
        index={2}
        value={`${completed}`}
        label="Completed"
        sub={`${tasks.length} total tasks`}
      />
      <Metric
        index={3}
        value={`${avgBattery}%`}
        label="Battery"
        sub={
          batteryCount > 0
            ? `${batteryLabel(avgBattery)} · ${batteryCount} charging`
            : batteryLabel(avgBattery)
        }
        dot={batteryTone}
        valueClassName={TONE_TEXT[batteryTone]}
      />
    </div>
  );
}
