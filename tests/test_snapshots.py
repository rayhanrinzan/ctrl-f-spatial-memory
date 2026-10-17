"""Snapshot capture, dedupe, retention, persistence and deletion (synthetic frames)."""
from conftest import DESK, DRESSER, obs
from database import Database
from snapshots import SnapshotStore


def capture(clock, store, frame, *observations, n=6):
    for ev in clock.frames(n, *observations):
        store.submit(ev, frame)
    store.flush()


def test_snapshot_after_confirmed_placement(clock, store, db, frame):
    capture(clock, store, frame, obs(pos=DESK))
    [s] = db.get_snapshots("bottle_01")
    assert s["event_type"] == "first_seen" and s["region"] == "Desk"
    assert s["x0"] < DESK[0] < s["x1"]
    assert store.path_for(s["filename"]).stat().st_size > 0


def test_no_snapshot_for_unrelated_motion(clock, store, db, frame):
    capture(clock, store, frame, obs(pos=DESK))
    person = obs(cat="person", pos=(0.8, 0.5), size=0.5)
    capture(clock, store, frame, obs(pos=DESK), person, n=25)
    assert len(db.get_snapshots("bottle_01")) == 1


def test_new_snapshot_after_move_and_latest_lookup(clock, store, db, frame):
    capture(clock, store, frame, obs(pos=DESK))
    store.cooldown = 0
    capture(clock, store, frame, obs(pos=DRESSER))
    snaps = db.get_snapshots("bottle_01")
    assert [s["event_type"] for s in snaps] == ["moved", "first_seen"]
    assert db.latest_snapshots()["bottle_01"]["region"] == "Dresser"


def test_duplicate_snapshots_suppressed(store, db, frame):
    ev = {"object_id": "bottle_01", "event_type": "moved_within", "timestamp": "2026-10-15T14:30:00+00:00",
          "region": "Desk", "bbox": (0.1, 0.1, 0.2, 0.2), "confidence": 0.9}
    assert store.submit(ev, frame)
    assert not store.submit(ev, frame)  # same spot within cooldown
    store.flush()
    assert len(db.get_snapshots("bottle_01")) == 1


def test_capture_disabled(clock, store, db, frame):
    store.enabled = False
    capture(clock, store, frame, obs())
    assert db.get_snapshots("bottle_01") == []
    assert db.get_by_category("bottle")["region"] == "Desk"  # memory still updates


def test_missing_frame_skips_photo_but_keeps_memory(clock, store, db):
    for ev in clock.frames(6, obs()):
        assert store.submit(ev, None) is False
    assert db.get_by_category("bottle") is not None and db.get_snapshots("bottle_01") == []


def test_retention_limit_deletes_old_files(store, db, frame):
    store.cooldown = 0
    for i in range(6):
        store.submit({"object_id": "cup_01", "event_type": "moved", "timestamp": f"2026-10-15T14:3{i}:00+00:00",
                      "region": "Desk", "bbox": (0.1 * i, 0.1, 0.1 * i + 0.05, 0.2), "confidence": 0.8}, frame)
    store.flush()
    assert len(db.get_snapshots("cup_01")) == 3
    assert len(list(store.dir.glob("*.jpg"))) == 3


def test_photos_persist_across_restart(tmp_path, clock, store, db, frame):
    capture(clock, store, frame, obs())
    name = db.get_snapshots("bottle_01")[0]["filename"]
    db2 = Database(tmp_path / "t.db")
    store2 = SnapshotStore(db2, tmp_path / "snaps")
    assert db2.get_snapshots("bottle_01")[0]["filename"] == name and store2.path_for(name)


def test_clear_deletes_photos_and_rejects_bad_paths(clock, mem, store, db, frame):
    capture(clock, store, frame, obs())
    (store.dir / "notes.txt").write_text("keep me")
    mem.reset()
    store.clear()
    assert db.get_snapshots("bottle_01") == [] and list(store.dir.glob("*.jpg")) == []
    assert (store.dir / "notes.txt").exists()
    assert store.path_for("../t.db") is None and store.path_for("notes.txt") is None
