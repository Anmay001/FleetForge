import { create } from 'zustand';

export interface AppSettings {
  autoResetOnCompletion: boolean;
  showGridCoordinates: boolean;
  enableSoundAlerts: boolean;
  compactTelemetry: boolean;
}

interface SettingsState extends AppSettings {
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  toggleSetting: (key: keyof AppSettings) => void;
}

const STORAGE_KEY = 'fleetforge:settings';

function loadInitialSettings(): AppSettings {
  const defaults: AppSettings = {
    autoResetOnCompletion: false,
    showGridCoordinates: true,
    enableSoundAlerts: false,
    compactTelemetry: false,
  };

  if (typeof window === 'undefined') return defaults;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...loadInitialSettings(),

  updateSetting: (key, value) =>
    set((state) => {
      const updated = { ...state, [key]: value };
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            autoResetOnCompletion: updated.autoResetOnCompletion,
            showGridCoordinates: updated.showGridCoordinates,
            enableSoundAlerts: updated.enableSoundAlerts,
            compactTelemetry: updated.compactTelemetry,
          })
        );
      } catch {
        // ignore quota / storage errors
      }
      return { [key]: value };
    }),

  toggleSetting: (key) =>
    set((state) => {
      const nextVal = !state[key];
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            autoResetOnCompletion: key === 'autoResetOnCompletion' ? nextVal : state.autoResetOnCompletion,
            showGridCoordinates: key === 'showGridCoordinates' ? nextVal : state.showGridCoordinates,
            enableSoundAlerts: key === 'enableSoundAlerts' ? nextVal : state.enableSoundAlerts,
            compactTelemetry: key === 'compactTelemetry' ? nextVal : state.compactTelemetry,
          })
        );
      } catch {
        // ignore
      }
      return { [key]: nextVal };
    }),
}));
