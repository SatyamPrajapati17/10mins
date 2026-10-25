// src/components/WhyPanel.tsx
import React from 'react';
import { HelpCircle, FileText, TrendingUp, CheckCircle, HelpCircle as QuestionIcon } from 'lucide-react';
import { Explanation } from '../lib/types';

interface WhyPanelProps {
  explanation: Explanation;
  minute: number;
}

export const WhyPanel: React.FC<WhyPanelProps> = ({ explanation, minute }) => {
  return (
    <div className="bg-surface border border-subtle-border rounded-lg p-3 text-cream">
      <div className="flex items-center justify-between mb-3 border-b border-subtle-border pb-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-accent-light" />
          <span className="text-xs font-mono uppercase tracking-wider font-semibold text-cream">
            DECISION EXPLANATION (MIN {String(minute).padStart(2, '0')})
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted bg-raised px-2 py-0.5 rounded border border-subtle-border">
          DETERMINISTIC REASONING
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* 1. New Evidence */}
        <div className="bg-raised p-2.5 rounded border border-subtle-border flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-accent-light font-bold flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5" /> 1. NEW EVIDENCE
            </span>
            <p className="text-cream text-xs leading-relaxed">{explanation.new_evidence}</p>
          </div>
        </div>

        {/* 2. How Beliefs Changed */}
        <div className="bg-raised p-2.5 rounded border border-subtle-border flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-accent-light font-bold flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5" /> 2. HOW BELIEFS CHANGED
            </span>
            <p className="text-cream text-xs leading-relaxed">{explanation.belief_change}</p>
          </div>
        </div>

        {/* 3. Why This Action */}
        <div className="bg-raised p-2.5 rounded border border-subtle-border flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-accent-light font-bold flex items-center gap-1.5 mb-1">
              <CheckCircle className="w-3.5 h-3.5" /> 3. WHY THIS ACTION
            </span>
            <p className="text-cream text-xs leading-relaxed">{explanation.why_action}</p>
          </div>
        </div>

        {/* 4. What Would Change It */}
        <div className="bg-raised p-2.5 rounded border border-subtle-border flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-accent-light font-bold flex items-center gap-1.5 mb-1">
              <QuestionIcon className="w-3.5 h-3.5" /> 4. WHAT WOULD CHANGE IT
            </span>
            <p className="text-cream text-xs leading-relaxed">{explanation.what_would_change}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
