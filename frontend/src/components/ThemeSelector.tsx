// src/components/ThemeSelector.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Palette, ChevronDown, Check, Volume2, VolumeX } from 'lucide-react';
import { useTheme, THEME_COLOR_OPTIONS, ThemeColor } from '../lib/ThemeContext';
import { sound } from '../lib/sound';

export const ThemeSelector: React.FC = () => {
  const { mode, color, activeColorOption, toggleMode, setColor } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => sound.isEnabled());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs">
      {/* Tactical Audio Toggle */}
      <button
        onClick={() => {
          const nextState = sound.toggle();
          setSoundEnabled(nextState);
        }}
        className={`px-2 py-1.5 rounded bg-surface border transition-all flex items-center gap-1 shadow-sm ${
          soundEnabled
            ? 'border-accent text-cream hover:border-accent-light'
            : 'border-subtle-border text-muted hover:text-cream'
        }`}
        title={`Tactical Audio: ${soundEnabled ? 'ON (Click to Mute)' : 'MUTED (Click to Enable)'}`}
      >
        {soundEnabled ? (
          <Volume2 className="w-3.5 h-3.5 text-accent-light" />
        ) : (
          <VolumeX className="w-3.5 h-3.5 text-muted" />
        )}
        <span className="text-[10px] uppercase font-bold hidden sm:inline">
          {soundEnabled ? 'SND' : 'MUTE'}
        </span>
      </button>
      {/* Light / Dark Mode Toggle */}
      <button
        onClick={toggleMode}
        className="px-2.5 py-1.5 rounded bg-surface border border-subtle-border hover:border-accent text-cream transition-all flex items-center gap-1.5 shadow-sm"
        title={`Current: ${mode.toUpperCase()} mode. Click to toggle to ${mode === 'dark' ? 'LIGHT' : 'DARK'} mode.`}
      >
        {mode === 'dark' ? (
          <>
            <Moon className="w-3.5 h-3.5 text-accent-light" />
            <span className="text-[10px] uppercase font-bold text-cream">Dark</span>
          </>
        ) : (
          <>
            <Sun className="w-3.5 h-3.5 text-data-amber" />
            <span className="text-[10px] uppercase font-bold text-cream">Light</span>
          </>
        )}
      </button>

      {/* Theme Accent Color Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="px-2.5 py-1.5 rounded bg-surface border border-subtle-border hover:border-accent text-cream transition-all flex items-center gap-1.5 shadow-sm"
          title="Change theme color palette"
        >
          <span
            className="w-2.5 h-2.5 rounded-full border border-subtle-border shadow-sm flex-shrink-0"
            style={{ backgroundColor: activeColorOption.main, boxShadow: '0 0 6px var(--accent-glow)' }}
          />
          <span className="text-[10px] uppercase font-bold text-cream">
            {activeColorOption.label}
          </span>
          <ChevronDown className="w-3 h-3 text-muted" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-44 bg-surface border border-subtle-border rounded-lg shadow-2xl py-1 z-50">
            <div className="px-2.5 py-1 text-[9px] uppercase tracking-wider text-muted font-bold border-b border-subtle-border mb-1">
              THEME COLOR PALETTE
            </div>
            {THEME_COLOR_OPTIONS.map((opt) => {
              const isSelected = opt.id === color;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    setColor(opt.id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between hover:bg-raised transition-colors ${
                    isSelected ? 'bg-raised font-bold text-cream' : 'text-muted hover:text-cream'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full border border-subtle-border shadow-sm flex-shrink-0"
                      style={{ backgroundColor: opt.main }}
                    />
                    <span className="text-[11px]">{opt.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-accent-light" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
