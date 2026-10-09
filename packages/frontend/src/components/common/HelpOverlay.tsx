import { X } from 'lucide-react';

export interface HelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  keys: string[];
  label: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: ['Space'], label: 'Play / Pause simulation' },
  { keys: ['R'], label: 'Reset simulation' },
  { keys: ['E'], label: 'Toggle emergency stop' },
  { keys: ['1'], label: 'Select AMR-01' },
  { keys: ['2'], label: 'Select AMR-02' },
  { keys: ['3'], label: 'Select AMR-03' },
  { keys: ['4'], label: 'Select AMR-04' },
  { keys: ['5'], label: 'Select AMR-05' },
  { keys: ['D'], label: 'Toggle light / dark theme' },
  { keys: ['?'], label: 'Open this help' },
  { keys: ['Esc'], label: 'Close dialogs / clear selection' },
];

export default function HelpOverlay({ isOpen, onClose }: HelpOverlayProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm 
                 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-lg 
                      bg-white dark:bg-slate-900 
                      border border-slate-200 dark:border-slate-700 
                      shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 
                        border-b border-slate-200 
                        dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 
                           dark:text-white">
              FleetForge — Controls
            </h2>
            <p className="text-xs text-slate-500 
                          dark:text-slate-400 mt-0.5">
              Keyboard shortcuts and interaction hints
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 
                       hover:text-slate-900 dark:hover:text-white 
                       hover:bg-slate-100 dark:hover:bg-slate-800 
                       transition-colors"
            aria-label="Close help"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 
                        gap-6">

          {/* Shortcuts */}
          <div>
            <div className="text-[10px] font-mono uppercase 
                            tracking-widest text-slate-500 
                            dark:text-slate-400 mb-3">
              Keyboard Shortcuts
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-slate-700 
                                   dark:text-slate-300">
                    {row.label}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {row.keys.map((k) => (
                      <kbd
                        key={k}
                        className="px-2 py-0.5 rounded 
                                   bg-slate-100 dark:bg-slate-800 
                                   border border-slate-300 
                                   dark:border-slate-600 
                                   text-[11px] font-mono 
                                   text-slate-700 dark:text-slate-200"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interaction hints */}
          <div>
            <div className="text-[10px] font-mono uppercase 
                            tracking-widest text-slate-500 
                            dark:text-slate-400 mb-3">
              Interaction Hints
            </div>
            <ul className="space-y-2 text-sm text-slate-700 
                           dark:text-slate-300">
              <li className="flex gap-2">
                <span className="text-emerald-500">▸</span>
                <span>
                  <strong>Click a robot</strong> on the 3D scene to 
                  open its telemetry panel
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">▸</span>
                <span>
                  <strong>Drag to orbit</strong>, <strong>scroll to 
                  zoom</strong> the camera
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">▸</span>
                <span>
                  <strong>Toggle Follow AMR</strong> in the toolbar 
                  to track the selected robot
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">▸</span>
                <span>
                  Chargers show <strong>QUEUED</strong> (amber) or 
                  <strong> CHARGING</strong> (cyan) badges
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">▸</span>
                <span>
                  Robots <strong>yield</strong> and <strong>reroute
                  </strong> automatically — no collisions
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 
                        dark:border-slate-700 
                        flex items-center justify-between 
                        text-[11px] font-mono text-slate-500">
          <span>FleetForge v1.0 · Autonomous Fleet Command</span>
          <span>Press <kbd className="px-1.5 py-0.5 rounded 
                                     bg-slate-100 
                                     dark:bg-slate-800 
                                     border border-slate-300 
                                     dark:border-slate-600">Esc</kbd> 
                to close</span>
        </div>
      </div>
    </div>
  );
}
