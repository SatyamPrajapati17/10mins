// src/lib/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light';
export type ThemeColor = 'brown' | 'teal' | 'emerald' | 'indigo' | 'amber' | 'crimson';

export interface ThemeOption {
  id: ThemeColor;
  label: string;
  main: string;
  light: string;
  dark: string;
  glow: string;
  lightModeMain: string;
  lightModeLight: string;
}

export const THEME_COLOR_OPTIONS: ThemeOption[] = [
  {
    id: 'brown',
    label: 'Warm Umber',
    main: '#8B5E3C',
    light: '#B07A4F',
    dark: '#5C3A21',
    glow: 'rgba(139, 94, 60, 0.35)',
    lightModeMain: '#8B5E3C',
    lightModeLight: '#A56F47'
  },
  {
    id: 'teal',
    label: 'Ocean Teal',
    main: '#0D9488',
    light: '#2DD4BF',
    dark: '#115E59',
    glow: 'rgba(13, 148, 136, 0.35)',
    lightModeMain: '#0F766E',
    lightModeLight: '#14B8A6'
  },
  {
    id: 'emerald',
    label: 'Emerald Ops',
    main: '#059669',
    light: '#34D399',
    dark: '#065F46',
    glow: 'rgba(5, 150, 105, 0.35)',
    lightModeMain: '#047857',
    lightModeLight: '#10B981'
  },
  {
    id: 'indigo',
    label: 'Tactical Indigo',
    main: '#6366F1',
    light: '#818CF8',
    dark: '#4338CA',
    glow: 'rgba(99, 102, 241, 0.35)',
    lightModeMain: '#4F46E5',
    lightModeLight: '#6366F1'
  },
  {
    id: 'amber',
    label: 'Amber Alert',
    main: '#D97706',
    light: '#FBBF24',
    dark: '#92400E',
    glow: 'rgba(217, 119, 6, 0.35)',
    lightModeMain: '#B45309',
    lightModeLight: '#F59E0B'
  },
  {
    id: 'crimson',
    label: 'Crimson Command',
    main: '#DC2626',
    light: '#F87171',
    dark: '#991B1B',
    glow: 'rgba(220, 38, 38, 0.35)',
    lightModeMain: '#B91C1C',
    lightModeLight: '#EF4444'
  },
];

interface ThemeContextType {
  mode: ThemeMode;
  color: ThemeColor;
  activeColorOption: ThemeOption;
  setMode: (mode: ThemeMode) => void;
  setColor: (color: ThemeColor) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('first10_theme_mode') as ThemeMode) || 'dark';
  });

  const [color, setColorState] = useState<ThemeColor>(() => {
    return (localStorage.getItem('first10_theme_color') as ThemeColor) || 'brown';
  });

  const activeColorOption = THEME_COLOR_OPTIONS.find(c => c.id === color) || THEME_COLOR_OPTIONS[0];

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Direct inline CSS variable injection guarantees instantaneous, flicker-free updates
    if (mode === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      if (body) {
        body.classList.add('light');
        body.classList.remove('dark');
      }
      root.setAttribute('data-theme', 'light');

      root.style.setProperty('--bg-base', '#F8F6F2');
      root.style.setProperty('--bg-surface', '#FFFFFF');
      root.style.setProperty('--bg-raised', '#EFEAE2');
      root.style.setProperty('--border-subtle', '#D8CFC4');
      root.style.setProperty('--text-primary', '#1E1B18');
      root.style.setProperty('--text-muted', '#665C54');

      root.style.setProperty('--accent-main', activeColorOption.lightModeMain || activeColorOption.main);
      root.style.setProperty('--accent-light', activeColorOption.lightModeLight || activeColorOption.light);
      root.style.setProperty('--accent-dark', activeColorOption.dark);
      root.style.setProperty('--accent-glow', activeColorOption.glow);
      root.style.setProperty('--accent-surface-tint', 'rgba(0, 0, 0, 0.02)');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      if (body) {
        body.classList.add('dark');
        body.classList.remove('light');
      }
      root.setAttribute('data-theme', 'dark');

      root.style.setProperty('--bg-base', '#0D0B0A');
      root.style.setProperty('--bg-surface', '#17120F');
      root.style.setProperty('--bg-raised', '#211A15');
      root.style.setProperty('--border-subtle', '#33281F');
      root.style.setProperty('--text-primary', '#F5EFE8');
      root.style.setProperty('--text-muted', '#A89684');

      root.style.setProperty('--accent-main', activeColorOption.main);
      root.style.setProperty('--accent-light', activeColorOption.light);
      root.style.setProperty('--accent-dark', activeColorOption.dark);
      root.style.setProperty('--accent-glow', activeColorOption.glow);
      root.style.setProperty('--accent-surface-tint', 'rgba(255, 255, 255, 0.02)');
    }

    root.setAttribute('data-palette', color);

    localStorage.setItem('first10_theme_mode', mode);
    localStorage.setItem('first10_theme_color', color);
  }, [mode, color, activeColorOption]);

  const setMode = (newMode: ThemeMode) => setModeState(newMode);
  const setColor = (newColor: ThemeColor) => setColorState(newColor);
  const toggleMode = () => setModeState(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ mode, color, activeColorOption, setMode, setColor, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
