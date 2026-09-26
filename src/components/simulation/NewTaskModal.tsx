import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFleetStore } from '../../store/useFleetStore';
import { WAYPOINTS, DROP_ZONES } from '../../data/warehouseLayout';

export interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PICKUP_NODES = WAYPOINTS.filter((w) => w.id.startsWith('RACK-'));

export default function NewTaskModal({ isOpen, onClose }: NewTaskModalProps) {
  const robots = useFleetStore((s) => s.robots);
  const addTask = useFleetStore((s) => s.addTask);

  const [boxId, setBoxId] = useState('');
  const [pickupNode, setPickupNode] = useState(PICKUP_NODES[0]?.id ?? '');
  const [dropLocation, setDropLocation] = useState(DROP_ZONES[0]?.id ?? '');
  const [assignedRobotId, setAssignedRobotId] = useState(
    robots[0]?.id ?? 'AMR-01'
  );

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const canSubmit = boxId.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    addTask({
      boxId: boxId.trim(),
      pickupNode,
      dropLocation,
      assignedRobotId,
      status: 'QUEUED',
    });
    setBoxId('');
    onClose();
  };

  const inputCls =
    'w-full h-9 px-3 rounded text-sm font-mono ' +
    'bg-slate-50 dark:bg-slate-800 ' +
    'border border-slate-200 dark:border-slate-700 ' +
    'text-slate-900 dark:text-slate-200 ' +
    'placeholder:text-slate-400 ' +
    'focus:border-emerald-500/50 focus:outline-none ' +
    'focus:ring-1 focus:ring-emerald-500/30 transition-colors';

  const labelCls =
    'ff-field-label block mb-1.5';

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm
                 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-96 max-w-full rounded-lg
                      bg-white dark:bg-slate-900
                      border border-slate-200 dark:border-slate-800
                      shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4
                        border-b border-slate-200 dark:border-slate-800">
          <h2 className="ff-heading">
            Create New Task
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400
                       hover:text-slate-900 dark:hover:text-white
                       hover:bg-slate-100 dark:hover:bg-slate-800
                       transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className={labelCls}>Box ID</label>
            <input
              type="text"
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
              placeholder="BOX-D2XX"
              autoFocus
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Pickup Node</label>
            <select
              value={pickupNode}
              onChange={(e) => setPickupNode(e.target.value)}
              className={inputCls}
            >
              {PICKUP_NODES.map((w) => (
                <option key={w.id} value={w.id}>{w.id}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Drop Location</label>
            <select
              value={dropLocation}
              onChange={(e) => setDropLocation(e.target.value)}
              className={inputCls}
            >
              {DROP_ZONES.map((d) => (
                <option key={d.id} value={d.id}>{d.id}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Assigned Robot</label>
            <select
              value={assignedRobotId}
              onChange={(e) => setAssignedRobotId(e.target.value)}
              className={inputCls}
            >
              {robots.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} · {r.status}
                </option>
              ))}
            </select>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="ff-control ff-control-neutral h-9 px-4"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="ff-control ff-control-primary h-9 px-4"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
