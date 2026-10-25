// src/components/EvidenceHealth.tsx
import React from 'react';
import { Layers, AlertTriangle, Radio, EyeOff } from 'lucide-react';
import { Uncertainty, EvidenceSummary } from '../lib/types';

interface EvidenceHealthProps {
  uncertainty: Uncertainty;
  evidence: EvidenceSummary;
  onOpenSourceDrawer: () => void;
}

export const EvidenceHealth: React.FC<EvidenceHealthProps> = ({
  uncertainty,
  evidence,
  onOpenSourceDrawer
}) => {
  const missingCount = evidence.missing.length;
  const discountedCount = evidence.discounted.length;

  return (
    <div className="bg-surface border border-subtle-border rounded-lg p-3 text-cream">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono uppercase tracking-wider text-muted flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-accent-light" /> EVIDENCE HEALTH &amp; PROVENANCE
        </span>
        <button
          onClick={onOpenSourceDrawer}
          className="text-xs font-mono text-accent-light hover:underline flex items-center gap-1"
        >
          View Source Map →
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs font-mono">
        {/* Independent Sources */}
        <div
          onClick={onOpenSourceDrawer}
          className="bg-raised p-2 rounded border border-subtle-border cursor-pointer hover:border-accent/40 transition-colors"
        >
          <span className="text-[10px] text-muted block flex items-center gap-1">
            <Radio className="w-3 h-3 text-data-teal" /> INDEP SOURCES
          </span>
          <span className="text-base font-bold text-cream tabular-nums mt-0.5 block">
            {uncertainty.effective_independent_sources.toFixed(1)}
          </span>
          <span className="text-[10px] text-muted truncate">Discounted for corr</span>
        </div>

        {/* Entropy Bits */}
        <div className="bg-raised p-2 rounded border border-subtle-border">
          <span className="text-[10px] text-muted block flex items-center gap-1">
            <Layers className="w-3 h-3 text-data-violet" /> UNCERTAINTY
          </span>
          <span className="text-base font-bold text-cream tabular-nums mt-0.5 block">
            {uncertainty.entropy_bits.toFixed(2)} <span className="text-[10px] font-normal text-muted">bits</span>
          </span>
          <span className="text-[10px] text-muted truncate">4-hypothesis entropy</span>
        </div>

        {/* Suspected Shared Failures */}
        <div
          onClick={onOpenSourceDrawer}
          className={`bg-raised p-2 rounded border cursor-pointer transition-colors ${
            discountedCount > 0 ? 'border-data-amber/50 bg-data-amber/5' : 'border-subtle-border'
          }`}
        >
          <span className="text-[10px] text-muted block flex items-center gap-1">
            <AlertTriangle className={`w-3 h-3 ${discountedCount > 0 ? 'text-data-amber' : 'text-muted'}`} /> SHARED DISCOUNTS
          </span>
          <span className="text-base font-bold text-cream tabular-nums mt-0.5 block">
            {discountedCount}
          </span>
          <span className="text-[10px] text-muted truncate">Common-cause gateways</span>
        </div>

        {/* Missing Feeds */}
        <div
          onClick={onOpenSourceDrawer}
          className={`bg-raised p-2 rounded border cursor-pointer transition-colors ${
            missingCount > 0 ? 'border-data-coral/50 bg-data-coral/5' : 'border-subtle-border'
          }`}
        >
          <span className="text-[10px] text-muted block flex items-center gap-1">
            <EyeOff className={`w-3 h-3 ${missingCount > 0 ? 'text-data-coral' : 'text-muted'}`} /> MISSING FEEDS
          </span>
          <span className="text-base font-bold text-cream tabular-nums mt-0.5 block">
            {missingCount}
          </span>
          <span className="text-[10px] text-muted truncate">
            {missingCount > 0 ? evidence.missing.join(', ') : 'None missing'}
          </span>
        </div>
      </div>
    </div>
  );
};
