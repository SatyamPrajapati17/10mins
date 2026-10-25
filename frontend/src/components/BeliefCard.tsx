// src/components/BeliefCard.tsx
import React, { useState } from 'react';
import { Activity, AlertOctagon, MapPin, GitFork, ArrowUp, ArrowDown, Minus, Info } from 'lucide-react';
import { HypothesisKey } from '../lib/types';

interface BeliefCardProps {
  hypothesis: HypothesisKey;
  label: string;
  probability: number; // 0 to 1
  delta: number; // change from previous minute
  history: number[]; // history up to current minute for sparkline
  supportingEvidence: string[];
  contradictingEvidence: string[];
  isDominant: boolean;
}

const HYPOTHESIS_CONFIG: Record<HypothesisKey, { color: string; bgBadge: string; icon: React.FC<{ className?: string }>; desc: string }> = {
  noise: {
    color: '#7C8DA6',
    bgBadge: 'bg-[#7C8DA6]/15 text-[#7C8DA6] border-[#7C8DA6]/30',
    icon: Activity,
    desc: 'Routine stochastic noise and harmless fluctuations'
  },
  sensor_failure: {
    color: '#B48CF2',
    bgBadge: 'bg-[#B48CF2]/15 text-[#B48CF2] border-[#B48CF2]/30',
    icon: AlertOctagon,
    desc: 'Hardware, gateway outage or telemetry glitches'
  },
  isolated: {
    color: '#F2B84B',
    bgBadge: 'bg-[#F2B84B]/15 text-[#F2B84B] border-[#F2B84B]/30',
    icon: MapPin,
    desc: 'Localized disturbance without systemic spread'
  },
  cascade: {
    color: '#FF6B5E',
    bgBadge: 'bg-[#FF6B5E]/15 text-[#FF6B5E] border-[#FF6B5E]/30',
    icon: GitFork,
    desc: 'Multi-subsystem compounding catastrophic emergency'
  }
};

export const BeliefCard: React.FC<BeliefCardProps> = ({
  hypothesis,
  label,
  probability,
  delta,
  history,
  supportingEvidence,
  contradictingEvidence,
  isDominant
}) => {
  const [showPopover, setShowPopover] = useState(false);
  const cfg = HYPOTHESIS_CONFIG[hypothesis];
  const Icon = cfg.icon;

  const pct = Math.round(probability * 100);
  const deltaPct = Math.round(delta * 100);

  // Sparkline points (15 points max)
  const sparklineData = history.slice(-15);
  const maxVal = Math.max(...sparklineData, 1.0);
  const points = sparklineData.map((val, idx) => {
    const x = (idx / Math.max(1, sparklineData.length - 1)) * 60;
    const y = 20 - (val / (maxVal || 1.0)) * 18;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div
      className={`relative bg-surface border rounded-lg p-3.5 transition-all duration-150 ${
        isDominant ? 'border-accent shadow-[0_0_12px_rgba(139,94,60,0.15)] ring-1 ring-accent/30' : 'border-subtle-border hover:border-[#8B5E3C]/50'
      }`}
      onMouseEnter={() => setShowPopover(true)}
      onMouseLeave={() => setShowPopover(false)}
      tabIndex={0}
      onFocus={() => setShowPopover(true)}
      onBlur={() => setShowPopover(false)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-raised border border-subtle-border" style={{ color: cfg.color }}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold tracking-wider uppercase text-cream">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="text-[11px] font-mono flex items-center">
            {deltaPct > 0 ? (
              <span className="text-data-coral flex items-center">
                <ArrowUp className="w-3 h-3" />+{deltaPct}%
              </span>
            ) : deltaPct < 0 ? (
              <span className="text-muted flex items-center">
                <ArrowDown className="w-3 h-3" />{deltaPct}%
              </span>
            ) : (
              <span className="text-muted flex items-center">
                <Minus className="w-3 h-3" />0%
              </span>
            )}
          </div>
          <button
            onClick={() => setShowPopover(!showPopover)}
            className="text-muted hover:text-cream p-0.5 rounded"
            title="View evidence popover"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-baseline justify-between mt-1">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold font-mono tracking-tight tabular-nums" style={{ color: cfg.color }}>
            {pct}%
          </span>
          <span className="text-xs text-muted font-mono">P({hypothesis[0].toUpperCase()})</span>
        </div>

        {/* Mini SVG Sparkline */}
        <div className="w-16 h-6">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 60 20">
            {points && (
              <polyline
                fill="none"
                stroke={cfg.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
                opacity={0.85}
              />
            )}
          </svg>
        </div>
      </div>

      {/* Probability Progress Bar */}
      <div className="w-full bg-raised h-1.5 rounded-full mt-2.5 overflow-hidden border border-subtle-border">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.max(2, pct)}%`, backgroundColor: cfg.color }}
        />
      </div>

      {/* Evidence Popover */}
      {showPopover && (
        <div className="absolute z-30 bottom-full left-0 mb-2 w-72 bg-raised border border-subtle-border rounded-lg p-3 text-xs shadow-2xl">
          <div className="font-semibold text-cream mb-1 flex items-center justify-between">
            <span>{label} Evidence</span>
            <span className="text-[10px] font-mono" style={{ color: cfg.color }}>{pct}% probability</span>
          </div>
          <p className="text-[11px] text-muted mb-2">{cfg.desc}</p>

          <div className="space-y-2 font-mono text-[11px]">
            <div>
              <span className="text-data-teal font-semibold block mb-0.5">TOP SUPPORTING EVIDENCE</span>
              {supportingEvidence.length > 0 ? (
                <ul className="space-y-1 list-disc list-inside text-cream">
                  {supportingEvidence.slice(0, 3).map((e, i) => (
                    <li key={i} className="truncate">{e}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted italic">No strong supporting signals</span>
              )}
            </div>

            {contradictingEvidence.length > 0 && (
              <div>
                <span className="text-data-amber font-semibold block mb-0.5">CONTRADICTING / UNCONFIRMED</span>
                <ul className="space-y-1 list-disc list-inside text-cream">
                  {contradictingEvidence.slice(0, 2).map((e, i) => (
                    <li key={i} className="truncate">{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
