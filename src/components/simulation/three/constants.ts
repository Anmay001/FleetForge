export const GRID_SIZE = 20;     // 20x20 meter warehouse

// Theme-aware palette. Functions accept 'light' | 'dark'.
export interface ScenePalette {
  floor: string;
  floorAlt: string;      // checkerboard alt tile
  gridLine: string;
  laneLine: string;
  dropZone: string;      // green zone fill (semi-transparent)
  dropZoneBorder: string;
  chargingPad: string;   // cyan pad fill
  chargingBorder: string;
  rackMetal: string;     // rack frame
  rackWood: string;      // pallet
  box: string;           // cardboard box
  obstacle: string;
  bg: string;            // scene background
}

export const PALETTES: Record<'light' | 'dark', ScenePalette> = {
  light: {
    floor: '#f1f5f9',
    floorAlt: '#e2e8f0',
    gridLine: '#cbd5e1',
    laneLine: '#eab308',
    dropZone: '#10b981',
    dropZoneBorder: '#059669',
    chargingPad: '#06b6d4',
    chargingBorder: '#0891b2',
    rackMetal: '#3b82f6',
    rackWood: '#a16207',
    box: '#d97706',
    obstacle: '#ef4444',
    bg: '#f8fafc',
  },
  dark: {
    floor: '#0f172a',
    floorAlt: '#1e293b',
    gridLine: '#334155',
    laneLine: '#eab308',
    dropZone: '#10b981',
    dropZoneBorder: '#34d399',
    chargingPad: '#06b6d4',
    chargingBorder: '#22d3ee',
    rackMetal: '#1e40af',
    rackWood: '#78350f',
    box: '#92400e',
    obstacle: '#ef4444',
    bg: '#020617',
  },
};
