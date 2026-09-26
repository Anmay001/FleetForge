import { ReactNode } from 'react';
import { useFleetStore } from '../../store/useFleetStore';

export interface CanvasFooterProps {
  viewMode: '3d' | 'top';
}

function LegendItem({ swatch, label }: {
  swatch: ReactNode; label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {swatch}
      <span>{label}</span>
    </div>
  );
}

export default function CanvasFooter({ viewMode }: CanvasFooterProps) {
  const obstacles = useFleetStore((s) => s.obstacles);

  return (
    <div className="absolute bottom-0 left-0 right-0
                    flex items-center justify-between gap-4
                    px-4 py-2
                    bg-gradient-to-t from-black/40 to-transparent
                    text-white text-[11px] font-mono
                    pointer-events-none">

      {/* Left — legend */}
      <div className="hidden sm:flex items-center gap-4 overflow-hidden">
        <LegendItem swatch={<div className="w-3 h-3 rounded-sm bg-blue-500" />}
                    label="Rack" />
        <LegendItem swatch={<div className="w-3 h-3 rounded-full bg-orange-500" />}
                    label="AMR" />
        <LegendItem swatch={<div className="w-4 h-0.5 bg-yellow-400" />}
                    label="Lane" />
        <LegendItem swatch={<div className="w-3 h-3 rounded-full bg-red-500" />}
                    label="Obstacle" />
        <LegendItem swatch={<div className="w-3 h-3 rounded-sm bg-cyan-400" />}
                    label="Charging" />
        <LegendItem swatch={<div className="w-3 h-3 rounded-sm border border-emerald-400" />}
                    label="Drop Zone" />
      </div>

      {/* Right — stats */}
      <div className="flex items-center gap-2 opacity-80 ml-auto">
        <span>
          {obstacles.length} {obstacles.length === 1 ? 'obstacle' : 'obstacles'}
        </span>
        {viewMode === '3d' && (
          <>
            <span className="opacity-50">·</span>
            <span className="hidden md:inline">drag to orbit, scroll to zoom</span>
          </>
        )}
      </div>
    </div>
  );
}
