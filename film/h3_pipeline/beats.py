from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


# Structured action beats: shot["action"]["beats"] is an optional list of
# {"start": seconds, "end": seconds, "action": str, "result": str, "speed": str}.
# Structural contradictions (overlap, out of range, missing fields) are ERROR and
# block validation. Anything requiring semantic judgement is WARN only: the
# checker never pretends to decide creative correctness.

BEAT_REQUIRED_FIELDS = ("start", "end", "action")
GAP_TOLERANCE_SECONDS = 0.25
TAIL_TOLERANCE_SECONDS = 0.5
OVERLONG_BEAT_SECONDS = 3.0
OVERLONG_BEAT_RATIO = 0.6
LEGACY_PROMPT_OVERLONG_CHARS = 600
OFFICIAL_BASE_PROMPT_OVERLONG_CHARS = 2400
OFFICIAL_REFERENCE_PROMPT_OVERLONG_CHARS = 5000

SPEED_KEYWORDS = (
    "缓慢", "缓缓", "慢", "匀速", "中速", "自然", "快", "迅速", "急速", "轻",
    "slow", "fast", "quick", "rapid", "natural", "gentle", "steady",
)
IDENTITY_RISK_KEYWORDS = (
    "大笑", "张嘴", "露齿", "咧嘴", "咬牙", "转头", "回头", "摇头", "甩头",
    "laugh", "open mouth", "mouth open", "teeth", "grin", "turn head", "head turn", "look back", "shake head",
)


@dataclass(frozen=True)
class BeatIssue:
    shot_id: str
    severity: str
    code: str
    detail: str


def _shot_duration_seconds(project: Any, shot: dict[str, Any]) -> float:
    composite = shot.get("composite")
    if isinstance(composite, dict):
        try:
            fps = float(composite.get("output_fps") or 0)
            frames = float(composite.get("output_frames") or 0)
            if fps > 0 and frames > 0:
                return frames / fps
        except (TypeError, ValueError):
            pass
    trim = shot.get("narrative_trim_seconds")
    if trim is not None:
        try:
            value = float(trim)
            if value > 0:
                return value
        except (TypeError, ValueError):
            pass
    profile = project.profile_for(shot)
    fps = float(profile.get("fps") or 24)
    frames = float(profile.get("frames") or 124)
    return frames / fps if fps > 0 else 0.0


def _beats_of(shot: dict[str, Any]) -> Any:
    action = shot.get("action") or {}
    return action.get("beats")


def _speed_declared(text: str) -> bool:
    lowered = text.lower()
    return any(keyword in lowered for keyword in SPEED_KEYWORDS)


def _identity_relevant(shot: dict[str, Any]) -> bool:
    if shot.get("identity_critical"):
        return True
    return str(shot.get("workflow")) == "reference"


def _identity_risk_text(shot: dict[str, Any]) -> str:
    action = shot.get("action") or {}
    parts = [str(shot.get("prompt") or "")]
    parts.extend(str(action.get(field) or "") for field in ("subject", "camera", "start_state", "end_state"))
    beats = _beats_of(shot)
    if isinstance(beats, list):
        for beat in beats:
            if isinstance(beat, dict):
                parts.append(str(beat.get("action") or ""))
                parts.append(str(beat.get("result") or ""))
    return " ".join(parts).lower()


def _prompt_overlong_chars(project: Any, shot: dict[str, Any]) -> int:
    production = getattr(project, "data", {}).get("production", {})
    if str(production.get("prompt_contract") or "legacy") != "official-h3-v1":
        return LEGACY_PROMPT_OVERLONG_CHARS
    if str(shot.get("workflow") or "") == "reference":
        return OFFICIAL_REFERENCE_PROMPT_OVERLONG_CHARS
    return OFFICIAL_BASE_PROMPT_OVERLONG_CHARS


def check_shot_beats(project: Any, shot: dict[str, Any]) -> list[BeatIssue]:
    """Check one shot's structured beats. ERROR only for structural contradictions."""
    shot_id = str(shot.get("id") or "<unknown>")
    issues: list[BeatIssue] = []
    raw = _beats_of(shot)
    if raw is None:
        return issues
    if not isinstance(raw, list):
        issues.append(BeatIssue(shot_id, "ERROR", "beats_not_list", "action.beats 必须是列表"))
        return issues
    duration = _shot_duration_seconds(project, shot)
    frame_epsilon = 0.051
    parsed: list[tuple[int, float, float, dict[str, Any]]] = []
    for index, beat in enumerate(raw):
        label = f"beats[{index}]"
        if not isinstance(beat, dict):
            issues.append(BeatIssue(shot_id, "ERROR", "beat_not_object", f"{label} 必须是对象"))
            continue
        missing = [field for field in BEAT_REQUIRED_FIELDS if field not in beat]
        if missing:
            issues.append(BeatIssue(shot_id, "ERROR", "beat_missing_field", f"{label} 缺少字段：{', '.join(missing)}"))
            continue
        try:
            start, end = float(beat["start"]), float(beat["end"])
        except (TypeError, ValueError):
            issues.append(BeatIssue(shot_id, "ERROR", "beat_time_invalid", f"{label} start/end 必须是秒数"))
            continue
        if not str(beat.get("action") or "").strip():
            issues.append(BeatIssue(shot_id, "ERROR", "beat_missing_field", f"{label} action 不能为空"))
            continue
        if end <= start:
            issues.append(BeatIssue(shot_id, "ERROR", "beat_time_invalid", f"{label} end 必须大于 start"))
            continue
        if start < -frame_epsilon or (duration and end > duration + frame_epsilon):
            issues.append(BeatIssue(
                shot_id, "ERROR", "beat_out_of_range",
                f"{label} {start:.2f}-{end:.2f}s 超出镜头时长 0-{duration:.2f}s",
            ))
            continue
        parsed.append((index, start, end, beat))
    parsed.sort(key=lambda item: (item[1], item[2]))
    for position in range(1, len(parsed)):
        previous, current = parsed[position - 1], parsed[position]
        if current[1] < previous[2] - frame_epsilon:
            issues.append(BeatIssue(
                shot_id, "ERROR", "beat_overlap",
                f"beats[{previous[0]}] 与 beats[{current[0]}] 时间段重叠：{previous[1]:.2f}-{previous[2]:.2f}s 与 {current[1]:.2f}-{current[2]:.2f}s",
            ))
    if any(issue.code == "beat_overlap" for issue in issues):
        return issues
    for position in range(1, len(parsed)):
        previous, current = parsed[position - 1], parsed[position]
        gap = current[1] - previous[2]
        if gap > GAP_TOLERANCE_SECONDS:
            issues.append(BeatIssue(
                shot_id, "WARN", "beat_gap",
                f"beats[{previous[0]}] 与 beats[{current[0]}] 之间存在 {gap:.2f}s 未定义时间段；若有意留白请在复盘中说明",
            ))
    if parsed:
        first, last = parsed[0], parsed[-1]
        if first[1] > GAP_TOLERANCE_SECONDS:
            issues.append(BeatIssue(shot_id, "WARN", "beat_gap", f"镜头开头 {first[1]:.2f}s 未定义动作"))
        if duration and last[2] < duration - TAIL_TOLERANCE_SECONDS:
            issues.append(BeatIssue(shot_id, "WARN", "beat_gap", f"镜头结尾 {duration - last[2]:.2f}s 未定义动作"))
    overlong_limit = max(OVERLONG_BEAT_SECONDS, OVERLONG_BEAT_RATIO * duration) if duration else OVERLONG_BEAT_SECONDS
    for index, start, end, beat in parsed:
        length = end - start
        if length > overlong_limit:
            issues.append(BeatIssue(
                shot_id, "WARN", "beat_overlong",
                f"beats[{index}] 单一动作持续 {length:.2f}s（占比 {length / duration:.0%}），建议拆分或明确速度变化" if duration else f"beats[{index}] 动作过长",
            ))
        if not str(beat.get("result") or "").strip():
            issues.append(BeatIssue(shot_id, "WARN", "beat_missing_result", f"beats[{index}] 缺少可见动作结果 result"))
        if not str(beat.get("speed") or "").strip() and not _speed_declared(str(beat.get("action") or "")):
            issues.append(BeatIssue(shot_id, "WARN", "beat_speed_unclear", f"beats[{index}] 动作速度不明确，建议填写 speed 或在动作中说明"))
    return issues


def check_shot_semantics(project: Any, shot: dict[str, Any]) -> list[BeatIssue]:
    """Heuristic WARN-only checks: state conflicts, identity risk, prompt bloat."""
    shot_id = str(shot.get("id") or "<unknown>")
    issues: list[BeatIssue] = []
    action = shot.get("action") or {}
    start_state = re.sub(r"\s+", "", str(action.get("start_state") or ""))
    end_state = re.sub(r"\s+", "", str(action.get("end_state") or ""))
    if start_state and end_state and start_state == end_state:
        issues.append(BeatIssue(shot_id, "WARN", "state_conflict", "start_state 与 end_state 完全相同，动作结果不可见"))
    raw = _beats_of(shot)
    if isinstance(raw, list) and raw and isinstance(raw[0], dict):
        first_action = re.sub(r"\s+", "", str(raw[0].get("action") or ""))
        if start_state and first_action and len(first_action) >= 6 and (first_action in start_state or start_state in first_action):
            issues.append(BeatIssue(shot_id, "WARN", "state_conflict", "首个 beat 动作与 start_state 疑似重复/冲突：动作应从初始状态之后开始"))
    prompt = str(shot.get("prompt") or "")
    if len(prompt) > _prompt_overlong_chars(project, shot):
        issues.append(BeatIssue(shot_id, "WARN", "prompt_overlong", f"提示词 {len(prompt)} 字符过长；目标是时间轴清楚、动作可执行，建议把动作分解到 action.beats"))
    if _identity_relevant(shot):
        text = _identity_risk_text(shot)
        hits = sorted({keyword for keyword in IDENTITY_RISK_KEYWORDS if keyword in text})
        if hits:
            issues.append(BeatIssue(
                shot_id, "WARN", "identity_risk_action",
                f"人物身份关键镜头包含高风险面部/头部动作：{', '.join(hits)}；生成后必须由当前Agent视觉审片核对身份一致性",
            ))
    return issues


def check_project_action(project: Any) -> list[BeatIssue]:
    """All action checks for a project, including beats-adoption reminders."""
    issues: list[BeatIssue] = []
    for shot in project.shots:
        shot_id = str(shot.get("id") or "<unknown>")
        issues.extend(check_shot_beats(project, shot))
        issues.extend(check_shot_semantics(project, shot))
        if _beats_of(shot) is None and not project.path_for(shot.get("source_path")):
            issues.append(BeatIssue(shot_id, "WARN", "beats_missing", "未配置结构化 action.beats，动作时间轴无法自动核对"))
    order = {"ERROR": 0, "WARN": 1}
    return sorted(issues, key=lambda issue: (order.get(issue.severity, 2), issue.shot_id, issue.code))


def beat_structure_errors(project: Any, shot: dict[str, Any]) -> list[str]:
    """ERROR-level beat problems for validate(): only unambiguous structural defects."""
    return [f"{issue.shot_id}: {issue.detail}" for issue in check_shot_beats(project, shot) if issue.severity == "ERROR"]
