// src/components/Banner.tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const Banner: React.FC = () => {
  return (
    <div className="bg-raised border-b border-subtle-border text-cream px-4 py-1.5 flex items-center justify-between text-xs tracking-wider font-mono">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-data-amber opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-data-amber"></span>
        </span>
        <span className="font-semibold text-data-amber tracking-widest uppercase">SIMULATED DATA</span>
        <span className="text-muted">— not for real emergency decisions</span>
      </div>
      <div className="flex items-center gap-4 text-muted text-[11px]">
        <span>ENGINE: BAYESIAN + HYSTERESIS</span>
        <span>LATENCY &lt; 50MS</span>
      </div>
    </div>
  );
};
