import { useEffect, useState } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import {
  TONE_HEX, statusLabel, toneOfBattery,
} from '../common/status';

function formatUptime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

export default function BatteryHealthCard() {
  const robots = useFleetStore((s) => s.robots);
  const simulationStartedAt = useFleetStore((s) => s.simulationStartedAt);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = now - simulationStartedAt;

  return (
    <div className="ff-panel px-5 py-4">
      <div className="ff-heading">Battery Health</div>
      <div className="ff-sub mt-0.5 mb-4">
        Simulation uptime {formatUptime(elapsed)}
      </div>

      <div className="space-y-3">
        {robots.map((r) => {
          const tone = toneOfBattery(r.battery);
          return (
            <div key={r.id} className="flex items-center gap-3">
              <div className="text-[11px] font-mono text-slate-700
                              dark:text-slate-300 w-32 flex-shrink-0
                              truncate">
                <span className="text-slate-500 dark:text-slate-500">
                  {r.id}
                </span>
                <span className="mx-1 text-slate-400">·</span>
                <span>{statusLabel(r.status)}</span>
              </div>
              <div className="ff-meter flex-1">
                <div
                  className="ff-meter-fill"
                  style={{
                    width: `${r.battery}%`,
                    backgroundColor: TONE_HEX[tone],
                  }}
                />
              </div>
              <div className="text-[11px] font-mono text-slate-900
                              dark:text-white w-12 text-right
                              flex-shrink-0 tabular-nums">
                {r.battery.toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
