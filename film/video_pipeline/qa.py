from __future__ import annotations

import json
import copy
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from h3_pipeline.project import H3Project
from h3_pipeline.approval import sha256_file
from h3_pipeline.qa import qa_project as legacy_media_qa
from h3_pipeline.qa import render_master as legacy_render_master

from .project import VideoProject


@dataclass(frozen=True)
class VideoCheck:
    name: str
    status: str
    detail: str
    shot_id: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {"name": self.name, "status": self.status, "detail": self.detail, "shot_id": self.shot_id}


def _legacy_view(project: VideoProject) -> H3Project:
    # The legacy checker assumes every source clip is an 832x480 H3 render.
    # Schema v2 also accepts native footage, screen captures, and motion graphics,
    # whose expected dimensions are the project output unless explicitly set.
    data = copy.deepcopy(project.data)
    output = data.get("output") or {}
    for shot in data.get("shots") or []:
        generation = shot.get("generation") or {}
        is_h3 = (
            str(shot.get("asset_strategy") or "") == "generated_motion"
            and str(generation.get("provider") or "") == "h3-local"
        )
        if is_h3:
            continue
        parameters = dict(shot.get("parameters") or {})
        generation_parameters = generation.get("parameters") or {}
        parameters.setdefault("width", generation_parameters.get("width", output.get("width", 1920)))
        parameters.setdefault("height", generation_parameters.get("height", output.get("height", 1080)))
        parameters.setdefault("fps", generation_parameters.get("fps", output.get("fps", 24)))
        shot["parameters"] = parameters
    return H3Project(root=project.root, path=project.path, data=data)


def _declares_audio(project: VideoProject) -> bool:
    audio = project.data.get("audio") or {}
    return any(str(audio.get(name) or "").strip() for name in ("master_mix", "narration", "music", "ambience"))


def _adapt_legacy_check(project: VideoProject, item: Any) -> VideoCheck:
    """Apply Schema v2 intent to deterministic legacy media checks."""
    status, detail = item.status, item.detail
    if not _declares_audio(project) and item.name in {
        "master_audio", "master_lufs", "master_true_peak", "master_loudness",
    }:
        status = "SKIP"
        detail = "项目明确声明为无声母版；未要求响度目标"
    return VideoCheck(item.name, status, detail, item.shot_id)


def source_provenance_checks(project: VideoProject) -> list[VideoCheck]:
    checks: list[VideoCheck] = []
    sources = {str(item.get("id")): item for item in project.data.get("sources") or []}
    for shot in project.shots:
        strategy = str(shot.get("asset_strategy") or "")
        if strategy not in {"existing_footage", "licensed_stock", "open_archive", "screen_recording"}:
            continue
        source_id = str(shot.get("source_id") or "")
        source = sources.get(source_id)
        if not source:
            checks.append(VideoCheck("source_provenance", "ERROR", "真实/网络素材缺少source_id登记", str(shot.get("id"))))
            continue
        required = ["origin", "rights", "usage"]
        missing = [field for field in required if not str(source.get(field) or "").strip()]
        status = "ERROR" if missing else "OK"
        detail = f"缺少来源字段：{', '.join(missing)}" if missing else f"来源与用途已登记：{source_id}"
        checks.append(VideoCheck("source_provenance", status, detail, str(shot.get("id"))))
    if not checks:
        checks.append(VideoCheck("source_provenance", "SKIP", "项目未使用需要登记的真实或网络素材"))
    return checks


def slideshow_risk_check(project: VideoProject) -> VideoCheck:
    shots = project.shots
    if not shots:
        return VideoCheck("slideshow_risk", "ERROR", "项目没有镜头")
    motion_strategies = {"existing_footage", "licensed_stock", "open_archive", "screen_recording", "generated_motion", "motion_graphics", "talking_head"}
    motion = sum(str(shot.get("asset_strategy")) in motion_strategies for shot in shots)
    motion_ratio = motion / len(shots)
    actionless = 0
    for shot in shots:
        if str(shot.get("asset_strategy")) != "generated_motion":
            continue
        action = shot.get("action") or {}
        if not str(action.get("subject") or "").strip() or not str(action.get("end_state") or "").strip():
            actionless += 1
    blocked = motion_ratio < 0.65 or actionless > 0
    detail = f"真实运动策略占比{motion_ratio:.0%}，缺少明确主体/结束状态的生成镜头{actionless}个"
    return VideoCheck("slideshow_risk", "ERROR" if blocked else "OK", detail)


def agent_review_check(project: VideoProject) -> VideoCheck:
    path = project.root / "工程" / "agent_review.json"
    if not path.is_file():
        return VideoCheck("agent_final_review", "ERROR", "缺少最终Agent审片记录")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return VideoCheck("agent_final_review", "ERROR", f"审片记录无效：{exc}")
    approved = payload.get("status") == "approved" and bool(str(payload.get("notes") or "").strip())
    return VideoCheck("agent_final_review", "OK" if approved else "ERROR", str(payload.get("notes") or "审片未批准"))


def qa_video_project(project: VideoProject, *, include_master: bool = True) -> list[VideoCheck]:
    checks: list[VideoCheck] = []
    checks.extend(source_provenance_checks(project))
    checks.append(slideshow_risk_check(project))
    try:
        for item in legacy_media_qa(_legacy_view(project), include_master=include_master):
            checks.append(_adapt_legacy_check(project, item))
    except Exception as exc:
        checks.append(VideoCheck("media_qa", "ERROR", str(exc)))
    if project.data.get("qa", {}).get("require_agent_review", True):
        checks.append(agent_review_check(project))
    return checks


def materialize_source_clips(project: VideoProject) -> None:
    clips_dir = project.path_for(project.data.get("output", {}).get("clips_dir"))
    if not clips_dir:
        raise RuntimeError("output.clips_dir未配置")
    clips_dir.mkdir(parents=True, exist_ok=True)
    for shot in project.shots:
        source = project.path_for(shot.get("source_path") or shot.get("output_path"))
        target = clips_dir / f"{shot['id']}.mp4"
        if source and source.is_file() and source.resolve() != target.resolve():
            if target.exists() and target.is_file() and sha256_file(target) != sha256_file(source):
                raise RuntimeError(
                    f"拒绝覆盖既有materialized flat素材：{target}；请使用run-scoped输出 {source}"
                )
            shutil.copy2(source, target)


def render_video_project(project: VideoProject) -> Path:
    materialize_source_clips(project)
    return legacy_render_master(_legacy_view(project))


def write_video_report(project: VideoProject, checks: list[VideoCheck]) -> Path:
    path = project.root / "工程" / "video_qa_report.json"
    payload = {
        "schema_version": 2,
        "project_id": project.project_id,
        "pipeline": project.pipeline_id,
        "passed": not any(item.status == "ERROR" for item in checks),
        "checks": [item.as_dict() for item in checks],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path
