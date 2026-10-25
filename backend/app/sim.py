# backend/app/sim.py
"""
Deterministic seeded crisis simulator and fault injection suite for FIRST 10.
Adheres strictly to docs/07-Implementation-Plan-FAST.md (Sprint 1) & docs/02-TRD.md.
"""

import hashlib
import json
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timezone, timedelta
from app.models import Event, Location

# Sensor and gateway layout (40 sensors across 4 gateways)
GATEWAYS = {
    "gateway_G11": {"lat": 19.0760, "lon": 72.8777, "zone": "Zone A (Central)"},
    "gateway_G12": {"lat": 19.0850, "lon": 72.8900, "zone": "Zone B (East Basin)"},
    "gateway_G13": {"lat": 19.0650, "lon": 72.8650, "zone": "Zone C (South Harbor)"},
    "gateway_G14": {"lat": 19.0950, "lon": 72.8550, "zone": "Zone D (North Ridge)"},
}

SENSOR_TYPES = [
    ("rain", "rainfall", 0.90),
    ("drain", "drainage_level", 0.80),
    ("camera", "road_closure", 0.70),
    ("traffic", "traffic_speed", 0.75),
    ("infra", "infra_status", 0.85),
    ("hb", "source_heartbeat", 0.95),
]


def _build_sensors():
    sensors = []
    for g_id, g_info in GATEWAYS.items():
        for s_prefix, s_type, rel in SENSOR_TYPES:
            # 2 sensors per type per gateway
            for idx in [1, 2]:
                s_id = f"{s_prefix}_{g_id[-3:]}_{idx:02d}"
                sensors.append({
                    "source_id": s_id,
                    "source_group": g_id,
                    "event_type": s_type,
                    "location": g_info,
                    "base_reliability": rel
                })
    return sensors


SENSORS = _build_sensors()


def generate(
    scenario: str = "cascade",
    seed: int = 42,
    minutes: int = 30,
    ambiguous_prefix: bool = False,
    split_min: int = 8
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Generate deterministic list of events according to the scenario.
    Returns (events, ground_truth).
    """
    rng = np.random.default_rng(seed)
    base_time = datetime(2026, 10, 26, 0, 0, 0, tzinfo=timezone.utc)
    events: List[Dict[str, Any]] = []

    # Map scenario to ground truth
    truth_map = {
        "noise": "noise",
        "gateway_failure": "sensor_failure",
        "isolated_flood": "isolated",
        "cascade": "cascade",
        "monsoon_shift": "noise",
    }
    truth = truth_map.get(scenario, "noise")

    for m in range(minutes):
        minute_time = base_time + timedelta(minutes=m)
        iso_time = minute_time.isoformat()

        # Check ambiguous prefix logic: if ambiguous_prefix and m <= split_min,
        # generate mild prefix that could be either benign or beginning of cascade
        in_prefix = ambiguous_prefix and (m <= split_min)
        active_scenario = "noise" if in_prefix else scenario

        # 1. Physical sensor readings per gateway
        for s in SENSORS:
            g_id = s["source_group"]
            s_type = s["event_type"]
            s_id = s["source_id"]
            lat = s["location"]["lat"]
            lon = s["location"]["lon"]
            zone = s["location"]["zone"]

            val: Dict[str, Any] = {}
            quality = "valid"

            if s_type == "rainfall":
                if active_scenario == "cascade":
                    # Rain grows from minute 4 across all zones
                    base_rain = 5.0 + max(0.0, m - 4) * 6.0 + rng.normal(0, 1.5)
                elif active_scenario == "isolated_flood":
                    # Rain only in G12
                    base_rain = (15.0 + rng.normal(0, 2)) if g_id == "gateway_G12" and m >= 5 else 2.0 + rng.normal(0, 0.5)
                elif active_scenario == "monsoon_shift":
                    base_rain = 12.0 + rng.normal(0, 2.0)
                else:
                    base_rain = max(0.0, 1.0 + rng.normal(0, 0.5))
                val = {"mm_per_h": max(0.0, round(float(base_rain), 1)), "anom": int(base_rain > 20.0)}

            elif s_type == "drainage_level":
                if active_scenario == "cascade":
                    level = 20.0 + max(0.0, m - 5) * 8.5 + rng.normal(0, 2.0)
                elif active_scenario == "isolated_flood":
                    level = (30.0 + max(0.0, m - 5) * 10.0 + rng.normal(0, 2.0)) if g_id == "gateway_G12" else 22.0 + rng.normal(0, 1.0)
                elif active_scenario == "gateway_failure" and g_id == "gateway_G12" and m >= 6:
                    # Gateway glitch produces wild stuck readings
                    level = 98.5 + rng.normal(0, 0.5)
                    quality = "suspect"
                else:
                    level = max(10.0, 20.0 + rng.normal(0, 1.5))
                val = {"level_cm": round(float(level), 1), "anom": int(level > 65.0)}

            elif s_type == "traffic_speed":
                if active_scenario == "cascade":
                    speed = max(5.0, 50.0 - max(0.0, m - 6) * 6.0 + rng.normal(0, 2.0))
                elif active_scenario == "isolated_flood":
                    speed = max(10.0, 50.0 - max(0.0, m - 6) * 7.0) if g_id == "gateway_G12" else 48.0 + rng.normal(0, 2.0)
                else:
                    speed = max(35.0, 50.0 + rng.normal(0, 2.0))
                val = {"speed_kmh": round(float(speed), 1), "anom": int(speed < 25.0)}

            elif s_type == "road_closure":
                closed = 0
                if active_scenario == "cascade" and m >= 9:
                    closed = 1 if rng.uniform() > 0.3 else 0
                elif active_scenario == "isolated_flood" and g_id == "gateway_G12" and m >= 8:
                    closed = 1
                val = {"closed": closed, "anom": closed}

            elif s_type == "infra_status":
                status = "ok"
                if active_scenario == "gateway_failure" and g_id == "gateway_G12" and m >= 6:
                    status = "degraded"
                elif active_scenario == "cascade" and m >= 12 and g_id in ["gateway_G11", "gateway_G12"]:
                    status = "submerged"
                val = {"status": status, "anom": int(status != "ok")}

            elif s_type == "source_heartbeat":
                alive = 1
                if active_scenario == "gateway_failure" and g_id == "gateway_G12" and m >= 6:
                    # G12 loses heartbeats!
                    alive = 0 if rng.uniform() > 0.2 else 1
                val = {"alive": alive, "anom": int(alive == 0)}

            evt_id = f"evt_{m:02d}_{s_id}_{hashlib.md5(f'{seed}_{m}_{s_id}'.encode()).hexdigest()[:6]}"
            events.append({
                "event_id": evt_id,
                "event_time": iso_time,
                "sim_minute": m,
                "ingestion_time": iso_time,
                "source_id": s_id,
                "source_group": g_id,
                "location": {"lat": lat, "lon": lon, "zone": zone},
                "event_type": s_type,
                "value": val,
                "quality": quality,
                "revision_of": None,
                "origin_id": None
            })

        # 2. Independent emergency dispatch feed
        dispatch_count = 1 + int(rng.poisson(0.5))
        if active_scenario == "cascade" and m >= 8:
            dispatch_count += int(2 + max(0, m - 8) * 1.5 + rng.poisson(2))
        elif active_scenario == "isolated_flood" and m >= 9:
            dispatch_count += 2

        evt_id = f"evt_{m:02d}_dispatch_{hashlib.md5(f'{seed}_{m}_disp'.encode()).hexdigest()[:6]}"
        events.append({
            "event_id": evt_id,
            "event_time": iso_time,
            "sim_minute": m,
            "ingestion_time": iso_time,
            "source_id": "dispatch_central",
            "source_group": "emergency_services",
            "location": {"lat": 19.0760, "lon": 72.8777, "zone": "Central"},
            "event_type": "dispatch",
            "value": {"active_dispatches": dispatch_count, "anom": int(dispatch_count > 4)},
            "quality": "valid",
            "revision_of": None,
            "origin_id": None
        })

        # 3. Independent hospital admissions feed
        hospital_z = round(float(rng.normal(0, 0.4)), 2)
        if active_scenario == "cascade" and m >= 12:
            hospital_z = round(float(1.5 + max(0, m - 12) * 0.4 + rng.normal(0, 0.3)), 2)

        evt_id = f"evt_{m:02d}_hospital_{hashlib.md5(f'{seed}_{m}_hosp'.encode()).hexdigest()[:6]}"
        events.append({
            "event_id": evt_id,
            "event_time": iso_time,
            "sim_minute": m,
            "ingestion_time": iso_time,
            "source_id": "hospital_district",
            "source_group": "health_department",
            "location": {"lat": 19.0800, "lon": 72.8700, "zone": "Central"},
            "event_type": "hospital_arrivals",
            "value": {"hospital_z": hospital_z, "anom": int(hospital_z > 1.8)},
            "quality": "valid",
            "revision_of": None,
            "origin_id": None
        })

        # 4. Citizen reports with origin_id
        if active_scenario == "cascade" and m >= 7:
            num_reports = int(rng.integers(1, 4))
            for r_idx in range(num_reports):
                origin = f"citizen_{m}_{r_idx}_{seed}"
                evt_id = f"evt_{m:02d}_cit_{r_idx}_{hashlib.md5(f'{seed}_{m}_{r_idx}'.encode()).hexdigest()[:6]}"
                events.append({
                    "event_id": evt_id,
                    "event_time": iso_time,
                    "sim_minute": m,
                    "ingestion_time": iso_time,
                    "source_id": f"cit_rep_{r_idx}",
                    "source_group": "citizen_network",
                    "location": {"lat": 19.0850, "lon": 72.8900, "zone": "Zone B"},
                    "event_type": "citizen_report",
                    "value": {"text": "Water rising above car wheels near junction", "anom": 1},
                    "quality": "valid",
                    "revision_of": None,
                    "origin_id": origin
                })
        elif active_scenario == "isolated_flood" and m >= 8:
            origin = f"citizen_isolated_{m}_{seed}"
            evt_id = f"evt_{m:02d}_cit_iso_{hashlib.md5(f'{seed}_{m}_iso'.encode()).hexdigest()[:6]}"
            events.append({
                "event_id": evt_id,
                "event_time": iso_time,
                "sim_minute": m,
                "ingestion_time": iso_time,
                "source_id": "cit_rep_local",
                "source_group": "citizen_network",
                "location": {"lat": 19.0850, "lon": 72.8900, "zone": "Zone B"},
                "event_type": "citizen_report",
                "value": {"text": "Local storm drain clogged at market", "anom": 1},
                "quality": "valid",
                "revision_of": None,
                "origin_id": origin
            })

    return events, truth


# Fault Injection Utilities (Sprint 1)
def kill_gateway(events: List[Dict[str, Any]], gateway: str = "gateway_G12", from_min: int = 5) -> List[Dict[str, Any]]:
    """Simulate gateway failure: heartbeats lost and sensor readings become erratic or missing."""
    modified = []
    for e in events:
        e_copy = dict(e)
        if e_copy["source_group"] == gateway and e_copy["sim_minute"] >= from_min:
            if e_copy["event_type"] == "source_heartbeat":
                e_copy["value"] = {"alive": 0, "anom": 1}
            elif e_copy["event_type"] in ["drainage_level", "rainfall"]:
                # High erratic reading with suspect quality
                e_copy["value"] = {"level_cm": 99.0, "anom": 1}
                e_copy["quality"] = "suspect"
        modified.append(e_copy)
    return modified


def drop_cameras(events: List[Dict[str, Any]], from_min: int = 5) -> List[Dict[str, Any]]:
    """Drop camera feeds from minute from_min onwards (simulate camera network outage)."""
    # Cameras are omitted, creating a missing feed observation
    return [e for e in events if not (e["event_type"] == "road_closure" and e["sim_minute"] >= from_min)]


def duplicate(events: List[Dict[str, Any]], frac: float = 0.2, seed: int = 99) -> List[Dict[str, Any]]:
    """Duplicate a fraction of events with identical event_id to test idempotency."""
    rng = np.random.default_rng(seed)
    dupes = []
    for e in events:
        dupes.append(e)
        if rng.uniform() < frac:
            dupes.append(dict(e))  # Exact duplicate
    return dupes


def shuffle_arrival(events: List[Dict[str, Any]], seed: int = 101) -> List[Dict[str, Any]]:
    """Permute event array order (out-of-order arrival) while keeping event_time unchanged."""
    rng = np.random.default_rng(seed)
    shuffled = list(events)
    rng.shuffle(shuffled)
    return shuffled


def late_dispatch(events: List[Dict[str, Any]], delay_minutes: int = 5) -> List[Dict[str, Any]]:
    """Shift ingestion time of dispatch events to simulate late arrival."""
    modified = []
    for e in events:
        e_copy = dict(e)
        if e_copy["event_type"] == "dispatch":
            # Delayed ingestion time
            dt = datetime.fromisoformat(e_copy["ingestion_time"]) + timedelta(minutes=delay_minutes)
            e_copy["ingestion_time"] = dt.isoformat()
        modified.append(e_copy)
    return modified


def retract(events: List[Dict[str, Any]], target_ids: List[str]) -> List[Dict[str, Any]]:
    """Append retraction events that retract target_ids."""
    modified = list(events)
    for tid in target_ids:
        # Find original event to base retraction on
        orig = next((e for e in events if e["event_id"] == tid), None)
        if orig:
            retract_evt = dict(orig)
            retract_evt["event_id"] = f"retract_{tid}"
            retract_evt["quality"] = "retracted"
            retract_evt["revision_of"] = tid
            modified.append(retract_evt)
    return modified


def rumor_burst(events: List[Dict[str, Any]], origin_id: str = "rumor_bot_01", n: int = 10, minute: int = 6) -> List[Dict[str, Any]]:
    """Simulate bot/rumor burst: N citizen reports sharing the same origin_id."""
    modified = list(events)
    base_time = datetime(2026, 10, 26, 0, minute, 0, tzinfo=timezone.utc).isoformat()
    for i in range(n):
        modified.append({
            "event_id": f"evt_{minute:02d}_rumor_{i}_{origin_id}",
            "event_time": base_time,
            "sim_minute": minute,
            "ingestion_time": base_time,
            "source_id": f"rumor_src_{i}",
            "source_group": "citizen_network",
            "location": {"lat": 19.0850, "lon": 72.8900, "zone": "Zone B"},
            "event_type": "citizen_report",
            "value": {"text": "Bridge collapsed and entire highway under water!", "anom": 1},
            "quality": "valid",
            "revision_of": None,
            "origin_id": origin_id
        })
    return modified


def flip_story(events: List[Dict[str, Any]], source_id: str, from_min: int = 7) -> List[Dict[str, Any]]:
    """Simulate a source correcting or flipping its reading."""
    modified = []
    for e in events:
        modified.append(e)
        if e["source_id"] == source_id and e["sim_minute"] == from_min:
            # Add a corrected version
            corrected = dict(e)
            corrected["event_id"] = f"corr_{e['event_id']}"
            corrected["quality"] = "corrected"
            corrected["revision_of"] = e["event_id"]
            if "speed_kmh" in corrected["value"]:
                corrected["value"] = {"speed_kmh": 50.0, "anom": 0}
            elif "level_cm" in corrected["value"]:
                corrected["value"] = {"level_cm": 25.0, "anom": 0}
            modified.append(corrected)
    return modified


def twin(prefix_scenario: str = "cascade", split_min: int = 8, seed: int = 777) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], str]:
    """
    Generate twin episodes A and B:
    - Exactly identical events for minute <= split_min (guaranteed same hash)
    - After split_min: Twin A evolves as False Alarm (noise/isolated), Twin B evolves as True Cascade.
    """
    # 1. Generate full cascade stream
    events_full_cascade, _ = generate(scenario="cascade", seed=seed, minutes=30, ambiguous_prefix=True, split_min=split_min)
    # 2. Generate full noise/isolated stream with same seed and prefix
    events_full_benign, _ = generate(scenario="isolated_flood", seed=seed, minutes=30, ambiguous_prefix=True, split_min=split_min)

    # Prefix events (<= split_min) must be byte-for-byte identical
    prefix_events = [e for e in events_full_cascade if e["sim_minute"] <= split_min]

    # Compute prefix hash
    prefix_sorted = sorted(prefix_events, key=lambda x: (x["event_time"], x["source_id"], x["event_id"]))
    prefix_bytes = json.dumps(prefix_sorted, sort_keys=True).encode()
    prefix_hash = hashlib.sha256(prefix_bytes).hexdigest()

    # Twin A: shared prefix + benign post-split
    twin_a = list(prefix_events) + [e for e in events_full_benign if e["sim_minute"] > split_min]
    # Twin B: shared prefix + cascade post-split
    twin_b = list(prefix_events) + [e for e in events_full_cascade if e["sim_minute"] > split_min]

    return twin_a, twin_b, prefix_hash
