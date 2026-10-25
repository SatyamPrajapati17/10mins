// src/lib/types.ts

export type HypothesisKey = 'noise' | 'sensor_failure' | 'isolated' | 'cascade';
export type ActionType = 'WATCH' | 'PREPARE' | 'ALERT' | 'ESCALATE';
export type UserRole = 'viewer' | 'duty_officer' | 'supervisor' | 'analyst' | 'admin';

export interface User {
  email: string;
  display_name: string;
  role: UserRole;
}

export interface Belief {
  noise: number;
  sensor_failure: number;
  isolated: number;
  cascade: number;
}

export interface Uncertainty {
  entropy_bits: number;
  effective_independent_sources: number;
}

export interface ActionDetails {
  recommended: ActionType;
  expected_cost: Record<ActionType, number>;
  wait_cost: number;
  vow: number;
  next_review_minute: number;
  controller_state: ActionType;
  transition_reason: string;
  override_triggered: boolean;
}

export interface ForecastSlot {
  event: string;
  area: string;
  window: [number, number];
  p: number;
  path: string[];
  invalidated_if: string[];
  unavailable?: boolean;
  reason?: string;
}

export interface EvidenceSummary {
  supporting: string[];
  contradicting: string[];
  discounted: string[];
  missing: string[];
}

export interface Explanation {
  new_evidence: string;
  belief_change: string;
  why_action: string;
  what_would_change: string;
}

export interface Assessment {
  episode_id: string;
  minute: number;
  assessment_version: number;
  belief: Belief;
  uncertainty: Uncertainty;
  action: ActionDetails;
  forecast: ForecastSlot[];
  evidence: EvidenceSummary;
  explanation: Explanation;
}

export interface Episode {
  id: string;
  scenario: string;
  seed: number;
  status: string;
  current_minute: number;
  duration_min: number;
  truth: string;
  created_at: string;
  assessment_version: number;
  sources?: Array<{
    source_id: string;
    source_group: string;
    zone: string;
    lat: number;
    lon: number;
    event_type: string;
  }>;
}

export interface AuthorizationRequest {
  id: string;
  episode_id: string;
  minute: number;
  action: ActionType;
  requester: string;
  justification: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  decided_by?: string;
  decision_reason?: string;
  snapshot: any;
  created_at: string;
  decided_at?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: any;
}

export interface LiveWeatherData {
  available: boolean;
  source: string;
  label: string;
  location?: string;
  lat: number;
  lon: number;
  temp_c?: number;
  feels_like_c?: number;
  humidity?: number;
  wind_kmh?: number;
  rain_mm?: number;
  forecast_3h_rain_mm?: number;
  description?: string;
  alerts?: Array<{
    event: string;
    headline: string;
    severity: string;
  }>;
  updated_at: string;
  error?: string;
}
