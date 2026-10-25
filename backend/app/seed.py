# backend/app/seed.py
"""
Seed script to pre-populate database with the 5 standard demo episodes and sample authorization requests.
"""

import json
import uuid
from datetime import datetime, timezone
from app.db import get_db, init_db
from app.sim import generate
from app.engine import run_episode

DEMO_SCENARIOS = [
    ("cascade", 42, 30, "Cascading crisis: heavy rainfall leads to drainage failure and hospital surges"),
    ("gateway_failure", 888, 25, "Gateway G12 failure: heartbeat loss and spurious readings discounted"),
    ("isolated_flood", 303, 25, "Isolated flood: local blockage in Zone B, contained"),
    ("noise", 101, 20, "Baseline noise: routine fluctuations across all gateways"),
    ("monsoon_shift", 505, 25, "Monsoon shift: elevated background rainfall prior")
]


def seed_data():
    init_db()
    conn = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()

    print("Seeding demo episodes...")
    for scen, seed, duration, desc in DEMO_SCENARIOS:
        ep_id = f"ep_{scen[:4]}_{seed}"

        # Check if already seeded
        existing = conn.execute("SELECT id FROM episodes WHERE id = ?", (ep_id,)).fetchone()
        if existing:
            print(f"Episode {ep_id} already exists, skipping.")
            continue

        events, truth = generate(scenario=scen, seed=seed, minutes=duration)
        assessments = run_episode(events, monsoon_shift=(scen == "monsoon_shift"))

        with conn:
            conn.execute(
                """INSERT INTO episodes (id, scenario, seed, status, current_minute, duration_min, truth, is_sandbox, created_by, created_at, assessment_version)
                   VALUES (?, ?, ?, 'created', 0, ?, ?, 0, 'admin@demo.first10', ?, 1)""",
                (ep_id, scen, seed, duration, truth, now_iso)
            )

            for e in events:
                conn.execute(
                    """INSERT INTO events (episode_id, event_id, event_time, sim_minute, ingestion_time, source_id, source_group, zone, lat, lon, event_type, value_json, quality, revision_of, origin_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        ep_id, e["event_id"], e["event_time"], e["sim_minute"], e["ingestion_time"],
                        e["source_id"], e["source_group"], e["location"]["zone"], e["location"]["lat"], e["location"]["lon"],
                        e["event_type"], json.dumps(e["value"]), e["quality"], e.get("revision_of"), e.get("origin_id")
                    )
                )

            for a in assessments:
                ad = a.model_dump()
                ad["episode_id"] = ep_id
                conn.execute(
                    """INSERT INTO assessments (episode_id, minute, assessment_version, data_json)
                       VALUES (?, ?, 1, ?)""",
                    (ep_id, a.minute, json.dumps(ad))
                )

        print(f"Seeded episode: {ep_id} ({scen}, {duration} min, truth={truth})")

    # Add a sample authorization request for the supervisor queue
    sample_auth_id = "auth_demo_cascade_01"
    existing_auth = conn.execute("SELECT id FROM authorizations WHERE id = ?", (sample_auth_id,)).fetchone()
    if not existing_auth:
        with conn:
            conn.execute(
                """INSERT INTO authorizations (id, episode_id, minute, action, requester, justification, status, snapshot_json, created_at)
                   VALUES (?, 'ep_casc_42', 12, 'ESCALATE', 'officer@demo.first10', 'Widespread inundation reported across Zone A and B with 3 hospital surge alerts.', 'pending', ?, ?)""",
                (sample_auth_id, json.dumps({"cascade_p": 0.88, "version": 1}), now_iso)
            )
        print("Seeded sample pending authorization request.")

    conn.close()
    print("Database seeding completed.")


if __name__ == "__main__":
    seed_data()
