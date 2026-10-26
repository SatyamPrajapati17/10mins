// src/components/ActionBadge.tsx
import React from 'react';
import { Eye, ClipboardCheck, Bell, Megaphone, ShieldAlert, ArrowRight, Clock } from 'lucide-react';
import { ActionType } from '../lib/types';

interface ActionBadgeProps {
  currentAction: ActionType;
  recommendedAction: ActionType;
  sinceMinute: number;
  expectedCost: Record<ActionType, number>;
  transitionReason: string;
  overrideTriggered: boolean;
  onRequestEscalate: () => void;
  canRequestAuth: boolean;
}

const ACTION_METAS: Record<ActionType, { label: string; color: string; bg: string; icon: React.FC<{ className?: string }> }> = {
  WATCH: {
    label: 'WATCH',
    color: '#5AA9E6',
    bg: 'bg-[#5AA9E6]/15 border-[#5AA9E6]',
    icon: Eye
  },
  PREPARE: {
    label: 'PREPARE',
    color: '#F2B84B',
    bg: 'bg-[#F2B84B]/20 border-[#F2B84B]',
    icon: ClipboardCheck
  },
  ALERT: {
    label: 'ALERT',
    color: '#F28C38',
    bg: 'bg-[#F28C38]/25 border-[#F28C38]',
    icon: Bell
  },
  ESCALATE: {
    label: 'ESCALATE',
    color: '#E5484D',
    bg: 'bg-[#E5484D]/30 border-[#E5484D]',
    icon: Megaphone
  }
};

export const ActionBadge: React.FC<ActionBadgeProps> = ({
  currentAction,
  recommendedAction,
  sinceMinute,
  expectedCost,
  transitionReason,
  overrideTriggered,
  onRequestEscalate,
  canRequestAuth
}) => {
  const meta = ACTION_METAS[currentAction] || ACTION_METAS.WATCH;
  const Icon = meta.icon;

  const maxCost = Math.max(...Object.values(expectedCost), 50.0);

  // Format transition explanation
  const getSubtext = () => {
    if (overrideTriggered) return 'Immediate Cascade Override';
    if (transitionReason.includes('hysteresis')) return 'Held by Hysteresis Delay';
    if (transitionReason.includes('waiting')) return 'Held by Value of Waiting';
    return `Transition: ${transitionReason.replace(/_/g, ' ')}`;
  };

  return (
    <div className="bg-surface border border-subtle-border rounded-lg p-3.5 text-cream">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono uppercase tracking-wider text-muted flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> CURRENT CONTROLLER STATE
        </span>
        <span className="text-xs font-mono text-muted">
          Active since min {sinceMinute}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border font-mono font-bold text-lg tracking-wider ${meta.bg}`}
            style={{ color: meta.color }}
          >
            <Icon className="w-5 h-5" />
            <span>{meta.label}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs text-cream font-medium">
              {getSubtext()}
            </span>
            <span className="text-[11px] text-muted font-mono">
              Raw argmin: {recommendedAction} (EL: {expectedCost[recommendedAction]?.toFixed(1)})
            </span>
          </div>
        </div>

        {/* Consequential action button */}
        {(currentAction === 'ESCALATE' || currentAction === 'ALERT' || recommendedAction === 'ESCALATE') && (
          <button
            onClick={onRequestEscalate}
            disabled={!canRequestAuth}
            className={`px-3 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              canRequestAuth
                ? 'bg-data-red text-cream hover:bg-data-red/90 ring-1 ring-data-red'
                : 'bg-raised text-muted border border-subtle-border cursor-not-allowed'
            }`}
            title={canRequestAuth ? 'Request authorization for consequential action' : 'Login as duty officer to request'}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Request {currentAction === 'ESCALATE' ? 'ESCALATE' : 'Authorization'}</span>
          </button>
        )}
      </div>

      {/* Mini Expected Loss 4-bar chart */}
      <div className="mt-3 pt-3 border-t border-subtle-border">
        <div className="flex items-center justify-between text-[11px] font-mono text-muted mb-1.5">
          <span>EXPECTED LOSS EL(a) BY ACTION (LOWEST = OPTIMAL)</span>
          <span className="text-accent-light">Min Cost: {expectedCost[recommendedAction]?.toFixed(1)}</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {(['WATCH', 'PREPARE', 'ALERT', 'ESCALATE'] as ActionType[]).map((act) => {
            const cost = expectedCost[act] || 0;
            const isLowest = act === recommendedAction;
            const isCurrent = act === currentAction;
            const heightPct = Math.min(100, Math.max(12, (cost / maxCost) * 100));

            return (
              <div
                key={act}
                className={`bg-raised p-2 rounded border text-center font-mono text-[11px] transition-colors ${
                  isLowest ? 'border-accent bg-accent/10' : 'border-subtle-border'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-semibold ${isLowest ? 'text-accent-light' : 'text-muted'}`}>{act}</span>
                  {isCurrent && (
                    <span className="text-[9px] px-1 py-0.2 bg-cream/10 rounded text-cream">ACT</span>
                  )}
                </div>
                <div className="h-6 w-full bg-base rounded flex items-end overflow-hidden p-0.5">
                  <div
                    className={`w-full rounded-sm transition-all duration-300 ${
                      isLowest ? 'bg-accent' : 'bg-muted/40'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="block mt-1 font-bold text-cream tabular-nums">{cost.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
