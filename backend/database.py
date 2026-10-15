"""SQLite persistence for object memories and movement events. Never stores frames."""
from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS objects (
    object_id  TEXT PRIMARY KEY,
    category   TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    region     TEXT,
    x          REAL,
    y          REAL,
    last_seen  TEXT NOT NULL,
    visible    INTEGER NOT NULL DEFAULT 0,
    confidence REAL,
    track_id   INTEGER
);
CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    object_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    from_region TEXT,
    to_region   TEXT NOT NULL,
    timestamp   TEXT NOT NULL
);
"""

OBJECT_FIELDS = ("object_id", "category", "name", "region", "x", "y",
                 "last_seen", "visible", "confidence", "track_id")


def _obj(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    d = dict(row)
    d["visible"] = bool(d["visible"])
    return d


class Database:
    def __init__(self, path: str | Path):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(SCHEMA)
        self._conn.commit()

    def upsert_object(self, obj: dict) -> None:
        cols = ", ".join(OBJECT_FIELDS)
        marks = ", ".join("?" for _ in OBJECT_FIELDS)
        updates = ", ".join(f"{f}=excluded.{f}" for f in OBJECT_FIELDS if f != "object_id")
        values = [int(obj[f]) if f == "visible" else obj.get(f) for f in OBJECT_FIELDS]
        with self._lock:
            self._conn.execute(
                f"INSERT INTO objects ({cols}) VALUES ({marks}) "
                f"ON CONFLICT(object_id) DO UPDATE SET {updates}", values)
            self._conn.commit()

    def get_objects(self) -> list[dict]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM objects ORDER BY name").fetchall()
        return [_obj(r) for r in rows]

    def get_object(self, object_id: str) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM objects WHERE object_id = ?", (object_id,)).fetchone()
        return _obj(row)

    def get_by_category(self, category: str) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM objects WHERE category = ?", (category,)).fetchone()
        return _obj(row)

    def add_event(self, object_id: str, name: str, from_region: str | None,
                  to_region: str, timestamp: str) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO events (object_id, name, from_region, to_region, timestamp) "
                "VALUES (?, ?, ?, ?, ?)", (object_id, name, from_region, to_region, timestamp))
            self._conn.commit()

    def get_events(self, limit: int = 50) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]

    def clear(self) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM objects")
            self._conn.execute("DELETE FROM events")
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()
