from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from .catalog import pipeline_catalog, provider_catalog


SCHEMA_VERSION = 2
SAFE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
ASSET_STRATEGIES = {
    "existing_footage", "licensed_stock", "open_archive", "screen_recording",
    "generated_motion", "generated_still", "motion_graphics", "talking_head",
}
COMMON_STAGES = [
    "research", "proposal", "script", "shot_plan", "animatic", "assets",
    "edit", "audio_subtitles", "render", "qa", "agent_review",
]


class VideoProjectError(RuntimeError):
    pass


def slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-") or "video-project"


def default_video_project(title: str, pipeline: str = "cinematic-brand") -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "project": {
            "id": slug(title), "title": title, "pipeline": pipeline,
            "goal": "", "audience": "", "target_duration_seconds": 60,
            "language": "zh-CN", "privacy_level": "internal",
            "privacy": {"show_title": True, "show_prompts": True, "redact_paths": True},
        },
        "creative": {
            "concept": "", "tone": [], "references": [], "pacing": "",
            "realism": "photoreal", "forbidden": [], "distinctness_required": True,
        },
        "production": {
            "quality_priority": "highest", "provider_policy": "hybrid-local-first",
            "cloud_budget_cny": 0, "cloud_budget_approved": False,
            "approval_policy": "exceptions-only", "primary_workspace": "comfyui",
            "representative_shot": "shot01", "single_gpu_queue": True,
            "model_audio": "strip", "profile": "quality", "fast_profile_approved": False,
        },
        "sources": [],
        "shots": [{
            "id": "shot01", "scene_id": "scene01", "purpose": "代表镜头",
            "duration_seconds": 5.17, "asset_strategy": "generated_motion",
            "workflow": "i2v", "prompt": "", "start_image": "生成图版素材/shot01-start.png",
            "seed": 31001,
            "generation": {"provider": "h3-local", "workflow": "h3-i2v", "prompt": "", "parameters": {}},
            "action": {"subject": "", "camera": "", "environment": "", "start_state": "", "end_state": ""},
        }],
        "timeline": {"order": ["shot01"], "transition_seconds": 0.16, "editor": "velorn"},
        "audio": {
            "master_mix": "", "narration": "", "music": "", "ambience": "",
            "narration_lufs": -16, "music_lufs": -24, "ambience_lufs": -32,
            "master_lufs": -14, "true_peak_dbtp": -1.0,
        },
        "subtitles": {"srt": "", "font": "PingFang SC Semibold", "font_index": 11},
        "deliverables": [{"id": "master-horizontal", "path": "成片/横屏母版.mp4", "width": 1920, "height": 1080, "fps": 24}],
        "output": {"clips_dir": "素材/生成镜头-无原音", "master": "成片/横屏母版.mp4", "width": 1920, "height": 1080, "fps": 24},
        "qa": {
            "require_cfr": True, "block_on_source_audio": True, "block_on_missing_glyph": True,
            "continuity_rmse_max": 0.04, "require_source_provenance": True,
            "block_slideshow_risk": True, "require_agent_review": True,
        },
    }


def migrate_v1(data: dict[str, Any]) -> dict[str, Any]:
    if data.get("schema_version") == SCHEMA_VERSION:
        return data
    if data.get("schema_version") != 1:
        raise VideoProjectError(f"不支持的schema_version：{data.get('schema_version')}")
    migrated = dict(data)
    migrated["schema_version"] = SCHEMA_VERSION
    project = migrated.setdefault("project", {})
    project.setdefault("pipeline", "cinematic-brand")
    project.setdefault("goal", project.get("creative_direction") or f"制作“{project.get('title', '当前主题')}”高质量视频")
    project.setdefault("audience", "项目目标观众")
    project.setdefault("target_duration_seconds", 60)
    project.setdefault("language", "zh-CN")
    project.setdefault("privacy_level", "internal")
    migrated.setdefault("creative", {
        "concept": project.get("creative_direction", ""), "tone": ["cinematic", "photoreal"],
        "references": [], "pacing": "", "realism": "photoreal", "forbidden": [],
        "distinctness_required": True,
    })
    production = migrated.setdefault("production", {})
    production.setdefault("quality_priority", "highest")
    production.setdefault("provider_policy", "hybrid-local-first")
    production.setdefault("cloud_budget_cny", 0)
    production.setdefault("cloud_budget_approved", False)
    production.setdefault("approval_policy", "exceptions-only")
    production.setdefault("primary_workspace", "comfyui")
    migrated.setdefault("sources", [])
    for shot in migrated.get("shots") or []:
        shot.setdefault("duration_seconds", round(int((production.get("frames") or 124)) / 24, 3))
        shot.setdefault("asset_strategy", "generated_motion")
        provider_workflow = {
            "i2v": "h3-i2v", "first_last": "h3-first-last",
            "continuation": "h3-continuation", "reference": "h3-reference",
        }.get(str(shot.get("workflow")), "h3-i2v")
        shot.setdefault("generation", {
            "provider": "h3-local", "workflow": provider_workflow,
            "prompt": shot.get("prompt", ""), "parameters": shot.get("parameters") or {},
        })
    timeline = migrated.setdefault("timeline", {})
    timeline.setdefault("editor", "velorn")
    output = migrated.setdefault("output", {})
    migrated.setdefault("deliverables", [{
        "id": "master-horizontal", "path": output.get("master", "成片/横屏母版.mp4"),
        "width": output.get("width", 1920), "height": output.get("height", 1080), "fps": output.get("fps", 24),
    }])
    qa = migrated.setdefault("qa", {})
    qa.setdefault("require_source_provenance", True)
    qa.setdefault("block_slideshow_risk", True)
    qa.setdefault("require_agent_review", True)
    return migrated


@dataclass(frozen=True)
class VideoProject:
    root: Path
    path: Path
    data: dict[str, Any]

    @property
    def project_id(self) -> str:
        return str(self.data.get("project", {}).get("id", ""))

    @property
    def title(self) -> str:
        return str(self.data.get("project", {}).get("title", ""))

    @property
    def pipeline_id(self) -> str:
        return str(self.data.get("project", {}).get("pipeline", ""))

    @property
    def shots(self) -> list[dict[str, Any]]:
        return list(self.data.get("shots") or [])

    @property
    def shot_map(self) -> dict[str, dict[str, Any]]:
        return {str(shot["id"]): shot for shot in self.shots}

    @property
    def profile_name(self) -> str:
        return str(self.data.get("production", {}).get("profile") or "quality")

    def path_for(self, value: str | None) -> Path | None:
        if not value:
            return None
        path = Path(value).expanduser()
        return path if path.is_absolute() else self.root / path

    def validate(self, *, check_files: bool = True) -> list[str]:
        errors: list[str] = []
        project = self.data.get("project") or {}
        if self.data.get("schema_version") != SCHEMA_VERSION:
            errors.append(f"schema_version必须为{SCHEMA_VERSION}")
        if not SAFE_ID.fullmatch(self.project_id):
            errors.append("project.id必须是安全ASCII标识")
        pipelines = pipeline_catalog()
        if self.pipeline_id not in pipelines:
            errors.append(f"未知片型管线：{self.pipeline_id}")
        if not str(project.get("goal") or "").strip():
            errors.append("project.goal不能为空")
        if not str(project.get("audience") or "").strip():
            errors.append("project.audience不能为空")
        production = self.data.get("production") or {}
        budget = float(production.get("cloud_budget_cny") or 0)
        if budget < 0:
            errors.append("production.cloud_budget_cny不能为负数")
        providers = provider_catalog()
        ids: list[str] = []
        for shot in self.shots:
            shot_id = str(shot.get("id") or "")
            ids.append(shot_id)
            if not SAFE_ID.fullmatch(shot_id):
                errors.append(f"无效shot.id：{shot_id}")
            strategy = str(shot.get("asset_strategy") or "")
            if strategy not in ASSET_STRATEGIES:
                errors.append(f"{shot_id}: 未知asset_strategy：{strategy}")
            if float(shot.get("duration_seconds") or 0) <= 0:
                errors.append(f"{shot_id}: duration_seconds必须大于0")
            generation = shot.get("generation") or {}
            provider_id = str(generation.get("provider") or "")
            if strategy in {"generated_motion", "generated_still", "motion_graphics", "talking_head"}:
                if provider_id not in providers:
                    errors.append(f"{shot_id}: 未知generation.provider：{provider_id}")
                elif providers[provider_id].get("paid") and not production.get("cloud_budget_approved"):
                    errors.append(f"{shot_id}: 付费供应商{provider_id}尚未批准项目预算")
            for field in ("start_image", "end_image", "source_path"):
                path = self.path_for(shot.get(field))
                if check_files and path and not path.is_file():
                    errors.append(f"{shot_id}: {field}不存在：{path}")
        if len(set(ids)) != len(ids):
            errors.append("shot.id不能重复")
        order = list((self.data.get("timeline") or {}).get("order") or [])
        if set(order) != set(ids) or len(order) != len(ids):
            errors.append("timeline.order必须且只能包含全部镜头一次")
        known_sources = {str(item.get("id")) for item in self.data.get("sources") or []}
        for shot in self.shots:
            source_id = shot.get("source_id")
            if source_id and str(source_id) not in known_sources:
                errors.append(f"{shot.get('id')}: source_id不存在：{source_id}")
        return errors

    def fingerprint(self) -> str:
        encoded = yaml.safe_dump(self.data, allow_unicode=True, sort_keys=True).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def write(self, path: Path | None = None) -> Path:
        target = path or self.path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(yaml.safe_dump(self.data, allow_unicode=True, sort_keys=False), encoding="utf-8")
        return target


def load_video_project(root: Path, *, auto_migrate: bool = False) -> VideoProject:
    root = root.expanduser().resolve()
    path = root / "工程" / "video_project.yaml"
    if not path.is_file():
        raise VideoProjectError(f"缺少项目定义：{path}")
    payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise VideoProjectError(f"无效YAML：{path}")
    if payload.get("schema_version") == 1:
        payload = migrate_v1(payload)
        if auto_migrate:
            VideoProject(root, path, payload).write()
    return VideoProject(root=root, path=path, data=payload)


def initialize_video_project(root: Path, title: str, pipeline: str, *, force: bool = False) -> VideoProject:
    root = root.expanduser().resolve()
    path = root / "工程" / "video_project.yaml"
    if path.exists() and not force:
        raise VideoProjectError(f"项目定义已存在：{path}")
    project = VideoProject(root, path, default_video_project(title, pipeline))
    project.write()
    return project
