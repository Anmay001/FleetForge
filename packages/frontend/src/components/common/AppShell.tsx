import React from 'react';
import Header from './Header';
import Sidebar, { View } from './Sidebar';

export interface AppShellProps {
  activeView: View;
  onNavigate: (v: View) => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

export default function AppShell({ activeView, onNavigate, onLogout, children }: AppShellProps) {
  return (
    <div className="h-screen w-screen bg-slate-50 dark:bg-slate-950
                    flex flex-col overflow-hidden">
      <Header onLogout={onLogout ?? (() => {})} />
      <div className="flex flex-1 min-h-0">
        <Sidebar activeView={activeView} onNavigate={onNavigate} />
        <main className="flex-1 min-w-0 overflow-auto bg-transparent">
          {children}
        </main>
      </div>
    </div>
  );
}
