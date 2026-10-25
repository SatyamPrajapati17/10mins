// src/pages/Login.tsx
import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, UserCheck, AlertTriangle } from 'lucide-react';
import { loginApi } from '../lib/api';
import { User } from '../lib/types';
import { Banner } from '../components/Banner';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('officer@demo.first10');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await loginApi(email, password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoUser = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setLoading(true);
    setError(null);
    try {
      const res = await loginApi(demoEmail, 'password123');
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex flex-col justify-between text-cream">
      <Banner />

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface border border-subtle-border rounded-lg p-6 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex w-12 h-12 rounded-lg bg-gradient-to-br from-accent-light to-accent items-center justify-center text-cream font-mono font-bold text-lg border border-accent/40 shadow-md">
              F10
            </div>
            <h1 className="text-lg font-mono font-bold tracking-wider text-cream">
              FIRST 10 CRISIS SYSTEM
            </h1>
            <p className="text-xs text-muted font-mono">
              Uncertainty-Aware Decision &amp; Inference Engine
            </p>
          </div>

          {error && (
            <div className="p-3 bg-data-red/15 border border-data-red/40 rounded text-xs font-mono text-cream flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-data-red flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-mono text-muted block mb-1">OPERATOR EMAIL</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-base border border-subtle-border rounded pl-9 pr-3 py-2 text-xs font-mono text-cream focus:outline-none focus:border-accent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-muted block mb-1">PASSWORD</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-base border border-subtle-border rounded pl-9 pr-3 py-2 text-xs font-mono text-cream focus:outline-none focus:border-accent"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded bg-accent hover:bg-accent-light text-cream font-mono font-bold text-xs tracking-wider uppercase transition-colors flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In To Console'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="pt-4 border-t border-subtle-border space-y-2">
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider block text-center">
              QUICK DEMO PERSONAS
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => handleQuickDemoUser('officer@demo.first10')}
                className="p-2 rounded bg-raised border border-subtle-border hover:border-accent text-left transition-colors"
              >
                <div className="font-bold text-cream">Duty Officer</div>
                <div className="text-[10px] text-muted">Marcus (Play/Request)</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoUser('supervisor@demo.first10')}
                className="p-2 rounded bg-raised border border-subtle-border hover:border-accent text-left transition-colors"
              >
                <div className="font-bold text-cream">Supervisor</div>
                <div className="text-[10px] text-muted">Sarah (Authorize)</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoUser('analyst@demo.first10')}
                className="p-2 rounded bg-raised border border-subtle-border hover:border-accent text-left transition-colors"
              >
                <div className="font-bold text-cream">Analyst</div>
                <div className="text-[10px] text-muted">Dr. Chen (Twin Lab)</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoUser('admin@demo.first10')}
                className="p-2 rounded bg-raised border border-subtle-border hover:border-accent text-left transition-colors"
              >
                <div className="font-bold text-cream">System Admin</div>
                <div className="text-[10px] text-muted">Full Privileges</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 text-center text-xs font-mono text-muted/60 border-t border-subtle-border">
        FIRST 10 Prototype · Decision-theoretic state estimation · 2026
      </div>
    </div>
  );
};
