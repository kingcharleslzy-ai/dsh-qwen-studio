from __future__ import annotations

import json

import re

import time

import uuid

from pathlib import Path

from typing import Any, Optional

STUDIO_ROOT = Path(__file__).resolve().parent.parent

LIBRARY_FILE = STUDIO_ROOT / "data" / "asset_library.json"

MAX_ASSET_IMAGES = 5

def _now() -> float:
    return time.time()

def _empty_library() -> dict[str, Any]:
    return {"characters": [], "locations": [], "creatures": [], "vehicles": [], "updated_at": 0}

def _library_tracking(data):
    return {
        '_deleted_asset_ids': list(dict.fromkeys(str(x) for x in data.get('_deleted_asset_ids', []) if isinstance(x, str))),
        '_source_signatures': {str(k): str(v) for k, v in data.get('_source_signatures', {}).items()},
        '_source_aliases': {str(k): str(v) for k, v in data.get('_source_aliases', {}).items()},
    }

def asset_kind_key(kind: str) -> tuple[str, str]:
    """Normalize kind -> (singular, plural list key)."""
    k = str(kind or "").strip().lower()
    if k in ("location", "locations", "loc", "place"):
        return "location", "locations"
    if k in ("creature", "creatures", "monster", "beast", "canavar", "yaratik", "yaratık"):
        return "creature", "creatures"
    if k in (
        "vehicle", "vehicles", "craft", "ship", "spaceship", "car", "mecha",
        "araç", "arac", "gemi", "uzaygemisi", "uzay gemisi",
    ):
        return "vehicle", "vehicles"
    return "character", "characters"

def load_library() -> dict[str, Any]:
    if not LIBRARY_FILE.is_file():
        return _empty_library()
    try:
        raw = json.loads(LIBRARY_FILE.read_text(encoding="utf-8"))
    except Exception:
        return _empty_library()
    if not isinstance(raw, dict):
        return _empty_library()
    out = _empty_library()
    out["characters"] = [
        _clean_asset(x, "character") for x in (raw.get("characters") or []) if isinstance(x, dict)
    ]
    out["locations"] = [
        _clean_asset(x, "location") for x in (raw.get("locations") or []) if isinstance(x, dict)
    ]
    out["creatures"] = [
        _clean_asset(x, "creature") for x in (raw.get("creatures") or []) if isinstance(x, dict)
    ]
    out["vehicles"] = [
        _clean_asset(x, "vehicle") for x in (raw.get("vehicles") or []) if isinstance(x, dict)
    ]
    out["updated_at"] = raw.get("updated_at") or 0
    out.update(_library_tracking(raw))
    return out

def save_library(data: dict[str, Any]) -> dict[str, Any]:
    out = {
        "characters": [
            _clean_asset(x, "character") for x in (data.get("characters") or []) if isinstance(x, dict)
        ],
        "locations": [
            _clean_asset(x, "location") for x in (data.get("locations") or []) if isinstance(x, dict)
        ],
        "creatures": [
            _clean_asset(x, "creature") for x in (data.get("creatures") or []) if isinstance(x, dict)
        ],
        "vehicles": [
            _clean_asset(x, "vehicle") for x in (data.get("vehicles") or []) if isinstance(x, dict)
        ],
        "updated_at": _now(),
        **_library_tracking(data),
    }
    LIBRARY_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = LIBRARY_FILE.with_suffix('.tmp')
    temporary.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(LIBRARY_FILE)
    return out

def list_library(kind: Optional[str] = None) -> dict[str, Any]:
    lib = load_library()
    k, _ = asset_kind_key(kind) if kind else ("", "")
    empty = {"characters": [], "locations": [], "creatures": [], "vehicles": []}
    if k == "character":
        return {**empty, "characters": lib["characters"]}
    if k == "location":
        return {**empty, "locations": lib["locations"]}
    if k == "creature":
        return {**empty, "creatures": lib.get("creatures") or []}
    if k == "vehicle":
        return {**empty, "vehicles": lib.get("vehicles") or []}
    return lib

def upsert_library_asset(kind: str, asset: dict[str, Any]) -> dict[str, Any]:
    """Insert or replace a card in the global asset library."""
    k, key = asset_kind_key(kind)
    lib = load_library()
    cleaned = _clean_asset(asset if isinstance(asset, dict) else {}, k)
    lid = str(
        (asset or {}).get("library_id") or (asset or {}).get("id") or cleaned.get("id") or ""
    ).strip()
    if lid:
        cleaned["id"] = lid
    items = list(lib.get(key) or [])
    idx = next((i for i, x in enumerate(items) if str(x.get("id") or "") == cleaned["id"]), -1)
    if idx >= 0:
        items[idx] = cleaned
    else:
        items.append(cleaned)
    lib[key] = items
    marker = key + ':' + cleaned['id']
    lib['_deleted_asset_ids'] = [x for x in lib.get('_deleted_asset_ids', []) if x != marker]
    lib.setdefault('_source_signatures', {}).pop(marker, None)
    save_library(lib)
    return cleaned

def _slug(name: str) -> str:
    s = (name or "").strip().lower()
    s = s.translate(
        str.maketrans(
            {
                "ç": "c",
                "ğ": "g",
                "ı": "i",
                "ö": "o",
                "ş": "s",
                "ü": "u",
                "â": "a",
                "î": "i",
                "û": "u",
            }
        )
    )
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s or "asset"

def _clean_images(item: dict[str, Any], name: str) -> list[dict[str, str]]:
    slug = _slug(name)
    raw = item.get("images")
    rows: list[dict[str, str]] = []
    if isinstance(raw, list) and raw:
        for x in raw:
            if isinstance(x, str) and x.strip():
                file = x.strip()
                rows.append({"file": file, "url": f"/api/refs/{file}"})
            elif isinstance(x, dict):
                file = str(x.get("file") or x.get("image") or "").strip()
                if not file:
                    continue
                url = str(x.get("url") or f"/api/refs/{file}").strip()
                rows.append({"file": file, "url": url})
    else:
        image = str(item.get("image") or "").strip()
        if image:
            rows.append(
                {
                    "file": image,
                    "url": str(item.get("url") or f"/api/refs/{image}"),
                }
            )
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for i, row in enumerate(rows[:MAX_ASSET_IMAGES]):
        file = row["file"]
        if file in seen:
            continue
        seen.add(file)
        out.append(
            {
                "name": f"{slug}{len(out) + 1}",
                "file": file,
                "url": row.get("url") or f"/api/refs/{file}",
            }
        )
        if len(out) >= MAX_ASSET_IMAGES:
            break
    return out

def _clean_asset(item: Any, kind: str) -> dict[str, Any]:
    if not isinstance(item, dict):
        item = {}
    name = str(item.get("name") or "").strip()
    trigger = str(item.get("trigger") or "").strip()
    notes = str(item.get("notes") or item.get("description") or "").strip()
    aid = str(item.get("id") or "").strip() or str(uuid.uuid4())
    images = _clean_images(item, name)
    first = images[0] if images else {}
    out: dict[str, Any] = {
        "id": aid,
        "kind": kind,
        "name": name,
        "trigger": trigger or name,
        "images": images,
        "image": first.get("file") or "",
        "url": first.get("url") or "",
        "notes": notes,
        "voice": str(item.get("voice") or "").strip(),
    }
    for field in ("source_ref", "sheet_overview"):
        if item.get(field):
            out[field] = Path(str(item[field])).name
    if item.get("sheet_method") in ("standard", "look_sheets"):
        out["sheet_method"] = item["sheet_method"]
    if item.get("library_id"):
        out["library_id"] = str(item["library_id"]).strip()
    voice_audio = str(item.get("voice_audio") or "").strip()
    if voice_audio:
        out["voice_audio"] = Path(voice_audio).name
    if kind == "character":
        out["lora_id"] = str(item.get("lora_id") or "").strip()
        out["use_lora"] = bool(item.get("use_lora", bool(out["lora_id"])))
        try:
            out["lora_strength"] = float(item.get("lora_strength") if item.get("lora_strength") is not None else 0.8)
        except (TypeError, ValueError):
            out["lora_strength"] = 0.8
    return out
