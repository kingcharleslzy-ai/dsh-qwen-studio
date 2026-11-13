from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .catalog import pipeline_catalog, provider_catalog
from .project import COMMON_STAGES, VideoProject


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _json_file(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    except (OSError, json.JSONDecodeError):
        return {}


def infer_stage_statuses(project: VideoProject) -> dict[str, str]:
    """Infer truthful, reproducible stage state from stable project artifacts."""
    statuses = {stage: "pending" for stage in COMMON_STAGES}
    shots = project.shots
    if (project.data.get("creative") or {}).get("concept") or project.data.get("sources"):
        statuses["research"] = "completed"
        statuses["proposal"] = "completed"
    if shots and all(str(shot.get("purpose") or shot.get("prompt") or "").strip() for shot in shots):
        statuses["script"] = "completed"
    order = list((project.data.get("timeline") or {}).get("order") or [])
    if shots and len(order) == len(shots):
        statuses["shot_plan"] = "completed"

    clips_dir = project.path_for((project.data.get("output") or {}).get("clips_dir"))
    materialized = []
    for shot in shots:
        direct = project.path_for(shot.get("source_path") or shot.get("output_path"))
        clip = clips_dir / f"{shot.get('id')}.mp4" if clips_dir else None
        materialized.append(bool((direct and direct.is_file()) or (clip and clip.is_file())))
    if materialized and any(materialized):
        statuses["animatic"] = "completed"
    if materialized and all(materialized):
        statuses["assets"] = "completed"

    master = project.path_for((project.data.get("output") or {}).get("master"))
    if master and master.is_file():
        for stage in ("research", "proposal", "script", "shot_plan", "animatic", "assets", "edit", "audio_subtitles", "render"):
            statuses[stage] = "completed"
    qa = _json_file(project.root / "工程" / "video_qa_report.json")
    if qa:
        statuses["qa"] = "completed" if qa.get("passed") else "failed"
    review = _json_file(project.root / "工程" / "agent_review.json")
    if review:
        statuses["agent_review"] = "completed" if review.get("status") == "approved" else "failed"
    elif statuses["qa"] == "completed":
        statuses["agent_review"] = "awaiting_agent"
    return statuses


def build_production_plan(project: VideoProject) -> dict[str, Any]:
    pipeline = pipeline_catalog()[project.pipeline_id]
    providers = provider_catalog()
    tasks: list[dict[str, Any]] = []
    for position, shot in enumerate(project.shots):
        generation = shot.get("generation") or {}
        provider_id = str(generation.get("provider") or "")
        provider = providers.get(provider_id, {})
        tasks.append({
            "id": str(shot["id"]), "position": position, "scene_id": shot.get("scene_id"),
            "purpose": shot.get("purpose", ""), "duration_seconds": shot.get("duration_seconds"),
            "asset_strategy": shot.get("asset_strategy"), "provider": provider_id or None,
            "provider_runtime": provider.get("runtime"), "paid": bool(provider.get("paid")),
            "workflow": generation.get("workflow") or shot.get("workflow"),
            "dependencies": [shot["continues_from"]] if shot.get("continues_from") else [],
        })
    return {
        "schema_version": 2,
        "project_id": project.project_id,
        "project_title": project.title,
        "project_fingerprint": project.fingerprint(),
        "pipeline": project.pipeline_id,
        "pipeline_name": pipeline.get("name"),
        "created_at": utc_now(),
        "approval_policy": project.data.get("production", {}).get("approval_policy"),
        "budget": {
            "currency": "CNY",
            "approved": bool(project.data.get("production", {}).get("cloud_budget_approved")),
            "limit": float(project.data.get("production", {}).get("cloud_budget_cny") or 0),
        },
        "stages": [{"id": stage, "status": status} for stage, status in infer_stage_statuses(project).items()],
        "tasks": tasks,
        "display": project.data.get("project", {}).get("privacy", {}),
    }


def write_production_plan(project: VideoProject) -> Path:
    path = project.root / "工程" / "production_plan.json"
    path.write_text(json.dumps(build_production_plan(project), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path
