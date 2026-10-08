import {
  Square, Pause, Play, RefreshCw, BatteryCharging,
  AlertTriangle, Power,
} from 'lucide-react';
import { ReactNode } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import {
  TONE_BG, TONE_HEX, TONE_TEXT, batteryLabel, statusLabel,
  toneOfBattery, toneOfStatus,
} from '../common/status';

export default function TelemetryInspector() {
  const robots = useFleetStore((s) => s.robots);
  const selectedId = useFleetStore((s) => s.selectedRobotId);
  const selectRobot = useFleetStore((s) => s.selectRobot);
  const updateRobot = useFleetStore((s) => s.updateRobot);
  const toggleEmergencyStop = useFleetStore((s) => s.toggleEmergencyStop);
  const isEmergencyStopped = useFleetStore((s) => s.isEmergencyStopped);

  const robot = robots.find((r) => r.id === selectedId) ?? robots[0];

  if (!robot) {
    return (
      <div className="flex-1 flex items-center justify-center px-4
                      text-xs text-slate-500 dark:text-slate-400">
        No robots available
      </div>
    );
  }

  const statusTone = toneOfStatus(robot.status);
  const batteryTone = toneOfBattery(robot.battery);

  return (
    <div className="flex flex-col min-h-0 flex-1
                    bg-white dark:bg-slate-900">

      {/* ---------- Identity + status ---------- */}
      <div className="px-4 pt-3 pb-3 border-b ff-rule flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: robot.color }} />
            <h2 className="font-mono text-[15px] font-semibold tracking-tight
                           text-slate-900 dark:text-white">
              {robot.id}
            </h2>
          </div>

          <span className={['ff-status', TONE_TEXT[statusTone]].join(' ')}>
            <span className={['ff-status-dot', TONE_BG[statusTone]].join(' ')} />
            {robot.isEmergencyStopped ? 'E-stop' : statusLabel(robot.status)}
          </span>
        </div>

        {/* Unit selector — number + live status dot */}
        <div className="mt-3 grid grid-cols-5 gap-1">
          {robots.map((r) => {
            const isActive = r.id === robot.id;
            const tone = toneOfStatus(r.status);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => selectRobot(r.id)}
                title={`${r.id} — ${r.isEmergencyStopped ? 'E-stop' : statusLabel(r.status)}`}
                className={[
                  'h-8 rounded flex items-center justify-center gap-1.5',
                  'border transition-colors',
                  isActive
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                    : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800',
                ].join(' ')}
              >
                <span className={[
                  'font-mono text-[11px] leading-none',
                  isActive
                    ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400',
                ].join(' ')}>
                  {r.numericId}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: r.isEmergencyStopped
                      ? TONE_HEX.danger
                      : TONE_HEX[tone],
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- Scrollable information ---------- */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* POWER */}
        <Section title="Power">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[22px] font-mono font-semibold leading-none
                             text-slate-900 dark:text-white">
              {robot.battery.toFixed(0)}%
            </span>
            <span className={['ff-status', TONE_TEXT[batteryTone]].join(' ')}>
              <span className={['ff-status-dot', TONE_BG[batteryTone]].join(' ')} />
              {batteryLabel(robot.battery)}
            </span>
          </div>
          <div className="ff-meter mt-2.5">
            <div
              className="ff-meter-fill"
              style={{
                width: `${robot.battery}%`,
                backgroundColor: TONE_HEX[batteryTone],
              }}
            />
          </div>
        </Section>

        {/* MISSION */}
        <Section title="Mission">
          <Field label="Current task" value={robot.currentTask ?? '—'} />
          <Field label="Destination" value={robot.destination} />
          {robot.payload !== null && (
            <Field label="Payload" value={robot.payload} />
          )}
        </Section>

        {/* TELEMETRY */}
        <Section title="Telemetry">
          <div className="py-1.5">
            <div className="ff-field-label mb-1.5">Position</div>
            <div className="grid grid-cols-2 gap-2">
              <ValueBox axis="X" value={`${robot.position.x.toFixed(2)} m`} />
              <ValueBox axis="Z" value={`${robot.position.z.toFixed(2)} m`} />
            </div>
          </div>
          <Field label="Speed" value={`${robot.speed.toFixed(2)} m/s`} />
          <Field label="Distance travelled"
                 value={`${robot.distanceTravelled.toFixed(1)} m`} />
        </Section>
      </div>

      {/* ---------- Operator actions ---------- */}
      <div className="border-t ff-rule px-4 py-3 space-y-2 flex-shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            icon={Square}
            label="Stop"
            tone="danger"
            onClick={() => updateRobot(robot.id, {
              speed: 0, status: 'IDLE', destination: 'IDLE',
            })}
          />
          <ActionButton
            icon={Pause}
            label="Pause"
            tone="neutral"
            onClick={() => updateRobot(robot.id, {
              speed: 0, status: 'WAITING',
            })}
          />
          <ActionButton
            icon={Play}
            label="Resume"
            tone="ok"
            onClick={() => updateRobot(robot.id, {
              isEmergencyStopped: false,
              status: 'MOVING_TO_PICKUP',
            })}
          />
          <ActionButton
            icon={RefreshCw}
            label="Reroute"
            tone="neutral"
            onClick={() => {
              updateRobot(robot.id, {
                destination: 'REROUTING',
                targetPosition: {
                  x: robot.position.x, y: 0, z: robot.position.z,
                },
                status: 'MOVING_TO_PICKUP',
              });
              useFleetStore.getState().addEvent({
                robotId: robot.id,
                message: `${robot.id} rerouted by operator`,
                type: 'WARN',
              });
            }}
          />
        </div>

        <ActionButton
          icon={BatteryCharging}
          label="Send to charging pad"
          tone="neutral"
          full
          onClick={() => updateRobot(robot.id, {
            status: 'GOING_TO_CHARGE',
            targetPosition: { x: 2, y: 0, z: 2 },
            destination: 'CHARGE-01',
          })}
        />
      </div>

      {/* ---------- Emergency ---------- */}
      <div className="border-t ff-rule px-4 py-3 space-y-2 flex-shrink-0">
        <button
          type="button"
          onClick={toggleEmergencyStop}
          className={[
            'w-full h-9 rounded flex items-center justify-center gap-2',
            'text-xs font-semibold uppercase tracking-label transition-colors',
            isEmergencyStopped
              ? 'bg-red-600 text-white border border-red-700 hover:bg-red-700'
              : 'ff-control-danger',
          ].join(' ')}
        >
          {isEmergencyStopped
            ? <Play size={14} />
            : <AlertTriangle size={14} />}
          {isEmergencyStopped ? 'Resume operations' : 'Emergency stop'}
        </button>

        <button
          type="button"
          disabled={!isEmergencyStopped}
          onClick={() => {
            toggleEmergencyStop();
            useFleetStore.getState().robots.forEach((r) => {
              useFleetStore.getState().updateRobot(r.id, {
                isEmergencyStopped: false,
                status: 'IDLE',
                speed: 0,
              });
            });
          }}
          className="ff-control ff-control-quiet w-full h-9"
        >
          <Power size={13} />
          Bring all units online
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3 border-b ff-rule">
      <div className="ff-label mb-2.5">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="ff-field-label flex-shrink-0">{label}</span>
      <span className="ff-data truncate">{value}</span>
    </div>
  );
}

function ValueBox({ axis, value }: { axis: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 px-2 py-1.5 rounded
                    bg-slate-50 dark:bg-slate-800/60">
      <span className="ff-label">{axis}</span>
      <span className="font-mono text-xs text-slate-900 dark:text-white
                       tabular-nums">
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface ActionButtonProps {
  icon: typeof Play;
  label: string;
  tone: 'danger' | 'ok' | 'neutral';
  onClick: () => void;
  full?: boolean;
}

const TONE_CLASSES: Record<ActionButtonProps['tone'], string> = {
  danger: 'ff-control-danger',
  ok: 'ff-control-neutral text-emerald-700 dark:text-emerald-400 ' +
      'border-emerald-300 dark:border-emerald-500/40 ' +
      'hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
  neutral: 'ff-control-neutral',
};

function ActionButton({
  icon: Icon, label, tone, onClick, full,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={['ff-control', TONE_CLASSES[tone], full ? 'w-full' : ''].join(' ')}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
