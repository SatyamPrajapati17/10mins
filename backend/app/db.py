# backend/app/db.py
"""
SQLite database storage for FIRST 10.
Stores episodes, events, assessments, authorizations, and audit log.
Recomputes assessments deterministically when events or faults change.
"""

import sqlite3
import json
import os
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "first10.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS episodes (
            id TEXT PRIMARY KEY,
            scenario TEXT NOT NULL,
            seed INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'created',
            current_minute INTEGER NOT NULL DEFAULT 0,
            duration_min INTEGER NOT NULL DEFAULT 30,
            truth TEXT,
            is_sandbox INTEGER NOT NULL DEFAULT 0,
            created_by TEXT,
            created_at TEXT NOT NULL,
            assessment_version INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS events (
            pk INTEGER PRIMARY KEY AUTOINCREMENT,
            episode_id TEXT NOT NULL,
            event_id TEXT NOT NULL,
            event_time TEXT NOT NULL,
            sim_minute INTEGER NOT NULL,
            ingestion_time TEXT NOT NULL,
            source_id TEXT NOT NULL,
            source_group TEXT NOT NULL,
            zone TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            event_type TEXT NOT NULL,
            value_json TEXT NOT NULL,
            quality TEXT NOT NULL DEFAULT 'valid',
            revision_of TEXT,
            origin_id TEXT,
            UNIQUE(episode_id, event_id)
        );

        CREATE TABLE IF NOT EXISTS assessments (
            episode_id TEXT NOT NULL,
            minute INTEGER NOT NULL,
            assessment_version INTEGER NOT NULL,
            data_json TEXT NOT NULL,
            PRIMARY KEY (episode_id, minute, assessment_version)
        );

        CREATE TABLE IF NOT EXISTS authorizations (
            id TEXT PRIMARY KEY,
            episode_id TEXT NOT NULL,
            minute INTEGER NOT NULL,
            action TEXT NOT NULL,
            requester TEXT NOT NULL,
            justification TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            decided_by TEXT,
            decision_reason TEXT,
            snapshot_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            decided_at TEXT
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            details_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS twin_tests (
            id TEXT PRIMARY KEY,
            episode_a TEXT NOT NULL,
            episode_b TEXT NOT NULL,
            split_minute INTEGER NOT NULL,
            prefix_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """)
    conn.close()


# Ensure DB schema is initialized on import
init_db()
