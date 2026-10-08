import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import StatusBadge from '../common/StatusBadge';
import { TONE_HEX } from '../common/status';
import TaskKpiRibbonInline from './TaskKpiRibbon';

type SortKey =
  | 'id' | 'boxId' | 'pickupNode' | 'dropLocation'
  | 'assignedRobotId' | 'status' | 'createdAt';

const SPEEDS: Array<0.5 | 1 | 2 | 5> = [0.5, 1, 2, 5];

export default function TaskQueueTable() {
  const tasks = useFleetStore((s) => s.tasks);
  const robots = useFleetStore((s) => s.robots);
  const simulationSpeed = useFleetStore((s) => s.simulationSpeed);
  const setSpeed = useFleetStore((s) => s.setSpeed);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const robotColor = (id: string) =>
    robots.find((r) => r.id === id)?.color ?? TONE_HEX.idle;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = tasks.filter((t) => {
      const matchesSearch =
        q === '' ||
        t.id.toLowerCase().includes(q) ||
        t.boxId.toLowerCase().includes(q) ||
        t.assignedRobotId.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'All' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    list = [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [tasks, search, statusFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <TaskKpiRibbonInline />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2
                               text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-56 h-8 pl-8 pr-3 rounded text-xs font-mono
                         bg-white dark:bg-slate-900
                         border border-slate-200 dark:border-slate-800
                         text-slate-800 dark:text-slate-200
                         placeholder:text-slate-400
                         focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2 rounded text-xs font-mono
                       bg-white dark:bg-slate-900
                       border border-slate-200 dark:border-slate-800
                       text-slate-800 dark:text-slate-200
                       focus:border-emerald-500/50 focus:outline-none"
          >
            <option value="All">All</option>
            <option value="QUEUED">Queued</option>
            <option value="MOVING_TO_PICKUP">Moving to Pickup</option>
            <option value="DROPPING">Moving to Drop</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="ff-label">Sim speed</span>
          <div className="ff-seg">
            {SPEEDS.map((s) => {
              const isActive = simulationSpeed === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={[
                    'ff-seg-item font-mono',
                    isActive ? 'ff-seg-item-active' : '',
                  ].join(' ')}
                >
                  {s}x
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="ff-panel overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200
                        dark:border-slate-800">
          <h2 className="ff-heading">Task Queue</h2>
          <p className="ff-sub mt-0.5">
            Auto-generated every 10–30 seconds in demo mode
          </p>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800
                           bg-slate-50 dark:bg-slate-800/40">
              <Th onClick={() => handleSort('id')} active={sortKey === 'id'}
                  dir={sortDir}>TASK</Th>
              <Th onClick={() => handleSort('boxId')} active={sortKey === 'boxId'}
                  dir={sortDir}>BOX</Th>
              <Th onClick={() => handleSort('pickupNode')}
                  active={sortKey === 'pickupNode'} dir={sortDir}>PICKUP</Th>
              <Th onClick={() => handleSort('dropLocation')}
                  active={sortKey === 'dropLocation'} dir={sortDir}>DROP</Th>
              <Th onClick={() => handleSort('assignedRobotId')}
                  active={sortKey === 'assignedRobotId'} dir={sortDir}>ROBOT</Th>
              <Th onClick={() => handleSort('status')}
                  active={sortKey === 'status'} dir={sortDir}>STATUS</Th>
              <Th onClick={() => handleSort('createdAt')}
                  active={sortKey === 'createdAt'} dir={sortDir}>CREATED</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => (
              <tr key={task.id}
                  className="border-b border-slate-100
                             dark:border-slate-800/60
                             hover:bg-slate-50 dark:hover:bg-slate-800/30
                             transition-colors">
                <td className="px-5 py-3 font-mono text-slate-700
                               dark:text-slate-300">
                  {task.id}
                </td>
                <td className="px-5 py-3 font-mono text-slate-700
                               dark:text-slate-300">
                  {task.boxId}
                </td>
                <td className="px-5 py-3 font-mono text-slate-500
                               dark:text-slate-400">
                  {task.pickupNode}
                </td>
                <td className="px-5 py-3 font-mono text-slate-500
                               dark:text-slate-400">
                  {task.dropLocation}
                </td>
                <td className="px-5 py-3 font-mono"
                    style={{ color: robotColor(task.assignedRobotId) }}>
                  {task.assignedRobotId}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={task.status} size="sm" />
                </td>
                <td className="px-5 py-3 font-mono text-slate-500
                               dark:text-slate-400">
                  {formatTime(task.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500
                          dark:text-slate-400">
            No tasks match your filters.
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, onClick, active, dir }: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: 'asc' | 'desc';
}) {
  return (
    <th
      onClick={onClick}
      className="px-5 py-2.5 text-left ff-label
                 cursor-pointer hover:text-slate-900
                 dark:hover:text-white select-none
                 whitespace-nowrap"
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && (
          dir === 'asc'
            ? <ChevronUp size={11} />
            : <ChevronDown size={11} />
        )}
      </span>
    </th>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
