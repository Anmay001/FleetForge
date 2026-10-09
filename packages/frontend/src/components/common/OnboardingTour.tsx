import { useState } from 'react';
import { X } from 'lucide-react';

export interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface TourStep {
  title: string;
  body: string;
  /** Where the card sits. */
  position: 'center' | 'right' | 'bottom' | 'top';
  /** Optional emoji-free icon-like prefix. Use a short label. */
  eyebrow: string;
}

const STEPS: TourStep[] = [
  {
    eyebrow: 'WELCOME',
    title: 'Welcome to FleetForge',
    body:
      'Autonomous fleet coordination for smart warehouses. Five ' +
      'robots, one hive mind, zero central dispatcher.',
    position: 'center',
  },
  {
    eyebrow: 'STEP 1 OF 4',
    title: 'Meet your fleet',
    body:
      'Every robot streams live telemetry — position, battery, ' +
      'task, and last command. Click any robot on the 3D scene or ' +
      'use keys 1–5 to inspect it.',
    position: 'right',
  },
  {
    eyebrow: 'STEP 2 OF 4',
    title: 'Watch them think',
    body:
      'Robots negotiate passage through pheromone trails, peer ' +
      'imitation, and reservation locks. No collisions. No deadlocks.',
    position: 'bottom',
  },
  {
    eyebrow: 'STEP 3 OF 4',
    title: 'Give commands',
    body:
      'Stop, pause, reroute, or send any robot to charge. Emergencies ' +
      'halt the whole fleet with one click.',
    position: 'right',
  },
  {
    eyebrow: 'STEP 4 OF 4',
    title: 'Ready when you are',
    body:
      'Press ? anytime for keyboard shortcuts. Drag the scene to ' +
      'orbit, scroll to zoom. Welcome aboard.',
    position: 'center',
  },
];

export default function OnboardingTour({
  isOpen,
  onClose,
  onComplete,
}: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);

  if (!isOpen) return null;

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  // Position presets
  const positionClass = (() => {
    switch (step.position) {
      case 'right':
        return 'top-1/2 right-8 -translate-y-1/2';
      case 'bottom':
        return 'bottom-24 left-1/2 -translate-x-1/2';
      case 'top':
        return 'top-24 left-1/2 -translate-x-1/2';
      case 'center':
      default:
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
    }
  })();

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px]">
      <div
        className={`fixed ${positionClass} w-full max-w-md px-4 
                    transition-all duration-300`}
      >
        <div className="rounded-xl bg-white dark:bg-slate-900 
                        border border-slate-200 dark:border-slate-700 
                        shadow-2xl overflow-hidden">

          {/* Progress bar */}
          <div className="h-1 bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-emerald-500 transition-all 
                         duration-300"
              style={{
                width: `${((stepIndex + 1) / STEPS.length) * 100}%`,
              }}
            />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between 
                          px-6 pt-5 pb-3">
            <div>
              <div className="text-[10px] font-mono uppercase 
                              tracking-widest text-emerald-600 
                              dark:text-emerald-400 mb-1">
                {step.eyebrow}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 
                             dark:text-white">
                {step.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 
                         hover:text-slate-900 dark:hover:text-white 
                         hover:bg-slate-100 dark:hover:bg-slate-800 
                         transition-colors -mt-1"
              aria-label="Skip tour"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 pb-5">
            <p className="text-sm text-slate-600 dark:text-slate-300 
                          leading-relaxed">
              {step.body}
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 
                          dark:border-slate-800 
                          flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-mono text-slate-500 
                         hover:text-slate-700 dark:hover:text-slate-300 
                         transition-colors"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="h-8 px-3 rounded-md text-xs font-medium 
                             text-slate-600 dark:text-slate-300 
                             hover:bg-slate-100 
                             dark:hover:bg-slate-800 
                             transition-colors"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className="h-8 px-4 rounded-md text-xs font-medium 
                           bg-emerald-500 text-white 
                           hover:bg-emerald-600 transition-colors"
              >
                {isLast ? 'Get started' : 'Next'}
              </button>
            </div>
          </div>

          {/* Dots indicator */}
          <div className="px-6 pb-4 flex items-center justify-center 
                          gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={[
                  'w-1.5 h-1.5 rounded-full transition-colors',
                  i === stepIndex
                    ? 'bg-emerald-500'
                    : 'bg-slate-300 dark:bg-slate-700',
                ].join(' ')}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
