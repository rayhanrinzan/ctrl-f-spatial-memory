"""The objects Keepsake remembers. One physical object per category (hackathon assumption).

`category` must be a class name the detector actually outputs (pretrained YOLO11n / COCO).
Edit this list to change what Keepsake tracks; the API and frontend read it from /api/catalog.
"""
from __future__ import annotations

CATALOG: list[dict] = [
    {"category": "cell phone", "name": "Phone", "icon": "phone",
     "aliases": ["phone", "cell phone", "cellphone", "mobile", "iphone", "smartphone"]},
    {"category": "bottle", "name": "Water Bottle", "icon": "bottle",
     "aliases": ["water bottle", "bottle", "drink", "flask"]},
    {"category": "laptop", "name": "Laptop", "icon": "laptop",
     "aliases": ["laptop", "macbook", "computer", "notebook computer"]},
    {"category": "cup", "name": "Cup", "icon": "cup",
     "aliases": ["cup", "mug", "coffee", "coffee cup"]},
    {"category": "book", "name": "Book", "icon": "book",
     "aliases": ["book", "notebook", "novel"]},
    {"category": "backpack", "name": "Backpack", "icon": "backpack",
     "aliases": ["backpack", "bag", "rucksack", "bookbag", "school bag"]},
    {"category": "remote", "name": "Remote", "icon": "remote",
     "aliases": ["remote", "tv remote", "remote control", "controller", "clicker"]},
    {"category": "mouse", "name": "Mouse", "icon": "mouse",
     "aliases": ["mouse", "computer mouse"]},
]

for _item in CATALOG:
    _item["object_id"] = f"{_item['category'].replace(' ', '_')}_01"

BY_CATEGORY: dict[str, dict] = {c["category"]: c for c in CATALOG}
ALIASES: dict[str, list[str]] = {c["category"]: c["aliases"] for c in CATALOG}
SUPPORTED: list[str] = [c["category"] for c in CATALOG]
