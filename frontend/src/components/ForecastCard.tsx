// src/components/ForecastCard.tsx
import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Clock, GitMerge, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ForecastSlot } from '../lib/types';

interface ForecastCardProps {
  slot: ForecastSlot;
  index: number;
}

export const ForecastCard: React.FC<ForecastCardProps> = ({ slot, index }) => {
  const [expanded, setExpanded] = useState(false);

  if (slot.unavailable) {
    return (
      <div className="bg-surface border border-dashed border-subtle-border rounded-lg p-3 text-muted">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-muted/60 font-bold">SLOT #{index + 1}</span>
            <span className="text-cream font-medium truncate">{slot.event}</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/10 border border-subtle-border text-muted">
            ABSTAINED
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted/80 mt-2 bg-raised p-2 rounded border border-subtle-border">
          <AlertCircle className="w-4 h-4 text-data-amber flex-shrink-0" />
          <span>{slot.reason || 'Forecast unavailable: fewer than 2 independent supporting sources.'}</span>
        </div>
      </div>
    );
  }

  const pPct = Math.round(slot.p * 100);

  return (
    <div className="bg-surface border border-subtle-border rounded-lg p-3 text-cream hover:border-accent/50 transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-accent/20 border border-accent/40 text-accent-light">
            EVENT {index + 1}
          </span>
          <span className="font-semibold text-xs text-cream">{slot.event}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold font-mono text-accent-light tabular-nums">
            {pPct}%
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted hover:text-cream transition-colors p-0.5"
            title="Expand causal path details"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-2">
        <div className="flex items-center gap-1 text-muted">
          <span>Area:</span>
          <span className="text-cream font-medium">{slot.area}</span>
        </div>
        <div className="flex items-center justify-end gap-1 text-muted">
          <Clock className="w-3.5 h-3.5 text-accent-light" />
          <span>Window:</span>
          <span className="text-cream font-medium">T+{slot.window[0]} to T+{slot.window[1]}m</span>
        </div>
      </div>

      {/* Progress window bar */}
      <div className="w-full bg-raised h-1.5 rounded-full overflow-hidden border border-subtle-border">
        <div
          className="h-full bg-accent-light rounded-full transition-all duration-300"
          style={{ width: `${pPct}%` }}
        />
      </div>

      {/* Expanded Causal Chain */}
      {expanded && (
        <div className="mt-2.5 pt-2 border-t border-subtle-border text-[11px] font-mono space-y-2">
          <div>
            <span className="text-muted block text-[10px] uppercase font-bold flex items-center gap-1">
              <GitMerge className="w-3 h-3 text-data-teal" /> CAUSAL PROPAGATION PATH
            </span>
            <div className="flex items-center gap-1.5 text-cream mt-1 flex-wrap">
              {slot.path.map((step, sIdx) => (
                <React.Fragment key={sIdx}>
                  <span className="bg-raised px-1.5 py-0.5 rounded border border-subtle-border">
                    {step}
                  </span>
                  {sIdx < slot.path.length - 1 && <span className="text-muted">→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {slot.invalidated_if && slot.invalidated_if.length > 0 && (
            <div>
              <span className="text-muted block text-[10px] uppercase font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-data-amber" /> INVALIDATION CONDITIONS
              </span>
              <ul className="list-disc list-inside text-muted/90 mt-0.5 space-y-0.5">
                {slot.invalidated_if.map((cond, cIdx) => (
                  <li key={cIdx}>{cond}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
