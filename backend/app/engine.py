# backend/app/engine.py
"""
FIRST 10 Core Decision & Inference Engine.
Spec: docs/07-Implementation-Plan-FAST.md (Section 3) & docs/02-TRD.md.
Implements:
- Normalization (dedupe, revisions, retractions, determinism)
- Group-aware Bayesian filtering over H in {noise, sensor_failure, isolated, cascade}
- Common-cause gateway discounting (n_eff with rho=0.8, static sensor reliability)
- Cost-matrix expected loss + simplified Value of Waiting
- Controller with hysteresis state machine and instant cascade override
- Causal forecaster with abstention
- Templated 4-heading explanations
"""

import math
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from app.models import (
    Event, Assessment, Belief, Uncertainty, ActionDetails,
    ForecastSlot, EvidenceSummary, Explanation
)

# Cost Matrix from TRD Section 4.5
COST_MATRIX = {
    "WATCH": {"noise": 0.0, "sensor_failure": 1.0, "isolated": 15.0, "cascade": 100.0},
    "PREPARE": {"noise": 2.0, "sensor_failure": 3.0, "isolated": 8.0, "cascade": 40.0},
    "ALERT": {"noise": 10.0, "sensor_failure": 12.0, "isolated": 4.0, "cascade": 15.0},
    "ESCALATE": {"noise": 40.0, "sensor_failure": 45.0, "isolated": 20.0, "cascade": 5.0},
}

ACTIONS = ["WATCH", "PREPARE", "ALERT", "ESCALATE"]
HYPOTHESES = ["noise", "sensor_failure", "isolated", "cascade"]

# Static sensor type reliability
SENSOR_RELIABILITY = {
    "rainfall": 0.90,
    "drainage_level": 0.80,
    "road_closure": 0.70,
    "traffic_speed": 0.75,
    "infra_status": 0.85,
    "source_heartbeat": 0.95,
    "citizen_report": 0.40,
    "dispatch": 0.90,
    "hospital_arrivals": 0.85,
}

# Sticky transition matrix T: rows = prev, cols = next
# [noise, sensor_failure, isolated, cascade]
T_BASE = np.array([
    [0.91, 0.03, 0.04, 0.02],
    [0.10, 0.85, 0.03, 0.02],
    [0.05, 0.03, 0.82, 0.10],
    [0.01, 0.01, 0.02, 0.96],
])

# Delay damage rates d(h) per minute for Value of Waiting: [noise, sensor_failure, isolated, cascade]
DELAY_RATES = {"noise": 0.0, "sensor_failure": 0.5, "isolated": 2.0, "cascade": 10.0}


def normalize(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Pure normalizer:
    1. Dedupe exact event_id (keep first occurrence)
    2. Apply revisions: if an event has revision_of, it supersedes the earlier event_id
    3. Drop retracted events from the effective view
    4. Deterministic sort by (event_time, source_id, event_id)
    """
    seen_ids = set()
    deduped = []
    for e in events:
        eid = e["event_id"]
        if eid not in seen_ids:
            seen_ids.add(eid)
            deduped.append(e)

    # Track revisions and retractions
    # Map target_id -> latest revision event
    revisions: Dict[str, Dict[str, Any]] = {}
    retracted_targets = set()

    for e in deduped:
        rev_target = e.get("revision_of")
        if rev_target:
            if e.get("quality") == "retracted":
                retracted_targets.add(rev_target)
            else:
                revisions[rev_target] = e

    effective = []
    for e in deduped:
        eid = e["event_id"]
        # Skip if retracted
        if eid in retracted_targets or e.get("quality") == "retracted":
            continue
        # If this event was superseded by a non-retracted revision, use the revision instead
        if eid in revisions:
            effective.append(revisions[eid])
        elif not e.get("revision_of"):
            # Normal original event
            effective.append(e)

    # Final deterministic sort
    effective.sort(key=lambda x: (x.get("event_time", ""), x.get("source_id", ""), x.get("event_id", "")))
    return effective


def softmax(x: np.ndarray) -> np.ndarray:
    """Stable softmax."""
    shift_x = x - np.max(x)
    exps = np.exp(shift_x)
    return exps / np.sum(exps)


def compute_n_eff(n: int, rho: float = 0.8) -> float:
    """Effective independent sample size under intra-group correlation rho."""
    if n <= 1:
        return float(n)
    return float(n) / (1.0 + (n - 1) * rho)


def extract_minute_features(minute_events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Extract per-minute summary features from effective events for that minute.
    """
    anom_by_group: Dict[str, List[int]] = {}
    hb_loss_by_group: Dict[str, List[int]] = {}
    group_sensors: Dict[str, List[str]] = {}
    group_types: Dict[str, List[str]] = {}

    rain_vals = []
    traffic_drops = []
    closures = 0
    dispatch_count = 0
    hospital_z = 0.0
    seen_origins = set()
    seen_types = set()

    for e in minute_events:
        g = e.get("source_group", "unknown")
        etype = e.get("event_type", "")
        sid = e.get("source_id", "")
        val = e.get("value", {})
        anom = val.get("anom", 0)

        seen_types.add(etype)

        if g.startswith("gateway_"):
            if g not in anom_by_group:
                anom_by_group[g] = []
                hb_loss_by_group[g] = []
                group_sensors[g] = []
                group_types[g] = []
            anom_by_group[g].append(anom)
            group_sensors[g].append(sid)
            group_types[g].append(etype)

            if etype == "source_heartbeat":
                alive = val.get("alive", 1)
                hb_loss_by_group[g].append(1 if alive == 0 else 0)

        if etype == "rainfall":
            rain_vals.append(val.get("mm_per_h", 0.0))
        elif etype == "traffic_speed":
            spd = val.get("speed_kmh", 50.0)
            traffic_drops.append(max(0.0, (50.0 - spd) / 50.0))
        elif etype == "road_closure":
            if val.get("closed", 0) == 1:
                closures += 1
        elif etype == "dispatch":
            dispatch_count = max(dispatch_count, val.get("active_dispatches", 0))
        elif etype == "hospital_arrivals":
            hospital_z = val.get("hospital_z", 0.0)
        elif etype == "citizen_report":
            origin = e.get("origin_id") or e.get("source_id")
            if origin:
                seen_origins.add(origin)

    # Compute group fractions
    anom_frac_by_group = {g: (sum(v) / len(v) if v else 0.0) for g, v in anom_by_group.items()}
    hb_loss_frac_by_group = {g: (sum(v) / len(v) if v else 0.0) for g, v in hb_loss_by_group.items()}

    all_expected_types = {"rainfall", "drainage_level", "traffic_speed", "road_closure", "infra_status", "source_heartbeat"}
    missing_types = list(all_expected_types - seen_types)

    return {
        "anom_by_group": anom_frac_by_group,
        "hb_loss_by_group": hb_loss_frac_by_group,
        "group_sizes": {g: len(v) for g, v in anom_by_group.items()},
        "group_types": group_types,
        "rain_avg": float(np.mean(rain_vals)) if rain_vals else 0.0,
        "traffic_drop_avg": float(np.mean(traffic_drops)) if traffic_drops else 0.0,
        "closures": closures,
        "dispatch_count": dispatch_count,
        "hospital_z": hospital_z,
        "reports_indep": len(seen_origins),
        "missing_types": missing_types,
    }


def compute_log_likelihoods(feats: Dict[str, Any]) -> Tuple[np.ndarray, List[str], List[str], List[str]]:
    """
    Computes log-likelihood contribution per hypothesis:
    Returns (log_likelihoods, supporting_notes, contradicting_notes, discounted_notes).
    H = [noise, sensor_failure, isolated, cascade]
    """
    # Initialize log-likelihoods for [noise, sensor_failure, isolated, cascade]
    ll = np.zeros(4, dtype=float)

    supporting = []
    contradicting = []
    discounted = []

    anom_groups = feats["anom_by_group"]
    hb_loss = feats["hb_loss_by_group"]
    group_sizes = feats["group_sizes"]
    group_types = feats["group_types"]

    # 1. Gateway Groups Analysis
    high_anom_groups = [g for g, frac in anom_groups.items() if frac >= 0.35]
    severe_hb_loss_groups = [g for g, frac in hb_loss.items() if frac >= 0.40]

    for g, frac in anom_groups.items():
        n = group_sizes.get(g, 1)
        n_eff = compute_n_eff(n, rho=0.8)
        # Average sensor reliability in this group
        types_in_g = group_types.get(g, [])
        r_bar = float(np.mean([SENSOR_RELIABILITY.get(t, 0.8) for t in types_in_g])) if types_in_g else 0.8
        w_g = n_eff * r_bar

        discounted.append(f"{g}: {n} sensors discounted to n_eff={n_eff:.1f} (intra-corr rho=0.8, weight {w_g:.2f})")

        # Group likelihood terms
        if frac > 0.40:
            # High anomalies in this group
            if g in severe_hb_loss_groups and len(high_anom_groups) == 1:
                # Strong signal for sensor_failure (concentrated failure + heartbeat loss)
                ll[1] += 3.5 * w_g  # sensor_failure
                ll[0] -= 3.0 * w_g  # noise
                ll[3] -= 1.0 * w_g  # cascade
                supporting.append(f"Heartbeat loss & anomaly surge isolated to {g} strongly indicates hardware/gateway fault.")
            elif len(high_anom_groups) > 1:
                # Multiple groups failing simultaneously favors cascade
                ll[3] += 2.8 * w_g  # cascade
                ll[2] += 0.8 * w_g  # isolated
                ll[0] -= 3.5 * w_g  # noise
                ll[1] -= 1.5 * w_g  # sensor_failure
                supporting.append(f"Corroborated anomalies across multiple gateways ({', '.join(high_anom_groups)}) favors systemic crisis.")
            else:
                # Single group anomaly without heartbeat loss -> isolated incident candidate
                ll[2] += 2.5 * w_g  # isolated
                ll[3] += 0.5 * w_g
                ll[0] -= 2.0 * w_g
                supporting.append(f"Localized anomaly in {g} without multi-zone spread supports isolated incident.")
        else:
            # Low anomalies in this group
            ll[0] += 0.8 * w_g
            ll[3] -= 1.0 * w_g

    # 2. Independent Confirmation Signals
    # Rain
    rain = feats["rain_avg"]
    if rain > 20.0:
        ll[3] += 3.0
        ll[2] += 1.5
        ll[0] -= 3.5
        ll[1] -= 2.0
        supporting.append(f"Heavy rain detected ({rain:.1f} mm/h) across city meters.")
    elif rain > 8.0:
        ll[3] += 1.0
        ll[2] += 1.0
        ll[0] -= 1.0

    # Traffic drop
    drop = feats["traffic_drop_avg"]
    if drop > 0.45:
        ll[3] += 2.5
        ll[2] += 1.0
        ll[0] -= 2.5
        supporting.append(f"Traffic speed dropped severely ({drop*100:.0f}% slowdown).")

    # Closures
    closures = feats["closures"]
    if closures >= 2:
        ll[3] += 3.0
        ll[2] += 1.5
        ll[0] -= 3.0
        supporting.append(f"Multiple arterial road closures reported ({closures} active).")
    elif closures == 1:
        ll[2] += 1.5
        ll[3] += 0.8

    # Emergency Dispatch
    dispatch = feats["dispatch_count"]
    if dispatch >= 5:
        ll[3] += 3.5
        ll[2] += 1.0
        ll[0] -= 3.5
        ll[1] -= 2.0
        supporting.append(f"Emergency dispatch surge ({dispatch} active units).")
    elif dispatch >= 3:
        ll[3] += 1.2
        ll[2] += 0.8

    # Hospital Arrivals
    hosp_z = feats["hospital_z"]
    if hosp_z > 1.8:
        ll[3] += 3.0
        ll[0] -= 2.5
        supporting.append(f"Hospital emergency intake z-score elevated (z={hosp_z:.2f}).")

    # Citizen Reports (deduped by origin_id)
    n_origins = feats["reports_indep"]
    if n_origins >= 2:
        # Multiple independent citizen origins
        ll[3] += 2.0 * min(n_origins, 4)
        ll[2] += 1.2
        ll[0] -= 2.0
        supporting.append(f"{n_origins} independent citizen reports confirmed via distinct origins.")
    elif n_origins == 1:
        ll[2] += 1.0
        ll[3] += 0.5
        supporting.append("Single citizen report received; awaiting independent corroboration.")

    # Missing feed types handling: missing data is health observation only, NEVER 'all clear'
    if "road_closure" in feats["missing_types"]:
        contradicting.append("Camera feeds absent: road clearance cannot be assumed.")
        # Does not add to noise!
        ll[0] -= 0.5

    return ll, supporting, contradicting, discounted


def evaluate_forecast(
    minute: int,
    belief: Belief,
    feats: Dict[str, Any],
    p_cascade: float,
    effective_sources: float
) -> List[ForecastSlot]:
    """
    Fixed causal chain:
    1. Rain -> Drainage overflow (Drainage subsystem)
    2. Drainage -> Road closure / Impassable (Transport subsystem)
    3. Road closure & floods -> Hospital load surge / Rescue demand (Emergency/Health subsystem)

    Top 3 by P * impact with distinct subsystems.
    If independent supporting groups < 2 or P < 0.15 -> unavailable slot.
    If camera feed missing -> abstain for road clearance / closure prediction.
    """
    slots = []

    # Check abstention rule: independent supporting groups < 2 or P < 0.15
    independent_groups = len([g for g, frac in feats["anom_by_group"].items() if frac > 0.25])
    if feats["reports_indep"] > 0:
        independent_groups += 1
    if feats["dispatch_count"] >= 3:
        independent_groups += 1

    # Slot 1: Drainage Overflow in East Basin (Zone B)
    p1 = min(0.98, max(0.05, (p_cascade * 0.70 + (belief.isolated * 0.60) + (feats["rain_avg"] / 30.0) * 0.40)))
    if independent_groups < 2 or p1 < 0.15:
        slots.append(ForecastSlot(
            event="Drainage Overflow (East Basin)",
            area="Zone B",
            window=[minute + 2, minute + 4],
            p=round(p1, 2),
            path=["Rainfall Spike", "Storm Culvert Saturation"],
            invalidated_if=["Rainfall ceases", "Pumping station G12 cleared"],
            unavailable=True,
            reason="Fewer than 2 independent corroborating sources."
        ))
    else:
        slots.append(ForecastSlot(
            event="Drainage Overflow (East Basin)",
            area="Zone B",
            window=[minute + 2, minute + 4],
            p=round(p1, 2),
            path=["Rainfall Spike", "Storm Culvert Saturation"],
            invalidated_if=["Rainfall ceases", "Pumping station G12 cleared"],
            unavailable=False
        ))

    # Slot 2: Arterial Road Inundation & Closure (Transport Subsystem)
    if "road_closure" in feats["missing_types"]:
        # Camera dropped: abstain!
        slots.append(ForecastSlot(
            event="Arterial Road Impassable",
            area="Central Corridor",
            window=[minute + 3, minute + 6],
            p=0.0,
            path=["Drainage Backflow", "Surface Runoff"],
            invalidated_if=["Camera feed restored", "Traffic patrol clearance"],
            unavailable=True,
            reason="Camera feeds dropped: traffic status cannot be confirmed."
        ))
    else:
        p2 = min(0.95, max(0.04, (p_cascade * 0.85 + (feats["traffic_drop_avg"] * 0.50))))
        if independent_groups < 2 or p2 < 0.15:
            slots.append(ForecastSlot(
                event="Arterial Road Impassable",
                area="Central Corridor",
                window=[minute + 3, minute + 6],
                p=round(p2, 2),
                path=["Drainage Backflow", "Surface Runoff"],
                invalidated_if=["Camera inspection clears road", "Drainage pumps active"],
                unavailable=True,
                reason="Fewer than 2 independent supporting sources."
            ))
        else:
            slots.append(ForecastSlot(
                event="Arterial Road Impassable",
                area="Central Corridor",
                window=[minute + 3, minute + 6],
                p=round(p2, 2),
                path=["Drainage Backflow", "Surface Runoff"],
                invalidated_if=["Camera inspection clears road", "Drainage pumps active"],
                unavailable=False
            ))

    # Slot 3: Emergency Dispatch & Hospital Load Spike (Health/Emergency Subsystem)
    p3 = min(0.92, max(0.02, (p_cascade * 0.90 + (feats["dispatch_count"] / 10.0) * 0.30)))
    if independent_groups < 2 or p3 < 0.15:
        slots.append(ForecastSlot(
            event="Emergency Trauma Load Surge",
            area="District Hospital",
            window=[minute + 5, minute + 8],
            p=round(p3, 2),
            path=["Road Inundation", "Delayed Ambulance Transit", "Patient Influx"],
            invalidated_if=["Dispatch rate normalizes", "Secondary triage opened"],
            unavailable=True,
            reason="Cascade probability insufficient or uncorroborated."
        ))
    else:
        slots.append(ForecastSlot(
            event="Emergency Trauma Load Surge",
            area="District Hospital",
            window=[minute + 5, minute + 8],
            p=round(p3, 2),
            path=["Road Inundation", "Delayed Ambulance Transit", "Patient Influx"],
            invalidated_if=["Dispatch rate normalizes", "Secondary triage opened"],
            unavailable=False
        ))

    return slots[:3]


def build_explanation(
    minute: int,
    belief: Belief,
    prev_belief: Optional[Belief],
    action: ActionDetails,
    feats: Dict[str, Any],
    supporting: List[str]
) -> Explanation:
    """Templated 4-heading decision explanation from stored numbers."""
    # 1. New Evidence
    if supporting:
        new_evidence_text = f"Minute {minute:02d}: " + "; ".join(supporting[:2]) + "."
    else:
        new_evidence_text = f"Minute {minute:02d}: Sensor feeds and heartbeats within baseline tolerance."

    # 2. How Beliefs Changed
    if prev_belief:
        delta_cascade = belief.cascade - prev_belief.cascade
        delta_sf = belief.sensor_failure - prev_belief.sensor_failure
        delta_iso = belief.isolated - prev_belief.isolated
        dir_cascade = "increased" if delta_cascade >= 0 else "decreased"
        belief_change_text = (
            f"P(cascade) {dir_cascade} by {abs(delta_cascade)*100:.1f}% to {belief.cascade*100:.1f}%. "
            f"P(sensor_failure) is {belief.sensor_failure*100:.1f}%, P(isolated) is {belief.isolated*100:.1f}%, "
            f"and P(noise) is {belief.noise*100:.1f}%."
        )
    else:
        belief_change_text = (
            f"Prior initialized: P(noise)={belief.noise*100:.1f}%, P(sensor_failure)={belief.sensor_failure*100:.1f}%, "
            f"P(isolated)={belief.isolated*100:.1f}%, P(cascade)={belief.cascade*100:.1f}%."
        )

    # 3. Why This Action
    min_cost = action.expected_cost[action.recommended]
    other_costs = ", ".join(f"{a}: {cost:.1f}" for a, cost in action.expected_cost.items() if a != action.recommended)
    why_action_text = (
        f"{action.recommended} has the lowest expected loss ({min_cost:.1f} vs {other_costs}). "
        f"Controller state is '{action.controller_state}' ({action.transition_reason})."
    )

    # 4. What Would Change It
    if action.recommended in ["WATCH", "PREPARE"]:
        what_would_change_text = (
            "Confirmation from >=2 independent gateways or a surge in emergency dispatch "
            "would drive expected loss lower for ALERT / ESCALATE."
        )
    else:
        what_would_change_text = (
            "Consistent drop in cross-zone anomalies for 2 consecutive minutes or verification of sensor gateway failure "
            "would justify de-escalation."
        )

    return Explanation(
        new_evidence=new_evidence_text,
        belief_change=belief_change_text,
        why_action=why_action_text,
        what_would_change=what_would_change_text
    )


def run_episode(
    events: List[Dict[str, Any]],
    config: Optional[Dict[str, Any]] = None,
    monsoon_shift: bool = False
) -> List[Assessment]:
    """
    Pure deterministic episode runner.
    Processes events minute by minute from 0 to max minute.
    Returns list of Assessments.
    """
    config = config or {}
    m_up = config.get("m_up", 2.0)
    m_down = config.get("m_down", 3.0)
    p_override = config.get("p_override", 0.75)

    # Transition matrix
    T = np.copy(T_BASE)
    if monsoon_shift:
        # Monsoon regime raises background noise-with-anomalies
        T[0, 2] += 0.05
        T[0, 0] -= 0.05

    # 1. Normalize
    eff_events = normalize(events)

    if not eff_events:
        max_min = 0
    else:
        max_min = max(e["sim_minute"] for e in eff_events)

    # Initial prior distribution: [noise, sensor_failure, isolated, cascade]
    b = np.array([0.70, 0.10, 0.15, 0.05], dtype=float)

    assessments: List[Assessment] = []
    controller_state = "WATCH"
    deescalate_counter = 0
    prev_belief_obj: Optional[Belief] = None

    for m in range(max_min + 1):
        minute_evts = [e for e in eff_events if e["sim_minute"] == m]

        # 1. Predict step: pred = T^T * b_prev
        pred = T.T @ b
        pred = np.clip(pred, 1e-6, 1.0)
        pred = pred / np.sum(pred)

        # 2. Extract features and compute log-likelihoods
        feats = extract_minute_features(minute_evts)
        ll, supporting, contradicting, discounted = compute_log_likelihoods(feats)

        # 3. Update step: logpost = log(pred) + sum LLR
        logpost = np.log(pred) + ll
        b = softmax(logpost)

        # Ensure exact sum to 1.0
        b = b / np.sum(b)
        belief_dict = {
            "noise": round(float(b[0]), 4),
            "sensor_failure": round(float(b[1]), 4),
            "isolated": round(float(b[2]), 4),
            "cascade": round(float(b[3]), 4),
        }
        # Normalize rounding to 1.0
        diff = 1.0 - sum(belief_dict.values())
        belief_dict["cascade"] = round(belief_dict["cascade"] + diff, 4)

        belief_obj = Belief(**belief_dict)

        # 4. Uncertainty: Entropy (bits) & effective independent sources
        entropy = -sum(p * math.log2(p) for p in b if p > 1e-9)
        eff_sources = sum(compute_n_eff(sz, 0.8) for sz in feats["group_sizes"].values()) + feats["reports_indep"]
        uncertainty_obj = Uncertainty(
            entropy_bits=round(entropy, 2),
            effective_independent_sources=round(eff_sources, 1)
        )

        # 5. Expected Loss per action
        el_dict = {}
        for act in ACTIONS:
            el = sum(b[i] * COST_MATRIX[act][HYPOTHESES[i]] for i in range(4))
            el_dict[act] = round(el, 2)

        raw_recommended = min(el_dict, key=el_dict.get)

        # 6. Value of Waiting (VoW)
        delay_cost = sum(b[i] * DELAY_RATES[HYPOTHESES[i]] for i in range(4))
        el_star = el_dict[raw_recommended]
        vow = el_star - (0.5 * el_star + delay_cost)

        # 7. Controller Hysteresis & Override
        # Check override: P(cascade) >= p_override AND >= 2 independent groups
        high_anom_groups = [g for g, frac in feats["anom_by_group"].items() if frac >= 0.35]
        has_independent_corroboration = (len(high_anom_groups) >= 2 or (len(high_anom_groups) >= 1 and (feats["reports_indep"] >= 1 or feats["dispatch_count"] >= 4)))

        override_active = False
        transition_reason = "hold_state"

        if b[3] >= p_override and has_independent_corroboration:
            override_active = True
            controller_state = "ESCALATE"
            transition_reason = "override_cascade_multi_source"
        else:
            curr_el = el_dict[controller_state]
            # Check upward transition (escalation): requires gain >= m_up
            act_order = {"WATCH": 0, "PREPARE": 1, "ALERT": 2, "ESCALATE": 3}
            target_up = raw_recommended if act_order[raw_recommended] > act_order[controller_state] else None

            if target_up and (curr_el - el_dict[target_up]) >= m_up:
                # Upward transition is immediate!
                controller_state = target_up
                deescalate_counter = 0
                transition_reason = f"enter_{target_up.lower()}_gain_threshold"
            else:
                # Check downward transition (de-escalation): requires gain >= m_down for k=2 consecutive minutes
                target_down = raw_recommended if act_order[raw_recommended] < act_order[controller_state] else None
                if target_down and (curr_el - el_dict[target_down]) >= m_down:
                    deescalate_counter += 1
                    if deescalate_counter >= 2:
                        controller_state = target_down
                        deescalate_counter = 0
                        transition_reason = f"deescalate_to_{target_down.lower()}_sustained"
                    else:
                        transition_reason = "hold_hysteresis_persistence"
                else:
                    deescalate_counter = 0
                    if vow > 0 and raw_recommended in ["ALERT", "ESCALATE"] and not override_active:
                        transition_reason = "hold_value_of_waiting"

        # Action details
        action_details = ActionDetails(
            recommended=raw_recommended,
            expected_cost=el_dict,
            wait_cost=round(delay_cost, 2),
            vow=round(vow, 2),
            next_review_minute=m + 1,
            controller_state=controller_state,
            transition_reason=transition_reason,
            override_triggered=override_active
        )

        # 8. Forecast
        forecast_slots = evaluate_forecast(
            minute=m,
            belief=belief_obj,
            feats=feats,
            p_cascade=float(b[3]),
            effective_sources=eff_sources
        )

        # 9. Evidence Summary
        evidence_summary = EvidenceSummary(
            supporting=supporting[:4],
            contradicting=contradicting[:3],
            discounted=discounted[:4],
            missing=feats["missing_types"]
        )

        # 10. Explanation
        explanation = build_explanation(
            minute=m,
            belief=belief_obj,
            prev_belief=prev_belief_obj,
            action=action_details,
            feats=feats,
            supporting=supporting
        )

        assessments.append(Assessment(
            episode_id="",
            minute=m,
            assessment_version=1,
            belief=belief_obj,
            uncertainty=uncertainty_obj,
            action=action_details,
            forecast=forecast_slots,
            evidence=evidence_summary,
            explanation=explanation
        ))

        prev_belief_obj = belief_obj

    return assessments
