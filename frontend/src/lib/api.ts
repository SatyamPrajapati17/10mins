// src/lib/api.ts

import { Episode, Assessment, AuthorizationRequest, AuditEntry, LiveWeatherData, User } from './types';

const API_BASE = typeof window !== 'undefined' && window.location.hostname
  ? `http://${window.location.hostname}:8000`
  : 'http://localhost:8000';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('first10_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export async function loginApi(email: string, password: string): Promise<{ access_token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(err.detail || 'Login failed');
  }
  const data = await res.json();
  localStorage.setItem('first10_token', data.access_token);
  localStorage.setItem('first10_user', JSON.stringify(data.user));
  return data;
}

export function getCurrentUser(): User | null {
  const raw = localStorage.getItem('first10_user');
  if (!raw) {
    // Default fallback to Duty Officer Marcus
    return {
      email: 'officer@demo.first10',
      display_name: 'Duty Officer Marcus',
      role: 'duty_officer'
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function logoutUser(): void {
  localStorage.removeItem('first10_token');
  localStorage.removeItem('first10_user');
}

export async function fetchEpisodesApi(): Promise<Episode[]> {
  const res = await fetch(`${API_BASE}/episodes`, { headers: getAuthHeader() });
  if (!res.ok) throw new Error('Failed to fetch episodes');
  return res.json();
}

export async function createEpisodeApi(scenario: string, seed: number, duration: number = 30): Promise<any> {
  const res = await fetch(`${API_BASE}/episodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ scenario, seed, duration_min: duration }),
  });
  if (!res.ok) throw new Error('Failed to create episode');
  return res.json();
}

export async function fetchEpisodeDetailsApi(id: string): Promise<Episode> {
  const res = await fetch(`${API_BASE}/episodes/${id}`, { headers: getAuthHeader() });
  if (!res.ok) throw new Error('Failed to fetch episode details');
  return res.json();
}

export async function fetchAssessmentsApi(id: string): Promise<{ episode_id: string; assessment_version: number; assessments: Assessment[] }> {
  const res = await fetch(`${API_BASE}/episodes/${id}/assessments`, { headers: getAuthHeader() });
  if (!res.ok) throw new Error('Failed to fetch assessments');
  return res.json();
}

export async function injectFaultApi(episodeId: string, faultType: string, target?: string, fromMinute: number = 5): Promise<any> {
  const res = await fetch(`${API_BASE}/episodes/${episodeId}/faults`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ fault_type: faultType, target, from_minute: fromMinute }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Fault injection failed' }));
    throw new Error(err.detail || 'Fault injection failed');
  }
  return res.json();
}

export async function runTwinTestApi(prefix: string, split: number, seed: number): Promise<any> {
  const res = await fetch(`${API_BASE}/twin-tests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ prefix, split, seed }),
  });
  if (!res.ok) throw new Error('Failed to run twin test');
  return res.json();
}

export async function runEvalSuiteApi(n: number = 20): Promise<any> {
  const res = await fetch(`${API_BASE}/eval-runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ n_episodes: n }),
  });
  if (!res.ok) throw new Error('Failed to run evaluation suite');
  return res.json();
}

export async function fetchAuthorizationsApi(): Promise<AuthorizationRequest[]> {
  const res = await fetch(`${API_BASE}/authorizations`, { headers: getAuthHeader() });
  if (!res.ok) throw new Error('Failed to fetch authorizations');
  return res.json();
}

export async function requestAuthorizationApi(req: { episode_id: string; minute: number; action: string; justification: string; snapshot: any }): Promise<any> {
  const res = await fetch(`${API_BASE}/authorizations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error('Failed to submit authorization request');
  return res.json();
}

export async function decideAuthorizationApi(authId: string, decision: 'approve' | 'reject', reason: string): Promise<any> {
  const res = await fetch(`${API_BASE}/authorizations/${authId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ decision, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Authorization decision rejected' }));
    throw new Error(err.detail || 'Authorization decision rejected');
  }
  return res.json();
}

export async function fetchAuditApi(): Promise<AuditEntry[]> {
  const res = await fetch(`${API_BASE}/audit`, { headers: getAuthHeader() });
  if (!res.ok) throw new Error('Failed to fetch audit log');
  return res.json();
}

export async function fetchWeatherApi(lat: number, lon: number): Promise<LiveWeatherData> {
  try {
    const res = await fetch(`${API_BASE}/api/weather?lat=${lat}&lon=${lon}`);
    if (!res.ok) {
      return { available: false, source: 'LIVE', label: 'LIVE', lat, lon, updated_at: new Date().toISOString(), error: 'Live weather unavailable' };
    }
    return res.json();
  } catch (err: any) {
    return { available: false, source: 'LIVE', label: 'LIVE', lat, lon, updated_at: new Date().toISOString(), error: err.message || 'Live weather unavailable' };
  }
}

export async function fetchWeatherAlertsApi(lat: number, lon: number): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/weather/alerts?lat=${lat}&lon=${lon}`);
    if (!res.ok) return { available: false, alerts: [] };
    return res.json();
  } catch {
    return { available: false, alerts: [] };
  }
}
