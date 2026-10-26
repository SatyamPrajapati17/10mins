// src/components/AuthModal.tsx
import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle, XCircle, Clock, AlertTriangle, UserCheck } from 'lucide-react';
import { ActionType, AuthorizationRequest, User } from '../lib/types';
import { requestAuthorizationApi, decideAuthorizationApi } from '../lib/api';
import { sound } from '../lib/audio';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  episodeId: string;
  minute: number;
  recommendedAction: ActionType;
  expectedCost: Record<ActionType, number>;
  snapshot: any;
  authorizations: AuthorizationRequest[];
  onRefreshAuths: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  episodeId,
  minute,
  recommendedAction,
  expectedCost,
  snapshot,
  authorizations,
  onRefreshAuths
}) => {
  const [activeTab, setActiveTab] = useState<'request' | 'queue'>('request');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Decision state
  const [decisionReason, setDecisionReason] = useState('');

  if (!isOpen) return null;

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim()) return;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await requestAuthorizationApi({
        episode_id: episodeId,
        minute,
        action: recommendedAction,
        justification,
        snapshot: {
          ...snapshot,
          expectedCost,
          minute,
          episodeId
        }
      });
      setSuccessMsg('Authorization request submitted to supervisor queue.');
      setJustification('');
      sound.playActionEscalation('PREPARE');
      onRefreshAuths();
      setActiveTab('queue');
    } catch (err: any) {
      sound.playAuthReject();
      setErrorMsg(err.message || 'Failed to submit authorization request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async (authId: string, decision: 'approve' | 'reject') => {
    if (!decisionReason.trim()) {
      sound.playAuthReject();
      setErrorMsg('Decision reason is required to record official authorization.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await decideAuthorizationApi(authId, decision, decisionReason);
      if (decision === 'approve') {
        sound.playAuthSuccess();
      } else {
        sound.playAuthReject();
      }
      setSuccessMsg(`Request marked as ${decision.toUpperCase()}. Official record saved.`);
      setDecisionReason('');
      onRefreshAuths();
    } catch (err: any) {
      sound.playAuthReject();
      // Handles 403 two_person_rule error specifically
      setErrorMsg(err.message || 'Decision failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Group authorizations by Kanban status
  const pendingList = authorizations.filter(a => a.status === 'pending');
  const approvedList = authorizations.filter(a => a.status === 'approved');
  const rejectedList = authorizations.filter(a => a.status === 'rejected');
  const expiredList = authorizations.filter(a => a.status === 'expired');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-surface border border-subtle-border rounded-lg text-cream shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-subtle-border flex items-center justify-between bg-raised">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-data-red" />
            <div>
              <h2 className="text-sm font-mono font-bold tracking-wider uppercase text-cream">
                CONSEQUENTIAL ACTION AUTHORIZATION &amp; QUEUE
              </h2>
              <p className="text-xs text-muted font-mono">Two-person rule strictly enforced for ESCALATE / ALERT</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-cream p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-subtle-border bg-base px-4">
          <button
            onClick={() => setActiveTab('request')}
            className={`py-2.5 px-4 text-xs font-mono font-bold border-b-2 transition-colors ${
              activeTab === 'request'
                ? 'border-accent text-accent-light'
                : 'border-transparent text-muted hover:text-cream'
            }`}
          >
            REQUEST AUTHORIZATION
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`py-2.5 px-4 text-xs font-mono font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'queue'
                ? 'border-accent text-accent-light'
                : 'border-transparent text-muted hover:text-cream'
            }`}
          >
            <span>AUTHORIZATION QUEUE (KANBAN)</span>
            {pendingList.length > 0 && (
              <span className="bg-data-amber text-[#17120F] font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                {pendingList.length}
              </span>
            )}
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="m-4 mb-0 p-3 bg-data-red/15 border border-data-red/40 rounded text-xs font-mono text-cream flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-data-red flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="m-4 mb-0 p-3 bg-data-green/15 border border-data-green/40 rounded text-xs font-mono text-cream flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-data-green flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {activeTab === 'request' ? (
            <form onSubmit={handleRequestSubmit} className="space-y-4">
              <div className="bg-raised border border-subtle-border rounded p-3 text-xs font-mono space-y-2">
                <div className="flex justify-between items-center text-muted">
                  <span>RECOMMENDED ACTION:</span>
                  <span className="font-bold text-data-red text-sm">{recommendedAction}</span>
                </div>
                <div className="flex justify-between items-center text-muted">
                  <span>EPISODE / SIMULATED MINUTE:</span>
                  <span className="text-cream">{episodeId} / Minute {minute}</span>
                </div>
                <div className="flex justify-between items-center text-muted">
                  <span>REQUESTER:</span>
                  <span className="text-cream">{currentUser?.email || 'officer@demo.first10'}</span>
                </div>
                <div className="flex justify-between items-center text-muted">
                  <span>REQUIRED APPROVER:</span>
                  <span className="text-data-amber font-semibold">Supervisor (Different User)</span>
                </div>
              </div>

              {/* Cost matrix comparison table */}
              <div>
                <span className="text-xs font-mono text-muted block mb-1 font-semibold">
                  EXPECTED LOSS AT CURRENT MINUTE:
                </span>
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                  {Object.entries(expectedCost).map(([act, cost]) => (
                    <div
                      key={act}
                      className={`p-2 rounded border ${
                        act === recommendedAction ? 'border-accent bg-accent/10 text-accent-light' : 'border-subtle-border bg-raised text-muted'
                      }`}
                    >
                      <div className="text-[10px] font-semibold">{act}</div>
                      <div className="font-bold text-cream mt-1">{cost.toFixed(1)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Justification Field */}
              <div>
                <label className="text-xs font-mono text-muted block mb-1 font-semibold">
                  OPERATIONAL JUSTIFICATION (REQUIRED):
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Provide explicit operational rationale, field corroboration, or cascade evidence..."
                  rows={3}
                  className="w-full bg-base border border-subtle-border rounded p-2.5 text-xs font-mono text-cream focus:outline-none focus:border-accent"
                  required
                />
              </div>

              {/* Disclaimer */}
              <div className="text-[11px] font-mono text-muted/80 bg-base p-2.5 rounded border border-subtle-border">
                Notice: This application does not broadcast public alerts or siren systems.
                Authorization is recorded for the official municipal incident response procedure and immutable audit log.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded text-xs font-mono text-muted hover:text-cream border border-subtle-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !justification.trim()}
                  className={`px-4 py-2 rounded text-xs font-mono font-bold flex items-center gap-1.5 ${
                    justification.trim()
                      ? 'bg-data-red text-cream hover:bg-data-red/90'
                      : 'bg-raised text-muted cursor-not-allowed border border-subtle-border'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          ) : (
            /* Kanban View */
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {/* 1. Pending Column */}
                <div className="bg-raised border border-subtle-border rounded-lg p-2.5 flex flex-col">
                  <div className="flex items-center justify-between pb-2 border-b border-subtle-border mb-2 font-mono text-xs">
                    <span className="font-bold text-data-amber flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> PENDING
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-data-amber/20 text-data-amber text-[10px] font-bold">
                      {pendingList.length}
                    </span>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[360px]">
                    {pendingList.length === 0 ? (
                      <span className="text-[11px] font-mono text-muted/60 italic block text-center py-4">No pending requests</span>
                    ) : (
                      pendingList.map((auth) => (
                        <div key={auth.id} className="bg-surface border border-subtle-border rounded p-2.5 text-xs font-mono space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-data-red">{auth.action}</span>
                            <span className="text-[10px] text-muted">Min {auth.minute}</span>
                          </div>
                          <p className="text-[11px] text-cream leading-tight">{auth.justification}</p>
                          <div className="text-[10px] text-muted truncate">By: {auth.requester}</div>

                          {/* Supervisor action inline */}
                          <div className="pt-2 border-t border-subtle-border space-y-1.5">
                            <input
                              type="text"
                              placeholder="Supervisor reason..."
                              value={decisionReason}
                              onChange={(e) => setDecisionReason(e.target.value)}
                              className="w-full bg-base border border-subtle-border rounded p-1 text-[10px] text-cream"
                            />
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                onClick={() => handleDecision(auth.id, 'approve')}
                                disabled={submitting}
                                className="bg-data-green/20 hover:bg-data-green/30 border border-data-green/40 text-data-green py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1"
                              >
                                <CheckCircle className="w-3 h-3" /> Approve
                              </button>
                              <button
                                onClick={() => handleDecision(auth.id, 'reject')}
                                disabled={submitting}
                                className="bg-data-red/20 hover:bg-data-red/30 border border-data-red/40 text-data-red py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1"
                              >
                                <XCircle className="w-3 h-3" /> Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Approved Column */}
                <div className="bg-raised border border-subtle-border rounded-lg p-2.5 flex flex-col">
                  <div className="flex items-center justify-between pb-2 border-b border-subtle-border mb-2 font-mono text-xs">
                    <span className="font-bold text-data-green flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> APPROVED
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-data-green/20 text-data-green text-[10px] font-bold">
                      {approvedList.length}
                    </span>
                  </div>
                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[360px]">
                    {approvedList.map((auth) => (
                      <div key={auth.id} className="bg-surface border border-data-green/30 rounded p-2 text-xs font-mono space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-data-green">{auth.action}</span>
                          <span className="text-[10px] text-muted">Min {auth.minute}</span>
                        </div>
                        <p className="text-[11px] text-cream">{auth.justification}</p>
                        <div className="text-[10px] text-muted">
                          Approved by: {auth.decided_by}
                        </div>
                        {auth.decision_reason && (
                          <div className="text-[10px] text-data-teal italic">"{auth.decision_reason}"</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Rejected Column */}
                <div className="bg-raised border border-subtle-border rounded-lg p-2.5 flex flex-col">
                  <div className="flex items-center justify-between pb-2 border-b border-subtle-border mb-2 font-mono text-xs">
                    <span className="font-bold text-data-red flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> REJECTED
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-data-red/20 text-data-red text-[10px] font-bold">
                      {rejectedList.length}
                    </span>
                  </div>
                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[360px]">
                    {rejectedList.map((auth) => (
                      <div key={auth.id} className="bg-surface border border-data-red/30 rounded p-2 text-xs font-mono space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-data-red">{auth.action}</span>
                          <span className="text-[10px] text-muted">Min {auth.minute}</span>
                        </div>
                        <p className="text-[11px] text-cream">{auth.justification}</p>
                        <div className="text-[10px] text-muted">
                          Rejected by: {auth.decided_by}
                        </div>
                        {auth.decision_reason && (
                          <div className="text-[10px] text-data-red italic">"{auth.decision_reason}"</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Expired Column */}
                <div className="bg-raised border border-subtle-border rounded-lg p-2.5 flex flex-col">
                  <div className="flex items-center justify-between pb-2 border-b border-subtle-border mb-2 font-mono text-xs">
                    <span className="font-bold text-muted flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> EXPIRED
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-muted/20 text-muted text-[10px] font-bold">
                      {expiredList.length}
                    </span>
                  </div>
                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[360px]">
                    {expiredList.map((auth) => (
                      <div key={auth.id} className="bg-surface border border-subtle-border rounded p-2 text-xs font-mono space-y-1 text-muted">
                        <div className="flex justify-between items-center">
                          <span className="font-bold">{auth.action}</span>
                          <span className="text-[10px]">Min {auth.minute}</span>
                        </div>
                        <p className="text-[11px]">{auth.justification}</p>
                        <span className="text-[10px] italic">Timed out after 5 min window</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
