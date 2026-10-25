// src/components/Drawer.tsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children
}) => {
  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-surface border-l border-subtle-border text-cream flex flex-col shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-subtle-border flex items-center justify-between bg-raised">
            <div>
              <h2 className="text-sm font-mono font-bold tracking-wider uppercase text-cream">
                {title}
              </h2>
              {subtitle && <p className="text-xs text-muted font-mono mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-cream p-1 rounded hover:bg-[#33281F] transition-colors"
              title="Close drawer (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
