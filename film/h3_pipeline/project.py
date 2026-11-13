from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import yaml

from .beats import beat_structure_errors
from .composite_intent import composite_intent_errors


SCHEMA_VERSION = 1
WORKFLOW_TYPES = {"i2v", "first_last", "continuation", "reference"}
PROFILES: dict[str, dict[str, Any]] = {
    "quality": {"width": 832, "height": 480, "fps": 24, "frames": 124, "steps": 15},
    "hero": {"width": 832, "height": 480, "fps": 24, "frames": 124, "steps": 20},
    "fast": {"width": 832, "height": 480, "fps": 24, "frames": 124, "steps": 12, "requires_ab": True},
    "vertical_quality": {"width": 480, "height": 832, "fps": 24, "frames": 124, "steps": 15},
    "vertical_hero": {"width": 480, "height": 832, "fps": 24, "frames": 124, "steps": 20},
    "vertical_high": {"width": 544, "height": 960, "fps": 24, "frames": 124, "steps": 20},
    "vertical_production": {"width": 768, "height": 1376, "fps": 24, "frames": 124, "steps": 20},
    "vertical_production_8s": {"width": 768, "height": 1376, "fps": 24, "frames": 192, "steps": 20},
    "vertical_production_10s": {"width": 768, "height": 1376, "fps": 24, "frames": 243, "steps": 20},
}
REQUIRED_ACTION_FIELDS = ("subject", "camera", "environment", "start_state", "end_state")
SAFE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
PROMPT_CONTRACTS = {"legacy", "official-h3-v1"}
OFFICIAL_BASE_FIELDS = (
    "integrated_multimodal_description:",
    "overall_soundscape:",
    "non_diegetic_music:",
)
OFFICIAL_REFERENCE_FIELDS = (
    "subject_definitions:",
    "summary:",
    "retention_analysis:",
    "detailed_description:",
    "overall_soundscape:",
    "non_diegetic_music:",
)
MOTION_PHASE_MODES = {"active", "settle", "hold"}
MOTION_PHASE_INTENT_VERSION = "motion-phases-v1"


class ProjectError(RuntimeError):
    pass


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _as_path(project_root: Path, value: str | None) -> Path | None:
    if not value:
        return None
    path = Path(value).expanduser()
    return path if path.is_absolute() else project_root / path


def shot_output_frames(project: Any, shot: dict[str, Any]) -> int:
    """Return the frame count of the clip QA will inspect for this shot."""
    composite = shot.get("composite")
    if isinstance(composite, dict):
        try:
            return int(composite.get("output_frames") or 0)
        except (TypeError, ValueError):
            return 0
    trim_value = shot.get("narrative_trim_seconds")
    if trim_value is not None:
        try:
            frames = Decimal(str(trim_value)) * 24
            if frames.is_finite() and frames == frames.to_integral_value():
                return int(frames)
        except (InvalidOperation, TypeError, ValueError):
            return 0
    try:
        return int(project.profile_for(shot).get("frames") or 0)
    except (TypeError, ValueError):
        return 0


def motion_phase_intent(project: Any, shot: dict[str, Any]) -> dict[str, Any] | None:
    """Canonical resolved QA intent that an accepted review must bind."""
    phases = shot.get("motion_phases")
    if phases is None:
        return None
    errors = motion_phase_review_intent_errors(project, shot)
    if errors:
        raise ValueError("invalid motion phase review intent: " + "; ".join(errors))
    qa = project.data.get("qa", {})
    normalized_phases: list[dict[str, Any]] = []
    for phase in phases:
        normalized = {
            "mode": str(phase["mode"]),
            "start_frame": int(phase["start_frame"]),
            "end_frame": int(phase["end_frame"]),
        }
        if phase.get("max_drift_rmse") is not None:
            normalized["max_drift_rmse"] = float(phase["max_drift_rmse"])
        normalized_phases.append(normalized)
    roi = shot.get("subject_roi")
    normalized_roi = (
        {key: float(roi[key]) for key in ("x", "y", "width", "height")}
        if isinstance(roi, dict)
        else None
    )
    return {
        "version": MOTION_PHASE_INTENT_VERSION,
        "motion_phases": normalized_phases,
        "output_frames": shot_output_frames(project, shot),
        "output_fps": int(project.data.get("output", {}).get("fps", 24)),
        "motion_sample_fps": int(qa.get("motion_sample_fps", 4)),
        "minimum_motion_rms": float(shot.get("minimum_motion_rms", qa.get("minimum_motion_rms"))),
        "minimum_motion_window_rms": float(shot.get(
            "minimum_motion_window_rms", qa.get("minimum_motion_window_rms")
        )),
        "continuity_rmse_max": float(qa.get("continuity_rmse_max", 0.04)),
        "subject_roi": normalized_roi,
        "subject_roi_backend": shot.get("subject_roi_backend", qa.get("subject_roi_backend")),
        "subject_roi_min_rms": float(
            shot.get("subject_roi_min_rms", qa.get("subject_motion_rms", 0.02))
        ),
    }


def motion_phase_errors(project: Any, shot: dict[str, Any]) -> list[str]:
    """Fail closed when optional frame-exact motion phases are malformed.

    Intervals are half-open [start_frame, end_frame) so adjacent phases can
    cover the clip exactly without sharing a frame.
    """
    phases = shot.get("motion_phases")
    if phases is None:
        return []
    shot_id = str(shot.get("id") or "<unknown>")
    if not isinstance(phases, list) or not phases:
        return [f"{shot_id}: motion_phases 必须是非空列表"]
    output_frames = shot_output_frames(project, shot)
    errors: list[str] = []
    qa = project.data.get("qa", {})
    sample_fps = qa.get("motion_sample_fps", 4)
    if isinstance(sample_fps, bool) or not isinstance(sample_fps, int) or sample_fps <= 0:
        errors.append(f"{shot_id}: motion_phases要求qa.motion_sample_fps为正整数")
    try:
        continuity_limit = float(qa.get("continuity_rmse_max", 0.04))
        if not math.isfinite(continuity_limit) or continuity_limit <= 0:
            raise ValueError
    except (TypeError, ValueError):
        continuity_limit = 0.0
        errors.append(f"{shot_id}: motion_phases要求qa.continuity_rmse_max为有限正数")
    expected_start = 0
    modes: list[str] = []
    for index, phase in enumerate(phases):
        label = f"motion_phases[{index}]"
        if not isinstance(phase, dict):
            errors.append(f"{shot_id}: {label} 必须是映射")
            continue
        allowed = {"mode", "start_frame", "end_frame", "max_drift_rmse"}
        unknown = sorted(set(phase) - allowed)
        if unknown:
            errors.append(f"{shot_id}: {label} 包含未知字段：{', '.join(unknown)}")
        mode = str(phase.get("mode") or "")
        modes.append(mode)
        if mode not in MOTION_PHASE_MODES:
            errors.append(f"{shot_id}: {label}.mode 只能是 active、settle 或 hold")
        start, end = phase.get("start_frame"), phase.get("end_frame")
        if isinstance(start, bool) or not isinstance(start, int):
            errors.append(f"{shot_id}: {label}.start_frame 必须是整数")
            continue
        if isinstance(end, bool) or not isinstance(end, int):
            errors.append(f"{shot_id}: {label}.end_frame 必须是整数")
            continue
        if start < 0 or end <= start:
            errors.append(f"{shot_id}: {label} 必须满足 0 <= start_frame < end_frame")
        if mode == "settle" and end - start < 2:
            errors.append(f"{shot_id}: {label} settle至少需要2帧以检查相邻变化")
        if mode == "hold" and end - start < 2:
            errors.append(f"{shot_id}: {label} hold至少需要2帧以检查漂移与微动")
        if output_frames > 0 and end > output_frames:
            errors.append(f"{shot_id}: {label} 越界：end_frame={end}，成片共{output_frames}帧")
        if start != expected_start:
            relation = "重叠" if start < expected_start else "缺口"
            errors.append(
                f"{shot_id}: {label} 与前段存在{relation}：期望start_frame={expected_start}，实际{start}"
            )
        expected_start = end
        drift_value = phase.get("max_drift_rmse")
        if mode == "hold":
            if drift_value is None:
                errors.append(f"{shot_id}: {label} hold 必须提供 max_drift_rmse")
            else:
                try:
                    drift = float(drift_value)
                    if not math.isfinite(drift) or drift <= 0 or drift > continuity_limit:
                        errors.append(
                            f"{shot_id}: {label}.max_drift_rmse 必须大于0且不超过 continuity_rmse_max={continuity_limit}"
                        )
                except (TypeError, ValueError):
                    errors.append(f"{shot_id}: {label}.max_drift_rmse 必须是有限数值")
        elif drift_value is not None:
            errors.append(f"{shot_id}: {label} 只有 hold 可以配置 max_drift_rmse")
    if "active" not in modes:
        errors.append(f"{shot_id}: motion_phases必须至少包含一个active阶段")
    if not modes or modes[0] != "active":
        errors.append(f"{shot_id}: motion_phases首段必须是active")
    for mode in MOTION_PHASE_MODES:
        if modes.count(mode) > 1:
            errors.append(f"{shot_id}: motion_phases中{mode}至多出现一次")
    allowed_sequences = (
        ["active"],
        ["active", "settle"],
        ["active", "hold"],
        ["active", "settle", "hold"],
    )
    if modes not in allowed_sequences and all(mode in MOTION_PHASE_MODES for mode in modes):
        errors.append(f"{shot_id}: motion_phases顺序只能是active→可选settle→可选hold")
    if "hold" in modes and modes[-1] != "hold":
        errors.append(f"{shot_id}: motion_phases中的hold必须是末段")
    if output_frames <= 0:
        errors.append(f"{shot_id}: 无法解析 motion_phases 对应的成片帧数")
    elif expected_start != output_frames:
        errors.append(
            f"{shot_id}: motion_phases 未完整覆盖成片：结束于{expected_start}，成片共{output_frames}帧"
        )
    if "active" in modes:
        thresholds = {
            "minimum_motion_rms": shot.get("minimum_motion_rms", qa.get("minimum_motion_rms")),
            "minimum_motion_window_rms": shot.get(
                "minimum_motion_window_rms", qa.get("minimum_motion_window_rms")
            ),
        }
        for name, value in thresholds.items():
            try:
                numeric = float(value)
                if value is None or not math.isfinite(numeric) or numeric <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                errors.append(f"{shot_id}: motion_phases包含active时必须配置有限正数{name}")
    return errors


def default_project(title: str) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "project": {
            "id": re.sub(r"[^A-Za-z0-9._-]+", "-", title).strip("-") or "h3-project",
            "title": title,
            "creative_direction": "",
            "display_mode": "real_project",
            "privacy": {"show_title": True, "show_prompts": True, "redact_paths": True},
        },
        "production": {
            "profile": "quality",
            "representative_shot": "shot01",
            "model_audio": "strip",
            "single_gpu_queue": True,
            "fast_profile_approved": False,
            "prompt_contract": "official-h3-v1",
            "preproduction_priority": "generation-first-v1",
            "reference_map_required": False,
        },
        "shots": [
            {
                "id": "shot01",
                "scene_id": "scene01",
                "purpose": "代表镜头",
                "workflow": "i2v",
                "prompt": "",
                "start_image": "生成图版素材/shot01-start.png",
                "seed": 31001,
                "candidate_group": "main",
                "action": {
                    "subject": "",
                    "camera": "",
                    "environment": "",
                    "start_state": "",
                    "end_state": "",
                },
            }
        ],
        "timeline": {"order": ["shot01"], "transition_seconds": 0.16},
        "audio": {
            "master_mix": "",
            "narration": "",
            "music": "",
            "ambience": "",
            "narration_lufs": -16,
            "music_lufs": -24,
            "ambience_lufs": -32,
            "master_lufs": -14,
            "true_peak_dbtp": -1.0,
        },
        "subtitles": {
            "srt": "",
            "font": "PingFang SC Semibold",
            "font_path": "",
            "font_index": 11,
        },
        "output": {
            "clips_dir": "素材/H3流水线-无原音",
            "candidates_dir": "素材/H3候选",
            "master": "成片/H3-横屏母版.mp4",
            "width": 1920,
            "height": 1080,
            "fps": 24,
        },
        "qa": {
            "continuity_rmse_max": 0.04,
            "block_on_missing_glyph": True,
            "block_on_source_audio": True,
            "require_cfr": True,
        },
    }


@dataclass(frozen=True)
class H3Project:
    root: Path
    path: Path
    data: dict[str, Any]

    @property
    def project_id(self) -> str:
        return str(self.data["project"]["id"])

    @property
    def title(self) -> str:
        return str(self.data["project"]["title"])

    @property
    def shots(self) -> list[dict[str, Any]]:
        return list(self.data.get("shots") or [])

    @property
    def shot_map(self) -> dict[str, dict[str, Any]]:
        return {str(shot["id"]): shot for shot in self.shots}

    @property
    def profile_name(self) -> str:
        return str(self.data.get("production", {}).get("profile", "quality"))

    def path_for(self, value: str | None) -> Path | None:
        return _as_path(self.root, value)

    def profile_for(self, shot: dict[str, Any]) -> dict[str, Any]:
        name = str(shot.get("profile") or self.profile_name)
        profile = dict(PROFILES.get(name, {}))
        profile.update(shot.get("parameters") or {})
        return profile

    def validate(self, *, check_files: bool = True) -> list[str]:
        errors: list[str] = []
        if self.data.get("schema_version") not in {SCHEMA_VERSION, 2}:
            errors.append(f"schema_version 必须为 {SCHEMA_VERSION} 或兼容的2")
        if not SAFE_ID.fullmatch(self.project_id):
            errors.append("project.id 只能包含英文字母、数字、点、下划线和连字符")
        if self.profile_name not in PROFILES:
            errors.append(f"未知 production.profile：{self.profile_name}")
        if self.profile_name == "fast" and not self.data.get("production", {}).get("fast_profile_approved"):
            errors.append("fast 档尚未完成同镜头 12/15 步 A/B，不能用于生产")
        production = self.data.get("production", {})
        prompt_contract = str(production.get("prompt_contract") or "legacy")
        if prompt_contract not in PROMPT_CONTRACTS:
            errors.append(f"production.prompt_contract 必须是 {', '.join(sorted(PROMPT_CONTRACTS))}")
        preproduction_priority = str(production.get("preproduction_priority") or "legacy")

        shots = self.shots
        if not shots:
            errors.append("shots 不能为空")
            return errors
        ids = [str(shot.get("id", "")) for shot in shots]
        if any(not SAFE_ID.fullmatch(value) for value in ids):
            errors.append("每个 shot.id 必须是安全且非空的标识")
        if len(set(ids)) != len(ids):
            errors.append("shot.id 不能重复")
        known = set(ids)
        order = list(self.data.get("timeline", {}).get("order") or ids)
        if set(order) != known or len(order) != len(ids):
            errors.append("timeline.order 必须且只能包含所有 shot.id 一次")

        for shot in shots:
            shot_id = str(shot.get("id", "<unknown>"))
            workflow = str(shot.get("workflow", ""))
            if workflow not in WORKFLOW_TYPES:
                errors.append(f"{shot_id}: workflow 必须是 {', '.join(sorted(WORKFLOW_TYPES))}")
            if not str(shot.get("prompt", "")).strip():
                errors.append(f"{shot_id}: prompt 不能为空")
            errors.extend(prompt_contract_errors(shot, prompt_contract))
            action = shot.get("action") or {}
            for field in REQUIRED_ACTION_FIELDS:
                if not str(action.get(field, "")).strip():
                    errors.append(f"{shot_id}: action.{field} 不能为空")
            errors.extend(beat_structure_errors(self, shot))
            errors.extend(subject_roi_errors(shot))
            candidate_group = str(shot.get("candidate_group") or "main")
            if not SAFE_ID.fullmatch(candidate_group):
                errors.append(f"{shot_id}: candidate_group 必须是安全且非空的ASCII标识")
            profile = self.profile_for(shot)
            if int(profile.get("steps", 0)) not in {12, 15, 20}:
                errors.append(f"{shot_id}: steps 仅允许 12、15、20")
            if int(profile.get("steps", 0)) == 12 and not self.data.get("production", {}).get("fast_profile_approved"):
                errors.append(f"{shot_id}: 12步尚未通过 A/B，不允许使用")
            for dimension in ("width", "height"):
                value = int(profile.get(dimension, 0))
                if value < 32 or value % 32:
                    errors.append(f"{shot_id}: {dimension} 必须是大于等于32的32倍数")
            frames = int(profile.get("frames", 0))
            if frames < 124 or frames > 362 or frames % 17 != 5:
                errors.append(f"{shot_id}: frames 必须位于H3训练范围124–362并满足17k+5，例如124或243")
            trim_value = shot.get("narrative_trim_seconds")
            if trim_value is not None:
                try:
                    trim_seconds = Decimal(str(trim_value))
                    trim_frames = trim_seconds * 24
                    if not trim_seconds.is_finite() or trim_seconds <= 0:
                        raise InvalidOperation
                    if trim_frames != trim_frames.to_integral_value():
                        errors.append(
                            f"{shot_id}: narrative_trim_seconds 必须精确落在24fps整数帧边界"
                        )
                    elif int(trim_frames) >= frames:
                        errors.append(
                            f"{shot_id}: narrative_trim_seconds 必须短于H3原始{frames}帧候选"
                        )
                except (InvalidOperation, ValueError):
                    errors.append(f"{shot_id}: narrative_trim_seconds 必须是有限正数")
            errors.extend(composite_intent_errors(shot))
            errors.extend(motion_phase_errors(self, shot))

            start = self.path_for(shot.get("start_image"))
            end = self.path_for(shot.get("end_image"))
            source = self.path_for(shot.get("source_path"))
            predecessor = shot.get("continues_from")
            if workflow == "continuation":
                if not predecessor or predecessor not in known:
                    errors.append(f"{shot_id}: continuation 必须指定有效 continues_from")
                if start:
                    errors.append(f"{shot_id}: continuation 不得固定 start_image，必须使用前段真实尾帧")
            elif workflow in {"i2v", "first_last"} and not start:
                errors.append(f"{shot_id}: {workflow} 必须指定 start_image")
            if workflow == "first_last" and not end:
                errors.append(f"{shot_id}: first_last 必须指定 end_image")
            reference_images = list(shot.get("reference_images") or [])
            reference_videos = list(shot.get("reference_videos") or [])
            reference_audios = list(shot.get("reference_audios") or [])
            errors.extend(
                reference_map_errors(
                    shot,
                    required=bool(production.get("reference_map_required")) and workflow == "reference",
                )
            )
            if workflow == "reference" and not (reference_images or reference_videos):
                errors.append(f"{shot_id}: reference 至少需要一张 reference_images 或一段 reference_videos")
            if len(reference_images) > 9:
                errors.append(f"{shot_id}: reference_images 最多9张")
            if len(reference_videos) > 3:
                errors.append(f"{shot_id}: reference_videos 最多3段")
            if len(reference_audios) > 3:
                errors.append(f"{shot_id}: reference_audios 最多3段")
            if len(reference_images) + len(reference_videos) + len(reference_audios) > 12:
                errors.append(f"{shot_id}: reference 图片/视频/音频合计最多12个文件")
            reference_image_size = str(shot.get("reference_image_size") or "")
            if reference_image_size and reference_image_size not in {"match", "max"}:
                errors.append(f"{shot_id}: reference_image_size 只能是 match 或 max")
            identity_reference_value = str(shot.get("identity_reference") or "")
            identity_critical = bool(shot.get("identity_critical"))
            if preproduction_priority == "generation-first-v1" and identity_critical:
                if workflow not in {"reference", "continuation"}:
                    errors.append(f"{shot_id}: generation-first-v1 的身份关键镜头必须使用 reference 或 continuation")
                if workflow == "reference" and identity_reference_value not in [str(item) for item in reference_images]:
                    errors.append(f"{shot_id}: identity_reference 必须同时列入 reference_images，确保真正进入Ref2VA")
                if workflow == "reference" and reference_image_size == "match":
                    errors.append(f"{shot_id}: 身份关键Ref2VA不得显式使用 match；省略或设置 max")
            if check_files:
                for label, path in (("start_image", start), ("end_image", end), ("source_path", source)):
                    if path and not path.is_file():
                        errors.append(f"{shot_id}: {label} 文件不存在：{path}")
                identity_reference = self.path_for(shot.get("identity_reference"))
                if identity_reference and not identity_reference.is_file():
                    errors.append(f"{shot_id}: identity_reference 文件不存在：{identity_reference}")
                for value in shot.get("reference_images") or []:
                    path = self.path_for(str(value))
                    if not path or not path.is_file():
                        errors.append(f"{shot_id}: reference_images 文件不存在：{path}")
                for value in shot.get("reference_videos") or []:
                    path = self.path_for(str(value))
                    if not path or not path.is_file():
                        errors.append(f"{shot_id}: reference_videos 文件不存在：{path}")
                for value in shot.get("reference_audios") or []:
                    path = self.path_for(str(value))
                    if not path or not path.is_file():
                        errors.append(f"{shot_id}: reference_audios 文件不存在：{path}")

        errors.extend(_dependency_errors(shots, order))
        representative = self.data.get("production", {}).get("representative_shot")
        if representative and representative not in known:
            errors.append("production.representative_shot 不在 shots 中")
        if self.data.get("production", {}).get("model_audio") != "strip":
            errors.append("production.model_audio 必须为 strip，禁止H3原生语音进入母版")
        return errors

    def fingerprint(self) -> str:
        normalized = yaml.safe_dump(self.data, allow_unicode=True, sort_keys=True).encode("utf-8")
        return hashlib.sha256(normalized).hexdigest()

    def write(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(yaml.safe_dump(self.data, allow_unicode=True, sort_keys=False), encoding="utf-8")


def prompt_contract_errors(shot: dict[str, Any], contract: str) -> list[str]:
    if contract != "official-h3-v1":
        return []
    shot_id = str(shot.get("id", "<unknown>"))
    workflow = str(shot.get("workflow") or "")
    prompt = str(shot.get("prompt") or "").strip()
    if not prompt:
        return []
    fields = OFFICIAL_REFERENCE_FIELDS if workflow == "reference" else OFFICIAL_BASE_FIELDS
    positions = [prompt.find(field) for field in fields]
    errors: list[str] = []
    missing = [field for field, position in zip(fields, positions) if position < 0]
    if missing:
        errors.append(f"{shot_id}: official-h3-v1 prompt 缺少字段：{', '.join(missing)}")
    elif positions != sorted(positions):
        errors.append(f"{shot_id}: official-h3-v1 prompt 字段顺序不符合官方规范")
    if workflow in {"i2v", "continuation"} and not prompt.startswith(
        "For the target video, at 0.00 seconds into the target video,"
    ):
        errors.append(f"{shot_id}: I2VA/continuation prompt 必须以官方0.00秒首帧对齐指令开头")
    if workflow == "first_last" and not prompt.startswith("How the reference pictures align with the target video"):
        errors.append(f"{shot_id}: FL2VA prompt 必须以官方首尾帧对齐指令开头")
    if workflow == "reference":
        for index, _ in enumerate(shot.get("reference_images") or [], start=1):
            if f"<Picture {index}>" not in prompt:
                errors.append(f"{shot_id}: Ref2VA prompt 未引用 <Picture {index}>")
        for index, _ in enumerate(shot.get("reference_videos") or [], start=1):
            if f"<Video {index}>" not in prompt:
                errors.append(f"{shot_id}: Ref2VA prompt 未引用 <Video {index}>")
        for index, _ in enumerate(shot.get("reference_audios") or [], start=1):
            if f"<Audio {index}>" not in prompt:
                errors.append(f"{shot_id}: Ref2VA prompt 未引用 <Audio {index}>")
    return errors


def subject_roi_errors(shot: dict[str, Any]) -> list[str]:
    """subject_roi is an optional (x, y, width, height) rect in 0..1 fractions."""
    value = shot.get("subject_roi")
    if value is None:
        return []
    shot_id = str(shot.get("id", "<unknown>"))
    if not isinstance(value, dict):
        return [f"{shot_id}: subject_roi 必须是包含 x/y/width/height 的映射（0..1比例）"]
    numbers: dict[str, float] = {}
    errors: list[str] = []
    for key in ("x", "y", "width", "height"):
        raw = value.get(key)
        if isinstance(raw, bool) or not isinstance(raw, (int, float)):
            errors.append(f"{shot_id}: subject_roi.{key} 必须是数值")
        else:
            numeric = float(raw)
            if not math.isfinite(numeric):
                errors.append(f"{shot_id}: subject_roi.{key} 必须是有限数值")
            else:
                numbers[key] = numeric
    if errors:
        return errors
    if numbers["x"] < 0 or numbers["y"] < 0:
        errors.append(f"{shot_id}: subject_roi 起点不能为负")
    if numbers["width"] <= 0 or numbers["height"] <= 0:
        errors.append(f"{shot_id}: subject_roi 宽高必须为正")
    if numbers["x"] + numbers["width"] > 1.001 or numbers["y"] + numbers["height"] > 1.001:
        errors.append(f"{shot_id}: subject_roi 超出画面范围（0..1比例）")
    return errors


def motion_phase_review_intent_errors(project: Any, shot: dict[str, Any]) -> list[str]:
    """Validate every shot field consumed by versioned phase review intent."""
    if shot.get("motion_phases") is None:
        return []
    shot_id = str(shot.get("id", "<unknown>"))
    errors = [*motion_phase_errors(project, shot), *subject_roi_errors(shot)]
    qa = project.data.get("qa", {})
    roi_threshold = shot.get("subject_roi_min_rms", qa.get("subject_motion_rms", 0.02))
    try:
        numeric_roi_threshold = float(roi_threshold)
        if not math.isfinite(numeric_roi_threshold) or numeric_roi_threshold <= 0:
            raise ValueError
    except (TypeError, ValueError):
        errors.append(f"{shot_id}: phase review要求subject_roi_min_rms/qa.subject_motion_rms为有限正数")
    output_fps = project.data.get("output", {}).get("fps", 24)
    if isinstance(output_fps, bool) or not isinstance(output_fps, int) or output_fps != 24:
        errors.append(f"{shot_id}: phase review要求output.fps为整数24")
    return errors


def reference_map_errors(shot: dict[str, Any], *, required: bool = False) -> list[str]:
    """Validate semantic roles without duplicating the ordered reference paths."""
    value = shot.get("reference_map")
    shot_id = str(shot.get("id", "<unknown>"))
    expected = {
        *(f"<Picture {index}>" for index, _ in enumerate(shot.get("reference_images") or [], start=1)),
        *(f"<Video {index}>" for index, _ in enumerate(shot.get("reference_videos") or [], start=1)),
        *(f"<Audio {index}>" for index, _ in enumerate(shot.get("reference_audios") or [], start=1)),
    }
    if value is None:
        return [f"{shot_id}: reference workflow 必须提供 reference_map，明确每个参考只控制什么"] if required else []
    if not isinstance(value, dict):
        return [f"{shot_id}: reference_map 必须是以 <Picture/Video/Audio N> 为键的映射"]
    errors: list[str] = []
    labels = {str(label) for label in value}
    missing = sorted(expected - labels)
    unknown = sorted(labels - expected)
    if missing:
        errors.append(f"{shot_id}: reference_map 缺少标签：{', '.join(missing)}")
    if unknown:
        errors.append(f"{shot_id}: reference_map 包含不存在的标签：{', '.join(unknown)}")
    for label, entry in value.items():
        if not isinstance(entry, dict):
            errors.append(f"{shot_id}: reference_map.{label} 必须是映射")
            continue
        controls = entry.get("controls")
        if isinstance(controls, str):
            controls = [controls]
        if not isinstance(controls, list) or not controls or any(not str(item).strip() for item in controls):
            errors.append(f"{shot_id}: reference_map.{label}.controls 必须是非空字符串列表")
        mode = entry.get("mode")
        if mode is not None and not str(mode).strip():
            errors.append(f"{shot_id}: reference_map.{label}.mode 不能为空")
    return errors


def _dependency_errors(shots: list[dict[str, Any]], order: list[str]) -> list[str]:
    errors: list[str] = []
    positions = {shot_id: index for index, shot_id in enumerate(order)}
    edges: dict[str, str] = {}
    for shot in shots:
        shot_id = str(shot.get("id"))
        predecessor = shot.get("continues_from")
        if predecessor:
            edges[shot_id] = str(predecessor)
            if predecessor in positions and positions[predecessor] >= positions.get(shot_id, -1):
                errors.append(f"{shot_id}: continues_from 必须在 timeline.order 中排在当前镜头之前")
    for start in edges:
        seen: set[str] = set()
        cursor = start
        while cursor in edges:
            if cursor in seen:
                errors.append(f"镜头依赖存在循环：{start}")
                break
            seen.add(cursor)
            cursor = edges[cursor]
    return errors


def load_project(project_root: Path, path: Path | None = None) -> H3Project:
    root = project_root.expanduser().resolve()
    project_path = path or root / "工程" / "video_project.yaml"
    if not project_path.is_file():
        raise ProjectError(f"缺少H3项目定义：{project_path}。先运行 `svd h3 init --project ...`")
    payload = yaml.safe_load(project_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ProjectError(f"无效YAML：{project_path}")
    return H3Project(root=root, path=project_path, data=payload)


def initialize_project(project_root: Path, title: str, *, force: bool = False) -> H3Project:
    root = project_root.expanduser().resolve()
    path = root / "工程" / "video_project.yaml"
    if path.exists() and not force:
        raise ProjectError(f"项目定义已存在：{path}")
    project = H3Project(root=root, path=path, data=default_project(title))
    project.write()
    return project


def build_run_manifest(project: H3Project, run_id: str, task_records: list[dict[str, Any]]) -> dict[str, Any]:
    project_data = project.data.get("project", {})
    production = project.data.get("production", {})
    budget = production.get("budget") or {}
    if not budget:
        budget = {
            "approved": bool(production.get("cloud_budget_approved", False)),
            "limit": float(production.get("cloud_budget_cny", 0) or 0),
            "currency": "CNY",
        }
    return {
        "schema_version": int(project.data.get("schema_version", 1) or 1),
        "run_id": run_id,
        "project_id": project.project_id,
        "project_title": project.title,
        "project_fingerprint": project.fingerprint(),
        "created_at": utc_now(),
        "pipeline": str(project_data.get("pipeline") or "cinematic-brand"),
        "display": project_data.get("privacy", {}),
        "production": production,
        "budget": budget,
        "sources": project.data.get("sources", []),
        "tasks": task_records,
    }


def copy_asset(source: Path, assets_dir: Path, preferred_name: str) -> str:
    digest = hashlib.sha256(source.read_bytes()).hexdigest()[:10]
    safe = re.sub(r"[^A-Za-z0-9._-]+", "-", preferred_name).strip("-")
    name = f"{digest}-{safe or source.name}"
    target = assets_dir / name
    if not target.exists():
        shutil.copy2(source, target)
    return name
