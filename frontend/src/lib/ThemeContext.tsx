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
}

export const THEME_COLOR_OPTIONS: ThemeOption[] = [
  { id: 'brown', label: 'Warm Umber', main: '#8B5E3C', light: '#B07A4F', dark: '#67442B' },
  { id: 'teal', label: 'Ocean Teal', main: '#0D9488', light: '#14B8A6', dark: '#0F766E' },
  { id: 'emerald', label: 'Emerald Ops', main: '#059669', light: '#10B981', dark: '#047857' },
  { id: 'indigo', label: 'Tactical Indigo', main: '#4F46E5', light: '#6366F1', dark: '#4338CA' },
  { id: 'amber', label: 'Amber Alert', main: '#D97706', light: '#F59E0B', dark: '#B45309' },
  { id: 'crimson', label: 'Crimson Command', main: '#DC2626', light: '#EF4444', dark: '#B91C1C' },
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

    // Apply mode class
    if (mode === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }

    // Apply color CSS variables
    root.style.setProperty('--accent-main', activeColorOption.main);
    root.style.setProperty('--accent-light', activeColorOption.light);
    root.style.setProperty('--accent-dark', activeColorOption.dark);

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
