"""Spatial memory: turns per-frame detections into stable last-known locations, and answers lookups."""
from __future__ import annotations

import re
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from database import Database
from spatial import Region, region_for_point

# YOLO (COCO) category -> words people use for it. One instance per category in the MVP.
ALIASES: dict[str, list[str]] = {
    "bottle": ["bottle", "water bottle", "drink"],
    "cup": ["cup", "mug", "coffee"],
    "cell phone": ["cell phone", "phone", "mobile", "iphone", "smartphone", "cellphone"],
    "book": ["book", "notebook", "novel"],
    "backpack": ["backpack", "bag", "rucksack", "bookbag"],
    "remote": ["remote", "tv remote", "controller"],
    "scissors": ["scissors"],
    "mouse": ["mouse", "computer mouse"],
    "laptop": ["laptop", "macbook", "computer", "notebook computer"],
}
SUPPORTED = list(ALIASES)


def display_name(category: str) -> str:
    return category.title()


def object_id_for(category: str) -> str:
    return f"{category.replace(' ', '_')}_01"


def now_iso(now: datetime | None = None) -> str:
    return (now or datetime.now(timezone.utc)).isoformat(timespec="seconds")


@dataclass
class Observation:
    category: str
    confidence: float
    x: float  # normalized bbox center
    y: float
    track_id: int | None = None
    bbox: tuple[float, float, float, float] | None = None  # normalized x0,y0,x1,y1


class SpatialMemory:
    """Updates a stored region only after `stability` consecutive sightings in a new region."""

    def __init__(self, db: Database, regions: list[Region], stability: int = 5,
                 min_confidence: float = 0.4, absence_seconds: float = 2.0):
        self.db = db
        self.regions = regions
        self.stability = stability
        self.min_confidence = min_confidence
        self.absence = timedelta(seconds=absence_seconds)
        self._candidates: dict[str, tuple[str, int]] = {}  # category -> (region, count)
        self._lock = threading.Lock()

    def observe(self, observations: list[Observation], now: datetime | None = None) -> list[dict]:
        """Process one frame's detections. Returns movement events created."""
        now = now or datetime.now(timezone.utc)
        ts = now_iso(now)
        events: list[dict] = []
        # One instance per category: keep the most confident detection of each.
        best: dict[str, Observation] = {}
        for o in observations:
            if o.category in ALIASES and o.confidence >= self.min_confidence:
                if o.category not in best or o.confidence > best[o.category].confidence:
                    best[o.category] = o

        with self._lock:
            for category, o in best.items():
                ev = self._update(category, o, ts)
                if ev:
                    events.append(ev)
            self._mark_absent(set(best), now)
        return events

    def _update(self, category: str, o: Observation, ts: str) -> dict | None:
        region = region_for_point(o.x, o.y, self.regions)
        rec = self.db.get_by_category(category)
        if rec:
            rec.update(last_seen=ts, visible=True, confidence=round(o.confidence, 3),
                       track_id=o.track_id)

        if region is None:  # seen, but outside every region: refresh sighting only
            if rec:
                self.db.upsert_object(rec)
            return None

        if rec and rec["region"] == region:
            self._candidates.pop(category, None)
            rec.update(x=round(o.x, 4), y=round(o.y, 4))
            self.db.upsert_object(rec)
            return None

        cand_region, count = self._candidates.get(category, (None, 0))
        count = count + 1 if cand_region == region else 1
        self._candidates[category] = (region, count)
        if count < self.stability:
            if rec:
                self.db.upsert_object(rec)
            return None

        # Stable in a new region: commit the move.
        self._candidates.pop(category, None)
        from_region = rec["region"] if rec else None
        rec = rec or {
            "object_id": object_id_for(category), "category": category,
            "name": display_name(category), "last_seen": ts, "visible": True,
            "confidence": round(o.confidence, 3), "track_id": o.track_id,
        }
        rec.update(region=region, x=round(o.x, 4), y=round(o.y, 4))
        self.db.upsert_object(rec)
        self.db.add_event(rec["object_id"], rec["name"], from_region, region, ts)
        return {"object_id": rec["object_id"], "name": rec["name"],
                "from_region": from_region, "to_region": region, "timestamp": ts}

    def _mark_absent(self, seen: set[str], now: datetime) -> None:
        for rec in self.db.get_objects():
            if rec["visible"] and rec["category"] not in seen:
                if now - datetime.fromisoformat(rec["last_seen"]) >= self.absence:
                    rec["visible"] = False
                    self.db.upsert_object(rec)

    def reset(self) -> None:
        with self._lock:
            self._candidates.clear()
            self.db.clear()


# ---------- Natural-language lookup (deterministic alias matching) ----------

def parse_query(text: str) -> tuple[str, str] | None:
    """Return (category, the word the user used) for the longest alias found in text."""
    t = " " + re.sub(r"[^a-z0-9 ]+", " ", text.lower()) + " "
    matches = [(len(a), cat, a) for cat, aliases in ALIASES.items() for a in aliases
               if re.search(rf"\b{re.escape(a)}s?\b", t)]
    if not matches:
        return None
    _, cat, alias = max(matches)
    return cat, alias


def answer_query(text: str, db: Database) -> dict:
    parsed = parse_query(text)
    if not parsed:
        names = ", ".join(SUPPORTED[:-1]) + f", and {SUPPORTED[-1]}"
        return {"found": False, "object": None,
                "answer": f"Sorry, I'm not sure which object you mean. I can look for a {names}."}
    category, word = parsed
    rec = db.get_by_category(category)
    if not rec or not rec.get("region"):
        return {"found": False, "object": None, "answer": f"I haven't seen your {word} yet."}
    where = f"on the {rec['region'].lower()}"
    if rec["visible"]:
        answer = f"I last saw your {word} {where}."
    else:
        answer = f"I last saw your {word} {where}, but it's not currently visible."
    return {"found": True, "object": rec, "answer": answer}
