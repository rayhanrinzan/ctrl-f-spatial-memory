"""Ctrl+F API server. Run: python main.py (binds to 127.0.0.1 only)."""
from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from database import Database
from memory import SUPPORTED, SpatialMemory, answer_query, parse_query
from spatial import load_regions
from vision import VisionWorker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
HERE = Path(__file__).parent


def env(name: str, default: str) -> str:
    return os.getenv(f"CTRLF_{name}", default)


regions = load_regions()
db = Database(env("DB_PATH", str(HERE / "data" / "ctrlf.db")))
memory = SpatialMemory(db, regions, stability=int(env("STABILITY_FRAMES", "5")),
                       min_confidence=float(env("CONFIDENCE", "0.4")),
                       absence_seconds=float(env("ABSENCE_SECONDS", "2.0")))
worker: VisionWorker | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global worker
    if env("CAMERA_ENABLED", "1") == "1":
        source = env("CAMERA_INDEX", "0")  # webcam index, or a video file path for testing
        worker = VisionWorker(memory, regions, camera_index=int(source) if source.isdigit() else source,
                              model_path=env("MODEL", str(HERE / "models" / "yolo11n.pt")),
                              conf=float(env("CONFIDENCE", "0.4")),
                              fps=float(env("INFERENCE_FPS", "5")))
        worker.start()
    yield
    if worker:
        worker.stop()
        worker.join(timeout=5)
    db.close()


app = FastAPI(title="Ctrl+F", lifespan=lifespan)
app.add_middleware(CORSMiddleware,
                   allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])


class Query(BaseModel):
    text: str


@app.get("/api/health")
def health():
    status = worker.status if worker else {"camera": "disabled", "error": None, "fps": 0,
                                           "detections": []}
    return {"status": "ok", **status, "supported": SUPPORTED}


@app.get("/api/regions")
def get_regions():
    return [r.to_dict() for r in regions]


@app.get("/api/objects")
def get_objects():
    return db.get_objects()


@app.get("/api/objects/{object_id}")
def get_object(object_id: str):
    obj = db.get_object(object_id)
    if obj is None:  # also accept a name/alias, e.g. /api/objects/phone
        parsed = parse_query(object_id.replace("_", " "))
        obj = db.get_by_category(parsed[0]) if parsed else None
    if obj is None:
        raise HTTPException(404, "Object not seen yet")
    return obj


@app.get("/api/events")
def get_events(limit: int = 50):
    return db.get_events(limit)


@app.post("/api/query")
def query(q: Query):
    return answer_query(q.text, db)


@app.delete("/api/memory")
def clear_memory():
    memory.reset()
    return {"cleared": True}


@app.get("/api/camera")
async def camera():
    """MJPEG stream of the annotated live frame. Nothing is written to disk."""
    if worker is None:
        raise HTTPException(503, "Camera disabled")

    async def frames():
        last = None
        while True:
            jpg = worker.latest_jpeg()
            if jpg is not None and jpg is not last:
                last = jpg
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
            await asyncio.sleep(0.05)

    return StreamingResponse(frames(), media_type="multipart/x-mixed-replace; boundary=frame")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=env("HOST", "127.0.0.1"), port=int(env("PORT", "8000")))
