// src/components/Timeline.tsx
import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Assessment, ActionType } from '../lib/types';

interface TimelineProps {
  assessments: Assessment[];
  currentMinute: number;
  onSelectMinute: (minute: number) => void;
  faultMarkers?: Array<{ minute: number; label: string }>;
}

const ACTION_COLORS: Record<ActionType, string> = {
  WATCH: '#5AA9E6',
  PREPARE: '#F2B84B',
  ALERT: '#F28C38',
  ESCALATE: '#E5484D',
};

export const Timeline: React.FC<TimelineProps> = ({
  assessments,
  currentMinute,
  onSelectMinute,
  faultMarkers = []
}) => {
  const chartData = assessments.map((a) => ({
    minute: a.minute,
    noise: Math.round(a.belief.noise * 100),
    sensor_failure: Math.round(a.belief.sensor_failure * 100),
    isolated: Math.round(a.belief.isolated * 100),
    cascade: Math.round(a.belief.cascade * 100),
    action: a.action.controller_state,
  }));

  return (
    <div className="bg-surface border border-subtle-border rounded-lg p-3 text-cream relative overflow-hidden transition-all duration-200">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-80" />
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono uppercase tracking-wider text-muted">
          BELIEF TRAJECTORY &amp; ACTION RIBBON (MINUTES 00 - {Math.max(0, assessments.length - 1)})
        </span>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#7C8DA6]" /> Noise
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#B48CF2]" /> Sensor Fail
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#F2B84B]" /> Isolated
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#FF6B5E]" /> Cascade
          </span>
        </div>
      </div>

      {/* Main Stacked Area Chart */}
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            onClick={(state) => {
              if (state && state.activeLabel !== undefined) {
                onSelectMinute(Number(state.activeLabel));
              }
            }}
            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
          >
            <XAxis
              dataKey="minute"
              stroke="#A89684"
              fontSize={11}
              tickFormatter={(m) => `m${m}`}
              tickLine={false}
              axisLine={{ stroke: '#33281F' }}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#A89684"
              fontSize={11}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={{ stroke: '#33281F' }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-raised border border-subtle-border p-2.5 rounded shadow-xl text-xs font-mono">
                      <div className="font-bold text-cream mb-1">Minute {label}</div>
                      {payload.map((entry: any) => (
                        <div key={entry.name} className="flex justify-between gap-4" style={{ color: entry.color }}>
                          <span className="capitalize">{entry.name.replace('_', ' ')}:</span>
                          <span className="font-bold tabular-nums">{entry.value}%</span>
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              x={currentMinute}
              stroke="var(--accent-light)"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{ value: `T=${currentMinute}`, fill: 'var(--accent-light)', fontSize: 10, position: 'top' }}
            />
            {faultMarkers.map((fm, idx) => (
              <ReferenceLine
                key={idx}
                x={fm.minute}
                stroke="#FF6B5E"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                label={{ value: fm.label, fill: '#FF6B5E', fontSize: 9, position: 'insideTopLeft' }}
              />
            ))}
            <Area type="monotone" dataKey="noise" stackId="1" stroke="#7C8DA6" fill="#7C8DA6" fillOpacity={0.6} />
            <Area type="monotone" dataKey="sensor_failure" stackId="1" stroke="#B48CF2" fill="#B48CF2" fillOpacity={0.6} />
            <Area type="monotone" dataKey="isolated" stackId="1" stroke="#F2B84B" fill="#F2B84B" fillOpacity={0.6} />
            <Area type="monotone" dataKey="cascade" stackId="1" stroke="#FF6B5E" fill="#FF6B5E" fillOpacity={0.7} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Action Ribbon directly beneath the timeline */}
      <div className="mt-2 pt-2 border-t border-subtle-border">
        <div className="text-[10px] font-mono text-muted mb-1 flex items-center justify-between">
          <span>ACTION CONTROLLER STATE RIBBON</span>
          <span>Click any block to jump playback</span>
        </div>
        <div className="flex h-4 w-full gap-0.5 rounded overflow-hidden bg-base border border-subtle-border">
          {chartData.map((d) => {
            const isCurrent = d.minute === currentMinute;
            const col = ACTION_COLORS[d.action as ActionType] || '#5AA9E6';
            return (
              <div
                key={d.minute}
                onClick={() => onSelectMinute(d.minute)}
                title={`Minute ${d.minute}: ${d.action}`}
                className={`flex-1 cursor-pointer transition-opacity relative ${
                  isCurrent ? 'ring-2 ring-cream z-10' : 'hover:opacity-80'
                }`}
                style={{ backgroundColor: col }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
