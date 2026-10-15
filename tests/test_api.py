import importlib
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


def test_api_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("CTRLF_CAMERA_ENABLED", "0")
    monkeypatch.setenv("CTRLF_DB_PATH", str(tmp_path / "api.db"))
    monkeypatch.setenv("CTRLF_STABILITY_FRAMES", "2")
    import main
    main = importlib.reload(main)
    from memory import Observation

    with TestClient(main.app) as c:
        assert c.get("/api/health").json()["camera"] == "disabled"
        assert len(c.get("/api/regions").json()) == 3
        t = datetime.now(timezone.utc)
        for i in range(2):  # synthetic observations, labeled as such
            main.memory.observe([Observation("cell phone", 0.8, 0.9, 0.5)], now=t + timedelta(seconds=i))
        objs = c.get("/api/objects").json()
        assert objs[0]["region"] == "Bed"
        assert c.get("/api/objects/cell_phone_01").json()["name"] == "Cell Phone"
        assert c.get("/api/objects/phone").json()["region"] == "Bed"
        assert c.get("/api/objects/nope").status_code == 404
        assert c.post("/api/query", json={"text": "where's my phone"}).json()["found"]
        assert c.get("/api/events").json()[0]["to_region"] == "Bed"
        assert c.get("/api/camera").status_code == 503
        assert c.delete("/api/memory").json() == {"cleared": True}
        assert c.get("/api/objects").json() == []
