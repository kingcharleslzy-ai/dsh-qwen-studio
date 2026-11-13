"""Bind local H3 Studio library cards to immutable DSH attachments."""
import fcntl
import hashlib
import json
import re
from pathlib import Path

from upstream_h3studio import cinema


def image(cfg, ref):
    if not isinstance(ref, str) or not re.fullmatch(r"sha256:[a-f0-9]{64}", ref):
        raise ValueError("无效的 DSH 图片附件 ID")
    digest = ref[7:]
    path = Path(cfg["data_home"]) / "attachments/v1/objects" / digest[:2] / digest
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError("图片附件内容与 ID 不一致")
    return data


def library(cfg, op, args):
    folder = Path(cfg["data_home"]) / "h3-video/characters"
    folder.mkdir(parents=True, exist_ok=True)
    cinema.LIBRARY_FILE = folder / "asset_library.json"
    with (folder / "library.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if cinema.LIBRARY_FILE.exists():
            json.loads(cinema.LIBRARY_FILE.read_text())  # Avoid replacing a damaged library.
        if op == "character_save":
            refs, name = args["reference_images"], args["name"].strip()
            if not name or len(name) > 100 or not isinstance(refs, list) or not 1 <= len(refs) <= cinema.MAX_ASSET_IMAGES or len(set(refs)) != len(refs):
                raise ValueError("请提供角色名称和 1–5 张不同的参考图")
            for ref in refs:
                image(cfg, ref)
            card_id = hashlib.sha256(name.encode()).hexdigest()[:32]
            card = cinema.upsert_library_asset("character", dict(id=card_id, name=name, images=refs))
            return dict(id=card["id"], status="saved", name=name, reference_images=refs)
        cards = cinema.list_library("character")["characters"]
        return dict(id="library", status="ready", characters=[
            dict(id=c["id"], name=c["name"], reference_images=[x["file"] for x in c["images"]]) for c in cards
        ])


def resolve_plan(cfg, root, request):
    plan = json.loads(json.dumps(request))
    cards = {c["id"]: c for c in library(cfg, "list", {})["characters"]}
    for shot in plan["shots"]:
        cast = shot.get("character_ids", plan.get("character_ids", []))
        if not isinstance(cast, list) or any(c not in cards for c in cast) or len(cast) != len(set(cast)):
            raise ValueError("分镜角色不存在或重复，请检查 h3_character_list")
        refs = list(dict.fromkeys(r for c in cast for r in cards[c]["reference_images"]))
        if len(refs) > 9:
            raise ValueError("每镜参考图上限为 9 张")
        if refs:
            plan.setdefault("preset", "quality480")
            if not plan["preset"].startswith("quality"):
                raise ValueError("参考人物需要 quality480 或 quality768")
            shot["reference_images"] = refs
            shot["cast_snapshot"] = [cards[c] for c in cast]
            paths = []
            for ref in refs:
                data = image(cfg, ref)
                ext = "jpg" if data.startswith(b"\xff\xd8\xff") else "png" if data.startswith(b"\x89PNG") else "webp"
                target = Path("素材/人物资产") / (ref[7:] + "." + ext)
                (root / target).parent.mkdir(parents=True, exist_ok=True)
                (root / target).write_bytes(data)
                paths.append(str(target))
            shot["reference_paths"] = paths
    return plan
