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
