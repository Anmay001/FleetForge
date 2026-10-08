import { useEffect, useState } from 'react';
import AppShell from './components/common/AppShell';
import { View } from './components/common/Sidebar';
import { useThemeStore } from './store/useThemeStore';
import { useSimulationLoop } from './hooks/useSimulationLoop';
import { useTaskGenerator } from './hooks/useTaskGenerator';
import WarehouseScene from './components/simulation/three/WarehouseScene';
import SimulationControls from './components/simulation/SimulationControls';
import TelemetryInspector from './components/simulation/TelemetryInspector';
import NewTaskModal from './components/simulation/NewTaskModal';
import KpiStrip from './components/simulation/KpiStrip';
import CanvasFooter from './components/simulation/CanvasFooter';
import LiveEventFeed from './components/events/LiveEventFeed';
import TaskQueueTable from './components/tasks/TaskQueueTable';
import MetricKpiGrid from './components/analytics/MetricKpiGrid';
import DistanceChart from './components/analytics/DistanceChart';
import BatteryHealthCard from './components/analytics/BatteryHealthCard';
import FleetGrid from './components/fleet/FleetGrid';
import SettingsPanel from './components/settings/SettingsPanel';

export default function App() {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const [view, setView] = useState<View>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | 'top'>('3d');
  const [follow, setFollow] = useState(false);
  const [cameraResetKey, setCameraResetKey] = useState(0);

  useSimulationLoop();
  useTaskGenerator();

  return (
    <AppShell
      activeView={view}
      onNavigate={setView}
      onLogout={() => {}}
    >
      {renderView()}
    </AppShell>
  );

  function renderView() {
    if (view === 'simulation') {
      return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)]">
          <KpiStrip />
          <SimulationControls
            onNewTask={() => setIsModalOpen(true)}
            onViewModeChange={setViewMode}
            onFollowChange={setFollow}
            onResetCamera={() => setCameraResetKey((k) => k + 1)}
          />

          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            {/* Canvas */}
            <div className="flex-1 min-h-[240px] lg:min-h-0 relative min-w-0">
              <WarehouseScene
                viewMode={viewMode}
                follow={follow}
                resetKey={cameraResetKey}
              />
              <CanvasFooter viewMode={viewMode} />
            </div>

            {/* Operations rail */}
            <aside className="h-[46vh] lg:h-auto lg:w-[340px] shrink-0
                              border-t lg:border-t-0 lg:border-l
                              border-slate-200 dark:border-slate-800
                              flex flex-col min-h-0 overflow-hidden
                              bg-white dark:bg-slate-900">
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <TelemetryInspector />
              </div>
              <div className="flex-shrink-0 border-t
                              border-slate-200 dark:border-slate-800">
                <LiveEventFeed />
              </div>
            </aside>
          </div>

          <NewTaskModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          />
        </div>
      );
    }

    if (view === 'tasks') {
      return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)]">
          <SimulationControls
            onNewTask={() => setIsModalOpen(true)}
            onViewModeChange={setViewMode}
            onFollowChange={setFollow}
            onResetCamera={() => setCameraResetKey((k) => k + 1)}
          />
          <div className="flex-1 overflow-y-auto">
            <TaskQueueTable />
          </div>
          <NewTaskModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          />
        </div>
      );
    }

    if (view === 'events') {
      return (
        <div className="h-[calc(100vh-3.5rem)] p-6">
          <div className="h-full ff-panel overflow-hidden">
            <LiveEventFeed variant="full" />
          </div>
        </div>
      );
    }

    if (view === 'analytics') {
      return (
        <div className="p-6 space-y-4">
          <h2 className="ff-label">Analytics</h2>
          <MetricKpiGrid />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DistanceChart />
            <BatteryHealthCard />
          </div>
        </div>
      );
    }

    if (view === 'dashboard') {
      return (
        <div className="p-6 space-y-4">
          <h2 className="ff-label">Dashboard</h2>
          <MetricKpiGrid />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DistanceChart />
            <BatteryHealthCard />
          </div>
        </div>
      );
    }

    if (view === 'fleet') {
      return <FleetGrid />;
    }

    if (view === 'settings') {
      return <SettingsPanel />;
    }

    return null;
  }
}
