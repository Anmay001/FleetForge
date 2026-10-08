import clsx from 'clsx';
import { TONE_BG, TONE_TEXT, statusLabel, toneOfStatus } from './status';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

/** Statuses an operator must notice — the dot pulses until cleared. */
const PULSING = new Set(['OBSTACLE_DETECTED', 'DANGER', 'WARN']);

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const tone = toneOfStatus(status);
  const pulse = PULSING.has(status);

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap font-medium',
        TONE_TEXT[tone],
        size === 'sm' ? 'text-[11px]' : 'text-xs'
      )}
    >
      <span
        className={clsx(
          'ff-status-dot',
          TONE_BG[tone],
          size === 'md' && 'w-2 h-2',
          pulse && 'animate-pulse'
        )}
      />
      {statusLabel(status)}
    </span>
  );
}
