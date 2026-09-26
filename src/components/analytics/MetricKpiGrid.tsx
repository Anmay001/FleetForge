import {
  PackageCheck, ClipboardList, Activity, Battery, Route,
  AlertTriangle, GitBranch, Clock,
  GitMerge, ShieldCheck, Users,
} from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';

interface Kpi {
  label: string;
  value: string;
  Icon: typeof PackageCheck;
}

export default function MetricKpiGrid() {
  const robots = useFleetStore((s) => s.robots);
  const tasks = useFleetStore((s) => s.tasks);
  const events = useFleetStore((s) => s.events);
  const coordinationStats = useFleetStore((s) => s.coordinationStats);

  const deliveries = tasks.filter((t) => t.status === 'COMPLETED').length;
  const generated = tasks.length;
  const utilization = robots.length === 0
    ? 0
    : Math.round(
        (robots.filter(
          (r) => r.status !== 'IDLE' && r.status !== 'WAITING'
        ).length /
          robots.length) *
          100
      );
  const avgBattery = robots.length === 0
    ? 0
    : Math.round(
        robots.reduce((sum, r) => sum + r.battery, 0) / robots.length
      );
  const totalDistance = robots.reduce(
    (sum, r) => sum + r.distanceTravelled,
    0
  );
  const obstacleEvents = events.filter((e) => e.type === 'DANGER').length;
  const reroutes = events.filter((e) => e.type === 'WARN').length;
  const corridorWaits = events.filter((e) =>
    e.message.toLowerCase().includes('wait')
  ).length;

  const kpis: Kpi[] = [
    { label: 'Deliveries Completed', value: String(deliveries),
      Icon: PackageCheck },
    { label: 'Tasks Generated', value: String(generated),
      Icon: ClipboardList },
    { label: 'Fleet Utilisation', value: `${utilization}%`,
      Icon: Activity },
    { label: 'Average Battery', value: `${avgBattery}%`,
      Icon: Battery },
    { label: 'Total Distance', value: `${totalDistance.toFixed(1)} m`,
      Icon: Route },
    { label: 'Obstacle Events', value: String(obstacleEvents),
      Icon: AlertTriangle },
    { label: 'Reroutes', value: String(reroutes),
      Icon: GitBranch },
    { label: 'Corridor Waits', value: String(corridorWaits),
      Icon: Clock },
    {
      label: 'Route Assignments',
      value: String(coordinationStats.totalAssignments),
      Icon: GitMerge,
    },
    {
      label: 'Conflicts Resolved',
      value: String(coordinationStats.totalConflictsResolved),
      Icon: ShieldCheck,
    },
    {
      label: 'Peak Concurrent',
      value: String(coordinationStats.peakConcurrentRoutes),
      Icon: Users,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="ff-panel px-4 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="ff-label leading-tight">{kpi.label}</div>
            <kpi.Icon size={13}
                      className="text-slate-400 dark:text-slate-500
                                 flex-shrink-0 mt-px" />
          </div>
          <div className="mt-2 font-mono text-xl font-semibold
                          tabular-nums leading-none
                          text-slate-900 dark:text-white">
            {kpi.value}
          </div>
        </div>
      ))}
    </div>
  );
}
