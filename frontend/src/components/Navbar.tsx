// src/components/Navbar.tsx
import React, { useState } from 'react';
import { Shield, Activity, GitFork, BarChart3, UserCheck, LogOut, PlayCircle, HelpCircle, Volume2, VolumeX } from 'lucide-react';
import { User, UserRole } from '../lib/types';
import { Banner } from './Banner';
import { ThemeSelector } from './ThemeSelector';
import { sound } from '../lib/audio';

interface NavbarProps {
  currentTab: 'dashboard' | 'lab' | 'metrics';
  onSelectTab: (tab: 'dashboard' | 'lab' | 'metrics') => void;
  currentUser: User | null;
  onSwitchUser: (role: UserRole) => void;
  onLogout: () => void;
  onQuickDemo?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onSwitchUser,
  onLogout,
  onQuickDemo
}) => {
  const [soundActive, setSoundActive] = useState(() => sound.isEnabled());
  return (
    <header className="sticky top-0 z-40 bg-base border-b border-subtle-border">
      {/* Persistent Banner */}
      <Banner />

      <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo and Product Title */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded flex items-center justify-center text-white font-mono font-bold text-sm border border-accent/40 shadow-sm transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--accent-light), var(--accent-main))',
                boxShadow: '0 2px 10px var(--accent-glow)'
              }}
            >
              F10
            </div>
            <div>
              <span className="font-mono font-bold tracking-wider text-sm text-cream block leading-tight">
                FIRST 10
              </span>
              <span className="text-[10px] font-mono text-muted tracking-tight">
                CRISIS INFERENCE ENGINE
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-accent/15 text-cream border border-accent/40 shadow-sm ring-1 ring-accent/20'
                  : 'text-muted hover:text-cream'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-accent-light" />
              <span>Operations Dashboard</span>
            </button>

            <button
              onClick={() => onSelectTab('lab')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${
                currentTab === 'lab'
                  ? 'bg-raised text-cream border border-subtle-border shadow-sm'
                  : 'text-muted hover:text-cream'
              }`}
            >
              <GitFork className="w-3.5 h-3.5 text-data-amber" />
              <span>Twin Lab &amp; Faults</span>
            </button>

            <button
              onClick={() => onSelectTab('metrics')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${
                currentTab === 'metrics'
                  ? 'bg-raised text-cream border border-subtle-border shadow-sm'
                  : 'text-muted hover:text-cream'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-data-teal" />
              <span>Metrics &amp; Calibration</span>
            </button>
          </nav>
        </div>

        {/* Right side: Quick Demo, Theme Selector, Role Switcher, User badge */}
        <div className="flex items-center gap-3">
          {onQuickDemo && (
            <button
              onClick={onQuickDemo}
              className="px-2.5 py-1 rounded bg-accent/20 hover:bg-accent/30 border border-accent/40 text-accent-light text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
              title="Instantly load the standard Cascade crisis demo episode"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Cascade Demo</span>
            </button>
          )}

          {/* Theme & Color Palette Selector */}
          <ThemeSelector />

          {/* Tactical Audio Telemetry Toggle */}
          <button
            onClick={() => {
              const newState = sound.toggle();
              setSoundActive(newState);
            }}
            className={`p-1.5 rounded bg-surface border transition-colors flex items-center gap-1 font-mono text-xs ${
              soundActive
                ? 'border-subtle-border hover:border-accent text-cream'
                : 'border-data-coral/40 text-data-coral bg-data-coral/10'
            }`}
            title={soundActive ? 'Tactical Audio: ON (Click to mute)' : 'Tactical Audio: MUTED (Click to enable)'}
          >
            {soundActive ? (
              <Volume2 className="w-3.5 h-3.5 text-accent-light" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-data-coral" />
            )}
          </button>

          {/* Demo User Fast Role Switcher */}
          <div className="flex items-center bg-surface border border-subtle-border rounded p-0.5 text-[11px] font-mono">
            <span className="px-2 text-muted">Role:</span>
            {(['duty_officer', 'supervisor', 'analyst', 'admin'] as UserRole[]).map((r) => {
              const isSelected = currentUser?.role === r;
              const shortNames: Record<UserRole, string> = {
                viewer: 'V',
                duty_officer: 'Officer',
                supervisor: 'Super',
                analyst: 'Analyst',
                admin: 'Admin'
              };
              return (
                <button
                  key={r}
                  onClick={() => onSwitchUser(r)}
                  className={`px-2 py-0.5 rounded transition-all ${
                    isSelected
                      ? 'bg-accent text-white font-bold shadow-sm'
                      : 'text-muted hover:text-cream'
                  }`}
                  style={isSelected ? { boxShadow: '0 1px 6px var(--accent-glow)' } : {}}
                  title={`Switch active demo session to ${r}`}
                >
                  {shortNames[r]}
                </button>
              );
            })}
          </div>

          {/* User profile & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-subtle-border">
            <div className="flex flex-col text-right">
              <span className="text-xs font-mono font-semibold text-cream leading-tight">
                {currentUser?.display_name || 'Officer Marcus'}
              </span>
              <span className="text-[10px] font-mono text-accent-light uppercase">
                {currentUser?.role || 'duty_officer'}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="text-muted hover:text-cream p-1.5 rounded hover:bg-raised"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
