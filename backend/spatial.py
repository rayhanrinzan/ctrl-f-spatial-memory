"""Room regions: named normalized rectangles in camera space, plus where they sit on the 2D map."""
from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path

DEFAULT_REGIONS_PATH = Path(__file__).with_name("regions.json")


@dataclass(frozen=True)
class Region:
    name: str
    # Camera-space rectangle, normalized 0..1 (x0,y0 top-left; x1,y1 bottom-right).
    x0: float
    y0: float
    x1: float
    y1: float
    # Map-space rectangle (normalized 0..1) used by the dashboard blueprint.
    map: tuple[float, float, float, float] = (0.0, 0.0, 1.0, 1.0)

    def contains(self, x: float, y: float) -> bool:
        return self.x0 <= x < self.x1 and self.y0 <= y < self.y1

    def to_dict(self) -> dict:
        d = asdict(self)
        d["map"] = list(self.map)
        return d


def load_regions(path: str | os.PathLike | None = None) -> list[Region]:
    path = Path(path or os.getenv("CTRLF_REGIONS", DEFAULT_REGIONS_PATH))
    data = json.loads(path.read_text())
    return [
        Region(r["name"], *r["camera"], map=tuple(r.get("map", (0, 0, 1, 1))))
        for r in data["regions"]
    ]


def region_for_point(x: float, y: float, regions: list[Region]) -> str | None:
    """Name of the first region containing the normalized point, or None."""
    for r in regions:
        if r.contains(x, y):
            return r.name
    return None


def validate_regions(items: list[dict]) -> list[Region]:
    """Build regions from API/JSON dicts, rejecting malformed rectangles."""
    if not 1 <= len(items) <= 8:
        raise ValueError("Provide between 1 and 8 regions")
    out, names = [], set()
    for it in items:
        name = str(it.get("name", "")).strip()
        if not name or len(name) > 32 or name.lower() in names:
            raise ValueError(f"Bad or duplicate region name: {name!r}")
        names.add(name.lower())
        x0, y0, x1, y1 = (float(v) for v in it["camera"])
        mx0, my0, mx1, my1 = (float(v) for v in it.get("map", (0, 0, 1, 1)))
        for v in (x0, y0, x1, y1, mx0, my0, mx1, my1):
            if not 0.0 <= v <= 1.0:
                raise ValueError("Coordinates must be between 0 and 1")
        if x1 - x0 < 0.02 or y1 - y0 < 0.02 or mx1 <= mx0 or my1 <= my0:
            raise ValueError(f"Region {name} is too small or inverted")
        out.append(Region(name, x0, y0, x1, y1, map=(mx0, my0, mx1, my1)))
    return out


def save_regions(regions: list[Region], path: str | os.PathLike | None = None) -> None:
    path = Path(path or os.getenv("CTRLF_REGIONS", DEFAULT_REGIONS_PATH))
    data = {"_comment": "camera: [x0, y0, x1, y1] normalized to the camera frame. "
                        "map: [x0, y0, x1, y1] normalized to the dashboard blueprint.",
            "regions": [{"name": r.name, "camera": [round(v, 4) for v in (r.x0, r.y0, r.x1, r.y1)],
                         "map": [round(v, 4) for v in r.map]} for r in regions]}
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n")
    tmp.replace(path)
