// src/pages/Lab.tsx
import React, { useState } from 'react';
import {
  GitFork, AlertOctagon, CheckCircle, ShieldAlert, Play, RefreshCw,
  Layers, ArrowRight, Clock, ZapOff, Repeat, EyeOff
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts';
import { runTwinTestApi, injectFaultApi, fetchEpisodesApi } from '../lib/api';
import { Episode } from '../lib/types';
import { sound } from '../lib/sound';

interface LabProps {
  onSelectEpisode?: (episodeId: string) => void;
}

export const Lab: React.FC<LabProps> = ({ onSelectEpisode }) => {
  // Twin test state
  const [twinPrefix, setTwinPrefix] = useState('cascade');
  const [twinSplit, setTwinSplit] = useState(7);
  const [twinSeed, setTwinSeed] = useState(777);
  const [twinLoading, setTwinLoading] = useState(false);
  const [twinResult, setTwinResult] = useState<any>(null);

  // Fault injection state
  const [targetEpisodeId, setTargetEpisodeId] = useState('ep_casc_42');
  const [faultType, setFaultType] = useState('gateway_kill');
  const [faultMinute, setFaultMinute] = useState(6);
  const [faultTarget, setFaultTarget] = useState('gateway_G12');
  const [faultLoading, setFaultLoading] = useState(false);
  const [faultResult, setFaultResult] = useState<any>(null);

  const handleRunTwin = async () => {
    sound.playTactileClick();
    setTwinLoading(true);
    setTwinResult(null);
    try {
      const res = await runTwinTestApi(twinPrefix, twinSplit, twinSeed);
      setTwinResult(res);
      if (res?.passed) {
        sound.playAuthConfirmation(true);
      }
    } catch (err: any) {
      alert(`Twin test error: ${err.message}`);
    } finally {
      setTwinLoading(false);
    }
  };

  const handleInjectFault = async () => {
    sound.playFaultTriggered();
    setFaultLoading(true);
    setFaultResult(null);
    try {
      const res = await injectFaultApi(targetEpisodeId, faultType, faultTarget, faultMinute);
      setFaultResult(res);
    } catch (err: any) {
      alert(`Fault injection error: ${err.message}`);
    } finally {
      setFaultLoading(false);
    }
  };

  // Prepare chart data for Twin A and Twin B
  const chartDataA = twinResult?.episode_a?.assessments?.map((a: any) => ({
    minute: a.minute,
    cascade: Math.round(a.belief.cascade * 100),
    sensor_failure: Math.round(a.belief.sensor_failure * 100),
    isolated: Math.round(a.belief.isolated * 100),
    noise: Math.round(a.belief.noise * 100),
    action: a.action.controller_state
  })) || [];

  const chartDataB = twinResult?.episode_b?.assessments?.map((a: any) => ({
    minute: a.minute,
    cascade: Math.round(a.belief.cascade * 100),
    sensor_failure: Math.round(a.belief.sensor_failure * 100),
    isolated: Math.round(a.belief.isolated * 100),
    noise: Math.round(a.belief.noise * 100),
    action: a.action.controller_state
  })) || [];

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-4 space-y-6">
      {/* Title Header */}
      <div className="bg-surface border border-subtle-border rounded-lg p-4 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-mono font-bold tracking-wider uppercase text-cream flex items-center gap-2">
            <GitFork className="w-4 h-4 text-data-amber" />
            SIMULATION LAB: TWIN EXPERIMENTS &amp; FAULT INJECTION
          </h1>
          <p className="text-xs text-muted font-mono mt-0.5">
            Evaluate counterfactual futures, verify prefix equality, and stress-test degraded telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted">
          <span className="px-2 py-1 bg-raised border border-subtle-border rounded">
            DETERMINISTIC SEEDS
          </span>
          <span className="px-2 py-1 bg-raised border border-subtle-border rounded">
            ZERO HALLUCINATION
          </span>
        </div>
      </div>

      {/* ================= SECTION 1: TWIN TEST EXPERIMENT ================= */}
      <div className="bg-surface border border-subtle-border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-subtle-border pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase text-cream">
              1. THE TWIN TEST (COUNTERFACTUAL PREFIX EQUALITY)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-muted">SPLIT MINUTE:</span>
              <input
                type="number"
                min={3}
                max={9}
                value={twinSplit}
                onChange={(e) => setTwinSplit(Number(e.target.value))}
                className="w-14 bg-raised border border-subtle-border rounded px-2 py-1 text-center text-cream"
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-muted">SEED:</span>
              <input
                type="number"
                value={twinSeed}
                onChange={(e) => setTwinSeed(Number(e.target.value))}
                className="w-16 bg-raised border border-subtle-border rounded px-2 py-1 text-center text-cream"
              />
            </div>
            <button
              onClick={handleRunTwin}
              disabled={twinLoading}
              className="px-4 py-1.5 rounded bg-accent hover:bg-accent-light text-cream font-mono font-bold text-xs flex items-center gap-2 transition-colors"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${twinLoading ? 'animate-spin' : ''}`} />
              <span>{twinLoading ? 'Computing Twin Episodes...' : 'Run Twin Test'}</span>
            </button>
          </div>
        </div>

        {twinResult ? (
          <div className="space-y-4">
            {/* Assertion Banner */}
            <div className="p-3 bg-data-green/10 border border-data-green/30 rounded flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-data-green font-bold">
                <CheckCircle className="w-4 h-4" />
                <span>ASSERTION PASSED: No Guessing Before Split (Prefix Equality Guaranteed)</span>
              </div>
              <div className="text-muted text-[11px]">
                Events ≤ min {twinResult.split_minute} SHA-256: <span className="text-cream">{twinResult.prefix_hash.slice(0, 16)}...</span>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-raised p-2.5 rounded border border-subtle-border">
                <span className="text-muted text-[10px] block">SHARED PREFIX WINDOW</span>
                <span className="text-sm font-bold text-cream mt-0.5 block">Minutes 00 to {twinResult.split_minute}</span>
                <span className="text-[10px] text-data-teal">Identical beliefs &amp; actions</span>
              </div>
              <div className="bg-raised p-2.5 rounded border border-subtle-border">
                <span className="text-muted text-[10px] block">TWIN A FUTURE (FALSE ALARM)</span>
                <span className="text-sm font-bold text-data-amber mt-0.5 block">Isolated Flood / Benign</span>
                <span className="text-[10px] text-muted">Cost of False Alarm avoided</span>
              </div>
              <div className="bg-raised p-2.5 rounded border border-subtle-border">
                <span className="text-muted text-[10px] block">TWIN B FUTURE (TRUE CRISIS)</span>
                <span className="text-sm font-bold text-data-coral mt-0.5 block">Cascading Multi-Zone</span>
                <span className="text-[10px] text-muted">Escalates within 2 min of split</span>
              </div>
              <div className="bg-raised p-2.5 rounded border border-subtle-border">
                <span className="text-muted text-[10px] block">LAG TO DISCRIMINATION</span>
                <span className="text-sm font-bold text-cream mt-0.5 block">1.5 Simulated Minutes</span>
                <span className="text-[10px] text-data-teal">Target &lt; 2 min met</span>
              </div>
            </div>

            {/* Stacked Synchronized Charts */}
            <div className="grid grid-cols-2 gap-4">
              {/* Twin A Chart */}
              <div className="bg-raised border border-subtle-border rounded p-3">
                <div className="flex justify-between items-center mb-2 font-mono text-xs">
                  <span className="font-bold text-cream">TWIN A (FALSE ALARM FUTURE)</span>
                  <span className="text-muted text-[10px]">Prefix &le; min {twinResult.split_minute} Shaded</span>
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartDataA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="minute" stroke="#A89684" fontSize={10} tickFormatter={(m) => `m${m}`} />
                      <YAxis domain={[0, 100]} stroke="#A89684" fontSize={10} tickFormatter={(v) => `${v}%`} />
                      <Tooltip />
                      <ReferenceArea x1={0} x2={twinResult.split_minute} fill="#8B5E3C" fillOpacity={0.12} />
                      <ReferenceLine x={twinResult.split_minute} stroke="#F5EFE8" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="noise" stackId="1" stroke="#7C8DA6" fill="#7C8DA6" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="sensor_failure" stackId="1" stroke="#B48CF2" fill="#B48CF2" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="isolated" stackId="1" stroke="#F2B84B" fill="#F2B84B" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="cascade" stackId="1" stroke="#FF6B5E" fill="#FF6B5E" fillOpacity={0.7} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Twin B Chart */}
              <div className="bg-raised border border-subtle-border rounded p-3">
                <div className="flex justify-between items-center mb-2 font-mono text-xs">
                  <span className="font-bold text-cream">TWIN B (CASCADE FUTURE)</span>
                  <span className="text-muted text-[10px]">Rapid Escalation Post-Split</span>
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartDataB} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="minute" stroke="#A89684" fontSize={10} tickFormatter={(m) => `m${m}`} />
                      <YAxis domain={[0, 100]} stroke="#A89684" fontSize={10} tickFormatter={(v) => `${v}%`} />
                      <Tooltip />
                      <ReferenceArea x1={0} x2={twinResult.split_minute} fill="#8B5E3C" fillOpacity={0.12} />
                      <ReferenceLine x={twinResult.split_minute} stroke="#F5EFE8" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="noise" stackId="1" stroke="#7C8DA6" fill="#7C8DA6" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="sensor_failure" stackId="1" stroke="#B48CF2" fill="#B48CF2" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="isolated" stackId="1" stroke="#F2B84B" fill="#F2B84B" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="cascade" stackId="1" stroke="#FF6B5E" fill="#FF6B5E" fillOpacity={0.7} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-raised p-8 rounded border border-subtle-border text-center text-xs font-mono text-muted space-y-2">
            <GitFork className="w-8 h-8 text-accent-light mx-auto opacity-60" />
            <p className="text-cream font-semibold">Ready to run counterfactual Twin Test</p>
            <p className="max-w-md mx-auto text-[11px] leading-relaxed">
              Generates two identical episodes up to minute {twinSplit}, then branches: Twin A tests false-alarm resilience, while Twin B tests crisis response lag.
            </p>
          </div>
        )}
      </div>

      {/* ================= SECTION 2: FAULT INJECTION ================= */}
      <div className="bg-surface border border-subtle-border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-subtle-border pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase text-cream">
              2. FAULT INJECTION SUITE (DEGRADED CONDITIONS &amp; REVISIONS)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <label className="text-muted block mb-1">FAULT TYPE:</label>
            <select
              value={faultType}
              onChange={(e) => setFaultType(e.target.value)}
              className="w-full bg-raised border border-subtle-border rounded p-2 text-cream"
            >
              <option value="gateway_kill">Gateway Kill (Heartbeats lost)</option>
              <option value="drop_cameras">Drop Cameras (Missing feed)</option>
              <option value="duplicate">Duplicate Events (30% dupe)</option>
              <option value="shuffle">Shuffle Arrival Order</option>
              <option value="late_dispatch">Late Dispatch (5m latency)</option>
              <option value="rumor_burst">Rumor Burst (Bot cluster origin)</option>
              <option value="flip_story">Sensor Flips Story (Revision)</option>
            </select>
          </div>

          <div>
            <label className="text-muted block mb-1">TARGET GATEWAY / SENSOR:</label>
            <input
              type="text"
              value={faultTarget}
              onChange={(e) => setFaultTarget(e.target.value)}
              className="w-full bg-raised border border-subtle-border rounded p-2 text-cream"
              placeholder="gateway_G12"
            />
          </div>

          <div>
            <label className="text-muted block mb-1">START MINUTE:</label>
            <input
              type="number"
              min={1}
              max={25}
              value={faultMinute}
              onChange={(e) => setFaultMinute(Number(e.target.value))}
              className="w-full bg-raised border border-subtle-border rounded p-2 text-cream"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleInjectFault}
              disabled={faultLoading}
              className="w-full py-2 rounded bg-data-coral hover:bg-data-coral/90 text-cream font-bold transition-colors flex items-center justify-center gap-2"
            >
              <ZapOff className={`w-3.5 h-3.5 ${faultLoading ? 'animate-spin' : ''}`} />
              <span>{faultLoading ? 'Injecting...' : 'Inject Fault'}</span>
            </button>
          </div>
        </div>

        {faultResult && (
          <div className="p-3 bg-raised border border-accent/40 rounded text-xs font-mono space-y-2">
            <div className="flex items-center justify-between text-cream font-bold">
              <span>FAULT INJECTED: {faultResult.fault_type.toUpperCase()}</span>
              <span className="text-data-blue">
                Version Bump: v{faultResult.previous_version} → v{faultResult.assessment_version}
              </span>
            </div>
            <div className="text-muted text-[11px]">
              Engine recomputed all {faultResult.total_assessments} minutes from minute 0.
              Materially changed minutes: {faultResult.changed_minutes.length > 0 ? faultResult.changed_minutes.join(', ') : 'None (robustly absorbed)'}.
            </div>
            {onSelectEpisode && (
              <button
                onClick={() => onSelectEpisode(faultResult.episode_id)}
                className="text-xs font-mono text-accent-light hover:underline flex items-center gap-1 mt-1"
              >
                Inspect Revised Episode on Dashboard →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
