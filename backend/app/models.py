# backend/app/models.py
"""
Data models and contracts for FIRST 10 - Uncertainty-Aware Crisis Inference and Decision Engine.
Follows specs from docs/07-Implementation-Plan-FAST.md and docs/02-TRD.md.
"""

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field

# Hypotheses: H in {noise, sensor_failure, isolated, cascade}
Hypothesis = Literal["noise", "sensor_failure", "isolated", "cascade"]

# Actions in order of escalation
ActionType = Literal["WATCH", "PREPARE", "ALERT", "ESCALATE"]

# Event Quality status
EventQuality = Literal["valid", "suspect", "missing", "corrected", "retracted"]

# User roles
UserRole = Literal["viewer", "duty_officer", "supervisor", "analyst", "admin"]


class Location(BaseModel):
    lat: float
    lon: float
    zone: str = "A"


class Event(BaseModel):
    event_id: str
    event_time: str  # ISO timestamp
    sim_minute: int  # integer simulated minute (0-indexed)
    ingestion_time: str
    source_id: str
    source_group: str  # e.g., 'gateway_G12'
    location: Location
    event_type: str  # rainfall, drainage_level, traffic_speed, road_closure, dispatch, hospital_arrivals, citizen_report, weather_alert, infra_status, source_heartbeat
    value: Dict[str, Any]
    quality: EventQuality = "valid"
    revision_of: Optional[str] = None
    origin_id: Optional[str] = None  # Provenance tracking for citizen rumors/reports


class Belief(BaseModel):
    noise: float
    sensor_failure: float
    isolated: float
    cascade: float


class Uncertainty(BaseModel):
    entropy_bits: float
    effective_independent_sources: float


class ActionDetails(BaseModel):
    recommended: ActionType
    expected_cost: Dict[ActionType, float]
    wait_cost: float
    vow: float  # Value of waiting
    next_review_minute: int
    controller_state: ActionType
    transition_reason: str
    override_triggered: bool = False


class ForecastSlot(BaseModel):
    event: str
    area: str
    window: List[int] = Field(default_factory=lambda: [0, 0])
    p: float
    path: List[str] = Field(default_factory=list)
    invalidated_if: List[str] = Field(default_factory=list)
    unavailable: bool = False
    reason: Optional[str] = None


class EvidenceSummary(BaseModel):
    supporting: List[str] = Field(default_factory=list)
    contradicting: List[str] = Field(default_factory=list)
    discounted: List[str] = Field(default_factory=list)
    missing: List[str] = Field(default_factory=list)


class Explanation(BaseModel):
    new_evidence: str
    belief_change: str
    why_action: str
    what_would_change: str


class Assessment(BaseModel):
    episode_id: str
    minute: int
    assessment_version: int = 1
    belief: Belief
    uncertainty: Uncertainty
    action: ActionDetails
    forecast: List[ForecastSlot]
    evidence: EvidenceSummary
    explanation: Explanation


class AuthorizationRequest(BaseModel):
    id: str
    episode_id: str
    minute: int
    action: ActionType
    requester: str
    justification: str
    status: Literal["pending", "approved", "rejected", "expired"] = "pending"
    decided_by: Optional[str] = None
    decision_reason: Optional[str] = None
    snapshot: Dict[str, Any]
    created_at: str
    decided_at: Optional[str] = None


class AuditEntry(BaseModel):
    id: str
    timestamp: str
    actor: str
    action: str
    details: Dict[str, Any]


class User(BaseModel):
    email: str
    display_name: str
    role: UserRole
    password: str  # demo password
