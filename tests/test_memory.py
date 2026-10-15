from datetime import datetime, timedelta, timezone

import pytest

from database import Database
from memory import Observation, SpatialMemory, answer_query, parse_query
from spatial import load_regions, region_for_point

T0 = datetime(2026, 10, 15, 14, 30, tzinfo=timezone.utc)
DESK, DRESSER, BED = (0.15, 0.5), (0.5, 0.5), (0.85, 0.5)


@pytest.fixture
def regions():
    return load_regions()


@pytest.fixture
def db(tmp_path):
    d = Database(tmp_path / "t.db")
    yield d
    d.close()


@pytest.fixture
def mem(db, regions):
    return SpatialMemory(db, regions, stability=3, min_confidence=0.4, absence_seconds=2)


def see(mem, pos, n, start=T0, cat="bottle", conf=0.9):
    for i in range(n):
        mem.observe([Observation(cat, conf, *pos, track_id=1)], now=start + timedelta(seconds=i * 0.2))


def test_region_assignment(regions):
    assert region_for_point(*DESK, regions) == "Desk"
    assert region_for_point(*DRESSER, regions) == "Dresser"
    assert region_for_point(*BED, regions) == "Bed"
    assert region_for_point(1.5, 0.5, regions) is None


def test_first_sighting_requires_stability(mem, db):
    see(mem, DESK, 2)
    assert db.get_by_category("bottle") is None
    see(mem, DESK, 1)
    rec = db.get_by_category("bottle")
    assert rec["region"] == "Desk" and rec["visible"] and rec["object_id"] == "bottle_01"


def test_move_between_regions_updates_memory_and_logs_event(mem, db):
    see(mem, DESK, 3)
    see(mem, DRESSER, 3, start=T0 + timedelta(seconds=5))
    assert db.get_by_category("bottle")["region"] == "Dresser"
    ev = db.get_events()[0]
    assert (ev["name"], ev["from_region"], ev["to_region"]) == ("Bottle", "Desk", "Dresser")


def test_jitter_does_not_move(mem, db):
    see(mem, DESK, 3)
    # Two flickers into Dresser, back to Desk, then two more: never 3 in a row.
    see(mem, DRESSER, 2, start=T0 + timedelta(seconds=2))
    see(mem, DESK, 1, start=T0 + timedelta(seconds=3))
    see(mem, DRESSER, 2, start=T0 + timedelta(seconds=4))
    assert db.get_by_category("bottle")["region"] == "Desk"
    assert len(db.get_events()) == 1  # only the first sighting


def test_low_confidence_ignored(mem, db):
    see(mem, DESK, 5, conf=0.2)
    assert db.get_by_category("bottle") is None


def test_disappearance_keeps_last_location(mem, db):
    see(mem, DESK, 3)
    see(mem, DRESSER, 3, start=T0 + timedelta(seconds=2))
    mem.observe([], now=T0 + timedelta(seconds=10))
    rec = db.get_by_category("bottle")
    assert rec["region"] == "Dresser" and rec["visible"] is False
    assert "not currently visible" in answer_query("Where is my bottle?", db)["answer"]


def test_reassociation_by_category_when_track_id_changes(mem, db):
    see(mem, DESK, 3)
    for i in range(3):
        mem.observe([Observation("bottle", 0.9, *BED, track_id=42)],
                    now=T0 + timedelta(seconds=3 + i))
    rec = db.get_by_category("bottle")
    assert rec["region"] == "Bed" and rec["track_id"] == 42 and len(db.get_objects()) == 1


def test_persistence_across_reinit(tmp_path, regions):
    path = tmp_path / "p.db"
    d1 = Database(path)
    see(SpatialMemory(d1, regions, stability=3), DRESSER, 3)
    d1.close()
    d2 = Database(path)
    assert d2.get_by_category("bottle")["region"] == "Dresser"
    assert len(d2.get_events()) == 1
    d2.close()


def test_clear_memory(mem, db):
    see(mem, DESK, 3)
    mem.reset()
    assert db.get_objects() == [] and db.get_events() == []


def test_query_parsing():
    assert parse_query("Where is my phone?") == ("cell phone", "phone")
    assert parse_query("Where did I leave my bottle?")[0] == "bottle"
    assert parse_query("Have you seen my cup?")[0] == "cup"
    assert parse_query("where are my keys") is None


def test_query_answers(mem, db):
    assert answer_query("Where is my phone?", db)["answer"] == "I haven't seen your phone yet."
    unknown = answer_query("Where are my keys?", db)
    assert unknown["found"] is False and "not sure" in unknown["answer"]
    see(mem, DESK, 3)
    see(mem, DRESSER, 3, start=T0 + timedelta(seconds=2))
    r = answer_query("Where is my bottle?", db)
    assert r["found"] and r["answer"] == "I last saw your bottle on the dresser."
    assert r["object"]["region"] == "Dresser"
