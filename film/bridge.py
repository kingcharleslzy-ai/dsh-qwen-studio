"""DSH adapter for materialized H3 footage in an SVD V2 project."""

from characters import library, resolve_plan

import fcntl
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from datetime import datetime


from h3_pipeline.approval import sha256_file
from h3_pipeline.ledger import record_shot_decision
from h3_pipeline.qa import (
    probe,
    video_stream,
    detect_black_and_freeze,
    measure_loudness,
)
from video_pipeline.plan import write_production_plan
from video_pipeline.project import (
    default_video_project,
    load_video_project,
    VideoProject,
)
from video_pipeline.qa import render_video_project, qa_video_project, write_video_report

DIMS = {"480": (864, 480), "768": (1344, 768)}


def put(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, "w") as out:
            json.dump(value, out, ensure_ascii=False, indent=2)
            out.flush()
            os.fsync(out.fileno())
        os.replace(tmp, path)
    finally:
        Path(tmp).unlink(missing_ok=True)


def media(*args):
    result = subprocess.run(
        [
            "ffmpeg",
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            *map(str, args),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode:
        raise ValueError(result.stderr[-1400:])


def text(value, name, limit=12000):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError(f"请检查 {name}")
    return value.strip()


def project_for(root, a):
    title, brief = text(a.get("title"), "标题", 200), text(a.get("brief"), "主题")
    shots = a.get("shots")
    seconds = a.get("duration_seconds")
    if type(seconds) is not int or not isinstance(shots, list) or not shots:
        raise ValueError("需要目标秒数与非空分镜表")
    rep = a.get("representative", 1)
    if type(rep) is not int or not 1 <= rep <= len(shots):
        raise ValueError("representative 为从 1 开始的镜头序号")
    preset = a.get("preset", "turbo480")
    if preset not in ("turbo480", "quality480", "turbo768", "quality768"):
        raise ValueError("无效 H3 档位")
    data = default_video_project(title, "documentary-montage")
    data["project"].update(
        id="film-" + a["id"],
        goal=brief,
        audience="按当前创作请求",
        target_duration_seconds=seconds,
    )
    data["creative"]["concept"] = brief
    data["shots"] = []
    width, height = DIMS[preset[-3:]]
    for n, item in enumerate(shots, 1):
        length = item["seconds"]
        if type(length) is not int or not 1 <= length <= 15:
            raise ValueError(f"第 {n} 镜必须为 1–15 整秒")
        purpose, prompt = (
            text(item["purpose"], "镜头意图"),
            text(item["prompt"], "H3 提示词"),
        )
        if "narration" in item and item["narration"]:
            text(item["narration"], "旁白", 250)
        data["shots"].append(
            dict(
                id=f"s{n:03}",
                scene_id=f"s{n:03}",
                purpose=purpose,
                prompt=prompt,
                duration_seconds=length,
                asset_strategy="generated_motion",
                workflow="reference" if item.get("reference_images") else "t2v",
                **({"reference_images":item["reference_paths"], "identity_reference":item["reference_paths"][0]} if item.get("reference_images") else {}),
                generation={
                    "provider": "h3-local",
                    "workflow": preset,
                    "prompt": prompt,
                },
                action={"subject": prompt, "end_state": purpose},
                parameters={"width": width, "height": height, "fps": 24},
            )
        )
    if sum(s["duration_seconds"] for s in data["shots"]) != seconds:
        raise ValueError("分镜时长之和必须等于成片时长")
    data["timeline"].update(
        order=[s["id"] for s in data["shots"]], transition_seconds=0
    )
    data["production"]["representative_shot"] = data["shots"][rep - 1]["id"]
    project = VideoProject(root, root / "工程/video_project.yaml", data)
    errors = project.validate()
    if errors:
        raise ValueError("; ".join(errors))
    return project


def sheet(source, path, seconds):
    media(
        "-i",
        source,
        "-vf",
        f"fps=6/{seconds},scale=320:-2,tile=3x2",
        "-frames:v",
        "1",
        path,
    )


def state_view(s):
    return {
        "id": s["id"],
        "status": s["status"],
        "accepted": len(s["accepted"]),
        "shot_count": len(s["plan"]["shots"]),
        "duration_seconds": s["plan"]["duration_seconds"],
    }


def assigned(s):
    i = s["current"]
    shot = s["plan"]["shots"][i]
    return shot, f"s{i + 1:03}", f"s{i + 1:03}-take{s['attempt']}"


def result(s):
    view = state_view(s)
    if s["status"] == "review_shot":
        view.update(s["review"])
    if s["status"] == "master_ready":
        view.update(s["master"])
    if s["status"] == "shot_failed":
        view.update(
            message=s["error"], review_token=assigned(s)[2], shot=assigned(s)[1]
        )
    return view


def materialize(root, s, receipt, cfg):
    shot, sid, take = assigned(s)
    source = (
        Path(cfg["data_home"])
        / "attachments/videos/h3"
        / (str(uuid.UUID(receipt["id"])) + ".mp4")
    )
    if Path(receipt["path"]).resolve() != source.resolve() or not source.is_file():
        raise ValueError("H3 回执和本机素材不一致")
    frame_count = shot["seconds"] * 24
    raw = video_stream(probe(source, count_frames=True))
    if int(raw["nb_read_frames"]) < frame_count:
        raise ValueError("源镜头长度不足")
    directory = root / "素材" / "镜头版本" / take
    directory.mkdir(parents=True, exist_ok=True)
    clip = directory / "edit.mp4"
    media(
        "-i",
        source,
        "-map",
        "0:v:0",
        "-an",
        "-frames:v",
        frame_count,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "16",
        clip,
    )
    info = video_stream(probe(clip, count_frames=True))
    if (
        int(info["nb_read_frames"]) != frame_count
        or info["avg_frame_rate"] != "24/1"
        or (info["width"], info["height"])
        != DIMS[s["plan"].get("preset", "turbo480")[-3:]]
    ):
        raise ValueError("分镜帧数、帧率或分辨率不符合计划")
    preview = directory / "review.jpg"
    sheet(clip, preview, shot["seconds"])
    black, freeze, _ = detect_black_and_freeze(clip)
    digest = sha256_file(clip)
    token = take + "-" + digest[:16]
    s["review"] = dict(
        shot=sid,
        review_token=token,
        contact_sheet=str(preview),
        clip_path=str(clip),
        original_path=str(source),
        purpose=shot["purpose"],
        prompt=shot["prompt"],
        technical_errors=[
            m for b, m in ((black, "持续黑屏"), (freeze, "画面冻结")) if b
        ],
    )
    put(
        directory / "source.json",
        dict(
            job=receipt["id"],
            source_sha256=sha256_file(source),
            edit_sha256=digest,
            frames=frame_count,
            generation=receipt,
            prompt=shot["prompt"],
        ),
    )
    s["status"] = "review_shot"


def narration(root, s, project, cfg):
    shots = s["plan"]["shots"]
    if not any(x.get("narration", "").strip() for x in shots):
        return
    directory = root / "工程" / "narration"
    directory.mkdir(parents=True, exist_ok=True)
    for i, shot in enumerate(shots):
        seconds = shot["seconds"]
        line = shot.get("narration", "").strip()
        if line:
            spoken = directory / f"{i}.aiff"
            if not Path("/usr/bin/say").is_file():
                raise ValueError("内置旁白需要 macOS 系统语音。")
            subprocess.run(
                ["/usr/bin/say", *(["-v", cfg["voice"]] if cfg.get("voice") else []), "-o", str(spoken), "-f", "-"],
                input=line,
                text=True,
                check=True,
                stdout=subprocess.DEVNULL,
            )
            duration = float(probe(spoken)["format"]["duration"])
            speed = max(1.0, duration / max(0.5, seconds - 0.15))
            if speed > 1.6:
                raise ValueError(f"第 {i + 1} 镜旁白过长，请用 h3_film_narration 缩短")
            args = ["-i", spoken, "-af", f"atempo={speed:.5f},apad"]
        else:
            args = ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
        media(*args, "-t", seconds, "-ar", "48000", "-ac", "2", directory / f"{i}.wav")
    listing = directory / "list.txt"
    listing.write_text("".join(f"file '{i}.wav'\n" for i in range(len(shots))))
    media(
        "-f",
        "concat",
        "-safe",
        "1",
        "-i",
        listing,
        "-c",
        "copy",
        directory / "track.wav",
    )
    project.data["audio"]["narration"] = str(
        (directory / "track.wav").relative_to(root)
    )
    project.write()


def gallery_copy(cfg, project_id, final, digest):
    directory = Path(cfg["data_home"]) / "attachments/videos/h3"
    directory.mkdir(parents=True, exist_ok=True)
    dest = directory / (str(uuid.UUID(project_id)) + ".mp4")
    if dest.exists() and sha256_file(dest) == digest:
        return dest
    fd, tmp = tempfile.mkstemp(dir=directory, suffix=".part")
    try:
        with final.open("rb") as source, os.fdopen(fd, "wb") as output:
            shutil.copyfileobj(source, output)
        if sha256_file(Path(tmp)) != digest:
            raise ValueError("视频库副本校验失败")
        os.replace(tmp, dest)
    finally:
        Path(tmp).unlink(missing_ok=True)
    return dest


def render(root, s, cfg):
    project = load_video_project(root)
    narration(root, s, project, cfg)
    # SVD writes to a staging deliverable; expose only a verified final master.
    final = root / "成片" / "横屏母版.mp4"
    project.data["output"]["master"] = "成片/剪辑校验中.mp4"
    project.write()
    temp = render_video_project(project)
    if project.data["audio"].get("narration"):
        measured = measure_loudness(temp)
        if measured:
            audio = project.data["audio"]
            gain = float(audio["master_lufs"]) - float(measured["input_i"])
            if abs(gain) > 0.75 and abs(gain) < 30:
                corrected = temp.with_suffix(".mix.mp4")
                ceiling = 10 ** ((float(audio["true_peak_dbtp"]) - 0.3) / 20)
                media(
                    "-i",
                    temp,
                    "-map",
                    "0:v:0",
                    "-map",
                    "0:a:0",
                    "-c:v",
                    "copy",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "320k",
                    "-af",
                    f"volume={gain:.3f}dB,alimiter=limit={ceiling:.6f}:level=0:latency=1",
                    "-movflags",
                    "+faststart",
                    corrected,
                )
                corrected.replace(temp)
    info = probe(temp, count_frames=True)
    v = video_stream(info)
    frames = int(v["nb_read_frames"])
    if frames != 24 * s["plan"]["duration_seconds"] or not any(
        t["codec_type"] == "audio" for t in info["streams"]
    ):
        raise ValueError(f"母版校验失败，检测到 {frames} 视频帧，请检查时间线")
    checks = qa_video_project(project)
    write_video_report(project, checks)
    errors = [
        c for c in checks if c.status == "ERROR" and c.name != "agent_final_review"
    ]
    if errors:
        raise ValueError(
            "; ".join(f"{c.shot_id or ''} {c.name}: {c.detail}" for c in errors)
        )
    temp.replace(final)
    project.data["output"]["master"] = str(final.relative_to(root))
    project.write()
    write_production_plan(project)
    digest = sha256_file(final)
    gallery = gallery_copy(cfg, s["id"], final, digest)
    s.update(
        status="master_ready",
        master=dict(
            path=str(final),
            gallery_path=str(gallery),
            frames=frames,
            fps=24,
            seconds=frames / 24,
            sha256=digest,
            final_review="尚待完整视听审片",
            warnings=[c.detail for c in checks if c.status == "WARN"],
        ),
    )


def run(cfg, op, a):
    if op in ("character_list", "character_save"):
        return library(cfg, op, a)
    key = a["id"]
    if not re.fullmatch(
        r"[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", key
    ):
        raise ValueError("无效项目 ID")
    if cfg.get("volume") and not os.path.ismount(cfg["volume"]):
        raise ValueError("项目素材卷未挂载，请连接后按同一 ID 继续")
    root = Path(cfg["project_root"]) / key
    lock_dir = Path(cfg["data_home"]) / "h3-video/locks"
    lock_dir.mkdir(parents=True, exist_ok=True)
    with (lock_dir / key).open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        file = root / "工程" / "film.json"
        if op == "create":
            if file.exists():
                s = json.loads(file.read_text())
                if s["request"] != a:
                    raise ValueError("同一创建请求 ID 的参数已变化")
                return result(s)
            plan = resolve_plan(cfg, root, a)
            project = project_for(root, plan)
            project.write()
            write_production_plan(project)
            s = dict(
                id=key,
                request=a,
                plan=plan,
                current=a.get("representative", 1) - 1,
                attempt=1,
                accepted=[],
                status="planned",
            )
        else:
            if not file.exists():
                raise ValueError("找不到对应工程")
            s = json.loads(file.read_text())
        if op in ("next", "status") and s["status"] == "master_ready":
            output = Path(s["master"]["path"])
            if not output.is_file() or sha256_file(output) != s["master"]["sha256"]:
                s.pop("master")
                s["status"] = "ready_to_edit"
        if op == "next":
            if s["status"] == "ready_to_edit":
                render(root, s, cfg)
            elif s["status"] in ("planned", "running"):
                shot, sid, take = assigned(s)
                seed = (
                    int(hashlib.sha256((key + take).encode()).hexdigest()[:8], 16)
                    % 2147483648
                )
                return {
                    **state_view(s),
                    "status": "generate",
                    "take": take,
                    "job_id": s.get("job_id"),
                    "generation": dict(
                        prompt=shot["prompt"],
                        duration_seconds=shot["seconds"],
                        preset=s["plan"].get("preset", "turbo480"),
                        seed=seed,
                        **({"reference_images":shot["reference_images"]} if shot.get("reference_images") else {}),
                    ),
                }
        elif op == "receipt":
            if s["status"] not in ("planned", "running") or a["take"] != assigned(s)[2]:
                return result(s)
            r = a["receipt"]
            s["job_id"] = r["id"]
            if r["status"] == "complete":
                expected = assigned(s)[0].get("reference_images", [])
                if expected and (r.get("mode") != "ref2va" or r.get("reference_images") != expected):
                    raise ValueError("人物参考图回执与分镜锁定的附件不同")
                materialize(root, s, r, cfg)
            elif r["status"] in ("running", "queued"):
                s["status"] = "running"
            else:
                s.update(status="shot_failed", error=r.get("message", r["status"]))
        elif op == "review":
            token = a["review_token"]
            if token == s.get("last_review_token"):
                return result(s)
            shot, sid, take = assigned(s)
            failed = s["status"] == "shot_failed"
            if failed and a["decision"] == "accept":
                raise ValueError("失败的镜头无法接受")
            if not failed and s["status"] != "review_shot":
                raise ValueError("当前没有待审镜头")
            review = s.get("review", {})
            if token != (take if failed else review["review_token"]):
                raise ValueError("审片版本已变化")
            reason = text(a.get("reason"), "审片依据")
            accept = a["decision"] == "accept"
            if a["decision"] not in ("reject", "accept"):
                raise ValueError("无效审片决定")
            if accept and review["technical_errors"]:
                raise ValueError("该镜技术检查未通过，请重做")
            p = load_video_project(root)
            row = p.shot_map[sid]
            if not failed:
                clip = Path(review["clip_path"])
                if token != take + "-" + sha256_file(clip)[:16]:
                    raise ValueError("素材已变化，请重新生成或审片")
                record_shot_decision(
                    root,
                    run_id=key,
                    shot_id=sid,
                    decision="accepted" if accept else "rejected",
                    source=clip,
                    reason=reason,
                )
            if accept:
                row["source_path"] = str(clip.relative_to(root))
                s["accepted"].append(s["current"])
                remaining = [i for i in range(len(p.shots)) if i not in s["accepted"]]
                s.update(status="planned" if remaining else "ready_to_edit", attempt=1)
                if remaining:
                    s["current"] = remaining[0]
            else:
                if a.get("replacement_prompt"):
                    shot["prompt"] = text(a["replacement_prompt"], "修订提示词")
                    row["prompt"] = row["generation"]["prompt"] = shot["prompt"]
                s.update(status="planned", attempt=s["attempt"] + 1)
            p.write()
            s.pop("review", None)
            s.pop("job_id", None)
            s["last_review_token"] = token
        elif op == "finish_review":
            if s["status"] != "master_ready" or a["sha256"] != s["master"]["sha256"]:
                raise ValueError("请先查看最终版并核对母版哈希")
            if sha256_file(Path(s["master"]["path"])) != a["sha256"]:
                raise ValueError("母版已变化，请重新检查")
            project = load_video_project(root)
            notes = text(a.get("notes"), "终审意见")
            checks = qa_video_project(project)
            if any(
                c.status == "ERROR" and c.name != "agent_final_review" for c in checks
            ):
                raise ValueError("技术质检仍有错误")
            put(
                root / "工程/agent_review.json",
                {
                    "schema_version": 1,
                    "project_id": project.project_id,
                    "status": "approved",
                    "reviewer": "agent",
                    "reviewed_at": datetime.now().isoformat(timespec="seconds"),
                    "notes": notes,
                    "master_sha256": a["sha256"],
                },
            )
            from video_pipeline.qa import agent_review_check

            write_video_report(
                project,
                [c for c in checks if c.name != "agent_final_review"]
                + [agent_review_check(project)],
            )
            write_production_plan(project)
            s["master"]["final_review"] = "已按母版哈希登记"
        elif op == "narration":
            if s["status"] == "master_ready":
                raise ValueError("母版已完成")
            i = a["shot_number"] - 1
            if not 0 <= i < len(s["plan"]["shots"]):
                raise ValueError("镜号无效")
            line = a["narration"]
            if not isinstance(line, str) or len(line) > 250:
                raise ValueError("单镜旁白限 250 字")
            s["plan"]["shots"][i]["narration"] = line
        elif op not in ("next", "create", "status"):
            raise ValueError("未知操作")
        put(file, s)
        return result(s)


if __name__ == "__main__":
    try:
        print(
            json.dumps(
                run(
                    json.loads(Path(sys.argv[1]).read_text()),
                    sys.argv[2],
                    json.load(sys.stdin),
                ),
                ensure_ascii=False,
            )
        )
    except Exception as exc:
        sys.exit(str(exc))
