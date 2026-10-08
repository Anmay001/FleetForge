import { useFleetStore } from '../../store/useFleetStore';

export default function TaskKpiRibbon() {
  const tasks = useFleetStore((s) => s.tasks);

  const queued = tasks.filter((t) => t.status === 'QUEUED').length;
  const inProgress = tasks.filter(
    (t) => t.status === 'MOVING_TO_PICKUP' || t.status === 'DROPPING'
  ).length;
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length;

  return (
    <div className="ff-panel overflow-hidden grid grid-cols-3">
      <RibbonCell index={0} label="Queued" value={queued} />
      <RibbonCell index={1} label="In progress" value={inProgress} />
      <RibbonCell index={2} label="Completed" value={completed} />
    </div>
  );
}

const DIVIDERS = ['', 'border-l', 'border-l'];

function RibbonCell(
  { index, label, value }: { index: number; label: string; value: number }
) {
  return (
    <div className={[
      'px-4 py-3 min-w-0',
      'border-slate-200 dark:border-slate-800',
      DIVIDERS[index],
    ].join(' ')}>
      <div className="ff-label truncate">{label}</div>
      <div className="mt-1.5 font-mono text-xl font-semibold leading-none
                      text-slate-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}
