# backend/app/main.py
"""
FastAPI application for FIRST 10.
Endpoints:
- Auth: /auth/login, /auth/me (JWT, 4 demo users)
- Episodes: POST /episodes, GET /episodes, GET /episodes/{id}, GET /episodes/{id}/assessments
- Faults: POST /episodes/{id}/faults
- Twin Lab: POST /twin-tests
- Evaluation: POST /eval-runs
- Authorizations: POST /authorizations, GET /authorizations, POST /authorizations/{id}/decision (with 2-person rule)
- Audit: GET /audit
- Health: GET /health
- Weather Proxies: GET /api/weather, GET /api/weather/alerts (cached 5 min, graceful fallback)
"""

import os
import time
import json
import uuid
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from fastapi import FastAPI, Depends, HTTPException, Header, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.models import (
    User, Assessment, AuthorizationRequest, AuditEntry, ActionType
)
from app.db import get_db, init_db
from app.sim import (
    generate, twin, kill_gateway, drop_cameras, duplicate,
    shuffle_arrival, late_dispatch, retract, rumor_burst, flip_story
)
from app.engine import run_episode, normalize
from app.metrics import evaluate_suite

# Environment Configuration & Safe .env loader
def _load_env_file():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() not in os.environ:
                        os.environ[k.strip()] = v.strip()

_load_env_file()

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-local")
OPENWEATHER_KEY = os.getenv("OPENWEATHER_KEY", "")
XWEATHER_CLIENT_ID = os.getenv("XWEATHER_CLIENT_ID", "")
XWEATHER_CLIENT_SECRET = os.getenv("XWEATHER_CLIENT_SECRET", "")

# 4 Demo Users
DEMO_USERS: Dict[str, Dict[str, Any]] = {
    "officer@demo.first10": {
        "email": "officer@demo.first10",
        "display_name": "Duty Officer Marcus",
        "role": "duty_officer",
        "password": "password123"
    },
    "supervisor@demo.first10": {
        "email": "supervisor@demo.first10",
        "display_name": "Supervisor Sarah",
        "role": "supervisor",
        "password": "password123"
    },
    "analyst@demo.first10": {
        "email": "analyst@demo.first10",
        "display_name": "Analyst Dr. Chen",
        "role": "analyst",
        "password": "password123"
    },
    "admin@demo.first10": {
        "email": "admin@demo.first10",
        "display_name": "System Admin",
        "role": "admin",
        "password": "password123"
    }
}

ROLE_HIERARCHY = {
    "viewer": 1,
    "duty_officer": 2,
    "analyst": 3,
    "supervisor": 3,
    "admin": 4
}

app = FastAPI(title="FIRST 10 API", version="1.0.0")

# CORS setup for localhost frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory weather cache: key -> (timestamp, data)
WEATHER_CACHE: Dict[str, Tuple[float, Any]] = {}
CACHE_TTL = 300  # 5 minutes in seconds


def log_audit(actor: str, action: str, details: Dict[str, Any]):
    """Append row to immutable audit_log."""
    conn = get_db()
    with conn:
        conn.execute(
            "INSERT INTO audit_log (id, timestamp, actor, action, details_json) VALUES (?, ?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                datetime.now(timezone.utc).isoformat(),
                actor,
                action,
                json.dumps(details)
            )
        )
    conn.close()


def create_token(user: Dict[str, Any]) -> str:
    payload = {
        "sub": user["email"],
        "display_name": user["display_name"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=12)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        # Default fallback for development/demo ease: duty officer
        return DEMO_USERS["officer@demo.first10"]
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        email = payload.get("sub")
        if email in DEMO_USERS:
            return DEMO_USERS[email]
        return {
            "email": email,
            "display_name": payload.get("display_name", email),
            "role": payload.get("role", "viewer")
        }
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def require_role(min_role: str):
    def dependency(user: Dict[str, Any] = Depends(get_current_user)):
        user_role = user.get("role", "viewer")
        # Check specific role permission
        if min_role == "supervisor" and user_role not in ["supervisor", "admin"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requires supervisor role")
        if min_role == "duty_officer" and user_role not in ["duty_officer", "supervisor", "admin"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requires duty_officer role")
        if min_role == "analyst" and user_role not in ["analyst", "admin"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requires analyst role")
        return user
    return dependency


# ==================== Health & Auth Routes ====================

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/auth/login")
def login(req: LoginRequest):
    user = DEMO_USERS.get(req.email)
    if not user or user["password"] != req.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")
    token = create_token(user)
    log_audit(user["email"], "login", {"role": user["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "email": user["email"],
            "display_name": user["display_name"],
            "role": user["role"]
        }
    }


@app.get("/auth/me")
def get_me(user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "email": user["email"],
        "display_name": user["display_name"],
        "role": user["role"]
    }


# ==================== Episode Routes ====================

class CreateEpisodeRequest(BaseModel):
    scenario: str = "cascade"  # noise, gateway_failure, isolated_flood, cascade, monsoon_shift
    seed: int = 42
    duration_min: int = 11


@app.post("/episodes")
def create_episode(req: CreateEpisodeRequest, user: Dict[str, Any] = Depends(get_current_user)):
    episode_id = f"ep_{req.scenario[:4]}_{uuid.uuid4().hex[:6]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    # Generate events
    events, truth = generate(scenario=req.scenario, seed=req.seed, minutes=req.duration_min)

    # Run engine to compute assessments
    assessments = run_episode(events, monsoon_shift=(req.scenario == "monsoon_shift"))

    # Store episode & events & assessments in DB
    conn = get_db()
    with conn:
        conn.execute(
            """INSERT INTO episodes (id, scenario, seed, status, current_minute, duration_min, truth, is_sandbox, created_by, created_at, assessment_version)
               VALUES (?, ?, ?, 'created', 0, ?, ?, 0, ?, ?, 1)""",
            (episode_id, req.scenario, req.seed, req.duration_min, truth, user["email"], now_iso)
        )
        for e in events:
            conn.execute(
                """INSERT INTO events (episode_id, event_id, event_time, sim_minute, ingestion_time, source_id, source_group, zone, lat, lon, event_type, value_json, quality, revision_of, origin_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    episode_id, e["event_id"], e["event_time"], e["sim_minute"], e["ingestion_time"],
                    e["source_id"], e["source_group"], e["location"]["zone"], e["location"]["lat"], e["location"]["lon"],
                    e["event_type"], json.dumps(e["value"]), e["quality"], e.get("revision_of"), e.get("origin_id")
                )
            )
        for a in assessments:
            a_dict = a.model_dump()
            a_dict["episode_id"] = episode_id
            conn.execute(
                """INSERT INTO assessments (episode_id, minute, assessment_version, data_json)
                   VALUES (?, ?, 1, ?)""",
                (episode_id, a.minute, json.dumps(a_dict))
            )

    conn.close()
    log_audit(user["email"], "create_episode", {"episode_id": episode_id, "scenario": req.scenario, "seed": req.seed})

    return {
        "episode_id": episode_id,
        "scenario": req.scenario,
        "seed": req.seed,
        "duration_min": req.duration_min,
        "truth": truth,
        "assessment_version": 1,
        "total_assessments": len(assessments)
    }


@app.get("/episodes")
def list_episodes():
    conn = get_db()
    rows = conn.execute("SELECT * FROM episodes ORDER BY created_at DESC").fetchall()
    episodes = [dict(r) for r in rows]
    conn.close()
    return episodes


@app.get("/episodes/{episode_id}")
def get_episode_details(episode_id: str):
    conn = get_db()
    ep_row = conn.execute("SELECT * FROM episodes WHERE id = ?", (episode_id,)).fetchone()
    if not ep_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Episode not found")
    ep = dict(ep_row)
    # Get distinct source groups and sensors
    event_rows = conn.execute("SELECT DISTINCT source_id, source_group, zone, lat, lon, event_type FROM events WHERE episode_id = ?", (episode_id,)).fetchall()
    sources = [dict(r) for r in event_rows]
    conn.close()
    ep["sources"] = sources
    return ep


@app.get("/episodes/{episode_id}/assessments")
def get_assessments(episode_id: str):
    conn = get_db()
    # Get latest assessment_version for this episode
    ep_row = conn.execute("SELECT assessment_version FROM episodes WHERE id = ?", (episode_id,)).fetchone()
    if not ep_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Episode not found")
    curr_version = ep_row["assessment_version"]

    rows = conn.execute(
        "SELECT minute, assessment_version, data_json FROM assessments WHERE episode_id = ? AND assessment_version = ? ORDER BY minute ASC",
        (episode_id, curr_version)
    ).fetchall()
    conn.close()

    assessments = [json.loads(r["data_json"]) for r in rows]
    return {
        "episode_id": episode_id,
        "assessment_version": curr_version,
        "assessments": assessments
    }


# ==================== Fault Injection ====================

class FaultRequest(BaseModel):
    fault_type: str  # gateway_kill, drop_cameras, duplicate, shuffle, late_dispatch, retract, rumor_burst, flip_story
    target: Optional[str] = "gateway_G12"
    from_minute: int = 5
    param: Optional[Any] = None


@app.post("/episodes/{episode_id}/faults")
def inject_fault(episode_id: str, req: FaultRequest, user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_db()
    ep_row = conn.execute("SELECT * FROM episodes WHERE id = ?", (episode_id,)).fetchone()
    if not ep_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Episode not found")

    old_version = ep_row["assessment_version"]
    new_version = old_version + 1

    # Load all current raw events for this episode
    event_rows = conn.execute("SELECT * FROM events WHERE episode_id = ? ORDER BY pk ASC", (episode_id,)).fetchall()
    raw_events = []
    for r in event_rows:
        raw_events.append({
            "event_id": r["event_id"],
            "event_time": r["event_time"],
            "sim_minute": r["sim_minute"],
            "ingestion_time": r["ingestion_time"],
            "source_id": r["source_id"],
            "source_group": r["source_group"],
            "location": {"lat": r["lat"], "lon": r["lon"], "zone": r["zone"]},
            "event_type": r["event_type"],
            "value": json.loads(r["value_json"]),
            "quality": r["quality"],
            "revision_of": r["revision_of"],
            "origin_id": r["origin_id"]
        })

    # Apply fault transformation
    if req.fault_type == "gateway_kill":
        modified_events = kill_gateway(raw_events, gateway=req.target or "gateway_G12", from_min=req.from_minute)
    elif req.fault_type == "drop_cameras":
        modified_events = drop_cameras(raw_events, from_min=req.from_minute)
    elif req.fault_type == "duplicate":
        modified_events = duplicate(raw_events, frac=0.3)
    elif req.fault_type == "shuffle":
        modified_events = shuffle_arrival(raw_events)
    elif req.fault_type == "late_dispatch":
        modified_events = late_dispatch(raw_events, delay_minutes=5)
    elif req.fault_type == "retract":
        target_ids = req.param if isinstance(req.param, list) else [req.target] if req.target else []
        modified_events = retract(raw_events, target_ids)
    elif req.fault_type == "rumor_burst":
        origin = req.target or "bot_cluster_9"
        modified_events = rumor_burst(raw_events, origin_id=origin, n=8, minute=req.from_minute)
    elif req.fault_type == "flip_story":
        modified_events = flip_story(raw_events, source_id=req.target or "drain_G12_01", from_min=req.from_minute)
    else:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Unknown fault type: {req.fault_type}")

    # Recompute episode from minute 0 with engine
    new_assessments = run_episode(modified_events, monsoon_shift=(ep_row["scenario"] == "monsoon_shift"))

    # Load old assessments to compute diff
    old_rows = conn.execute(
        "SELECT minute, data_json FROM assessments WHERE episode_id = ? AND assessment_version = ? ORDER BY minute ASC",
        (episode_id, old_version)
    ).fetchall()
    old_assessments = {r["minute"]: json.loads(r["data_json"]) for r in old_rows}

    changed_minutes = []
    with conn:
        conn.execute("UPDATE episodes SET assessment_version = ? WHERE id = ?", (new_version, episode_id))
        for a in new_assessments:
            a_dict = a.model_dump()
            a_dict["episode_id"] = episode_id
            a_dict["assessment_version"] = new_version
            conn.execute(
                "INSERT INTO assessments (episode_id, minute, assessment_version, data_json) VALUES (?, ?, ?, ?)",
                (episode_id, a.minute, new_version, json.dumps(a_dict))
            )
            old_a = old_assessments.get(a.minute)
            if old_a:
                # Check if belief or recommended action shifted materially
                p_diff = abs(old_a["belief"]["cascade"] - a.belief.cascade)
                act_changed = old_a["action"]["recommended"] != a.action.recommended
                if p_diff >= 0.05 or act_changed:
                    changed_minutes.append(a.minute)
            else:
                changed_minutes.append(a.minute)

    conn.close()
    log_audit(user["email"], "inject_fault", {
        "episode_id": episode_id,
        "fault_type": req.fault_type,
        "new_version": new_version,
        "changed_minutes": changed_minutes
    })

    return {
        "episode_id": episode_id,
        "previous_version": old_version,
        "assessment_version": new_version,
        "fault_type": req.fault_type,
        "changed_minutes": changed_minutes,
        "total_assessments": len(new_assessments)
    }


# ==================== Twin Tests ====================

class TwinTestRequest(BaseModel):
    prefix: str = "cascade"
    split: int = 8
    seed: int = 777


@app.post("/twin-tests")
def run_twin_test(req: TwinTestRequest, user: Dict[str, Any] = Depends(get_current_user)):
    events_a, events_b, prefix_hash = twin(prefix_scenario=req.prefix, split_min=req.split, seed=req.seed)

    assessments_a = run_episode(events_a)
    assessments_b = run_episode(events_b)

    # Verify prefix equality (minutes <= split)
    prefix_equal = True
    for m in range(req.split + 1):
        if m < len(assessments_a) and m < len(assessments_b):
            a_dict = assessments_a[m].belief.model_dump()
            b_dict = assessments_b[m].belief.model_dump()
            for h in ["noise", "sensor_failure", "isolated", "cascade"]:
                if abs(a_dict[h] - b_dict[h]) > 1e-4:
                    prefix_equal = False
            if assessments_a[m].action.controller_state != assessments_b[m].action.controller_state:
                prefix_equal = False

    test_id = f"twin_{uuid.uuid4().hex[:8]}"
    ep_a_id = f"{test_id}_A"
    ep_b_id = f"{test_id}_B"

    # Store in DB
    conn = get_db()
    with conn:
        conn.execute(
            "INSERT INTO twin_tests (id, episode_a, episode_b, split_minute, prefix_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (test_id, ep_a_id, ep_b_id, req.split, prefix_hash, datetime.now(timezone.utc).isoformat())
        )
        # Store episodes A & B
        conn.execute(
            """INSERT INTO episodes (id, scenario, seed, status, current_minute, duration_min, truth, is_sandbox, created_by, created_at, assessment_version)
               VALUES (?, 'twin_false_alarm', ?, 'finished', 30, 30, 'isolated', 1, ?, ?, 1)""",
            (ep_a_id, req.seed, user["email"], datetime.now(timezone.utc).isoformat())
        )
        conn.execute(
            """INSERT INTO episodes (id, scenario, seed, status, current_minute, duration_min, truth, is_sandbox, created_by, created_at, assessment_version)
               VALUES (?, 'twin_cascade', ?, 'finished', 30, 30, 'cascade', 1, ?, ?, 1)""",
            (ep_b_id, req.seed, user["email"], datetime.now(timezone.utc).isoformat())
        )
        for a in assessments_a:
            ad = a.model_dump()
            ad["episode_id"] = ep_a_id
            conn.execute("INSERT INTO assessments (episode_id, minute, assessment_version, data_json) VALUES (?, ?, 1, ?)", (ep_a_id, a.minute, json.dumps(ad)))
        for b in assessments_b:
            bd = b.model_dump()
            bd["episode_id"] = ep_b_id
            conn.execute("INSERT INTO assessments (episode_id, minute, assessment_version, data_json) VALUES (?, ?, 1, ?)", (ep_b_id, b.minute, json.dumps(bd)))

    conn.close()
    log_audit(user["email"], "twin_test", {"test_id": test_id, "split": req.split, "prefix_equal": prefix_equal})

    return {
        "test_id": test_id,
        "prefix_scenario": req.prefix,
        "split_minute": req.split,
        "seed": req.seed,
        "prefix_hash": prefix_hash,
        "prefix_equal": prefix_equal,
        "episode_a": {
            "id": ep_a_id,
            "label": "Twin A (False Alarm Future)",
            "assessments": [a.model_dump() for a in assessments_a]
        },
        "episode_b": {
            "id": ep_b_id,
            "label": "Twin B (Cascade Future)",
            "assessments": [b.model_dump() for b in assessments_b]
        }
    }


# ==================== Evaluation Runs ====================

class EvalRunRequest(BaseModel):
    n_episodes: int = 20


@app.post("/eval-runs")
def run_eval(req: EvalRunRequest, user: Dict[str, Any] = Depends(get_current_user)):
    results = evaluate_suite(n_episodes=req.n_episodes)
    log_audit(user["email"], "eval_run", {"n_episodes": req.n_episodes, "brier": results["brier_score"], "ece": results["ece"]})
    return results


# ==================== Authorizations & Two-Person Rule ====================

class CreateAuthRequest(BaseModel):
    episode_id: str
    minute: int
    action: ActionType  # ESCALATE or ALERT
    justification: str
    snapshot: Dict[str, Any]


@app.post("/authorizations")
def request_authorization(req: CreateAuthRequest, user: Dict[str, Any] = Depends(get_current_user)):
    auth_id = f"auth_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_db()
    with conn:
        conn.execute(
            """INSERT INTO authorizations (id, episode_id, minute, action, requester, justification, status, snapshot_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)""",
            (auth_id, req.episode_id, req.minute, req.action, user["email"], req.justification, json.dumps(req.snapshot), now_iso)
        )
    conn.close()
    log_audit(user["email"], "request_authorization", {"auth_id": auth_id, "action": req.action, "minute": req.minute})

    return {
        "id": auth_id,
        "episode_id": req.episode_id,
        "minute": req.minute,
        "action": req.action,
        "requester": user["email"],
        "status": "pending",
        "created_at": now_iso
    }


@app.get("/authorizations")
def list_authorizations():
    conn = get_db()
    rows = conn.execute("SELECT * FROM authorizations ORDER BY created_at DESC").fetchall()
    conn.close()
    items = []
    for r in rows:
        d = dict(r)
        d["snapshot"] = json.loads(d.pop("snapshot_json"))
        items.append(d)
    return items


class AuthDecisionRequest(BaseModel):
    decision: str  # approve or reject
    reason: str


@app.post("/authorizations/{auth_id}/decision")
def decide_authorization(auth_id: str, req: AuthDecisionRequest, user: Dict[str, Any] = Depends(require_role("supervisor"))):
    conn = get_db()
    row = conn.execute("SELECT * FROM authorizations WHERE id = ?", (auth_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Authorization request not found")

    auth_data = dict(row)

    # TWO-PERSON RULE CHECK: requester != approver
    if auth_data["requester"] == user["email"]:
        conn.close()
        log_audit(user["email"], "two_person_rule_violation", {"auth_id": auth_id, "requester": auth_data["requester"]})
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="two_person_rule: Requester and approver must be different users."
        )

    new_status = "approved" if req.decision.lower() == "approve" else "rejected"
    now_iso = datetime.now(timezone.utc).isoformat()

    with conn:
        conn.execute(
            """UPDATE authorizations SET status = ?, decided_by = ?, decision_reason = ?, decided_at = ? WHERE id = ?""",
            (new_status, user["email"], req.reason, now_iso, auth_id)
        )
    conn.close()
    log_audit(user["email"], "decide_authorization", {"auth_id": auth_id, "status": new_status, "reason": req.reason})

    return {
        "id": auth_id,
        "status": new_status,
        "decided_by": user["email"],
        "decision_reason": req.reason,
        "decided_at": now_iso,
        "note": "Official decision recorded. App does not broadcast publicly."
    }


# ==================== Audit Log ====================

@app.get("/audit")
def get_audit_trail(user: Dict[str, Any] = Depends(require_role("duty_officer"))):
    conn = get_db()
    rows = conn.execute("SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100").fetchall()
    conn.close()
    items = []
    for r in rows:
        d = dict(r)
        d["details"] = json.loads(d.pop("details_json"))
        items.append(d)
    return items


# ==================== Live Weather Proxy ====================

@app.get("/api/weather")
async def get_live_weather(lat: float = Query(19.0760), lon: float = Query(72.8777)):
    """
    OpenWeather current + 3h forecast proxy.
    Cached 5 minutes in memory. Graceful fallback on API failure.
    Keys remain strictly on the backend.
    """
    cache_key = f"ow_{round(lat, 3)}_{round(lon, 3)}"
    now = time.time()

    if cache_key in WEATHER_CACHE:
        cached_time, cached_data = WEATHER_CACHE[cache_key]
        if now - cached_time < CACHE_TTL:
            return cached_data

    # Fetch from OpenWeather
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp_cur = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"lat": lat, "lon": lon, "appid": OPENWEATHER_KEY, "units": "metric"}
            )
            resp_fc = await client.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={"lat": lat, "lon": lon, "appid": OPENWEATHER_KEY, "units": "metric", "cnt": 2}
            )

        if resp_cur.status_code == 200:
            cur_data = resp_cur.json()
            fc_data = resp_fc.json() if resp_fc.status_code == 200 else {}

            rain_1h = cur_data.get("rain", {}).get("1h", 0.0)
            fc_rain = 0.0
            if fc_data.get("list"):
                fc_rain = fc_data["list"][0].get("rain", {}).get("3h", 0.0)

            result = {
                "available": True,
                "source": "LIVE",
                "label": "LIVE",
                "location": cur_data.get("name") or f"Zone ({round(lat, 2)}°, {round(lon, 2)}°)",
                "lat": lat,
                "lon": lon,
                "temp_c": cur_data.get("main", {}).get("temp", 28.0),
                "feels_like_c": cur_data.get("main", {}).get("feels_like", 30.0),
                "humidity": cur_data.get("main", {}).get("humidity", 75),
                "wind_kmh": round(cur_data.get("wind", {}).get("speed", 3.0) * 3.6, 1),
                "rain_mm": rain_1h,
                "forecast_3h_rain_mm": fc_rain,
                "description": cur_data.get("weather", [{}])[0].get("description", "Scattered clouds"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            WEATHER_CACHE[cache_key] = (now, result)
            return result
        else:
            # Fallback calibrated telemetry if API rate limits or keys are unavailable
            return {
                "available": True,
                "source": "SIMULATED",
                "label": "SIMULATED",
                "location": f"Regional Radar ({round(lat, 2)}°, {round(lon, 2)}°)",
                "lat": lat,
                "lon": lon,
                "temp_c": 28.5,
                "feels_like_c": 31.0,
                "humidity": 68,
                "wind_kmh": 11.2,
                "rain_mm": 0.0,
                "forecast_3h_rain_mm": 0.4,
                "description": "Scattered clouds (Calibrated simulator)",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
    except Exception:
        return {
            "available": True,
            "source": "SIMULATED",
            "label": "SIMULATED",
            "location": f"Regional Radar ({round(lat, 2)}°, {round(lon, 2)}°)",
            "lat": lat,
            "lon": lon,
            "temp_c": 28.5,
            "feels_like_c": 31.0,
            "humidity": 68,
            "wind_kmh": 11.2,
            "rain_mm": 0.0,
            "forecast_3h_rain_mm": 0.4,
            "description": "Scattered clouds (Calibrated simulator)",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }


@app.get("/api/weather/alerts")
async def get_live_weather_alerts(lat: float = Query(19.0760), lon: float = Query(72.8777)):
    """
    Xweather observations + alerts proxy.
    Cached 5 minutes in memory. Graceful fallback on API failure.
    """
    cache_key = f"xw_{round(lat, 3)}_{round(lon, 3)}"
    now = time.time()

    if cache_key in WEATHER_CACHE:
        cached_time, cached_data = WEATHER_CACHE[cache_key]
        if now - cached_time < CACHE_TTL:
            return cached_data

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"https://data.api.xweather.com/alerts/{lat},{lon}",
                params={"client_id": XWEATHER_CLIENT_ID, "client_secret": XWEATHER_CLIENT_SECRET}
            )

        if resp.status_code == 200:
            data = resp.json()
            alerts = []
            for item in data.get("response", []):
                alerts.append({
                    "event": item.get("details", {}).get("event", "Weather Alert"),
                    "headline": item.get("details", {}).get("headline", ""),
                    "severity": item.get("details", {}).get("severity", "moderate")
                })
            result = {
                "available": True,
                "source": "LIVE",
                "label": "LIVE",
                "alerts": alerts,
                "count": len(alerts),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            WEATHER_CACHE[cache_key] = (now, result)
            return result
        else:
            return {
                "available": True,
                "source": "SIMULATED",
                "label": "SIMULATED",
                "alerts": [],
                "count": 0,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
    except Exception:
        return {
            "available": True,
            "source": "SIMULATED",
            "label": "SIMULATED",
            "alerts": [],
            "count": 0,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
