"""Webcam capture + YOLO tracking in a background thread. Frames live only in memory."""
from __future__ import annotations

import logging
import threading
import time

import cv2
import numpy as np

from memory import ALIASES, Observation, SpatialMemory
from spatial import Region

log = logging.getLogger("ctrlf.vision")


class VisionWorker(threading.Thread):
    def __init__(self, memory: SpatialMemory, regions: list[Region], camera_index: int | str = 0,
                 model_path: str = "yolo11n.pt", conf: float = 0.4, fps: float = 5.0,
                 frame_width: int = 640):
        super().__init__(daemon=True, name="vision")
        self.memory = memory
        self.regions = regions
        self.camera_index = camera_index
        self.model_path = model_path
        self.conf = conf
        self.interval = 1.0 / max(fps, 0.5)
        self.frame_width = frame_width
        self._halt = threading.Event()
        self._jpeg: bytes | None = None
        self._jpeg_lock = threading.Lock()
        self.status = {"camera": "starting", "error": None, "fps": 0.0,
                       "detections": [], "model": model_path}

    # ---- public ----
    def latest_jpeg(self) -> bytes | None:
        with self._jpeg_lock:
            return self._jpeg

    def stop(self) -> None:
        self._halt.set()

    # ---- thread ----
    def run(self) -> None:
        try:
            from ultralytics import YOLO, settings
            settings.update({"sync": False})  # no Ultralytics telemetry
            model = YOLO(self.model_path)
        except Exception as e:  # noqa: BLE001
            log.exception("model load failed")
            self.status.update(camera="error", error=f"Model load failed: {e}")
            return
        class_ids = [i for i, n in model.names.items() if n in ALIASES]

        cap = None
        failures = 0
        while not self._halt.is_set():
            if cap is None or not cap.isOpened():
                cap = self._open_camera()
                if cap is None:
                    self._halt.wait(3.0)
                    continue
            t0 = time.monotonic()
            ok, frame = cap.read()
            if (not ok or frame is None) and isinstance(self.camera_index, str):
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # loop test video files
                ok, frame = cap.read()
            if not ok or frame is None:
                # Cameras (esp. macOS / Continuity Camera) return empty frames while warming up;
                # only reopen after a sustained run of failures.
                failures += 1
                if failures >= 50:
                    self.status.update(camera="error", error="Camera read failed; reopening")
                    cap.release()
                    cap = None
                    failures = 0
                    self._halt.wait(2.0)
                else:
                    self._halt.wait(0.1)
                continue
            failures = 0
            if self.status["camera"] != "active":
                self.status.update(camera="active", error=None)
            frame = self._resize(frame)
            try:
                obs = self._detect(model, frame, class_ids)
                self.memory.observe(obs)
            except Exception as e:  # noqa: BLE001
                log.exception("inference failed")
                self.status["error"] = f"Inference error: {e}"
                obs = []
            self._publish(frame, obs)
            elapsed = time.monotonic() - t0
            self.status["fps"] = round(1.0 / max(elapsed, self.interval), 1)
            self._halt.wait(max(0.0, self.interval - elapsed))
        if cap is not None:
            cap.release()
        self.status["camera"] = "stopped"

    def _open_camera(self):
        cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            cap.release()
            self.status.update(camera="error", error=(
                f"Cannot open camera {self.camera_index}. Check the index and camera permission."))
            return None
        self.status.update(camera="active", error=None)
        log.info("camera %s opened", self.camera_index)
        return cap

    def _resize(self, frame: np.ndarray) -> np.ndarray:
        h, w = frame.shape[:2]
        if w > self.frame_width:
            frame = cv2.resize(frame, (self.frame_width, int(h * self.frame_width / w)))
        return frame

    def _detect(self, model, frame: np.ndarray, class_ids: list[int]) -> list[Observation]:
        res = model.track(frame, persist=True, tracker="bytetrack.yaml", conf=self.conf,
                          classes=class_ids, verbose=False)[0]
        h, w = frame.shape[:2]
        obs: list[Observation] = []
        if res.boxes is None:
            return obs
        ids = res.boxes.id.int().tolist() if res.boxes.id is not None else [None] * len(res.boxes)
        for xyxy, cls, cf, tid in zip(res.boxes.xyxy.tolist(), res.boxes.cls.int().tolist(),
                                      res.boxes.conf.tolist(), ids):
            x0, y0, x1, y1 = xyxy[0] / w, xyxy[1] / h, xyxy[2] / w, xyxy[3] / h
            obs.append(Observation(category=model.names[cls], confidence=float(cf),
                                   x=(x0 + x1) / 2, y=(y0 + y1) / 2, track_id=tid,
                                   bbox=(x0, y0, x1, y1)))
        return obs

    def _publish(self, frame: np.ndarray, obs: list[Observation]) -> None:
        h, w = frame.shape[:2]
        out = frame.copy()
        for r in self.regions:  # region overlays
            p0, p1 = (int(r.x0 * w), int(r.y0 * h)), (int(r.x1 * w) - 1, int(r.y1 * h) - 1)
            cv2.rectangle(out, p0, p1, (180, 140, 60), 1)
            cv2.putText(out, r.name, (p0[0] + 6, p0[1] + 18), cv2.FONT_HERSHEY_SIMPLEX,
                        0.5, (220, 180, 90), 1, cv2.LINE_AA)
        for o in obs:
            x0, y0, x1, y1 = o.bbox
            p0, p1 = (int(x0 * w), int(y0 * h)), (int(x1 * w), int(y1 * h))
            cv2.rectangle(out, p0, p1, (80, 220, 120), 2)
            label = f"{o.category} {o.confidence:.2f}" + (f" #{o.track_id}" if o.track_id else "")
            cv2.putText(out, label, (p0[0], max(14, p0[1] - 6)), cv2.FONT_HERSHEY_SIMPLEX,
                        0.5, (80, 220, 120), 1, cv2.LINE_AA)
            cv2.circle(out, (int(o.x * w), int(o.y * h)), 3, (80, 220, 120), -1)
        ok, buf = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if ok:
            with self._jpeg_lock:
                self._jpeg = buf.tobytes()
        self.status["detections"] = [
            {"category": o.category, "confidence": round(o.confidence, 2), "track_id": o.track_id}
            for o in obs]
