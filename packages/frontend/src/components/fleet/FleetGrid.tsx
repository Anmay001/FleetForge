import { useFleetStore } from '../../store/useFleetStore';
import StatusBadge from '../common/StatusBadge';
import { TONE_HEX, toneOfBattery } from '../common/status';

export default function FleetGrid() {
  const robots = useFleetStore((s) => s.robots);
  const selectedId = useFleetStore((s) => s.selectedRobotId);
  const selectRobot = useFleetStore((s) => s.selectRobot);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="ff-label">Fleet Management</h1>
        <p className="ff-sub mt-1">
          Click a robot to inspect telemetry. Status badges update live.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3
                      gap-3">
        {robots.map((r) => {
          const isSelected = r.id === selectedId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => selectRobot(r.id)}
              className={[
                'text-left p-4 transition-colors border rounded-lg',
                'bg-white dark:bg-slate-900',
                isSelected
                  ? 'border-emerald-500 ' +
                    'ring-1 ring-emerald-500/30'
                  : 'border-slate-200 dark:border-slate-800 ' +
                    'hover:border-slate-300 dark:hover:border-slate-700',
              ].join(' ')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: r.color }}
                  />
                  <span className="text-sm font-semibold text-slate-900
                                   dark:text-white truncate">
                    {r.id}
                  </span>
                </div>
                <StatusBadge status={r.status} size="sm" />
              </div>

              <div className="space-y-2.5">
                <Row label="Battery"
                     value={`${r.battery.toFixed(0)}%`}
                     bar={r.battery} />
                <Row label="Distance"
                     value={`${r.distanceTravelled.toFixed(1)} m`} />
                <Row label="Speed"
                     value={`${r.speed.toFixed(2)} m/s`} />
                <Row label="Task" value={r.currentTask ?? 'None'} />
                <Row label="Destination" value={r.destination} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  bar?: number;
}

function Row({ label, value, bar }: RowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="ff-field-label w-20 flex-shrink-0">
        {label}
      </span>
      <span className="text-xs font-mono text-slate-900
                       dark:text-slate-200 flex-shrink-0">
        {value}
      </span>
      {bar !== undefined && (
        <div className="ff-meter flex-1">
          <div
            className="ff-meter-fill"
            style={{
              width: `${bar}%`,
              backgroundColor: TONE_HEX[toneOfBattery(bar)],
            }}
          />
        </div>
      )}
    </div>
  );
}
