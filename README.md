# Ctrl+F — Spatial Memory

> *You shouldn't have to remember what you need to remember.*

Ctrl+F watches a room through a stationary webcam, recognizes everyday objects with YOLO, and remembers the **last place each one was seen**. A web dashboard shows a 2D map of the room, and you can ask "Where is my phone?" by typing or speaking.

Everything runs locally. Video frames are processed in memory and never saved.

## How it works

```
webcam ─► OpenCV ─► YOLO11n + ByteTrack ─► box center ─► region (Desk/Dresser/Bed)
                                                         │
                         stability filter (N sightings in a row) ─► SQLite (objects, events)
                                                         │
React dashboard ◄── FastAPI (localhost:8000) ◄───────────┘
```

- **Detection:** Ultralytics YOLO11 nano (COCO classes), CPU, about 5 inferences per second.
- **Tracking:** Ultralytics' built-in ByteTrack. Track IDs are temporary. The MVP assumes **one object per category**, so a new track ID is re-associated with the existing record by category.
- **Regions:** normalized rectangles in camera space ([backend/regions.json](backend/regions.json)). An object's region is the one containing its bounding-box center.
- **Movement:** the stored region changes only after the object is seen in a new region for `CTRLF_STABILITY_FRAMES` consecutive frames (default 5, about 1 second) with confidence ≥ `CTRLF_CONFIDENCE`. Each change is logged as `object → from → to → timestamp`.
- **Last seen:** when an object leaves the view, its location is kept and it is marked *not currently visible* after `CTRLF_ABSENCE_SECONDS`.

## Supported objects

These are COCO classes that YOLO11n actually recognizes (checked against `model.names`):

| Category | Ask with |
|---|---|
| bottle | bottle, water bottle |
| cup | cup, mug |
| cell phone | phone, cell phone, iPhone |
| book | book, notebook |
| backpack | backpack, bag |
| remote | remote, TV remote |
| scissors | scissors |
| mouse | mouse |

Keys, wallets and headphones are **not** COCO classes and aren't supported yet. For a reliable demo, use a bottle, cup or phone.

## Requirements

- macOS, Linux or Windows with a webcam
- Python 3.11+ (developed with 3.12)
- Node.js 20+ (developed with 24)

## Install

```bash
cd ~/Projects/ctrl-f-spatial-memory
python3.12 -m venv .venv                  # or: uv venv --python 3.12 .venv
.venv/bin/pip install -r backend/requirements.txt
npm --prefix frontend install
```

The YOLO weights (`yolo11n.pt`, about 5 MB) download automatically into `backend/models/` on first run. To download them ahead of time:

```bash
cd backend/models && ../../.venv/bin/python -c "from ultralytics import YOLO; YOLO('yolo11n.pt')"
```

## Run

Terminal 1, backend (binds to `127.0.0.1:8000` only):

```bash
cd backend && ../.venv/bin/python main.py
```

Terminal 2, frontend:

```bash
npm --prefix frontend run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to the backend.

### Webcam permission (macOS)

macOS grants camera access per app, so the **terminal app** that starts the backend needs permission. The server opens the camera on a background thread, which **cannot show the permission prompt**, so first run:

```bash
cd backend && ../.venv/bin/python check_camera.py
```

Allow the prompt, or turn it on under **System Settings → Privacy & Security → Camera** for Terminal, iTerm or VS Code. Then restart that terminal.

### Camera configuration

| Variable | Default | Meaning |
|---|---|---|
| `CTRLF_CAMERA_INDEX` | `0` | Webcam index (try `1` for an external camera), or a video file path for testing |
| `CTRLF_CAMERA_ENABLED` | `1` | `0` runs the API with no camera |
| `CTRLF_CONFIDENCE` | `0.4` | Minimum detection confidence |
| `CTRLF_INFERENCE_FPS` | `5` | Target inference rate |
| `CTRLF_STABILITY_FRAMES` | `5` | Sightings in a row needed to accept a move |
| `CTRLF_ABSENCE_SECONDS` | `2.0` | Time unseen before an object is marked not visible |
| `CTRLF_DB_PATH` | `backend/data/ctrlf.db` | SQLite file |

See [.env.example](.env.example). Variables are read from the environment, so set them inline, for example:

```bash
cd backend && CTRLF_CAMERA_INDEX=1 ../.venv/bin/python main.py
```

### Region configuration

Edit [backend/regions.json](backend/regions.json) and restart the backend. Each region has:

- `camera: [x0, y0, x1, y1]`: the area of the camera frame, normalized 0–1 from the top-left. By default, the frame is split into vertical thirds: Desk on the left, Dresser in the middle, Bed on the right.
- `map: [x0, y0, x1, y1]`: where the region appears on the dashboard blueprint.

Region outlines are drawn on the live camera preview, so you can line up your physical setup with them.

## Live demo

1. Start the backend and frontend. The header shows **Camera active**.
2. Put a bottle in the left third of the frame (**Desk**). After about 1 s it appears on the map, and *"Bottle first seen on the Desk"* shows in Recent activity.
3. Move it to the middle third (**Dresser**). After about 1 s the icon moves, and *"Bottle moved from Desk → Dresser"* is logged.
4. Ask **"Where is my bottle?"** by typing it, or press the mic and speak (Chrome/Edge/Safari). The answer is *"I last saw your bottle on the dresser."* It is spoken aloud and the icon is highlighted.
5. Take the bottle out of view. The icon becomes a dashed "last seen" marker.
6. Ask again: *"I last saw your bottle on the dresser, but it's not currently visible."*
7. Restart the backend. The memory is still there.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Server, camera status, fps, current detections |
| GET | `/api/regions` | Configured regions |
| GET | `/api/objects` | All remembered objects |
| GET | `/api/objects/{id}` | One object by id (`bottle_01`) or name (`phone`) |
| GET | `/api/events?limit=50` | Recent movement events |
| POST | `/api/query` | `{"text": "where is my phone?"}` → `{found, answer, object}` |
| DELETE | `/api/memory` | Clear all objects and events |
| GET | `/api/camera` | MJPEG stream of the annotated live frame |

## Tests

```bash
.venv/bin/python -m pytest          # backend: synthetic observations, no webcam needed
npm --prefix frontend run build     # frontend type-check + build
```

The tests cover region assignment, moves between regions, jitter rejection, low-confidence filtering, keeping the last-seen location after disappearance, track-ID re-association, persistence across database reopen, clearing memory, query parsing and fallbacks, and an API round-trip. All of these use **synthetic** detections; they don't exercise a real webcam.

To test the real detector without a webcam, point `CTRLF_CAMERA_INDEX` at any video file. Test video files are looped.

## Privacy

- Frames are captured, run through inference, and annotated **in memory only**. The latest annotated JPEG is held in RAM for the preview stream. Nothing is written to disk or sent anywhere.
- SQLite stores only object categories, normalized positions, regions, timestamps, confidences and movement events.
- Ultralytics telemetry (`sync`) is turned off at startup. There are no cloud APIs or analytics.
- The server listens on `127.0.0.1` only. Don't expose it to a network.
- Raw frames still exist briefly in process memory while they're being processed.
- Object metadata can itself reveal behavior patterns, such as when you're home or when you use your phone. Use **Clear memory** in the dashboard (or `DELETE /api/memory`) to erase it.
- Voice: browser speech recognition may be processed by the browser vendor's cloud service. In Chrome, audio goes to Google. Typed queries never leave your machine.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Camera unavailable" / `not authorized to capture video` | Run `check_camera.py` and grant camera permission to your terminal (see above) |
| Wrong camera | Set `CTRLF_CAMERA_INDEX=1` (or 2…) |
| Camera pops up on your iPhone, then disappears | macOS made the iPhone (Continuity Camera) index 0. Use `CTRLF_CAMERA_INDEX=1` for the built-in FaceTime camera |
| Works in Terminal but not when started from an IDE/agent app | macOS grants camera access per app. Start the backend from a terminal app that has permission |
| Objects flicker between regions | Raise `CTRLF_STABILITY_FRAMES`, or move the object further from region borders |
| Object not detected | Use good lighting and a clear view, try lowering `CTRLF_CONFIDENCE` to 0.3, and use a supported class |
| Mic button disabled | The browser lacks the Web Speech API (e.g. Firefox). Type instead |
| "Server offline" in the header | The backend isn't running on port 8000 |
| Slow on CPU | Lower `CTRLF_INFERENCE_FPS` to 2–3 |
