import { useState } from 'react';
import { useThemeStore } from '../../store/useThemeStore';

export default function SettingsPanel() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900
                       dark:text-white">
          Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure the FleetForge dashboard behaviour.
        </p>
      </div>

      <Section title="Appearance">
        <Row
          label="Dark mode"
          hint="Switch between light and dark themes"
          on={theme === 'dark'}
          onToggle={toggleTheme}
        />
      </Section>

      <Section title="Simulation">
        <Row
          label="Auto-reset on completion"
          hint="Reset the fleet to initial state when all tasks complete"
          defaultOn={false}
        />
        <Row
          label="Show grid coordinates"
          hint="Display X / Z labels on the warehouse grid"
          defaultOn={true}
        />
        <Row
          label="Enable sound alerts"
          hint="Play a subtle beep on DANGER events"
          defaultOn={false}
        />
      </Section>

      <Section title="Display">
        <Row
          label="Compact telemetry panel"
          hint="Reduce padding in the inspector for more rows"
          defaultOn={false}
        />
      </Section>

      <Section title="About">
        <div className="px-4 py-3 space-y-1">
          <div className="text-xs font-mono text-slate-700
                          dark:text-slate-300">
            FleetForge v1.0.0
          </div>
          <div className="text-[11px] text-slate-500
                          dark:text-slate-500">
            Autonomous Fleet Command · SIH-26123
          </div>
          <div className="text-[11px] text-slate-500
                          dark:text-slate-500">
            React 19 · TypeScript · Three.js · Zustand · Tailwind
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="ff-label mb-2 px-1">
        {title}
      </div>
      <div className="ff-panel overflow-hidden
                      divide-y divide-slate-100
                      dark:divide-slate-800">
        {children}
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  hint: string;
  on?: boolean;
  onToggle?: () => void;
  defaultOn?: boolean;
}

function Row({ label, hint, on, onToggle, defaultOn }: RowProps) {
  const [localOn, setLocalOn] = useState(defaultOn ?? false);
  const isOn = on !== undefined ? on : localOn;
  const handleClick = onToggle ?? (() => setLocalOn(!localOn));

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full flex items-center justify-between gap-4
                 px-4 py-3 text-left
                 hover:bg-slate-50 dark:hover:bg-slate-800/40
                 transition-colors"
    >
      <div className="min-w-0">
        <div className="text-sm text-slate-900 dark:text-slate-200">
          {label}
        </div>
        <div className="text-[11px] text-slate-500
                        dark:text-slate-400 mt-0.5">
          {hint}
        </div>
      </div>
      <span
        className={[
          'w-9 h-5 rounded-full relative transition-colors ' +
          'flex-shrink-0',
          isOn
            ? 'bg-emerald-500'
            : 'bg-slate-300 dark:bg-slate-700',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 w-4 h-4 rounded-full bg-white ' +
            'shadow-sm transition-transform',
            isOn ? 'translate-x-[18px]' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
    </button>
  );
}
