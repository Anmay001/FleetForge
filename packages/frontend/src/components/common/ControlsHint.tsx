import { HelpCircle } from 'lucide-react';

export interface ControlsHintProps {
  onOpenHelp: () => void;
}

export default function ControlsHint({ onOpenHelp }: ControlsHintProps) {
  return (
    <button
      type="button"
      onClick={onOpenHelp}
      className="fixed bottom-4 right-4 z-40 flex items-center 
                 gap-2 rounded-full px-3 py-2 
                 bg-white dark:bg-slate-900 
                 border border-slate-200 dark:border-slate-700 
                 shadow-lg hover:shadow-xl transition-all 
                 text-xs font-medium text-slate-700 
                 dark:text-slate-200 
                 hover:border-emerald-500/50"
      title="Show controls (?)"
    >
      <HelpCircle size={14} />
      <span>Controls</span>
      <kbd className="ml-1 px-1.5 py-0.5 rounded 
                      bg-slate-100 dark:bg-slate-800 
                      border border-slate-300 
                      dark:border-slate-600 
                      text-[10px] font-mono">
        ?
      </kbd>
    </button>
  );
}
