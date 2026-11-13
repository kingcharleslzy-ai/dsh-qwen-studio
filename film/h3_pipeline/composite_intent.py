from __future__ import annotations

import hashlib
import json
import re
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
from typing import Any


COMPOSITE_VERSION = "ffmpeg-composite-v1"
COMPOSITE_KIND = "composite"
COMPOSITE_FPS = 24
COMPOSITE_AUDIO_POLICY = "strip"
COMPOSITE_RETIME_MODES = {"exact", "uniform"}
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def _positive_int(value: Any, label: str, *, allow_zero: bool = False) -> int:
    if isinstance(value, bool):
        raise ValueError(f"{label}必须是整数")
    try:
        result = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label}必须是整数") from exc
    if str(value).strip() != str(result):
        raise ValueError(f"{label}必须是整数")
    invalid = result < 0 if allow_zero else result <= 0
    if invalid:
        qualifier = "非负" if allow_zero else "正"
        raise ValueError(f"{label}必须是{qualifier}整数")
    return result


def normalize_composite_intent(value: Any) -> dict[str, Any]:
    """Return the canonical, declarative FFmpeg composite graph from YAML.

    Paths and SHA-256 values are deliberately part of stable project intent.
    This prevents an identically named candidate, a later file replacement, or
    an opaque hand-edited clip from satisfying the declared composite.
    """
    if not isinstance(value, dict):
        raise ValueError("composite必须是映射")
    unknown_root = sorted(
        set(value) - {"version", "output_fps", "output_frames", "audio_policy", "segments", "transition"}
    )
    if unknown_root:
        raise ValueError(f"composite包含未知字段：{', '.join(unknown_root)}")
    version = str(value.get("version") or "")
    if version != COMPOSITE_VERSION:
        raise ValueError(f"composite.version仅支持{COMPOSITE_VERSION}")
    output_fps = _positive_int(value.get("output_fps"), "composite.output_fps")
    if output_fps != COMPOSITE_FPS:
        raise ValueError(f"composite.output_fps必须为{COMPOSITE_FPS}")
    audio_policy = str(value.get("audio_policy") or "")
    if audio_policy != COMPOSITE_AUDIO_POLICY:
        raise ValueError("composite.audio_policy必须为strip")
    output_frames = _positive_int(value.get("output_frames"), "composite.output_frames")
    segments = value.get("segments")
    if not isinstance(segments, list) or len(segments) < 2:
        raise ValueError("composite.segments至少需要两个片段")

    normalized_segments: list[dict[str, Any]] = []
    for index, segment in enumerate(segments, start=1):
        label = f"composite.segments[{index}]"
        if not isinstance(segment, dict):
            raise ValueError(f"{label}必须是映射")
        unknown_segment = sorted(
            set(segment)
            - {
                "candidate_id", "source_path", "source_sha256", "start_frame",
                "end_frame", "output_frames", "retime",
            }
        )
        if unknown_segment:
            raise ValueError(f"{label}包含未知字段：{', '.join(unknown_segment)}")
        candidate_id = str(segment.get("candidate_id") or "").strip()
        source_path = str(segment.get("source_path") or "").strip()
        source_sha256 = str(segment.get("source_sha256") or "").strip().lower()
        if not candidate_id:
            raise ValueError(f"{label}.candidate_id不能为空")
        if not source_path:
            raise ValueError(f"{label}.source_path不能为空")
        if (
            Path(source_path).is_absolute()
            or "\\" in source_path
            or "//" in source_path
            or any(part in {"", ".", ".."} for part in source_path.split("/"))
        ):
            raise ValueError(
                f"{label}.source_path必须是规范的项目内POSIX相对路径，"
                "不得含./、..、反斜杠或重复斜杠"
            )
        if not SHA256_RE.fullmatch(source_sha256):
            raise ValueError(f"{label}.source_sha256必须是64位小写SHA256")
        start_frame = _positive_int(segment.get("start_frame"), f"{label}.start_frame", allow_zero=True)
        end_frame = _positive_int(segment.get("end_frame"), f"{label}.end_frame")
        if end_frame <= start_frame:
            raise ValueError(f"{label}.end_frame必须大于start_frame")
        segment_output_frames = _positive_int(segment.get("output_frames"), f"{label}.output_frames")
        retime = str(segment.get("retime") or "exact")
        if retime not in COMPOSITE_RETIME_MODES:
            raise ValueError(
                f"{label}.retime仅支持{', '.join(sorted(COMPOSITE_RETIME_MODES))}"
            )
        source_frames = end_frame - start_frame
        if retime == "exact" and segment_output_frames != source_frames:
            raise ValueError(
                f"{label}.retime=exact时output_frames必须等于截取帧数{source_frames}"
            )
        normalized_segments.append({
            "candidate_id": candidate_id,
            "source_path": source_path,
            "source_sha256": source_sha256,
            "start_frame": start_frame,
            "end_frame": end_frame,
            "output_frames": segment_output_frames,
            "retime": retime,
        })
    transition_value = value.get("transition")
    transition: dict[str, Any] | None = None
    if transition_value is not None:
        if not isinstance(transition_value, dict):
            raise ValueError("composite.transition必须是映射")
        unknown_transition = sorted(
            set(transition_value) - {"type", "name", "duration_frames", "offset_frames"}
        )
        if unknown_transition:
            raise ValueError(
                f"composite.transition包含未知字段：{', '.join(unknown_transition)}"
            )
        transition_type = str(transition_value.get("type") or "")
        transition_name = str(transition_value.get("name") or "")
        if transition_type != "xfade" or transition_name != "fade":
            raise ValueError("composite.transition当前仅支持type=xfade、name=fade")
        if len(normalized_segments) != 2:
            raise ValueError("xfade composite当前必须正好包含两个segments")
        duration_frames = _positive_int(
            transition_value.get("duration_frames"),
            "composite.transition.duration_frames",
        )
        offset_frames = _positive_int(
            transition_value.get("offset_frames"),
            "composite.transition.offset_frames",
            allow_zero=True,
        )
        first_frames = int(normalized_segments[0]["output_frames"])
        second_frames = int(normalized_segments[1]["output_frames"])
        if duration_frames >= min(first_frames, second_frames):
            raise ValueError("composite.transition.duration_frames必须短于两侧片段")
        if offset_frames + duration_frames != first_frames:
            raise ValueError(
                "xfade必须覆盖第一段尾部：offset_frames + duration_frames "
                f"必须等于第一段{first_frames}帧"
            )
        transition = {
            "type": transition_type,
            "name": transition_name,
            "duration_frames": duration_frames,
            "offset_frames": offset_frames,
        }
        actual_output_frames = offset_frames + second_frames
    else:
        actual_output_frames = sum(item["output_frames"] for item in normalized_segments)
    if actual_output_frames != output_frames:
        raise ValueError(
            "composite.output_frames与segments/transition计算结果不一致："
            f"expected={output_frames} actual={actual_output_frames}"
        )
    normalized = {
        "version": version,
        "output_fps": output_fps,
        "output_frames": output_frames,
        "audio_policy": audio_policy,
        "segments": normalized_segments,
    }
    if transition is not None:
        normalized["transition"] = transition
    return normalized


def canonical_sha256(value: Any) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def build_edit_graph(intent: dict[str, Any]) -> dict[str, Any]:
    """Build the canonical executable graph that is persisted in provenance."""
    fps = int(intent["output_fps"])
    filters: list[str] = []
    labels: list[str] = []
    for index, segment in enumerate(intent["segments"]):
        source_frames = int(segment["end_frame"]) - int(segment["start_frame"])
        output_frames = int(segment["output_frames"])
        chain = [
            f"trim=start_frame={segment['start_frame']}:end_frame={segment['end_frame']}",
        ]
        if segment["retime"] == "uniform":
            factor = Fraction(output_frames, source_frames)
            if factor.numerator == 1:
                expression = f"(PTS-STARTPTS)/{factor.denominator}"
            else:
                expression = f"(PTS-STARTPTS)*{factor.numerator}/{factor.denominator}"
            chain.append(f"setpts={expression}")
        else:
            chain.append("setpts=PTS-STARTPTS")
        chain.append(f"fps={fps}")
        label = f"seg{index}"
        filters.append(f"[{index}:v]{','.join(chain)}[{label}]")
        labels.append(f"[{label}]")
    transition = intent.get("transition")
    if transition:
        duration_seconds = format(
            Decimal(int(transition["duration_frames"])) / Decimal(fps),
            "f",
        )
        offset_seconds = format(
            Decimal(int(transition["offset_frames"])) / Decimal(fps),
            "f",
        )
        join = (
            f"{labels[0]}{labels[1]}xfade=transition={transition['name']}:"
            f"duration={duration_seconds}:offset={offset_seconds}"
        )
    else:
        join = f"{''.join(labels)}concat=n={len(labels)}:v=1:a=0"
    filters.append(
        f"{join},fps={fps},trim=end_frame={intent['output_frames']},"
        f"setpts=PTS-STARTPTS,format=yuv420p[v]"
    )
    filter_complex = ";".join(filters)
    return {
        "version": COMPOSITE_VERSION,
        "inputs": [
            {
                "index": index,
                "candidate_id": segment["candidate_id"],
                "source_path": segment["source_path"],
                "source_sha256": segment["source_sha256"],
            }
            for index, segment in enumerate(intent["segments"])
        ],
        "filter_complex": filter_complex,
        "map": "[v]",
        "encoder": {
            "codec": "libx264",
            "preset": "slow",
            "crf": 14,
            "pixel_format": "yuv420p",
            "fps": fps,
            "fps_mode": "cfr",
            "audio": "none",
            "metadata": "ffmpeg-default",
            "chapters": "ffmpeg-default",
            "movflags": "+faststart",
        },
        "output_frames": int(intent["output_frames"]),
        "transition": transition,
    }


def composite_intent_errors(shot: dict[str, Any]) -> list[str]:
    value = shot.get("composite")
    if value is None:
        return []
    shot_id = str(shot.get("id") or "<unknown>")
    errors: list[str] = []
    if shot.get("narrative_trim_seconds") is not None:
        errors.append(f"{shot_id}: composite与narrative_trim_seconds不能同时配置")
    try:
        normalize_composite_intent(value)
    except ValueError as exc:
        errors.append(f"{shot_id}: {exc}")
    return errors
