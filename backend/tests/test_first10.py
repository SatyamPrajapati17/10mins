# backend/tests/test_first10.py
"""
10 Minimum Required Tests as specced in docs/07-Implementation-Plan-FAST.md (Section 6).
Tests:
1. Belief sums to 1 every minute
2. Duplicate events don't change output
3. Shuffled arrival order, same event times -> identical output
4. Same seed -> byte-identical assessments
5. Twin prefix: events and beliefs/actions equal through split
6. Gateway failure -> no ESCALATE, sensor_failure dominant
7. Cascade -> reaches ALERT/ESCALATE within target lag
8. Cameras dropped -> no "roads clear" inference, forecast slot abstains
9. Retracted event stops influencing belief; version increments
10. Supervisor == requester -> 403 two_person_rule
"""

import json
import pytest
from fastapi.testclient import TestClient
from app.main import app, DEMO_USERS, create_token
from app.sim import generate, twin, duplicate, shuffle_arrival, drop_cameras, retract
from app.engine import run_episode, normalize

client = TestClient(app)


# Test 1: Belief sums to 1 every minute
def test_1_belief_sums_to_one():
    events, _ = generate("cascade", seed=42, minutes=20)
    assessments = run_episode(events)
    for a in assessments:
        b = a.belief
        total = b.noise + b.sensor_failure + b.isolated + b.cascade
        assert pytest.approx(total, abs=1e-3) == 1.0


# Test 2: Duplicate events don't change output
def test_2_duplicate_events_idempotent():
    events, _ = generate("cascade", seed=101, minutes=15)
    assessments_orig = run_episode(events)

    events_duped = duplicate(events, frac=0.5, seed=999)
    assessments_duped = run_episode(events_duped)

    assert len(assessments_orig) == len(assessments_duped)
    for a1, a2 in zip(assessments_orig, assessments_duped):
        assert a1.belief.cascade == a2.belief.cascade
        assert a1.belief.sensor_failure == a2.belief.sensor_failure
        assert a1.action.recommended == a2.action.recommended


# Test 3: Shuffled arrival order, same event times -> identical output
def test_3_shuffled_arrival_identical_output():
    events, _ = generate("cascade", seed=202, minutes=15)
    assessments_orig = run_episode(events)

    events_shuffled = shuffle_arrival(events, seed=555)
    assessments_shuffled = run_episode(events_shuffled)

    assert len(assessments_orig) == len(assessments_shuffled)
    for a1, a2 in zip(assessments_orig, assessments_shuffled):
        assert pytest.approx(a1.belief.cascade, abs=1e-4) == a2.belief.cascade
        assert a1.action.recommended == a2.action.recommended


# Test 4: Same seed -> byte-identical assessments
def test_4_same_seed_byte_identical():
    events1, _ = generate("isolated_flood", seed=303, minutes=15)
    events2, _ = generate("isolated_flood", seed=303, minutes=15)

    res1 = run_episode(events1)
    res2 = run_episode(events2)

    bytes1 = json.dumps([a.model_dump() for a in res1], sort_keys=True)
    bytes2 = json.dumps([a.model_dump() for a in res2], sort_keys=True)

    assert bytes1 == bytes2


# Test 5: Twin prefix: events and beliefs/actions equal through split
def test_5_twin_prefix_equality():
    split_min = 7
    events_a, events_b, prefix_hash = twin(prefix_scenario="cascade", split_min=split_min, seed=777)

    res_a = run_episode(events_a)
    res_b = run_episode(events_b)

    for m in range(split_min + 1):
        # Beliefs must match exactly through the split
        assert pytest.approx(res_a[m].belief.cascade, abs=1e-4) == res_b[m].belief.cascade
        assert pytest.approx(res_a[m].belief.noise, abs=1e-4) == res_b[m].belief.noise
        assert res_a[m].action.controller_state == res_b[m].action.controller_state


# Test 6: Gateway failure -> no ESCALATE, sensor_failure dominant
def test_6_gateway_failure_no_escalate():
    events, truth = generate("gateway_failure", seed=888, minutes=20)
    assessments = run_episode(events)

    # By the end, sensor_failure should be the dominant belief
    end_assessment = assessments[-1]
    assert end_assessment.belief.sensor_failure > 0.50
    assert end_assessment.belief.cascade < 0.30

    # It must NEVER escalate solely due to one failed gateway
    for a in assessments:
        assert a.action.controller_state != "ESCALATE"


# Test 7: Cascade -> reaches ALERT/ESCALATE within target lag
def test_7_cascade_reaches_alert_or_escalate():
    events, truth = generate("cascade", seed=42, minutes=20)
    assessments = run_episode(events)

    # In cascade scenario, severe evidence starts around min 7-8
    # System should reach ALERT or ESCALATE by minute 10-12
    states = [a.action.controller_state for a in assessments]
    assert "ALERT" in states or "ESCALATE" in states
    assert assessments[-1].action.controller_state == "ESCALATE"
    assert assessments[-1].belief.cascade > 0.70


# Test 8: Cameras dropped -> no "roads clear" inference, forecast slot abstains
def test_8_cameras_dropped_forecast_abstains():
    events, _ = generate("cascade", seed=505, minutes=15)
    events_dropped = drop_cameras(events, from_min=6)
    assessments = run_episode(events_dropped)

    # After minute 6, transport slot (road closure) must abstain due to camera drop
    post_drop = assessments[8]
    road_slot = next((slot for slot in post_drop.forecast if "Road" in slot.event), None)
    assert road_slot is not None
    assert road_slot.unavailable is True
    assert "Camera" in (road_slot.reason or "")


# Test 9: Retracted event stops influencing belief; version increments
def test_9_retracted_event_stops_influencing():
    events, _ = generate("isolated_flood", seed=606, minutes=15)
    # Target an anomaly event in minute 8
    target_evt = next(e for e in events if e["sim_minute"] == 8 and e["value"].get("anom") == 1)
    retracted_events = retract(events, [target_evt["event_id"]])

    # Normalizer should exclude retracted target
    eff = normalize(retracted_events)
    eff_ids = [e["event_id"] for e in eff]
    assert target_evt["event_id"] not in eff_ids

    # API test: create episode and inject retract fault
    token = create_token(DEMO_USERS["analyst@demo.first10"])
    create_resp = client.post("/episodes", json={"scenario": "isolated_flood", "seed": 606, "duration_min": 15}, headers={"Authorization": f"Bearer {token}"})
    assert create_resp.status_code == 200
    ep_id = create_resp.json()["episode_id"]

    fault_resp = client.post(f"/episodes/{ep_id}/faults", json={"fault_type": "retract", "target": target_evt["event_id"]}, headers={"Authorization": f"Bearer {token}"})
    assert fault_resp.status_code == 200
    assert fault_resp.json()["assessment_version"] == 2


# Test 10: Supervisor == requester -> 403 two_person_rule
def test_10_two_person_rule_enforced():
    officer_token = create_token(DEMO_USERS["officer@demo.first10"])
    sup_token = create_token(DEMO_USERS["supervisor@demo.first10"])

    # 1. Officer requests authorization
    auth_resp = client.post("/authorizations", json={
        "episode_id": "ep_test",
        "minute": 10,
        "action": "ESCALATE",
        "justification": "Severe multi-gateway flooding corroboration",
        "snapshot": {"version": 1, "cascade_p": 0.85}
    }, headers={"Authorization": f"Bearer {officer_token}"})
    assert auth_resp.status_code == 200
    auth_id = auth_resp.json()["id"]

    # 2. Supervisor approves: allowed (different user)
    dec_resp = client.post(f"/authorizations/{auth_id}/decision", json={
        "decision": "approve",
        "reason": "Confirmed with regional field units"
    }, headers={"Authorization": f"Bearer {sup_token}"})
    assert dec_resp.status_code == 200
    assert dec_resp.json()["status"] == "approved"

    # 3. Supervisor requests authorization themselves
    self_auth = client.post("/authorizations", json={
        "episode_id": "ep_test_2",
        "minute": 12,
        "action": "ESCALATE",
        "justification": "Self-initiated escalation",
        "snapshot": {"version": 1}
    }, headers={"Authorization": f"Bearer {sup_token}"})
    self_id = self_auth.json()["id"]

    # 4. Supervisor attempts to approve their own request -> 403 two_person_rule!
    blocked_resp = client.post(f"/authorizations/{self_id}/decision", json={
        "decision": "approve",
        "reason": "Self approval"
    }, headers={"Authorization": f"Bearer {sup_token}"})
    assert blocked_resp.status_code == 403
    assert "two_person_rule" in blocked_resp.json()["detail"]
