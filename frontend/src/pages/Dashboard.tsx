// src/pages/Dashboard.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, SkipForward, RotateCcw, ShieldAlert, FileText, Layers,
  Activity, Clock, AlertTriangle, Radio, RefreshCw, ChevronRight, CheckCircle, CloudRain
} from 'lucide-react';
import { Episode, Assessment, User, AuthorizationRequest, AuditEntry, HypothesisKey } from '../lib/types';
import {
  fetchEpisodesApi, fetchAssessmentsApi, fetchAuthorizationsApi,
  fetchAuditApi, createEpisodeApi
} from '../lib/api';
import { BeliefCard } from '../components/BeliefCard';
import { ActionBadge } from '../components/ActionBadge';
import { ForecastCard } from '../components/ForecastCard';
import { EvidenceHealth } from '../components/EvidenceHealth';
import { Timeline } from '../components/Timeline';
import { WhyPanel } from '../components/WhyPanel';
import { LiveMap } from '../components/LiveMap';
import { WeatherCard } from '../components/WeatherCard';
import { Drawer } from '../components/Drawer';
import { AuthModal } from '../components/AuthModal';

interface DashboardProps {
  currentUser: User | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser }) => {
  // Episode & playback state
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [currentMinute, setCurrentMinute] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1); // 1x, 2x, 5x
  const [assessmentVersion, setAssessmentVersion] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Drawers & Modals
  const [activeDrawer, setActiveDrawer] = useState<'evidence' | 'sources' | 'audit' | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authorizations, setAuthorizations] = useState<AuthorizationRequest[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  // Tracked GPS location (defaults to Mumbai)
  const [trackedLocation, setTrackedLocation] = useState<{ lat: number; lon: number }>({
    lat: 19.0760,
    lon: 72.8777
  });

  // Load episodes on mount
  useEffect(() => {
    loadEpisodes();
    loadAuthorizations();
  }, []);

  const loadEpisodes = async () => {
    try {
      const eps = await fetchEpisodesApi();
      setEpisodes(eps);
      if (eps.length > 0) {
        // Default to the cascade demo episode if present, or first
        const cascadeEp = eps.find(e => e.scenario === 'cascade') || eps[0];
        setSelectedEpisodeId(cascadeEp.id);
        loadAssessments(cascadeEp.id);
      } else {
        // Auto-seed if empty
        const newEp = await createEpisodeApi('cascade', 42, 30);
        setSelectedEpisodeId(newEp.episode_id);
        loadAssessments(newEp.episode_id);
      }
    } catch (err) {
      console.error('Failed loading episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAssessments = async (epId: string) => {
    try {
      const data = await fetchAssessmentsApi(epId);
      setAssessments(data.assessments);
      setAssessmentVersion(data.assessment_version);
      setCurrentMinute(0);
      setIsPlaying(false);
    } catch (err) {
      console.error('Failed loading assessments:', err);
    }
  };

  const loadAuthorizations = async () => {
    try {
      const data = await fetchAuthorizationsApi();
      setAuthorizations(data);
    } catch (err) {
      console.error('Failed loading authorizations:', err);
    }
  };

  const loadAudit = async () => {
    try {
      const data = await fetchAuditApi();
      setAuditLog(data);
    } catch (err) {
      console.error('Failed loading audit:', err);
    }
  };

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = 1200 / speed;
    const timer = setInterval(() => {
      setCurrentMinute((prev) => {
        if (prev >= assessments.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isPlaying, speed, assessments.length]);

  // Keyboard navigation: Space (play/pause), J/K (step), E, S, A, Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setCurrentMinute((m) => Math.min(assessments.length - 1, m + 1));
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        setCurrentMinute((m) => Math.max(0, m - 1));
      } else if (e.key === 'e' || e.key === 'E') {
        setActiveDrawer('evidence');
      } else if (e.key === 's' || e.key === 'S') {
        setActiveDrawer('sources');
      } else if (e.key === 'a' || e.key === 'A') {
        loadAudit();
        setActiveDrawer('audit');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assessments.length]);

  // Current and previous assessments
  const currentAssessment = assessments[currentMinute] || assessments[0];
  const prevAssessment = currentMinute > 0 ? assessments[currentMinute - 1] : null;

  if (loading || !currentAssessment) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[500px] text-muted font-mono text-xs">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-accent-light" />
          <span>INITIALIZING CRISIS ENGINE CONSOLE...</span>
        </div>
      </div>
    );
  }

  // Calculate probability deltas
  const deltas: Record<HypothesisKey, number> = {
    noise: prevAssessment ? currentAssessment.belief.noise - prevAssessment.belief.noise : 0,
    sensor_failure: prevAssessment ? currentAssessment.belief.sensor_failure - prevAssessment.belief.sensor_failure : 0,
    isolated: prevAssessment ? currentAssessment.belief.isolated - prevAssessment.belief.isolated : 0,
    cascade: prevAssessment ? currentAssessment.belief.cascade - prevAssessment.belief.cascade : 0,
  };

  // Extract history up to current minute for sparklines
  const getHistory = (key: HypothesisKey) => {
    return assessments.slice(0, currentMinute + 1).map((a) => a.belief[key]);
  };

  // Determine dominant hypothesis
  const dominantKey = (Object.keys(currentAssessment.belief) as HypothesisKey[]).reduce((a, b) =>
    currentAssessment.belief[a] > currentAssessment.belief[b] ? a : b
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">
      {/* ================= TOP OPERATIONAL BAR ================= */}
      <div className="bg-surface border border-subtle-border rounded-lg p-3 flex items-center justify-between gap-4 font-mono text-xs relative overflow-hidden transition-all duration-200">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-90" />
        {/* Left: Episode Picker & Meta */}
        <div className="flex items-center gap-3">
          <label className="text-muted text-[11px] uppercase">EPISODE:</label>
          <select
            value={selectedEpisodeId}
            onChange={(e) => {
              setSelectedEpisodeId(e.target.value);
              loadAssessments(e.target.value);
            }}
            className="bg-raised border border-subtle-border text-cream px-2.5 py-1 rounded text-xs focus:outline-none focus:border-accent transition-colors"
          >
            {episodes.map((ep) => (
              <option key={ep.id} value={ep.id}>
                {ep.id} — {ep.scenario.toUpperCase()} (Seed {ep.seed})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-raised border border-subtle-border text-muted">
            <span>VERSION:</span>
            <span className={`font-bold ${assessmentVersion > 1 ? 'text-data-blue' : 'text-cream'}`}>
              v{assessmentVersion} {assessmentVersion > 1 && '(REVISED)'}
            </span>
          </div>

          {/* Quick Live Weather Pill in Top Bar */}
          <button
            onClick={() => {
              const el = document.getElementById('operational-radar-panel');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-raised border border-subtle-border hover:border-accent text-muted hover:text-cream transition-colors text-left"
            title="Click to view live weather details and spatial radar map"
          >
            <CloudRain className="w-3.5 h-3.5 text-data-teal flex-shrink-0" />
            <span className="text-[10px] uppercase font-bold text-accent-light">LIVE WX:</span>
            <span className="text-cream font-bold tabular-nums">29°C</span>
            <span className="text-[9px] text-muted hidden lg:inline">Rain: 0mm</span>
          </button>
        </div>

        {/* Center: Playback Controls & Minute Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-base p-1 rounded border border-subtle-border">
            <button
              onClick={() => setCurrentMinute(0)}
              className="p-1 text-muted hover:text-cream rounded hover:bg-raised"
              title="Reset to Minute 0 (⏮)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentMinute((m) => Math.max(0, m - 1))}
              className="px-2 py-1 text-muted hover:text-cream rounded hover:bg-raised text-[11px]"
              title="Step Backward (J)"
            >
              J
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-3.5 py-1 bg-accent hover:bg-accent-light text-white rounded font-bold flex items-center gap-1.5 shadow-md transition-all"
              style={{ boxShadow: '0 2px 10px var(--accent-glow)' }}
              title="Play / Pause (Space)"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>
            <button
              onClick={() => setCurrentMinute((m) => Math.min(assessments.length - 1, m + 1))}
              className="px-2 py-1 text-muted hover:text-cream rounded hover:bg-raised text-[11px]"
              title="Step Forward (K)"
            >
              K
            </button>
          </div>

          {/* Minute Progress Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-raised border border-subtle-border">
            <span className="text-muted">MINUTE:</span>
            <span className="font-bold text-accent-light text-sm tabular-nums">
              {String(currentMinute).padStart(2, '0')}/{String(assessments.length - 1).padStart(2, '0')}
            </span>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center bg-base rounded border border-subtle-border p-0.5 text-[11px]">
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-0.5 rounded transition-all ${
                  speed === s ? 'bg-accent text-white font-bold shadow-sm' : 'text-muted hover:text-cream'
                }`}
                style={speed === s ? { boxShadow: '0 1px 6px var(--accent-glow)' } : {}}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Right: Quick Drawer Triggers */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveDrawer('evidence')}
            className="px-2.5 py-1 rounded bg-raised border border-subtle-border hover:border-accent hover:text-accent-light text-cream text-xs flex items-center gap-1 transition-all"
            title="Evidence List (E)"
          >
            <FileText className="w-3.5 h-3.5 text-accent-light" />
            <span>Evidence</span>
          </button>
          <button
            onClick={() => setActiveDrawer('sources')}
            className="px-2.5 py-1 rounded bg-raised border border-subtle-border hover:border-accent text-cream text-xs flex items-center gap-1"
            title="Source Health & Gateways (S)"
          >
            <Layers className="w-3.5 h-3.5 text-data-teal" />
            <span>Sources</span>
          </button>
          <button
            onClick={() => {
              loadAuthorizations();
              setIsAuthModalOpen(true);
            }}
            className="px-2.5 py-1 rounded bg-raised border border-subtle-border hover:border-accent text-cream text-xs flex items-center gap-1"
            title="Authorization Queue & Requests"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-data-red" />
            <span>Auth Queue</span>
          </button>
          <button
            onClick={() => {
              loadAudit();
              setActiveDrawer('audit');
            }}
            className="px-2.5 py-1 rounded bg-raised border border-subtle-border hover:border-accent text-cream text-xs flex items-center gap-1"
            title="Audit Trail (A)"
          >
            <Clock className="w-3.5 h-3.5 text-muted" />
            <span>Audit</span>
          </button>
        </div>
      </div>

      {/* ================= ROW 1: ACTION BADGE & 4 BELIEF CARDS ================= */}
      <div className="grid grid-cols-12 gap-4">
        {/* Current Action Badge (4 cols) */}
        <div className="col-span-4">
          <ActionBadge
            currentAction={currentAssessment.action.controller_state}
            recommendedAction={currentAssessment.action.recommended}
            sinceMinute={0}
            expectedCost={currentAssessment.action.expected_cost}
            transitionReason={currentAssessment.action.transition_reason}
            overrideTriggered={currentAssessment.action.override_triggered}
            onRequestEscalate={() => setIsAuthModalOpen(true)}
            canRequestAuth={currentUser?.role === 'duty_officer' || currentUser?.role === 'supervisor' || currentUser?.role === 'admin'}
          />
        </div>

        {/* 4 Belief Cards (8 cols, 2 cols each) */}
        <div className="col-span-8 grid grid-cols-4 gap-3">
          <BeliefCard
            hypothesis="noise"
            label="Noise"
            probability={currentAssessment.belief.noise}
            delta={deltas.noise}
            history={getHistory('noise')}
            supportingEvidence={currentAssessment.evidence.supporting}
            contradictingEvidence={currentAssessment.evidence.contradicting}
            isDominant={dominantKey === 'noise'}
          />
          <BeliefCard
            hypothesis="sensor_failure"
            label="Sensor Fail"
            probability={currentAssessment.belief.sensor_failure}
            delta={deltas.sensor_failure}
            history={getHistory('sensor_failure')}
            supportingEvidence={currentAssessment.evidence.supporting}
            contradictingEvidence={currentAssessment.evidence.contradicting}
            isDominant={dominantKey === 'sensor_failure'}
          />
          <BeliefCard
            hypothesis="isolated"
            label="Isolated"
            probability={currentAssessment.belief.isolated}
            delta={deltas.isolated}
            history={getHistory('isolated')}
            supportingEvidence={currentAssessment.evidence.supporting}
            contradictingEvidence={currentAssessment.evidence.contradicting}
            isDominant={dominantKey === 'isolated'}
          />
          <BeliefCard
            hypothesis="cascade"
            label="Cascade"
            probability={currentAssessment.belief.cascade}
            delta={deltas.cascade}
            history={getHistory('cascade')}
            supportingEvidence={currentAssessment.evidence.supporting}
            contradictingEvidence={currentAssessment.evidence.contradicting}
            isDominant={dominantKey === 'cascade'}
          />
        </div>
      </div>

      {/* ================= ROW 2: FORECASTS & TIMELINE ================= */}
      <div className="grid grid-cols-12 gap-4">
        {/* Next 3 Events (4 cols) */}
        <div className="col-span-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono text-muted uppercase">
            <span>NEXT THREE CAUSAL EVENTS</span>
            <span className="text-[10px] text-accent-light">Ranked by P × Impact</span>
          </div>
          {currentAssessment.forecast.map((slot, idx) => (
            <ForecastCard key={idx} slot={slot} index={idx} />
          ))}
        </div>

        {/* Belief Timeline Chart (8 cols) */}
        <div className="col-span-8">
          <Timeline
            assessments={assessments}
            currentMinute={currentMinute}
            onSelectMinute={(m) => setCurrentMinute(m)}
          />
        </div>
      </div>

      {/* ================= ROW 3: EVIDENCE HEALTH & WHY PANEL ================= */}
      <div className="grid grid-cols-12 gap-4">
        {/* Evidence Health Chips (4 cols) */}
        <div className="col-span-4">
          <EvidenceHealth
            uncertainty={currentAssessment.uncertainty}
            evidence={currentAssessment.evidence}
            onOpenSourceDrawer={() => setActiveDrawer('sources')}
          />
        </div>

        {/* Why This Decision Panel (8 cols) */}
        <div className="col-span-8">
          <WhyPanel
            explanation={currentAssessment.explanation}
            minute={currentMinute}
          />
        </div>
      </div>

      {/* ================= ROW 4: OPERATIONAL SPATIAL RADAR & LIVE WEATHER ================= */}
      <div id="operational-radar-panel" className="grid grid-cols-12 gap-4 scroll-mt-20">
        {/* Live Leaflet Map Panel (8 cols) */}
        <div className="col-span-8">
          <LiveMap
            currentBelief={currentAssessment.belief}
            onOpenSourceHealth={() => setActiveDrawer('sources')}
            onLocationTracked={(lat, lon) => {
              const rLat = Math.round(lat * 100) / 100;
              const rLon = Math.round(lon * 100) / 100;
              setTrackedLocation(prev => {
                if (Math.abs(prev.lat - rLat) < 0.01 && Math.abs(prev.lon - rLon) < 0.01) return prev;
                return { lat: rLat, lon: rLon };
              });
            }}
          />
        </div>

        {/* Live Weather Card (4 cols) */}
        <div className="col-span-4 flex flex-col justify-between">
          <WeatherCard
            lat={trackedLocation.lat}
            lon={trackedLocation.lon}
          />

          {/* Quick Keyboard Reference */}
          <div className="bg-surface border border-subtle-border rounded-lg p-3 text-xs font-mono mt-3">
            <span className="text-[10px] uppercase text-muted block mb-1.5 font-bold">KEYBOARD OPERATIONAL SHORTCUTS</span>
            <div className="grid grid-cols-2 gap-1.5 text-muted text-[11px]">
              <div><kbd className="bg-raised px-1.5 py-0.5 rounded text-cream">Space</kbd> Play / Pause</div>
              <div><kbd className="bg-raised px-1.5 py-0.5 rounded text-cream">J / K</kbd> Step Minute</div>
              <div><kbd className="bg-raised px-1.5 py-0.5 rounded text-cream">E</kbd> Evidence Drawer</div>
              <div><kbd className="bg-raised px-1.5 py-0.5 rounded text-cream">S</kbd> Source Health</div>
              <div><kbd className="bg-raised px-1.5 py-0.5 rounded text-cream">A</kbd> Audit Log</div>
              <div><kbd className="bg-raised px-1.5 py-0.5 rounded text-cream">Esc</kbd> Close Drawer</div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= DRAWERS & MODALS ================= */}

      {/* 1. Evidence List Drawer */}
      <Drawer
        isOpen={activeDrawer === 'evidence'}
        onClose={() => setActiveDrawer(null)}
        title="CURRENT MINUTE EVIDENCE STREAM"
        subtitle={`Minute ${currentMinute} active physical and social observations`}
      >
        <div className="space-y-4 font-mono text-xs">
          <div>
            <span className="text-data-teal font-bold block mb-1">SUPPORTING SIGNALS</span>
            <ul className="space-y-1.5 list-disc list-inside bg-raised p-3 rounded border border-subtle-border text-cream">
              {currentAssessment.evidence.supporting.map((item, idx) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <span className="text-data-amber font-bold block mb-1">CONTRADICTING / INSUFFICIENT SIGNALS</span>
            {currentAssessment.evidence.contradicting.length > 0 ? (
              <ul className="space-y-1.5 list-disc list-inside bg-raised p-3 rounded border border-subtle-border text-cream">
                {currentAssessment.evidence.contradicting.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">{item}</li>
                ))}
              </ul>
            ) : (
              <div className="bg-raised p-3 rounded border border-subtle-border text-muted italic">
                No contradicting evidence observed.
              </div>
            )}
          </div>

          <div>
            <span className="text-accent-light font-bold block mb-1">COMMON-CAUSE DISCOUNTED GROUPS</span>
            <ul className="space-y-1.5 list-disc list-inside bg-raised p-3 rounded border border-subtle-border text-muted">
              {currentAssessment.evidence.discounted.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </Drawer>

      {/* 2. Source Health Drawer */}
      <Drawer
        isOpen={activeDrawer === 'sources'}
        onClose={() => setActiveDrawer(null)}
        title="SOURCE HEALTH &amp; TELEMETRY GATEWAYS"
        subtitle="Gateway dependency graph, static reliabilities, and n_eff sample discounts"
      >
        <div className="space-y-4 font-mono text-xs">
          <div className="bg-raised p-3 rounded border border-subtle-border space-y-1 text-muted">
            <span className="text-cream font-bold block">INDEPENDENCE PRINCIPLE (TRD §4.3)</span>
            <p className="text-[11px] leading-relaxed">
              Sensors sharing the same gateway hardware have intra-group correlation ρ = 0.8.
              The effective sample size is discounted via <span className="text-accent-light font-bold">n_eff = n / (1 + (n-1)·ρ)</span>.
              A single malfunctioning gateway counts as ~1 witness rather than 10 separate corroborating sensors.
            </p>
          </div>

          <div className="space-y-2">
            {[
              { id: 'gateway_G11', name: 'Gateway G11 (Zone A Central)', sensors: 10, n_eff: 1.22, status: 'Normal', rel: 0.85 },
              { id: 'gateway_G12', name: 'Gateway G12 (Zone B East Basin)', sensors: 10, n_eff: 1.22, status: 'Suspected Fault / Water Level Surge', rel: 0.80 },
              { id: 'gateway_G13', name: 'Gateway G13 (Zone C South Harbor)', sensors: 10, n_eff: 1.22, status: 'Normal', rel: 0.85 },
              { id: 'gateway_G14', name: 'Gateway G14 (Zone D North Ridge)', sensors: 10, n_eff: 1.22, status: 'Normal', rel: 0.85 },
              { id: 'citizen_network', name: 'Citizen Rumor Network', sensors: 4, n_eff: 2.1, status: 'Origin Provenance Clustered', rel: 0.40 },
              { id: 'dispatch_central', name: 'Emergency CAD Dispatch', sensors: 1, n_eff: 1.0, status: 'Online', rel: 0.90 },
              { id: 'hospital_district', name: 'Health Dept Intake', sensors: 1, n_eff: 1.0, status: 'Online', rel: 0.85 },
            ].map((gw) => (
              <div key={gw.id} className="bg-raised p-3 rounded border border-subtle-border flex items-center justify-between">
                <div>
                  <span className="font-bold text-cream block">{gw.name}</span>
                  <span className="text-[11px] text-muted">
                    {gw.sensors} sensors · Reliability: {gw.rel} · {gw.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-accent-light font-bold block">
                    n_eff: {gw.n_eff}
                  </span>
                  <span className="text-[10px] text-muted">Intra-corr ρ=0.8</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Drawer>

      {/* 3. Audit Trail Drawer */}
      <Drawer
        isOpen={activeDrawer === 'audit'}
        onClose={() => setActiveDrawer(null)}
        title="IMMUTABLE AUDIT LOG"
        subtitle="Cryptographically tracked operational mutations and authorization records"
      >
        <div className="space-y-2 font-mono text-xs">
          {auditLog.length === 0 ? (
            <div className="text-muted text-center py-6">No audit records found.</div>
          ) : (
            auditLog.map((log) => (
              <div key={log.id} className="bg-raised p-2.5 rounded border border-subtle-border space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-accent-light uppercase">{log.action}</span>
                  <span className="text-[10px] text-muted">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-cream text-[11px]">Actor: {log.actor}</div>
                <div className="text-[10px] text-muted truncate">
                  Details: {JSON.stringify(log.details)}
                </div>
              </div>
            ))
          )}
        </div>
      </Drawer>

      {/* 4. Authorization Modal & Kanban Queue */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        episodeId={selectedEpisodeId}
        minute={currentMinute}
        recommendedAction={currentAssessment.action.recommended}
        expectedCost={currentAssessment.action.expected_cost}
        snapshot={currentAssessment}
        authorizations={authorizations}
        onRefreshAuths={loadAuthorizations}
      />
    </div>
  );
};
