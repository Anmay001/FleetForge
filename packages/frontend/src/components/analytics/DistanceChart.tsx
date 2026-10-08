import { useFleetStore } from '../../store/useFleetStore';

export default function DistanceChart() {
  const robots = useFleetStore((s) => s.robots);
  const maxDistance = Math.max(
    1,
    ...robots.map((r) => r.distanceTravelled)
  );

  return (
    <div className="ff-panel px-5 py-4">
      <div className="ff-heading">Distance per Robot</div>
      <div className="ff-sub mb-4">Metres travelled since last reset</div>

      <div className="space-y-3">
        {robots.map((r) => {
          const pct = (r.distanceTravelled / maxDistance) * 100;
          return (
            <div key={r.id} className="flex items-center gap-3">
              <div className="text-[11px] font-mono text-slate-700
                              dark:text-slate-300 w-16 flex-shrink-0">
                {r.id}
              </div>
              <div className="ff-meter flex-1">
                <div className="ff-meter-fill"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: r.color,
                  }}
                />
              </div>
              <div className="text-[11px] font-mono text-slate-900
                              dark:text-white w-14 text-right
                              flex-shrink-0 tabular-nums">
                {r.distanceTravelled.toFixed(1)} m
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
