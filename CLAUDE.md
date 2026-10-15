# CLAUDE.md — Ctrl+F

## Concept
A local spatial memory. A stationary webcam and YOLO detect everyday objects, assign each one to a named room region, and remember its **last observed location**. Users ask "Where is my phone?" (text or voice) and get the answer, plus a highlight on a 2D room map. MVP: one webcam, three regions, one instance per object category.

## Architecture
- `backend/vision.py`: `VisionWorker` thread. OpenCV capture → `model.track(..., tracker="bytetrack.yaml")` → `Observation`s → `SpatialMemory.observe()`. Keeps the latest annotated JPEG in RAM for `/api/camera` (MJPEG). Never writes frames.
- `backend/spatial.py`: `Region` (normalized camera rect + map rect), `load_regions()` from `regions.json`, `region_for_point()`.
- `backend/memory.py`: `SpatialMemory` (stability filter, one record per category, marks objects not-visible after the absence timeout, logs events), `ALIASES`, `parse_query()`, `answer_query()` (deterministic, never invents locations).
- `backend/database.py`: SQLite `objects` and `events` tables, parameterized queries, thread lock.
- `backend/main.py`: FastAPI app and endpoints. Config comes from `CTRLF_*` env vars. Binds to 127.0.0.1.
- `frontend/src`: React + Vite + TS + Tailwind v4. `App.tsx` polls `/api/health|objects|events` every 1 s. Components: `RoomMap` (positioned HTML blueprint), `SearchPanel` (text plus push-to-talk), `CameraPanel` (MJPEG `<img>`), `ActivityFeed`. Libraries: `lib/api.ts`, `lib/voice.ts` (Web Speech; `listen()` is the hook for a future wake word), `lib/format.ts` (icons, times).

## Stack
Python 3.12 venv at `.venv/` · ultralytics 8.4 (YOLO11n weights in `backend/models/`, gitignored) · OpenCV · FastAPI · SQLite · React 19 · Vite 8 · Tailwind 4 · lucide-react.

## Run
```bash
cd backend && ../.venv/bin/python main.py      # API on 127.0.0.1:8000
npm --prefix frontend run dev                   # UI on 127.0.0.1:5173 (proxies /api)
cd backend && ../.venv/bin/python check_camera.py   # macOS camera permission prompt
```
`CTRLF_CAMERA_INDEX=/path/video.mp4` runs real detection on a looping video file. `CTRLF_CAMERA_ENABLED=0` runs with no camera.

## Test
```bash
.venv/bin/python -m pytest        # pytest.ini sets pythonpath=backend
npm --prefix frontend run build
```
Tests use synthetic `Observation`s. Webcam behavior is not covered by automated tests.

## Conventions
- Never store or commit frames, recordings, DBs or weights (see .gitignore).
- Don't fabricate detections in live mode. Synthetic data belongs only in tests.
- Keep modules small. Backend modules are imported flat (`from memory import ...`), and the server runs from `backend/`.

## Current limitations
- One instance per category. Two cups merge into one record (the most confident detection wins each frame).
- Only COCO classes (no keys, wallets or headphones).
- Regions are 2D rectangles in image space. No depth, no occlusion reasoning, and no calibration UI (edit `regions.json`).
- Polling rather than push (fine for the MVP).
- Live webcam path was verified only with a video-file source in the dev session (camera permission was unavailable). The first real-webcam run still needs manual verification.

## Next priorities
1. Region calibration UI (drag rectangles over the camera preview → save `regions.json`).
2. Multi-instance support (track-level identities with appearance embeddings).
3. Custom or fine-tuned classes for keys, wallet and headphones.
4. WebSocket/SSE push instead of polling.
5. Hand-object interaction to explain *who* moved what. Wake-word activation via `lib/voice.ts listen()`.
