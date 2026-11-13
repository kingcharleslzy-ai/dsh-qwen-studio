from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat

from .facecheck import aggregate_observations, face_config, identity_reference_for, observations_as_dicts, resolve_backend
from .ledger import accepted_source_path, candidate_for_shot_intent
from .project import H3Project, ProjectError, motion_phase_review_intent_errors, shot_output_frames


@dataclass
class Check:
    name: str
    status: str
    detail: str
    shot_id: str | None = None


def command(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=False, capture_output=True, text=True, encoding="utf-8", errors="replace")


def require_media_tools() -> None:
    missing = [tool for tool in ("ffmpeg", "ffprobe") if not shutil.which(tool)]
    if missing:
        raise ProjectError(f"缺少媒体工具：{', '.join(missing)}")


def probe(path: Path, *, count_frames: bool = False) -> dict[str, Any]:
    args = ["ffprobe", "-v", "error"]
    if count_frames:
        args.append("-count_frames")
    args += ["-show_streams", "-show_format", "-of", "json", str(path)]
    result = command(args)
    if result.returncode != 0:
        raise ProjectError(result.stderr.strip() or f"ffprobe失败：{path}")
    return json.loads(result.stdout)


def video_stream(info: dict[str, Any]) -> dict[str, Any] | None:
    return next((stream for stream in info.get("streams", []) if stream.get("codec_type") == "video"), None)


def has_audio(info: dict[str, Any]) -> bool:
    return any(stream.get("codec_type") == "audio" for stream in info.get("streams", []))


def resolved_clip_path(project: H3Project, shot: dict[str, Any], clips_dir: Path) -> Path:
    """Use a hash-bound accepted source for QA, otherwise inspect the generated candidate."""
    source = accepted_source_path(project, shot)
    if source:
        return source
    candidate = candidate_for_shot_intent(project, shot)
    if candidate:
        candidate_path = project.path_for(candidate.get("source_path"))
        if candidate_path and candidate_path.is_file():
            return candidate_path
    if shot.get("narrative_trim_seconds") is not None or shot.get("composite") is not None:
        intent_name = "composite" if shot.get("composite") is not None else "narrative_trim_seconds"
        raise ProjectError(
            f"镜头 {shot.get('id')} 配置了{intent_name}，"
            "但没有与当前参数、edit graph及所有原候选path/SHA匹配的派生候选"
        )
    return clips_dir / f"{shot['id']}.mp4"


def fraction(value: str | None) -> float:
    if not value or value == "0/0":
        return 0.0
    numerator, denominator = value.split("/", 1)
    return float(numerator) / float(denominator)


def extract_frame(path: Path, target: Path, *, first: bool) -> None:
    args = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    if not first:
        args += ["-sseof", "-0.05"]
    args += ["-i", str(path), "-frames:v", "1", str(target)]
    result = command(args)
    if result.returncode != 0:
        raise ProjectError(result.stderr.strip() or f"提取帧失败：{path}")


def extract_frame_at_index(path: Path, target: Path, index: int) -> None:
    result = command([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(path),
        "-vf", f"select=eq(n\\,{index})", "-frames:v", "1", str(target),
    ])
    if result.returncode != 0 or not target.is_file():
        raise ProjectError(result.stderr.strip() or f"提取第{index}帧失败：{path}")


def normalized_rmse(left: Path, right: Path) -> float:
    a = Image.open(left).convert("RGB")
    b = Image.open(right).convert("RGB")
    if a.size != b.size:
        b = b.resize(a.size, Image.Resampling.LANCZOS)
    rms = ImageStat.Stat(ImageChops.difference(a, b)).rms
    return math.sqrt(sum(value * value for value in rms) / len(rms)) / 255.0


def sampled_motion_scores(
    path: Path,
    *,
    sample_fps: int = 4,
    crop_fraction: tuple[float, float, float, float] | None = None,
    start_frame: int | None = None,
    end_frame: int | None = None,
) -> list[float]:
    """Measure inter-frame change without treating tiny codec noise as action.

    crop_fraction is an optional (x, y, width, height) region in 0..1 fractions
    of the frame; the default is the historical center crop.
    """
    width, height = 192, 320
    filters: list[str] = []
    if start_frame is not None or end_frame is not None:
        start = 0 if start_frame is None else int(start_frame)
        trim = f"trim=start_frame={start}"
        if end_frame is not None:
            trim += f":end_frame={int(end_frame)}"
        filters += [trim, "setpts=PTS-STARTPTS"]
    filters += [f"fps={sample_fps}", f"scale={width}:{height}:flags=area", "format=gray"]
    result = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path),
            "-vf", ",".join(filters),
            "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1",
        ],
        check=False,
        capture_output=True,
    )
    if result.returncode != 0:
        raise ProjectError(result.stderr.decode("utf-8", errors="replace").strip() or f"动作检测失败：{path}")
    frame_size = width * height
    frames = [
        Image.frombytes("L", (width, height), result.stdout[offset : offset + frame_size])
        for offset in range(0, len(result.stdout) - frame_size + 1, frame_size)
    ]
    if len(frames) < 2:
        return []
    if crop_fraction is None:
        crop = (round(width * 0.15), round(height * 0.08), round(width * 0.85), round(height * 0.95))
    else:
        fx, fy, fw, fh = crop_fraction
        crop = (
            max(0, round(width * fx)),
            max(0, round(height * fy)),
            min(width, round(width * (fx + fw))),
            min(height, round(height * (fy + fh))),
        )
        if crop[2] <= crop[0] or crop[3] <= crop[1]:
            raise ProjectError(f"主体ROI超出画面范围：{crop_fraction}")
    return [
        ImageStat.Stat(ImageChops.difference(left.crop(crop), right.crop(crop))).rms[0] / 255.0
        for left, right in zip(frames, frames[1:])
    ]


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    scores = sorted(values)
    middle = len(scores) // 2
    return scores[middle] if len(scores) % 2 else (scores[middle - 1] + scores[middle]) / 2


def _motion_score_chunks(scores: list[float], window_size: int) -> list[list[float]]:
    """Build local windows without leaving a meaningless one-diff tail."""
    size = max(1, window_size)
    chunks = [list(scores[offset : offset + size]) for offset in range(0, len(scores), size)]
    if len(chunks) > 1 and len(chunks[-1]) < 2:
        chunks[-2].extend(chunks.pop())
    return chunks


def phase_native_frame_metrics(
    path: Path,
    start: int,
    end: int,
    *,
    crop_fraction: tuple[float, float, float, float] | None = None,
) -> dict[str, float | int]:
    """Decode a phase once and inspect every native frame, avoiding fps aliasing."""
    width, height = 192, 320
    filters = [
        f"trim=start_frame={start}:end_frame={end}",
        "setpts=PTS-STARTPTS",
        f"scale={width}:{height}:flags=area",
    ]
    if crop_fraction is not None:
        fx, fy, fw, fh = crop_fraction
        crop_x, crop_y = round(width * fx), round(height * fy)
        crop_width, crop_height = round(width * fw), round(height * fh)
        if crop_width <= 0 or crop_height <= 0:
            raise ProjectError(f"主体ROI尺寸无效：{crop_fraction}")
        filters.append(f"crop={crop_width}:{crop_height}:{crop_x}:{crop_y}")
        width, height = crop_width, crop_height
    filters.append("format=rgb24")
    frame_size = width * height * 3
    frame_count = 0
    anchor: Image.Image | None = None
    previous: Image.Image | None = None
    max_anchor = 0.0
    worst_anchor_frame = start
    max_adjacent = 0.0
    worst_adjacent_frame = start
    adjacent_values: list[float] = []

    def rmse(left: Image.Image, right: Image.Image) -> float:
        channels = ImageStat.Stat(ImageChops.difference(left, right)).rms
        return math.sqrt(sum(value * value for value in channels) / len(channels)) / 255.0

    with tempfile.TemporaryFile(prefix="svd-h3-phase-stderr-") as stderr_file:
        process = subprocess.Popen(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path),
                "-vf", ",".join(filters),
                "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
            ],
            stdout=subprocess.PIPE,
            stderr=stderr_file,
        )
        assert process.stdout is not None
        try:
            while True:
                payload = bytearray()
                while len(payload) < frame_size:
                    chunk = process.stdout.read(frame_size - len(payload))
                    if not chunk:
                        break
                    payload.extend(chunk)
                if not payload:
                    break
                if len(payload) != frame_size:
                    raise ProjectError(f"相位逐帧检测收到不完整帧：{path}")
                current = Image.frombytes("RGB", (width, height), bytes(payload))
                if anchor is None:
                    anchor = current
                else:
                    anchor_value = rmse(anchor, current)
                    if anchor_value > max_anchor:
                        max_anchor = anchor_value
                        worst_anchor_frame = start + frame_count
                if previous is not None:
                    adjacent = rmse(previous, current)
                    adjacent_values.append(adjacent)
                    if adjacent > max_adjacent:
                        max_adjacent = adjacent
                        worst_adjacent_frame = start + frame_count - 1
                previous = current
                frame_count += 1
            process.stdout.close()
            returncode = process.wait()
            stderr_file.seek(0, 2)
            stderr_size = stderr_file.tell()
            stderr_file.seek(max(0, stderr_size - 65536))
            stderr = stderr_file.read().decode("utf-8", errors="replace").strip()
            if returncode != 0:
                raise ProjectError(stderr or f"相位逐帧检测失败：{path}")
        finally:
            if not process.stdout.closed:
                process.stdout.close()
            if process.poll() is None:
                process.kill()
            process.wait()
    expected = end - start
    if frame_count != expected:
        raise ProjectError(f"相位逐帧检测解码{frame_count}帧，预期{expected}帧：{path}")
    return {
        "frame_count": frame_count,
        "max_anchor_drift": max_anchor,
        "worst_anchor_frame": worst_anchor_frame,
        "max_adjacent_motion": max_adjacent,
        "worst_adjacent_frame": worst_adjacent_frame,
        "median_adjacent_motion": _median(adjacent_values),
    }


def meaningful_motion_median(
    path: Path,
    *,
    sample_fps: int = 4,
    start_frame: int | None = None,
    end_frame: int | None = None,
) -> float:
    return _median(sampled_motion_scores(
        path, sample_fps=sample_fps, start_frame=start_frame, end_frame=end_frame,
    ))


def meaningful_motion_windows(
    path: Path,
    *,
    sample_fps: int = 4,
    window_seconds: int = 1,
    crop_fraction: tuple[float, float, float, float] | None = None,
    start_frame: int | None = None,
    end_frame: int | None = None,
) -> list[float]:
    scores = sampled_motion_scores(
        path,
        sample_fps=sample_fps,
        crop_fraction=crop_fraction,
        start_frame=start_frame,
        end_frame=end_frame,
    )
    window_size = max(1, sample_fps * window_seconds)
    return [_median(scores[index : index + window_size]) for index in range(0, len(scores), window_size)]


def roi_motion_median(path: Path, rect: tuple[float, float, float, float], *, sample_fps: int = 4) -> float:
    return _median(sampled_motion_scores(path, sample_fps=sample_fps, crop_fraction=rect))


SubjectRoiDetector = Any
ROI_BACKENDS: dict[str, SubjectRoiDetector] = {}


def register_roi_backend(name: str, detector: SubjectRoiDetector) -> None:
    """Register a pluggable subject detector for ROI motion QA.

    The detector receives (project, shot, clip_path) and returns an
    (x, y, width, height) rect in 0..1 fractions, or None when it cannot
    locate the subject. Detectors only steer WARN-level QA; they never
    approve a shot and must run fully local/offline.
    """
    ROI_BACKENDS[str(name)] = detector


def static_subject_roi(shot: dict[str, Any]) -> tuple[float, float, float, float] | None:
    value = shot.get("subject_roi")
    if not isinstance(value, dict):
        return None
    try:
        return (float(value["x"]), float(value["y"]), float(value["width"]), float(value["height"]))
    except (KeyError, TypeError, ValueError):
        return None


def resolve_subject_roi(project: H3Project, shot: dict[str, Any], clip_path: Path) -> tuple[tuple[float, float, float, float] | None, str | None]:
    """Resolve the per-shot subject ROI, preferring a configured detector backend.

    Returns (rect, note). rect is None when no ROI is available; note explains
    any backend fallback so the WARN-level check never pretends detection worked.
    """
    backend_name = shot.get("subject_roi_backend", project.data.get("qa", {}).get("subject_roi_backend"))
    static = static_subject_roi(shot)
    if not backend_name:
        return static, None
    detector = ROI_BACKENDS.get(str(backend_name))
    if detector is None:
        return static, f"主体ROI后端未注册：{backend_name}，回退到静态subject_roi"
    detected = detector(project, shot, clip_path)
    if detected is None:
        return static, f"主体ROI后端{backend_name}未检出主体，回退到静态subject_roi"
    return tuple(float(value) for value in detected), f"主体ROI由后端{backend_name}检测"


def cjk_chars(text: str) -> list[str]:
    return sorted({char for char in text if "\u3400" <= char <= "\u9fff"})


def font_charset_ranges(font_path: Path, index: int) -> list[tuple[int, int]] | None:
    """Return the selected TTC face's real cmap ranges when fontconfig is available.

    Pillow may silently draw a .notdef box for a missing glyph, so a non-empty
    raster mask is not sufficient for a delivery gate.
    """
    if not shutil.which("fc-query"):
        return None
    result = command(["fc-query", "--index", str(index), "--format=%{charset}", str(font_path)])
    if result.returncode != 0 or not result.stdout.strip():
        return None
    ranges: list[tuple[int, int]] = []
    for token in result.stdout.split():
        try:
            if "-" in token:
                start, end = token.split("-", 1)
                ranges.append((int(start, 16), int(end, 16)))
            else:
                value = int(token, 16)
                ranges.append((value, value))
        except ValueError:
            continue
    return ranges or None


def charset_contains(ranges: list[tuple[int, int]], char: str) -> bool:
    value = ord(char)
    return any(start <= value <= end for start, end in ranges)


def srt_seconds(value: str) -> float:
    hours, minutes, tail = value.replace(",", ".").split(":")
    return int(hours) * 3600 + int(minutes) * 60 + float(tail)


def parse_srt(path: Path) -> list[tuple[float, float, str]]:
    cues: list[tuple[float, float, str]] = []
    for block in re.split(r"\n\s*\n", path.read_text(encoding="utf-8").strip()):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        timing_index = next((index for index, line in enumerate(lines) if "-->" in line), None)
        if timing_index is None:
            continue
        start, end = [part.strip() for part in lines[timing_index].split("-->", 1)]
        text = "\n".join(lines[timing_index + 1 :])
        cues.append((srt_seconds(start), srt_seconds(end), text))
    return cues


def wrap_subtitle(text: str, width: int = 22) -> str:
    if "\n" in text:
        return text
    if not text or len(text) <= width:
        return text
    line_count = math.ceil(len(text) / width)
    balanced_width = math.ceil(len(text) / line_count)
    return "\n".join(text[index : index + balanced_width] for index in range(0, len(text), balanced_width))


def render_subtitle_layers(project: H3Project, srt: Path, width: int, height: int) -> list[tuple[float, float, Path]]:
    subtitles = project.data.get("subtitles", {})
    font_path = Path(str(subtitles.get("font_path") or ""))
    font_index = int(subtitles.get("font_index", 11))
    if not font_path.is_file():
        raise ProjectError(f"字幕字体不存在：{font_path}")
    font = ImageFont.truetype(str(font_path), size=max(44, round(height * 0.046)), index=font_index)
    target_dir = project.root / "生成图版素材" / "H3字幕图层"
    target_dir.mkdir(parents=True, exist_ok=True)
    rendered: list[tuple[float, float, Path]] = []
    for index, (start, end, text) in enumerate(parse_srt(srt), start=1):
        image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        max_chars = min(22, max(8, math.floor(width * 0.82 / font.size)))
        content = wrap_subtitle(text, width=max_chars)
        draw.multiline_text(
            (width / 2, height * 0.895), content, font=font, fill=(255, 255, 255, 255),
            stroke_width=max(3, round(height / 360)), stroke_fill=(0, 0, 0, 220), anchor="mm", align="center", spacing=10,
        )
        path = target_dir / f"subtitle-{index:03d}.png"
        image.save(path)
        rendered.append((start, end, path))
    return rendered


def glyph_check(project: H3Project) -> Check:
    subtitles = project.data.get("subtitles", {})
    srt = project.path_for(subtitles.get("srt"))
    if not srt:
        return Check("subtitle_glyphs", "SKIP", "项目未配置字幕")
    if not srt.is_file():
        return Check("subtitle_glyphs", "ERROR", f"字幕文件不存在：{srt}")
    font_path = Path(str(subtitles.get("font_path") or ""))
    if not font_path.is_file():
        return Check("subtitle_glyphs", "ERROR", f"字体文件不存在：{font_path}")
    index = int(subtitles.get("font_index", 11))
    font = ImageFont.truetype(str(font_path), size=48, index=index)
    chars = cjk_chars(srt.read_text(encoding="utf-8"))
    ranges = font_charset_ranges(font_path, index)
    missing = [char for char in chars if not charset_contains(ranges, char)] if ranges else [char for char in chars if font.getmask(char).getbbox() is None]
    if missing:
        return Check("subtitle_glyphs", "ERROR", f"PingFang SC索引{index}缺字：{'、'.join(missing)}")
    method = "字体cmap" if ranges else "字形栅格回退"
    return Check("subtitle_glyphs", "OK", f"PingFang SC索引{index}已用{method}覆盖{len(chars)}个唯一汉字")


def detect_black_and_freeze(path: Path) -> tuple[bool, bool, str]:
    result = command(
        [
            "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
            "-vf", "blackdetect=d=0.20:pix_th=0.04,freezedetect=n=-55dB:d=1.2", "-an", "-f", "null", "-",
        ]
    )
    log = result.stderr
    black = "black_start:" in log
    freeze = "freeze_start:" in log
    snippets = re.findall(r"(?:black_start|freeze_start):[^\r\n]+", log)
    return black, freeze, "; ".join(snippets[:4])


def motion_phase_checks(
    project: H3Project,
    shot: dict[str, Any],
    path: Path,
    actual_frames: int,
) -> list[Check]:
    """Run phase-aware motion QA after project validation has normalized intent."""
    phases = shot.get("motion_phases")
    if not isinstance(phases, list):
        return []
    shot_id = str(shot["id"])
    expected_frames = shot_output_frames(project, shot)
    if actual_frames != expected_frames:
        return [Check(
            "motion_phase_frames", "ERROR",
            f"实际成片{actual_frames}帧与motion_phases声明覆盖{expected_frames}帧不一致",
            shot_id,
        )]
    qa_config = project.data.get("qa", {})
    sample_fps = int(qa_config.get("motion_sample_fps", 4))
    motion_threshold_value = shot.get("minimum_motion_rms", qa_config.get("minimum_motion_rms"))
    window_threshold_value = shot.get(
        "minimum_motion_window_rms", qa_config.get("minimum_motion_window_rms")
    )
    continuity_threshold = float(qa_config.get("continuity_rmse_max", 0.04))
    checks: list[Check] = []
    with tempfile.TemporaryDirectory(prefix=f"svd-h3-motion-phases-{shot_id}-") as temp_value:
        temp = Path(temp_value)
        for index, phase in enumerate(phases):
            mode = str(phase["mode"])
            start, end = int(phase["start_frame"]), int(phase["end_frame"])
            label = f"{mode}[{start},{end})"
            if index > 0:
                previous_mode = str(phases[index - 1]["mode"])
                try:
                    boundary = phase_native_frame_metrics(path, start - 1, start + 1)
                    boundary_value = float(boundary["max_adjacent_motion"])
                    checks.append(Check(
                        "motion_phase_boundary",
                        "OK" if boundary_value <= continuity_threshold else "ERROR",
                        f"{previous_mode}->{mode} 边界 {start - 1}->{start} RMSE "
                        f"{boundary_value:.3%}，阈值{continuity_threshold:.1%}",
                        shot_id,
                    ))
                except ProjectError as exc:
                    checks.append(Check(
                        "motion_phase_boundary", "ERROR",
                        f"{previous_mode}->{mode} 边界无法逐帧检查：{exc}", shot_id,
                    ))
            if mode == "active":
                motion_threshold = float(motion_threshold_value)
                window_threshold = float(window_threshold_value)
                scores = sampled_motion_scores(
                    path, sample_fps=sample_fps, start_frame=start, end_frame=end,
                )
                score = _median(scores)
                enough_diffs = len(scores) >= 2
                checks.append(Check(
                    "motion_phase_active",
                    "OK" if enough_diffs and score >= motion_threshold else "ERROR",
                    f"{label} 相邻采样帧中位变化{score:.3%}，阈值{motion_threshold:.1%}；"
                    f"有效差分{len(scores)}（至少2）",
                    shot_id,
                ))
                chunks = _motion_score_chunks(scores, sample_fps)
                windows = [_median(chunk) for chunk in chunks]
                failed = [
                    window for window, (chunk, value) in enumerate(zip(chunks, windows))
                    if len(chunk) < 2 or value < window_threshold
                ]
                detail = (
                    "有效差分不足2，无法形成可靠局部窗" if not enough_diffs else
                    "未达标局部窗：" + ", ".join(
                        f"{window}={windows[window]:.3%}/差分{len(chunks[window])}" for window in failed
                    ) if failed else "所有局部动作窗达标"
                )
                checks.append(Check(
                    "motion_phase_active_windows", "OK" if enough_diffs and not failed else "ERROR",
                    f"{label} {detail}；阈值{window_threshold:.1%}", shot_id,
                ))
                continue
            if mode == "settle":
                try:
                    settle_metrics = phase_native_frame_metrics(path, start, end)
                except ProjectError as exc:
                    checks.append(Check(
                        "motion_phase_settle", "ERROR", f"{label} 无法逐帧检查：{exc}", shot_id,
                    ))
                    continue
                worst = float(settle_metrics["max_adjacent_motion"])
                worst_frame = int(settle_metrics["worst_adjacent_frame"])
                checks.append(Check(
                    "motion_phase_settle",
                    "OK" if worst <= continuity_threshold else "ERROR",
                    f"{label} 最大相邻帧RMSE {worst:.3%} @ {worst_frame}->{worst_frame + 1}，"
                    f"阈值{continuity_threshold:.1%}；逐帧检查{int(settle_metrics['frame_count'])}帧",
                    shot_id,
                ))
                continue
            try:
                metrics = phase_native_frame_metrics(path, start, end)
            except ProjectError as exc:
                checks.append(Check(
                    "motion_phase_hold", "ERROR", f"{label} 无法逐帧检查：{exc}", shot_id,
                ))
                continue
            max_anchor_drift = float(metrics["max_anchor_drift"])
            worst_frame = int(metrics["worst_anchor_frame"])
            threshold = float(phase["max_drift_rmse"])
            micro_median = float(metrics["median_adjacent_motion"])
            micro_max = float(metrics["max_adjacent_motion"])
            worst_micro_frame = int(metrics["worst_adjacent_frame"])
            anchor_ok = max_anchor_drift <= threshold
            micro_ok = micro_max <= continuity_threshold
            checks.append(Check(
                "motion_phase_hold",
                "OK" if anchor_ok and micro_ok else "ERROR",
                f"{label} 锚点最大漂移RMSE {max_anchor_drift:.3%} @ frame {worst_frame}，"
                f"上限{threshold:.1%}；微动中位{micro_median:.3%}，"
                f"微动最大{micro_max:.3%} @ {worst_micro_frame}->{worst_micro_frame + 1}"
                f"（上限{continuity_threshold:.1%}）；逐帧检查{int(metrics['frame_count'])}帧",
                shot_id,
            ))
    return checks


def phase_subject_roi_checks(
    project: H3Project,
    shot: dict[str, Any],
    path: Path,
) -> list[Check]:
    """Retain ROI visibility for phased shots without rescuing hard phase gates."""
    roi_rect, roi_note = resolve_subject_roi(project, shot, path)
    if roi_rect is None and not roi_note:
        return []
    shot_id = str(shot["id"])
    prefix = f"{roi_note}；" if roi_note else ""
    if roi_rect is None:
        return [Check(
            "subject_roi_motion", "WARN",
            f"{prefix}phase-aware主体ROI不可用；不改变motion_phase_active硬门结果，需当前Agent视觉确认主体动作",
            shot_id,
        )]
    qa_config = project.data.get("qa", {})
    sample_fps = int(qa_config.get("motion_sample_fps", 4))
    roi_threshold = float(shot.get("subject_roi_min_rms", qa_config.get("subject_motion_rms", 0.02)))
    motion_threshold = float(shot.get("minimum_motion_rms", qa_config.get("minimum_motion_rms")))
    continuity_threshold = float(qa_config.get("continuity_rmse_max", 0.04))
    checks: list[Check] = []
    phases = list(shot["motion_phases"])
    active = phases[0]
    start, end = int(active["start_frame"]), int(active["end_frame"])
    try:
        roi_scores = sampled_motion_scores(
            path, sample_fps=sample_fps, crop_fraction=roi_rect,
            start_frame=start, end_frame=end,
        )
        full_scores = sampled_motion_scores(
            path, sample_fps=sample_fps, start_frame=start, end_frame=end,
        )
    except ProjectError as exc:
        return [Check(
            "subject_roi_motion", "WARN",
            f"{prefix}phase-aware主体ROI动作读取失败：{exc}；不改变motion phase硬门结果",
            shot_id,
        )]
    roi_score = _median(roi_scores)
    enough_roi = len(roi_scores) >= 2
    full_ok = len(full_scores) >= 2 and _median(full_scores) >= motion_threshold
    roi_ok = enough_roi and roi_score >= roi_threshold
    discrepancy = roi_ok and not full_ok
    checks.append(Check(
        "subject_roi_motion",
        "WARN" if discrepancy or not roi_ok else "OK",
        f"{prefix}phase-aware active主体ROI中位变化{roi_score:.3%}，阈值{roi_threshold:.1%}；"
        f"有效差分{len(roi_scores)}（至少2）"
        + ("；主体在动但全帧active硬门未达标，仅作差异预警、不予救援" if discrepancy else "；不救援motion_phase_active全帧ERROR"),
        shot_id,
    ))
    roi_chunks = _motion_score_chunks(roi_scores, sample_fps)
    roi_windows = [_median(chunk) for chunk in roi_chunks]
    roi_failed = [
        index for index, (chunk, value) in enumerate(zip(roi_chunks, roi_windows))
        if len(chunk) < 2 or value < roi_threshold
    ]
    roi_windows_ok = enough_roi and not roi_failed
    roi_window_detail = (
        "有效差分不足2" if not enough_roi else
        "未达标：" + ", ".join(
            f"窗{index}={roi_windows[index]:.3%}/差分{len(roi_chunks[index])}" for index in roi_failed
        ) if roi_failed else "所有active主体ROI局部窗达标"
    )
    checks.append(Check(
        "subject_roi_motion_windows", "OK" if roi_windows_ok else "WARN",
        f"{prefix}{roi_window_detail}；主体ROI阈值{roi_threshold:.1%}；仅作phase-aware预警",
        shot_id,
    ))

    for index, phase in enumerate(phases[1:], start=1):
        mode = str(phase["mode"])
        start, end = int(phase["start_frame"]), int(phase["end_frame"])
        try:
            metrics = phase_native_frame_metrics(path, start, end, crop_fraction=roi_rect)
            boundary = phase_native_frame_metrics(path, start - 1, start + 1, crop_fraction=roi_rect)
        except ProjectError as exc:
            checks.append(Check(
                f"subject_roi_{mode}", "WARN",
                f"{prefix}{mode}[{start},{end})主体ROI逐帧读取失败：{exc}；仅作phase-aware预警",
                shot_id,
            ))
            continue
        boundary_value = float(boundary["max_adjacent_motion"])
        checks.append(Check(
            "subject_roi_boundary", "WARN" if boundary_value > continuity_threshold else "OK",
            f"{prefix}{phases[index - 1]['mode']}->{mode}主体ROI边界RMSE {boundary_value:.3%}，"
            f"阈值{continuity_threshold:.1%}；仅作phase-aware预警",
            shot_id,
        ))
        if mode == "settle":
            adjacent = float(metrics["max_adjacent_motion"])
            checks.append(Check(
                "subject_roi_settle", "WARN" if adjacent > continuity_threshold else "OK",
                f"{prefix}settle主体ROI最大相邻RMSE {adjacent:.3%}，"
                f"阈值{continuity_threshold:.1%}；仅作phase-aware预警",
                shot_id,
            ))
        elif mode == "hold":
            drift = float(metrics["max_anchor_drift"])
            adjacent = float(metrics["max_adjacent_motion"])
            drift_limit = float(phase["max_drift_rmse"])
            checks.append(Check(
                "subject_roi_hold",
                "WARN" if drift > drift_limit or adjacent > continuity_threshold else "OK",
                f"{prefix}hold主体ROI锚点最大漂移{drift:.3%}（上限{drift_limit:.1%}），"
                f"最大相邻微动{adjacent:.3%}（上限{continuity_threshold:.1%}）；仅作phase-aware预警",
                shot_id,
            ))
    return checks


def legacy_motion_checks(
    project: H3Project,
    shot: dict[str, Any],
    path: Path,
) -> list[Check]:
    """Keep the historical whole-clip/ROI motion policy isolated from phases."""
    shot_id = str(shot["id"])
    checks: list[Check] = []
    qa_config = project.data.get("qa", {})
    sample_fps = int(qa_config.get("motion_sample_fps", 4))
    roi_rect, roi_note = resolve_subject_roi(project, shot, path)
    roi_threshold = float(shot.get("subject_roi_min_rms", qa_config.get("subject_motion_rms", 0.02)))
    roi_score = roi_motion_median(path, roi_rect, sample_fps=sample_fps) if roi_rect else None
    motion_threshold = shot.get("minimum_motion_rms", qa_config.get("minimum_motion_rms"))
    full_score: float | None = None
    if motion_threshold is not None or roi_rect is not None:
        full_score = meaningful_motion_median(path, sample_fps=sample_fps)
    if motion_threshold is not None:
        threshold = float(motion_threshold)
        assert full_score is not None
        if full_score >= threshold:
            status, detail = "OK", f"全画面中心区域相邻采样帧中位变化{full_score:.3%}，阈值{threshold:.1%}"
        elif roi_score is not None and roi_score >= roi_threshold:
            status = "WARN"
            detail = (
                f"全画面中心区域中位变化{full_score:.3%}低于阈值{threshold:.1%}，但主体ROI运动{roi_score:.3%}达标："
                "静止背景稀释了全画面指标，需当前Agent视觉确认；真实卡帧仍由freezedetect独立把关"
            )
        else:
            status, detail = "ERROR", f"全画面中心区域相邻采样帧中位变化{full_score:.3%}，阈值{threshold:.1%}"
        checks.append(Check("meaningful_motion", status, detail, shot_id))
    window_threshold = shot.get("minimum_motion_window_rms", qa_config.get("minimum_motion_window_rms"))
    if window_threshold is not None:
        threshold = float(window_threshold)
        windows = meaningful_motion_windows(path, sample_fps=sample_fps)
        roi_windows = meaningful_motion_windows(path, sample_fps=sample_fps, crop_fraction=roi_rect) if roi_rect else []
        rescued = [
            index for index, value in enumerate(windows)
            if value < threshold and index < len(roi_windows) and roi_windows[index] >= roi_threshold
        ]
        failed = [
            index for index, value in enumerate(windows)
            if value < threshold and index not in rescued
        ]
        details: list[str] = []
        if failed:
            details.append("未达标：" + ", ".join(f"{index}-{index + 1}s 全画面{windows[index]:.3%}" for index in failed))
        if rescued:
            details.append(
                "ROI确认主体在动：" + ", ".join(
                    f"{index}-{index + 1}s 全画面{windows[index]:.3%}/主体{roi_windows[index]:.3%}" for index in rescued
                )
            )
        if failed:
            window_status = "ERROR"
        elif rescued:
            window_status = "WARN"
        else:
            window_status = "OK"
        checks.append(Check(
            "motion_windows",
            window_status,
            f"{'；'.join(details) or '每个1秒窗均达到全画面动作阈值'}；全画面阈值{threshold:.1%}，主体ROI阈值{roi_threshold:.1%}",
            shot_id,
        ))
        if roi_rect:
            roi_failed = [index for index, value in enumerate(roi_windows) if value < roi_threshold]
            roi_detail = ", ".join(f"{index}-{index + 1}s {roi_windows[index]:.3%}" for index in roi_failed) or "每个1秒主体ROI窗均有运动"
            checks.append(Check(
                "subject_roi_motion_windows",
                "WARN" if roi_failed else "OK",
                f"{roi_detail}；阈值{roi_threshold:.1%}；仅作主体动作预警，真实冻结由static_segment硬闸门阻止",
                shot_id,
            ))
    if roi_note or roi_rect is not None:
        prefix = f"{roi_note}；" if roi_note else ""
        if roi_score is None:
            checks.append(Check("subject_roi_motion", "WARN", f"{prefix}没有可用的主体区域，无法评估主体ROI运动；需当前Agent视觉确认主体动作", shot_id))
        elif roi_score >= roi_threshold:
            if motion_threshold is not None and full_score is not None and full_score < float(motion_threshold):
                detail = f"{prefix}主体ROI中位变化{roi_score:.3%}达标（阈值{roi_threshold:.1%}），已纠正静止背景对全画面指标的稀释"
            else:
                detail = f"{prefix}主体ROI相邻采样帧中位变化{roi_score:.3%}，阈值{roi_threshold:.1%}"
            checks.append(Check("subject_roi_motion", "OK", detail, shot_id))
        elif motion_threshold is not None and full_score is not None and full_score >= float(motion_threshold):
            checks.append(Check(
                "subject_roi_motion", "WARN",
                f"{prefix}主体ROI运动{roi_score:.3%}低于阈值{roi_threshold:.1%}，而全画面{full_score:.3%}在动："
                "背景动/主体静止，需当前Agent视觉确认主体是否应当动作",
                shot_id,
            ))
        else:
            full_detail = f"{full_score:.3%}" if full_score is not None else "未评估"
            checks.append(Check(
                "subject_roi_motion", "WARN",
                f"{prefix}主体ROI运动{roi_score:.3%}与全画面{full_detail}均低：疑似静止镜头，需当前Agent视觉确认；"
                "此检查只提示风险，不掩盖真实卡帧（freezedetect独立把关）",
                shot_id,
            ))
    return checks


def clip_checks(project: H3Project) -> list[Check]:
    require_media_tools()
    clips_dir = project.path_for(project.data.get("output", {}).get("clips_dir"))
    if not clips_dir:
        return [Check("clips_dir", "ERROR", "output.clips_dir未配置")]
    checks: list[Check] = []
    for shot in project.shots:
        shot_id = str(shot["id"])
        path = resolved_clip_path(project, shot, clips_dir)
        if not path.is_file():
            checks.append(Check("clip_exists", "ERROR", f"镜头不存在：{path}", shot_id))
            continue
        info = probe(path, count_frames=True)
        stream = video_stream(info)
        if not stream:
            checks.append(Check("video_stream", "ERROR", "没有视频流", shot_id))
            continue
        if has_audio(info):
            checks.append(Check("source_audio", "ERROR", "H3镜头仍有音轨，禁止进入母版", shot_id))
        else:
            checks.append(Check("source_audio", "OK", "无H3原始音轨", shot_id))
        width, height = int(stream.get("width", 0)), int(stream.get("height", 0))
        profile = project.profile_for(shot)
        status = "OK" if (width, height) == (int(profile["width"]), int(profile["height"])) else "ERROR"
        checks.append(Check("clip_dimensions", status, f"{width}x{height}", shot_id))
        black, freeze, detail = detect_black_and_freeze(path)
        checks.append(Check("black_frames", "ERROR" if black else "OK", detail or "未检测到持续黑帧", shot_id))
        checks.append(Check("static_segment", "ERROR" if freeze else "OK", detail or "未检测到超过1.2秒冻结", shot_id))
        motion_phases = shot.get("motion_phases")
        actual_frames = int(stream.get("nb_read_frames") or stream.get("nb_frames") or 0)
        if motion_phases is not None:
            phase_errors = motion_phase_review_intent_errors(project, shot)
            if phase_errors:
                checks.extend(Check("motion_phase_schema", "ERROR", detail, shot_id) for detail in phase_errors)
            else:
                checks.extend(motion_phase_checks(project, shot, path, actual_frames))
                checks.extend(phase_subject_roi_checks(project, shot, path))
        else:
            checks.extend(legacy_motion_checks(project, shot, path))
    return checks


def continuity_checks(project: H3Project) -> list[Check]:
    clips_dir = project.path_for(project.data.get("output", {}).get("clips_dir"))
    threshold = float(project.data.get("qa", {}).get("continuity_rmse_max", 0.04))
    checks: list[Check] = []
    if not clips_dir:
        return checks
    with tempfile.TemporaryDirectory(prefix="svd-h3-continuity-") as temp_value:
        temp = Path(temp_value)
        for shot in project.shots:
            predecessor = shot.get("continues_from")
            if not predecessor:
                continue
            shot_id = str(shot["id"])
            previous_shot = project.shot_map.get(str(predecessor), {"id": predecessor})
            previous_path = resolved_clip_path(project, previous_shot, clips_dir)
            current_path = resolved_clip_path(project, shot, clips_dir)
            if not previous_path.is_file() or not current_path.is_file():
                checks.append(Check("continuity_rmse", "ERROR", "缺少前段或续拍镜头", shot_id))
                continue
            tail, head = temp / f"{predecessor}-tail.png", temp / f"{shot_id}-head.png"
            extract_frame(previous_path, tail, first=False)
            extract_frame(current_path, head, first=True)
            value = normalized_rmse(tail, head)
            checks.append(
                Check("continuity_rmse", "OK" if value <= threshold else "ERROR", f"{predecessor}->{shot_id}: {value:.3%}，阈值{threshold:.1%}", shot_id)
            )
    return checks


def master_checks(project: H3Project) -> list[Check]:
    master = project.path_for(project.data.get("output", {}).get("master"))
    if not master or not master.is_file():
        return [Check("master_exists", "ERROR", f"母版不存在：{master}")]
    info = probe(master, count_frames=True)
    stream = video_stream(info)
    if not stream:
        return [Check("master_video", "ERROR", "母版没有视频流")]
    output = project.data.get("output", {})
    checks = [Check("master_exists", "OK", str(master))]
    dimensions = (int(stream.get("width", 0)), int(stream.get("height", 0)))
    expected = (int(output.get("width", 1920)), int(output.get("height", 1080)))
    checks.append(Check("master_dimensions", "OK" if dimensions == expected else "ERROR", f"{dimensions[0]}x{dimensions[1]}"))
    avg, real = fraction(stream.get("avg_frame_rate")), fraction(stream.get("r_frame_rate"))
    fps = float(output.get("fps", 24))
    cfr_ok = abs(avg - fps) < 0.001 and abs(real - fps) < 0.001
    checks.append(Check("master_cfr", "OK" if cfr_ok else "ERROR", f"avg={avg:.3f}, r={real:.3f}, frames={stream.get('nb_read_frames') or stream.get('nb_frames')}"))
    checks.append(Check("master_audio", "OK" if has_audio(info) else "ERROR", "存在最终混音" if has_audio(info) else "母版没有音轨"))
    if has_audio(info):
        measured = measure_loudness(master)
        if measured:
            audio = project.data.get("audio", {})
            target_i = float(audio.get("master_lufs", -14))
            target_tp = float(audio.get("true_peak_dbtp", -1.0))
            integrated = float(measured["input_i"])
            true_peak = float(measured["input_tp"])
            checks.append(Check("master_lufs", "OK" if abs(integrated - target_i) <= 1.0 else "ERROR", f"{integrated:.2f} LUFS，目标{target_i:.1f}±1.0"))
            checks.append(Check("master_true_peak", "OK" if true_peak <= target_tp else "ERROR", f"{true_peak:.2f} dBTP，上限{target_tp:.1f}"))
        else:
            checks.append(Check("master_loudness", "ERROR", "无法测量最终响度和真峰值"))
    return checks


def measure_loudness(path: Path) -> dict[str, Any] | None:
    result = command([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-map", "0:a:0",
        "-af", "loudnorm=I=-14:TP=-1:LRA=7:print_format=json", "-f", "null", "-",
    ])
    matches = re.findall(r"\{\s*\"input_i\"[\s\S]*?\}", result.stderr)
    if not matches:
        return None
    try:
        return json.loads(matches[-1])
    except json.JSONDecodeError:
        return None


def unexpected_speech_segments(
    segments: list[dict[str, Any]], cues: list[tuple[float, float, str]], *, padding: float = 0.75
) -> list[dict[str, Any]]:
    unexpected: list[dict[str, Any]] = []
    for segment in segments:
        offsets = segment.get("offsets") or {}
        start, end = float(offsets.get("from", 0)) / 1000.0, float(offsets.get("to", 0)) / 1000.0
        text = str(segment.get("text") or "").strip()
        if not text or end - start < 0.35 or is_whisper_nonspeech_hallucination(text):
            continue
        overlaps = any(end >= cue_start - padding and start <= cue_end + padding for cue_start, cue_end, _ in cues)
        if not overlaps:
            unexpected.append({"start": round(start, 3), "end": round(end, 3), "text": text})
    return unexpected


def is_whisper_nonspeech_hallucination(text: str) -> bool:
    compact = re.sub(r"[\s\[\]()（）:：·.。!！?？_-]+", "", text).lower()
    if not compact:
        return True
    if compact in {"music", "音樂", "音乐", "純音樂", "纯音乐"} or set(compact) <= {"♪", "♫", "♬"}:
        return True
    return "字幕" in compact and any(marker in compact for marker in ("製作", "制作", "作者", "jchong", "chong"))


def whisper_speech_check(project: H3Project) -> Check:
    master = project.path_for(project.data.get("output", {}).get("master"))
    srt = project.path_for(project.data.get("subtitles", {}).get("srt"))
    if not master or not master.is_file() or not srt or not srt.is_file():
        return Check("whisper_speech_scan", "SKIP", "缺少母版或预期字幕")
    executable = shutil.which("whisper-cli")
    configured_model = project.data.get("qa", {}).get("whisper_model")
    model = Path(str(configured_model)).expanduser() if configured_model else Path.home() / ".cache" / "short-video-agent" / "whisper" / "ggml-base.bin"
    if not executable or not model.is_file():
        return Check("whisper_speech_scan", "SKIP", "未安装whisper-cli或多语言模型；仍需Agent听检")
    with tempfile.TemporaryDirectory(prefix="svd-h3-whisper-") as temp_value:
        temp = Path(temp_value)
        audio_path, output_base = temp / "master.wav", temp / "scan"
        extraction = command(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(master), "-vn", "-ac", "1", "-ar", "16000", str(audio_path)])
        if extraction.returncode != 0:
            return Check("whisper_speech_scan", "ERROR", extraction.stderr.strip() or "提取语音失败")
        result = command([executable, "-m", str(model), "-l", "zh", "-ojf", "-of", str(output_base), "-np", str(audio_path)])
        json_path = output_base.with_suffix(".json")
        if result.returncode != 0 or not json_path.is_file():
            return Check("whisper_speech_scan", "ERROR", result.stderr.strip()[-500:] or "Whisper转写失败")
        payload = json.loads(json_path.read_text(encoding="utf-8", errors="replace"))
    segments = list(payload.get("transcription") or [])
    narration_path = project.path_for(project.data.get("audio", {}).get("narration"))
    cues = parse_srt(srt) if narration_path and narration_path.is_file() else []
    ignored = [
        {"offsets": item.get("offsets"), "text": item.get("text")}
        for item in segments if is_whisper_nonspeech_hallucination(str(item.get("text") or ""))
    ]
    unexpected = unexpected_speech_segments(segments, cues)
    report_path = project.root / "工程" / "Whisper语音扫描.json"
    report_path.write_text(json.dumps({
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "language": (payload.get("result") or {}).get("language"),
        "model": model.name,
        "segments": [{"offsets": item.get("offsets"), "text": item.get("text")} for item in segments],
        "expected_speech_windows": len(cues),
        "ignored_nonspeech_hallucinations": ignored,
        "unexpected_outside_subtitle_windows": unexpected,
        "agent_listen_required": True,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if unexpected:
        detail = "；".join(f"{item['start']:.1f}-{item['end']:.1f}s {item['text']}" for item in unexpected[:4])
        location = "旁白时间窗外" if cues else "无旁白项目中"
        return Check("whisper_speech_scan", "ERROR", f"{location}检测到疑似人声：{detail}")
    if not cues:
        return Check(
            "whisper_speech_scan", "OK",
            f"无旁白项目未检测到可信人声；忽略{len(ignored)}个字幕署名/音乐类识别幻觉；仍需Agent听检",
        )
    return Check("whisper_speech_scan", "OK", f"{len(segments) - len(ignored)}个可信语音段均在旁白时间窗内；仍需Agent听检")


def qa_project(project: H3Project, *, include_master: bool = True) -> list[Check]:
    checks = clip_checks(project)
    checks.extend(continuity_checks(project))
    checks.extend(face_consistency_checks(project))
    checks.append(glyph_check(project))
    if include_master:
        checks.extend(master_checks(project))
        checks.append(whisper_speech_check(project))
    return checks


def sample_clip_frames(path: Path, target_dir: Path, count: int) -> list[Path]:
    """Extract up to `count` evenly spaced frames for warning-level analysis."""
    duration = float(probe(path)["format"]["duration"])
    count = max(1, count)
    frames: list[Path] = []
    for index in range(count):
        position = duration * (index + 0.5) / count
        target = target_dir / f"frame-{index:02d}.png"
        result = command([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", f"{position:.3f}", "-i", str(path), "-frames:v", "1", str(target),
        ])
        if result.returncode == 0 and target.is_file():
            frames.append(target)
    return frames


def face_consistency_checks(project: H3Project, *, backend_override: Any | None = None) -> list[Check]:
    """WARN-only identity warning for identity-critical shots; never approves identity."""
    shots: list[tuple[dict[str, Any], Path]] = []
    for shot in project.shots:
        reference = identity_reference_for(project, shot)
        if reference:
            shots.append((shot, reference))
    if not shots:
        return []
    config = face_config(project)
    backend = backend_override or resolve_backend(project)
    status = backend.status()
    shot_ids = "、".join(str(shot.get("id")) for shot, _ in shots)
    if not status.available:
        return [Check("face_consistency", "WARN", f"{status.detail}。人物关键镜头：{shot_ids}")]
    clips_dir = project.path_for(project.data.get("output", {}).get("clips_dir"))
    threshold = float(config.get("similarity_warn_below", 0.55))
    frames_per_shot = int(config.get("frames_per_shot", 5))
    report: dict[str, Any] = {"backend": status.detail, "shots": {}}
    checks: list[Check] = []
    with tempfile.TemporaryDirectory(prefix="svd-h3-face-") as temp_value:
        temp = Path(temp_value)
        for shot, reference in shots:
            shot_id = str(shot.get("id"))
            clip = resolved_clip_path(project, shot, clips_dir) if clips_dir else None
            if not clip or not clip.is_file():
                checks.append(Check("face_consistency", "WARN", "镜头缺失，无法做人脸一致性预警；需当前Agent视觉核对身份", shot_id))
                continue
            if not reference.is_file():
                checks.append(Check("face_consistency", "WARN", f"人物参考图不存在：{reference.name}；需当前Agent视觉核对身份", shot_id))
                continue
            shot_temp = temp / shot_id
            shot_temp.mkdir()
            frames = sample_clip_frames(clip, shot_temp, frames_per_shot)
            observations = [backend.observe(reference, frame) for frame in frames]
            check_status, detail, stats = aggregate_observations(observations, threshold)
            report["shots"][shot_id] = {"reference": reference.name, "stats": stats, "observations": observations_as_dicts(observations)}
            checks.append(Check("face_consistency", check_status, detail, shot_id))
    report_path = project.root / "工程" / "人脸一致性预警.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return checks


def write_report(project: H3Project, checks: list[Check], *, timings: dict[str, float] | None = None) -> Path:
    report_json = project.root / "工程" / "运行报告.json"
    report_md = project.root / "工程" / "H3流水线质检报告.md"
    if timings is None and report_json.is_file():
        # Standalone QA must not erase historical run timings from the report.
        try:
            previous = json.loads(report_json.read_text(encoding="utf-8"))
            preserved = previous.get("timings_seconds")
            if isinstance(preserved, dict) and preserved:
                timings = {str(key): float(value) for key, value in preserved.items()}
        except (json.JSONDecodeError, OSError, TypeError, ValueError):
            pass
    payload = {
        "schema_version": 1,
        "project_id": project.project_id,
        "project_fingerprint": project.fingerprint(),
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "summary": {
            "errors": sum(item.status == "ERROR" for item in checks),
            "warnings": sum(item.status == "WARN" for item in checks),
            "ok": sum(item.status == "OK" for item in checks),
        },
        "timings_seconds": timings or {},
        "checks": [asdict(item) for item in checks],
    }
    report_json.parent.mkdir(parents=True, exist_ok=True)
    report_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# H3流水线质检报告", "", f"- 项目：{project.title}",
        f"- ERROR：{payload['summary']['errors']}", f"- WARN：{payload['summary']['warnings']}", f"- OK：{payload['summary']['ok']}", "",
        "| 状态 | 检查 | 镜头 | 详情 |", "| --- | --- | --- | --- |",
    ]
    for item in checks:
        detail = item.detail.replace("|", "\\|").replace("\n", " ")
        lines.append(f"| {item.status} | {item.name} | {item.shot_id or '—'} | {detail} |")
    report_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
    review_path = project.root / "工程" / "复盘.md"
    manual_heading = "## Agent审片与候选经验"
    manual_section = ""
    if review_path.is_file():
        previous = review_path.read_text(encoding="utf-8")
        if manual_heading in previous:
            manual_section = manual_heading + previous.split(manual_heading, 1)[1]
    failed = [item for item in checks if item.status == "ERROR"]
    warned = [item for item in checks if item.status == "WARN"]
    review_lines = [
        "# H3项目复盘",
        "",
        f"- 项目：{project.title}",
        f"- 定义指纹：`{project.fingerprint()}`",
        f"- 本次结果：ERROR {len(failed)} / WARN {len(warned)} / OK {payload['summary']['ok']}",
        "",
        "## 已验证经验",
        "",
        "- 本节只记录本项目已有客观证据的结果，不自动提升为全局规则。",
    ]
    if not failed:
        review_lines.append("- 本次硬质检全部通过；该结论只覆盖本次输入、模型版本和环境快照。")
    else:
        review_lines.extend(f"- 未通过：{item.name} / {item.shot_id or '项目'} / {item.detail}" for item in failed)
    review_lines += [
        "",
        "## 候选改进",
        "",
        "- Agent在最终审片后补充真实感、动作、物理合理性、节奏与声音方面的候选经验。",
        "- 候选规则须经两个独立项目验证，或由用户明确批准，才可进入全局有效规则。",
        "- 被证伪的规则从有效说明中删除，并在变更记录保留废弃原因。",
        "",
        "## 耗时分解",
        "",
    ]
    if timings:
        review_lines.extend(f"- {name}: {seconds:.2f} 秒" for name, seconds in timings.items())
    else:
        review_lines.append("- 本次为独立质检或历史工程重放，没有完整在线阶段计时。")
    review_lines += ["", manual_section or manual_heading + "\n\n- 待Agent最终审片后补充；本节不会被自动QA覆盖。"]
    review_path.write_text("\n".join(review_lines) + "\n", encoding="utf-8")
    return report_md


def render_audio_inputs(project: H3Project) -> list[tuple[str, Path]]:
    audio = project.data.get("audio", {})
    master_mix = project.path_for(audio.get("master_mix"))
    if master_mix and master_mix.is_file():
        return [("master_mix", master_mix)]
    resolved: list[tuple[str, Path]] = []
    for key in ("narration", "music", "ambience"):
        path = project.path_for(audio.get(key))
        if path and path.is_file():
            resolved.append((key, path))
    return resolved


def render_master(project: H3Project) -> Path:
    require_media_tools()
    output = project.data.get("output", {})
    clips_dir = project.path_for(output.get("clips_dir"))
    master = project.path_for(output.get("master"))
    if not clips_dir or not master:
        raise ProjectError("output.clips_dir 或 output.master 未配置")
    order = list(project.data.get("timeline", {}).get("order") or [shot["id"] for shot in project.shots])
    shot_map = project.shot_map
    accepted_pairs = [(shot_id, accepted_source_path(project, shot_map[shot_id])) for shot_id in order]
    unreviewed = [shot_id for shot_id, path in accepted_pairs if path is None]
    if unreviewed:
        raise ProjectError(
            "以下镜头尚无与当前source_path哈希一致的显式接受记录，禁止渲染："
            + ", ".join(unreviewed)
            + "；请先运行 svd h3 accept-shot"
        )
    paths = [path for _, path in accepted_pairs if path is not None]
    missing = [str(path) for path in paths if not path.is_file()]
    if missing:
        raise ProjectError("缺少镜头：\n" + "\n".join(missing))
    transition = float(project.data.get("timeline", {}).get("transition_seconds", 0.16))
    durations = [float(probe(path)["format"]["duration"]) for path in paths]
    width, height, fps = int(output.get("width", 1920)), int(output.get("height", 1080)), int(output.get("fps", 24))
    args = ["ffmpeg", "-hide_banner", "-y"]
    for path in paths:
        args += ["-i", str(path)]
    audio = project.data.get("audio", {})
    delivery_true_peak = float(audio.get("true_peak_dbtp", -1.0))
    render_true_peak = float(audio.get("render_true_peak_dbtp", delivery_true_peak - 0.3))
    audio_inputs: list[tuple[str, int]] = []
    for key, path in render_audio_inputs(project):
        audio_inputs.append((key, len(paths) + len(audio_inputs)))
        args += ["-i", str(path)]
    if not audio_inputs:
        audio_inputs.append(("silence", len(paths)))
        args += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
    srt = project.path_for(project.data.get("subtitles", {}).get("srt"))
    subtitle_layers: list[tuple[float, float, Path]] = []
    subtitle_input_start = len(paths) + len(audio_inputs)
    if srt and srt.is_file():
        subtitle_layers = render_subtitle_layers(project, srt, width, height)
        for _, _, layer in subtitle_layers:
            args += ["-loop", "1", "-framerate", str(fps), "-i", str(layer)]
    filters: list[str] = []
    for index, duration in enumerate(durations):
        filters.append(
            f"[{index}:v]fps={fps},scale={width}:{height}:force_original_aspect_ratio=increase:flags=lanczos,"
            f"crop={width}:{height},setsar=1,trim=duration={duration:.6f},setpts=PTS-STARTPTS[v{index}]"
        )
    previous = "v0"
    if transition == 0 and len(paths) > 1:
        inputs = "".join(f"[v{i}]" for i in range(len(paths)))
        filters.append(f"{inputs}concat=n={len(paths)}:v=1:a=0[cut]")
        previous = "cut"
    else:
        offset = durations[0] - transition
        for index in range(1, len(paths)):
            out = f"x{index}"
            filters.append(f"[{previous}][v{index}]xfade=transition=fade:duration={transition:.3f}:offset={offset:.6f}[{out}]")
            previous = out
            offset += durations[index] - transition
    total = sum(durations) - transition * max(0, len(durations) - 1)
    for index, (start, end, _) in enumerate(subtitle_layers):
        out = f"subtitle{index}"
        filters.append(
            f"[{previous}][{subtitle_input_start + index}:v]overlay=0:0:shortest=1:enable='between(t,{start:.3f},{end:.3f})'[{out}]"
        )
        previous = out
    filters.append(f"[{previous}]fps={fps}[finalv]")

    labels: dict[str, str] = {}
    for key, index in audio_inputs:
        if key == "master_mix":
            filters.append(f"[{index}:a]aresample=48000[premix]")
            labels[key] = "premix"
        elif key == "narration":
            route = ",asplit=2[vo][side]" if any(key == "music" for key, _ in audio_inputs) else "[vo]"
            filters.append(f"[{index}:a]loudnorm=I={float(audio.get('narration_lufs', -16))}:TP=-2:LRA=7,aresample=48000{route}")
            labels[key] = "vo"
        elif key == "music":
            filters.append(f"[{index}:a]loudnorm=I={float(audio.get('music_lufs', -24))}:TP=-3:LRA=9,aresample=48000[music]")
            labels[key] = "music"
        elif key == "ambience":
            filters.append(f"[{index}:a]loudnorm=I={float(audio.get('ambience_lufs', -32))}:TP=-4:LRA=12,aresample=48000[amb]")
            labels[key] = "amb"
        else:
            filters.append(f"[{index}:a]aresample=48000[silence]")
            labels[key] = "silence"
    mix_labels: list[str] = []
    if "master_mix" in labels:
        mix_labels.append("premix")
    elif "narration" in labels and "music" in labels:
        filters.append("[music][side]sidechaincompress=threshold=0.04:ratio=8:attack=20:release=350[musicduck]")
        mix_labels += ["vo", "musicduck"]
    else:
        mix_labels += [labels[key] for key in ("narration", "music") if key in labels]
    if "ambience" in labels:
        mix_labels.append("amb")
    if "silence" in labels:
        mix_labels.append("silence")
    filters.append(
        "".join(f"[{label}]" for label in mix_labels)
        + f"amix=inputs={len(mix_labels)}:duration=longest:normalize=0,atrim=duration={total:.6f},"
        + f"loudnorm=I={float(audio.get('master_lufs', -14))}:TP={render_true_peak}:LRA=7[aout]"
    )
    master.parent.mkdir(parents=True, exist_ok=True)
    args += [
        "-filter_complex", ";".join(filters), "-map", "[finalv]", "-map", "[aout]", "-t", f"{total:.6f}",
        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "320k",
        "-ar", "48000", "-movflags", "+faststart", str(master),
    ]
    result = subprocess.run(args, check=False)
    if result.returncode != 0:
        raise ProjectError("FFmpeg母版渲染失败")
    return master
