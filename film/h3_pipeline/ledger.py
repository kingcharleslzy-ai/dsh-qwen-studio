from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from .approval import sha256_file
from .composite_intent import (
    COMPOSITE_KIND,
    build_edit_graph,
    canonical_sha256,
    normalize_composite_intent,
)
from .project import H3Project, motion_phase_intent, motion_phase_review_intent_errors


# Project-level production ledger. Every run (representative or full film) is
# upserted by run_id into 工程/生产账单.json, so the bill aggregates the whole
# project history instead of only the last QA pass. Standalone QA never writes
# to this ledger. Agent token usage is external telemetry: when nothing was
# imported the bill says 不可用 rather than inventing numbers. The token
# snapshot interface (record_token_snapshot / `svd h3 token-snapshot`) is the
# stable import point for future external start/end token snapshots.

LEDGER_NAME = "生产账单.json"
TOKEN_UNAVAILABLE = "不可用：Agent Token 属于外部遥测，本机无法读取；可用 svd h3 token-snapshot 导入起止快照"

LOCAL_PHASE_MAP = {
    "transfer": ("运行包传输", "成品回传", "远端入队"),
    "render": ("剪辑_字幕_混音",),
    "qa": ("自动质检",),
}
REMOTE_PHASE_MAP = {
    "model_load": ("model_load", "远端_model_load"),
    "sampling": ("sampling", "远端_sampling"),
    "vae": ("vae_export_audio_strip", "远端_vae_export_audio_strip"),
}

CANDIDATE_PROVENANCE_FIELDS = (
    "candidate_id",
    "run_id",
    "shot_id",
    "candidate_group",
    "seed",
    "source_path",
    "source_sha256",
    "prompt",
    "prompt_sha256",
    "reference_pack",
    "reference_pack_sha256",
    "generation_signature",
    "workflow_fingerprint",
    "profile",
    "workflow",
    "provider",
    "run_manifest",
    "remote_artifact_sha256",
    "remote_sha256_verified",
    "provenance_source",
    "provenance_sha256",
    "sidecar_path",
    "candidate_kind",
    "source_candidate_id",
    "source_candidate_path",
    "source_candidate_sha256",
    "narrative_trim_seconds",
    "trim_frames",
    "source_frames",
    "output_fps",
    "audio_policy",
    "trim_policy",
    "composite_intent",
    "composite_intent_sha256",
    "composite_sources",
    "edit_graph",
    "edit_graph_sha256",
    "renderer",
    "output_frames",
)


def ledger_path(root: Path) -> Path:
    return root / "工程" / LEDGER_NAME


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def load_ledger(root: Path) -> dict[str, Any]:
    path = ledger_path(root)
    if path.is_file():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                payload["schema_version"] = 2
                payload.setdefault("runs", [])
                payload.setdefault("token_snapshots", [])
                payload.setdefault("shot_decisions", [])
                payload.setdefault("candidates", [])
                payload.setdefault("materialized_outputs", [])
                return payload
        except json.JSONDecodeError:
            pass
    return {
        "schema_version": 2,
        "runs": [],
        "token_snapshots": [],
        "shot_decisions": [],
        "candidates": [],
        "materialized_outputs": [],
        "created_at": _now(),
    }


def save_ledger(root: Path, ledger: dict[str, Any]) -> Path:
    path = ledger_path(root)
    ledger["updated_at"] = _now()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def upsert_run_record(root: Path, record: dict[str, Any]) -> Path:
    """Insert or replace one run's local record; existing history is preserved."""
    ledger = load_ledger(root)
    run_id = str(record.get("run_id") or "")
    if not run_id:
        raise ValueError("run record requires run_id")
    record = dict(record, updated_at=_now())
    runs = [item for item in ledger["runs"] if item.get("run_id") != run_id]
    previous = next((item for item in ledger["runs"] if item.get("run_id") == run_id), None)
    merged = {**(previous or {}), **record}
    runs.append(merged)
    runs.sort(key=lambda item: str(item.get("submitted_at") or ""))
    ledger["runs"] = runs
    return save_ledger(root, ledger)


def record_token_snapshot(root: Path, run_id: str, start: int, end: int, *, source: str = "manual", note: str = "") -> Path:
    """Stable import interface for external Agent token start/end snapshots."""
    if start < 0 or end < start:
        raise ValueError("token 快照必须满足 0 <= start <= end")
    ledger = load_ledger(root)
    ledger["token_snapshots"].append({
        "run_id": run_id, "start": int(start), "end": int(end), "total": int(end) - int(start),
        "source": source, "note": note, "recorded_at": _now(),
    })
    return save_ledger(root, ledger)


def record_shot_decision(
    root: Path,
    *,
    run_id: str,
    shot_id: str,
    decision: str,
    source: Path,
    reason: str,
    candidate: dict[str, Any] | None = None,
    motion_intent: Any = None,
) -> Path:
    """Append an explicit Agent review decision bound to one exact media file."""
    if decision not in {"accepted", "rejected"}:
        raise ValueError("shot decision must be accepted or rejected")
    if not reason.strip():
        raise ValueError("镜头接受/拒绝必须填写审片原因")
    source = source.expanduser().resolve()
    if not source.is_file():
        raise ValueError(f"审片素材不存在：{source}")
    try:
        source_ref = str(source.relative_to(root.resolve()))
    except ValueError as exc:
        raise ValueError("审片素材必须位于项目目录内，避免交接包依赖外部绝对路径") from exc
    source_sha256 = sha256_file(source)
    candidate_fields: dict[str, Any] = {}
    if candidate:
        if str(candidate.get("shot_id") or "") != shot_id:
            raise ValueError(f"候选属于镜头 {candidate.get('shot_id')}，不能记录为镜头 {shot_id}")
        if str(candidate.get("run_id") or "") != run_id:
            raise ValueError(f"候选属于运行 {candidate.get('run_id')}，不能记录为运行 {run_id}")
        if str(candidate.get("source_path") or "") != source_ref or str(candidate.get("source_sha256") or "") != source_sha256:
            raise ValueError("候选记录与本次审片素材路径或哈希不一致")
        candidate_fields = {
            key: candidate.get(key)
            for key in (
                "candidate_id",
                "candidate_group",
                "seed",
                "prompt_sha256",
                "reference_pack_sha256",
                "generation_signature",
                "candidate_kind",
                "source_candidate_id",
                "source_candidate_path",
                "source_candidate_sha256",
                "narrative_trim_seconds",
                "trim_frames",
                "output_fps",
                "audio_policy",
                "trim_policy",
                "composite_intent_sha256",
                "composite_sources",
                "edit_graph_sha256",
                "output_frames",
            )
            if candidate.get(key) is not None
        }
    ledger = load_ledger(root)
    motion_intent_sha256 = canonical_sha256(motion_intent) if motion_intent is not None else None
    ledger["shot_decisions"].append({
        "run_id": run_id,
        "shot_id": shot_id,
        "decision": decision,
        "source_path": source_ref,
        "source_sha256": source_sha256,
        "reason": reason.strip(),
        "reviewed_at": _now(),
        **({"motion_intent_sha256": motion_intent_sha256} if motion_intent_sha256 else {}),
        **candidate_fields,
    })
    return save_ledger(root, ledger)


def record_candidate(root: Path, candidate: dict[str, Any]) -> dict[str, Any]:
    """Upsert one immutable, run-scoped candidate bound to its exact local bytes."""
    run_id = str(candidate.get("run_id") or "")
    shot_id = str(candidate.get("shot_id") or "")
    source_value = str(candidate.get("source_path") or "")
    if not run_id or not shot_id or not source_value:
        raise ValueError("candidate requires run_id, shot_id and source_path")
    source = (root / source_value).resolve()
    try:
        source_ref = str(source.relative_to(root.resolve()))
    except ValueError as exc:
        raise ValueError("候选素材必须位于项目目录内") from exc
    if not source.is_file():
        raise ValueError(f"候选素材不存在：{source}")
    source_sha256 = sha256_file(source)
    expected = str(candidate.get("source_sha256") or source_sha256)
    if expected != source_sha256:
        raise ValueError(f"候选素材SHA256不一致：expected={expected} actual={source_sha256}")
    candidate_id = str(candidate.get("candidate_id") or f"{run_id}:{shot_id}:{source_sha256}")
    record = {
        **candidate,
        "candidate_id": candidate_id,
        "run_id": run_id,
        "shot_id": shot_id,
        "candidate_group": str(candidate.get("candidate_group") or "main"),
        "source_path": source_ref,
        "source_sha256": source_sha256,
        "synced_at": str(candidate.get("synced_at") or _now()),
    }
    ledger = load_ledger(root)
    previous = next((item for item in ledger["candidates"] if item.get("candidate_id") == candidate_id), None)
    if previous:
        changed = [field for field in CANDIDATE_PROVENANCE_FIELDS if previous.get(field) != record.get(field)]
        if changed:
            raise ValueError(
                f"candidate_id provenance 不可变，拒绝重写 {candidate_id}：{', '.join(changed)}"
            )
        return dict(previous)
    ledger["candidates"] = [item for item in ledger["candidates"] if item.get("candidate_id") != candidate_id]
    ledger["candidates"].append(record)
    save_ledger(root, ledger)
    return record


def record_materialized_output(
    root: Path,
    *,
    run_id: str,
    shot_id: str,
    source: Path,
    source_sha256: str,
    input_source_path: str,
    input_source_sha256: str,
) -> dict[str, Any]:
    """Record the exact immutable materialized output selected by sync."""
    source = source.expanduser().resolve()
    try:
        source_ref = str(source.relative_to(root.resolve()))
    except ValueError as exc:
        raise ValueError("materialized output 必须位于项目目录内") from exc
    if not source.is_file():
        raise ValueError(f"materialized output不存在：{source}")
    digest = sha256_file(source)
    if digest != source_sha256:
        raise ValueError(
            f"materialized output SHA256不一致：expected={source_sha256} actual={digest}"
        )
    input_source = (root / input_source_path).resolve()
    try:
        input_ref = str(input_source.relative_to(root.resolve()))
    except ValueError as exc:
        raise ValueError("materialized input source 必须位于项目目录内") from exc
    if not input_source.is_file():
        raise ValueError(f"materialized input source不存在：{input_source}")
    actual_input_sha256 = sha256_file(input_source)
    if actual_input_sha256 != input_source_sha256:
        raise ValueError(
            "materialized input source SHA256不一致："
            f"expected={input_source_sha256} actual={actual_input_sha256}"
        )
    record = {
        "output_id": f"{run_id}:{shot_id}",
        "run_id": run_id,
        "shot_id": shot_id,
        "source_path": source_ref,
        "source_sha256": digest,
        "input_source_path": input_ref,
        "input_source_sha256": actual_input_sha256,
        "synced_at": _now(),
    }
    ledger = load_ledger(root)
    previous = next(
        (item for item in ledger["materialized_outputs"] if item.get("output_id") == record["output_id"]),
        None,
    )
    if previous:
        immutable = (
            "run_id", "shot_id", "source_path", "source_sha256",
            "input_source_path", "input_source_sha256",
        )
        changed = [field for field in immutable if previous.get(field) != record.get(field)]
        if changed:
            raise ValueError(
                f"materialized output不可变，拒绝重写 {record['output_id']}：{', '.join(changed)}"
            )
        return dict(previous)
    ledger["materialized_outputs"].append(record)
    save_ledger(root, ledger)
    return record


def latest_materialized_output(
    root: Path,
    shot_id: str,
    *,
    input_source: Path | None = None,
) -> dict[str, Any] | None:
    input_ref = None
    input_sha256 = None
    if input_source is not None:
        input_source = input_source.expanduser().resolve()
        if not input_source.is_file():
            return None
        try:
            input_ref = str(input_source.relative_to(root.resolve()))
        except ValueError:
            return None
        input_sha256 = sha256_file(input_source)
    for item in reversed(load_ledger(root).get("materialized_outputs") or []):
        if str(item.get("shot_id") or "") != shot_id:
            continue
        if input_ref is not None and (
            str(item.get("input_source_path") or "") != input_ref
            or str(item.get("input_source_sha256") or "") != input_sha256
        ):
            continue
        source = (root / str(item.get("source_path") or "")).resolve()
        if source.is_file() and str(item.get("source_sha256") or "") == sha256_file(source):
            return dict(item)
    return None


def latest_shot_decisions(ledger: dict[str, Any]) -> dict[str, dict[str, Any]]:
    latest: dict[str, dict[str, Any]] = {}
    for item in ledger.get("shot_decisions") or []:
        shot_id = str(item.get("shot_id") or "")
        if shot_id:
            latest[shot_id] = dict(item)
    return latest


def candidate_is_current(root: Path, candidate: dict[str, Any]) -> bool:
    source_ref = str(candidate.get("source_path") or "")
    expected = str(candidate.get("source_sha256") or "")
    source = (root / source_ref).resolve() if source_ref else None
    return bool(source and source.is_file() and expected and sha256_file(source) == expected)


def candidate_sidecar_is_current(root: Path, candidate: dict[str, Any]) -> bool:
    sidecar_ref = str(candidate.get("sidecar_path") or "")
    if not sidecar_ref:
        return False
    root = root.resolve()
    raw = Path(sidecar_ref).expanduser()
    if not raw.is_absolute():
        raw = root / raw
    try:
        relative = raw.absolute().relative_to(root)
    except ValueError:
        return False
    cursor = root
    for part in relative.parts:
        cursor = cursor / part
        if cursor.is_symlink():
            return False
    sidecar = raw.resolve()
    if not sidecar.is_file():
        return False
    try:
        return json.loads(sidecar.read_text(encoding="utf-8")) == candidate
    except (json.JSONDecodeError, OSError):
        return False


def candidates_for_shot(root: Path, shot_id: str, *, run_id: str | None = None) -> list[dict[str, Any]]:
    records = []
    for item in load_ledger(root).get("candidates") or []:
        if str(item.get("shot_id") or "") != shot_id:
            continue
        if run_id is not None and str(item.get("run_id") or "") != run_id:
            continue
        records.append(dict(item))
    return records


def latest_candidate(root: Path, shot_id: str, *, run_id: str | None = None) -> dict[str, Any] | None:
    for item in reversed(candidates_for_shot(root, shot_id, run_id=run_id)):
        if candidate_is_current(root, item):
            return item
    return None


def candidate_for_source(root: Path, source: Path) -> dict[str, Any] | None:
    source = source.expanduser().resolve()
    if not source.is_file():
        return None
    try:
        source_ref = str(source.relative_to(root.resolve()))
    except ValueError:
        return None
    digest = sha256_file(source)
    for item in reversed(load_ledger(root).get("candidates") or []):
        if str(item.get("source_path") or "") == source_ref and str(item.get("source_sha256") or "") == digest:
            return dict(item)
    return None


def candidate_derivation_is_current(root: Path, candidate: dict[str, Any]) -> bool:
    """Validate an input candidate without relying on mutable current shot YAML.

    A generated candidate is a leaf. A narrative trim must still prove its
    exact generated parent and deterministic 24fps/no-audio trim metadata.
    Composite inputs are deliberately rejected to keep derivation depth one.
    """
    if not candidate_is_current(root, candidate) or not candidate_sidecar_is_current(root, candidate):
        return False
    kind = str(candidate.get("candidate_kind") or "generated")
    if kind == "generated":
        return True
    if kind != "narrative_trim":
        return False
    try:
        frames = int(candidate.get("trim_frames") or 0)
        seconds = Decimal(str(candidate.get("narrative_trim_seconds") or ""))
        if (
            frames <= 0
            or seconds * 24 != frames
            or int(candidate.get("output_fps") or 0) != 24
            or str(candidate.get("audio_policy") or "") != "strip"
            or str(candidate.get("trim_policy") or "") != "fps24-first-n-frames-v1"
        ):
            return False
    except (InvalidOperation, TypeError, ValueError):
        return False
    parent_ref = str(candidate.get("source_candidate_path") or "")
    parent_sha = str(candidate.get("source_candidate_sha256") or "")
    parent_id = str(candidate.get("source_candidate_id") or "")
    if not parent_ref or not parent_sha or not parent_id:
        return False
    parent = (root / parent_ref).resolve()
    try:
        parent.relative_to(root.resolve())
    except ValueError:
        return False
    if not parent.is_file() or sha256_file(parent) != parent_sha:
        return False
    recorded_parent = candidate_for_source(root, parent)
    return bool(
        recorded_parent
        and str(recorded_parent.get("candidate_id") or "") == parent_id
        and str(recorded_parent.get("candidate_kind") or "generated") == "generated"
        and candidate_is_current(root, recorded_parent)
        and candidate_sidecar_is_current(root, recorded_parent)
    )


def candidate_matches_shot_intent(root: Path, shot: dict[str, Any], candidate: dict[str, Any]) -> bool:
    """Whether one exact current candidate implements the shot's post-generation intent."""
    if str(candidate.get("shot_id") or "") != str(shot.get("id") or ""):
        return False
    if not candidate_is_current(root, candidate):
        return False
    requested = shot.get("narrative_trim_seconds")
    composite_value = shot.get("composite")
    kind = str(candidate.get("candidate_kind") or "generated")
    if composite_value is not None:
        if requested is not None or kind != COMPOSITE_KIND:
            return False
        if not candidate_sidecar_is_current(root, candidate):
            return False
        try:
            intent = normalize_composite_intent(composite_value)
        except ValueError:
            return False
        edit_graph = build_edit_graph(intent)
        if (
            candidate.get("composite_intent") != intent
            or str(candidate.get("composite_intent_sha256") or "") != canonical_sha256(intent)
            or candidate.get("edit_graph") != edit_graph
            or str(candidate.get("edit_graph_sha256") or "") != canonical_sha256(edit_graph)
            or int(candidate.get("output_frames") or 0) != int(intent["output_frames"])
            or int(candidate.get("output_fps") or 0) != int(intent["output_fps"])
            or str(candidate.get("audio_policy") or "") != str(intent["audio_policy"])
        ):
            return False
        declared_sources = list(candidate.get("composite_sources") or [])
        if len(declared_sources) != len(intent["segments"]):
            return False
        for segment, source_record in zip(intent["segments"], declared_sources):
            if not isinstance(source_record, dict) or any(
                str(source_record.get(field) or "") != str(segment[field])
                for field in ("candidate_id", "source_path", "source_sha256")
            ):
                return False
            source = (root / str(segment["source_path"])).resolve()
            try:
                source.relative_to(root.resolve())
            except ValueError:
                return False
            if not source.is_file() or sha256_file(source) != str(segment["source_sha256"]):
                return False
            recorded_source = candidate_for_source(root, source)
            recorded_kind = str((recorded_source or {}).get("candidate_kind") or "generated")
            if (
                not recorded_source
                or str(recorded_source.get("candidate_id") or "") != str(segment["candidate_id"])
                or str(source_record.get("candidate_kind") or "generated") != recorded_kind
                or not candidate_derivation_is_current(root, recorded_source)
            ):
                return False
        renderer = candidate.get("renderer") or {}
        return bool(
            isinstance(renderer, dict)
            and renderer.get("tool") == "ffmpeg"
            and str(renderer.get("version") or "").strip()
        )
    if requested is None:
        return kind == "generated"
    try:
        seconds = Decimal(str(requested))
        frames = seconds * 24
        if not seconds.is_finite() or seconds <= 0 or frames != frames.to_integral_value():
            return False
    except (InvalidOperation, ValueError):
        return False
    if kind != "narrative_trim":
        return False
    if not candidate_sidecar_is_current(root, candidate):
        return False
    canonical_seconds = format(Decimal(int(frames)) / Decimal(24), "f")
    if (
        int(candidate.get("trim_frames") or 0) != int(frames)
        or int(candidate.get("output_fps") or 0) != 24
        or str(candidate.get("audio_policy") or "") != "strip"
        or str(candidate.get("narrative_trim_seconds") or "") != canonical_seconds
    ):
        return False
    parent_ref = str(candidate.get("source_candidate_path") or "")
    parent_sha = str(candidate.get("source_candidate_sha256") or "")
    parent_id = str(candidate.get("source_candidate_id") or "")
    if not parent_ref or not parent_sha or not parent_id:
        return False
    parent = (root / parent_ref).resolve()
    try:
        parent.relative_to(root.resolve())
    except ValueError:
        return False
    if not parent.is_file() or sha256_file(parent) != parent_sha:
        return False
    recorded_parent = candidate_for_source(root, parent)
    return bool(
        recorded_parent
        and str(recorded_parent.get("candidate_id") or "") == parent_id
        and str(recorded_parent.get("candidate_kind") or "generated") == "generated"
    )


def candidate_for_shot_intent(
    project: H3Project,
    shot: dict[str, Any],
    *,
    run_id: str | None = None,
) -> dict[str, Any] | None:
    """Resolve the newest exact candidate matching current YAML post-generation intent."""
    shot_id = str(shot.get("id") or "")
    for item in reversed(candidates_for_shot(project.root, shot_id, run_id=run_id)):
        if candidate_matches_shot_intent(project.root, shot, item):
            return item
    return None


def shot_decision_is_current(root: Path, decision: dict[str, Any]) -> bool:
    source_ref = str(decision.get("source_path") or "")
    expected = str(decision.get("source_sha256") or "")
    source = (root / source_ref).resolve() if source_ref else None
    return bool(source and source.is_file() and expected and sha256_file(source) == expected)


def latest_shot_decision_for_source(root: Path, shot_id: str, source: Path) -> dict[str, Any] | None:
    """Return the latest decision for one exact path+SHA, ignoring other candidates."""
    source = source.expanduser().resolve()
    if not source.is_file():
        return None
    try:
        source_ref = str(source.relative_to(root.resolve()))
    except ValueError:
        return None
    digest = sha256_file(source)
    for item in reversed(load_ledger(root).get("shot_decisions") or []):
        if (
            str(item.get("shot_id") or "") == shot_id
            and str(item.get("source_path") or "") == source_ref
            and str(item.get("source_sha256") or "") == digest
        ):
            return dict(item)
    return None


def accepted_source_path(project: H3Project, shot: dict[str, Any]) -> Path | None:
    """Return the configured source only when the latest acceptance binds that exact file."""
    if motion_phase_review_intent_errors(project, shot):
        return None
    configured = project.path_for(shot.get("source_path"))
    if not configured or not configured.is_file():
        return None
    decision = latest_shot_decision_for_source(project.root, str(shot.get("id") or ""), configured)
    if not decision or decision.get("decision") != "accepted" or not shot_decision_is_current(project.root, decision):
        return None
    current_motion_intent = motion_phase_intent(project, shot)
    current_motion_intent_sha256 = (
        canonical_sha256(current_motion_intent) if current_motion_intent is not None else None
    )
    if decision.get("motion_intent_sha256") != current_motion_intent_sha256:
        return None
    candidate = candidate_for_source(project.root, configured)
    # Manual/non-candidate sources keep their legacy exact path+SHA semantics.
    # Every recorded candidate, however, must still implement current YAML
    # intent. This also invalidates an accepted derivative when the trim key is
    # later removed, instead of silently treating that old trim as a raw take.
    if (
        shot.get("narrative_trim_seconds") is not None
        or shot.get("composite") is not None
    ) and not candidate:
        # A manual/legacy source cannot prove which generated parents and exact
        # post-generation graph produced it. Once trim/composite intent is
        # declared, only a recorded derivative with complete provenance is
        # eligible.
        return None
    if candidate and not candidate_matches_shot_intent(project.root, shot, candidate):
        return None
    return configured.resolve()


def _local_phase(timings: dict[str, Any], keys: tuple[str, ...]) -> float:
    return round(sum(float(timings.get(key) or 0) for key in keys), 3)


def _run_wall_seconds(remote_run: dict[str, Any] | None, local_record: dict[str, Any] | None) -> float:
    if remote_run:
        started, completed = remote_run.get("started_at"), remote_run.get("completed_at")
        if started and completed:
            try:
                start_dt = datetime.fromisoformat(str(started).replace("Z", "+00:00"))
                complete_dt = datetime.fromisoformat(str(completed).replace("Z", "+00:00"))
                seconds = (complete_dt - start_dt).total_seconds()
                if seconds >= 0:
                    return round(seconds, 3)
            except ValueError:
                pass
    timings = (local_record or {}).get("timings_seconds") or {}
    return round(float(timings.get("总耗时") or 0), 3)


def build_billing(project: H3Project, remote_history: dict[str, Any] | None = None) -> dict[str, Any]:
    """Aggregate every known run of the project (local ledger + runner history)."""
    ledger = load_ledger(project.root)
    local_runs = {str(item.get("run_id")): item for item in ledger.get("runs") or []}
    remote_runs = {str(item.get("run_id") or item.get("id")): item for item in (remote_history or {}).get("runs") or []}
    remote_available = remote_history is not None
    run_ids = sorted(set(local_runs) | set(remote_runs))

    totals = {
        "runs": 0, "wall_seconds": 0.0, "model_load_seconds": 0.0, "sampling_seconds": 0.0,
        "vae_seconds": 0.0, "transfer_seconds": 0.0, "render_seconds": 0.0, "qa_seconds": 0.0,
        "shot_attempts": 0,
    }
    attempts: dict[str, int] = {}
    latest_status: dict[str, str] = {}
    failures: list[dict[str, Any]] = []
    billing_runs: list[dict[str, Any]] = []

    for run_id in run_ids:
        local, remote = local_runs.get(run_id), remote_runs.get(run_id)
        local_timings = (local or {}).get("timings_seconds") or {}
        remote_timings = (remote or {}).get("timings_seconds") or {}
        phases: dict[str, float] = {}
        for name, keys in REMOTE_PHASE_MAP.items():
            phases[name] = round(float(remote_timings.get(keys[0]) or local_timings.get(keys[1], 0) or 0), 3)
        for name, keys in LOCAL_PHASE_MAP.items():
            phases[name] = _local_phase(local_timings, keys)
        wall = _run_wall_seconds(remote, local)
        status = str((remote or {}).get("status") or (local or {}).get("status") or "unknown")
        tasks = (remote or {}).get("tasks") or (local or {}).get("tasks") or []
        for task in tasks:
            shot_id = str(task.get("id") or "")
            if not shot_id:
                continue
            attempts[shot_id] = attempts.get(shot_id, 0) + 1
            latest_status[shot_id] = str(task.get("status") or "unknown")
            if task.get("error"):
                failures.append({"run_id": run_id, "shot_id": shot_id, "error": str(task["error"])})
        if (remote or {}).get("error"):
            failures.append({"run_id": run_id, "shot_id": None, "error": str(remote["error"])})
        totals["runs"] += 1
        totals["wall_seconds"] += wall
        totals["model_load_seconds"] += phases["model_load"]
        totals["sampling_seconds"] += phases["sampling"]
        totals["vae_seconds"] += phases["vae"]
        totals["transfer_seconds"] += phases["transfer"]
        totals["render_seconds"] += phases["render"]
        totals["qa_seconds"] += phases["qa"]
        billing_runs.append({
            "run_id": run_id,
            "kind": (local or {}).get("kind") or "unknown",
            "status": status,
            "started_at": (remote or {}).get("started_at") or (local or {}).get("submitted_at"),
            "completed_at": (remote or {}).get("completed_at"),
            "wall_seconds": wall,
            "phases_seconds": phases,
            "shots": sorted({str(task.get("id")) for task in tasks if task.get("id")}),
        })
    totals["shot_attempts"] = sum(attempts.values())

    generated_completed = sorted(shot_id for shot_id, status in latest_status.items() if status == "completed")
    decisions = latest_shot_decisions(ledger)
    shot_map = project.shot_map
    accepted = sorted(
        shot_id for shot_id, shot in shot_map.items()
        if accepted_source_path(project, shot) is not None
    )
    rejected = sorted(
        shot_id for shot_id, item in decisions.items()
        if item.get("decision") == "rejected"
        and shot_decision_is_current(project.root, item)
        and shot_id not in accepted
    )
    stale_decisions = sorted(
        shot_id for shot_id, item in decisions.items()
        if not shot_decision_is_current(project.root, item)
        or (
            item.get("decision") == "accepted"
            and (shot_id not in shot_map or accepted_source_path(project, shot_map[shot_id]) is None)
        )
    )
    materialized_unreviewed = sorted({
        str(shot.get("id")) for shot in project.shots
        if project.path_for(shot.get("source_path")) and project.path_for(shot.get("source_path")).is_file()
        and str(shot.get("id")) not in accepted
    })
    retried = sorted(shot_id for shot_id, count in attempts.items() if count > 1)
    failed = sorted(shot_id for shot_id, status in latest_status.items() if status in {"failed", "blocked", "cancelled"})

    snapshots_by_run: dict[str, int] = {}
    for snapshot in ledger.get("token_snapshots") or []:
        run_id = str(snapshot.get("run_id") or "")
        snapshots_by_run[run_id] = snapshots_by_run.get(run_id, 0) + int(snapshot.get("total") or 0)
    token_usage: dict[str, Any] = {
        "available": bool(snapshots_by_run),
        "detail": TOKEN_UNAVAILABLE if not snapshots_by_run else f"{len(snapshots_by_run)} 个运行含外部导入的Token起止快照",
        "runs": snapshots_by_run,
        "total_tokens": sum(snapshots_by_run.values()) if snapshots_by_run else None,
    }

    return {
        "schema_version": 2,
        "project_id": project.project_id,
        "generated_at": _now(),
        "remote_history": "已合并GPU运行器历史" if remote_available else "不可用：仅统计本机台账",
        "totals": {key: round(value, 3) if isinstance(value, float) else value for key, value in totals.items()},
        "shots": {
            "accepted": accepted,
            "rejected": rejected,
            "generated_completed": generated_completed,
            "materialized_unreviewed": materialized_unreviewed,
            "stale_decisions": stale_decisions,
            "retried": retried,
            "failed": failed,
            "attempts": attempts,
            "decisions": decisions,
        },
        "failures": failures,
        "runs": billing_runs,
        "token_usage": token_usage,
    }


def write_billing(project: H3Project, billing: dict[str, Any]) -> Path:
    path = project.root / "工程" / LEDGER_NAME.replace(".json", "-汇总.json")
    path.write_text(json.dumps(billing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def format_billing_summary(billing: dict[str, Any]) -> str:
    totals = billing["totals"]
    shots = billing["shots"]
    lines = [
        f"项目账单：{billing['project_id']}（{billing['remote_history']}）",
        f"运行次数：{totals['runs']}，墙钟总计：{totals['wall_seconds']:.1f}s",
        (
            f"阶段耗时：模型加载 {totals['model_load_seconds']:.1f}s / 采样 {totals['sampling_seconds']:.1f}s / "
            f"VAE与剥离 {totals['vae_seconds']:.1f}s / 传输 {totals['transfer_seconds']:.1f}s / "
            f"渲染 {totals['render_seconds']:.1f}s / QA {totals['qa_seconds']:.1f}s"
        ),
        (
            f"镜头：尝试 {totals['shot_attempts']} 次，生成完成 {len(shots['generated_completed'])} 个，"
            f"明确接受 {len(shots['accepted'])} 个，明确拒绝 {len(shots['rejected'])} 个，"
            f"重试 {len(shots['retried'])} 个（{', '.join(shots['retried']) or '无'}），"
            f"失败 {len(shots['failed'])} 个（{', '.join(shots['failed']) or '无'}）"
        ),
        f"Agent Token：{billing['token_usage']['detail']}",
    ]
    if billing["failures"]:
        lines.append(f"失败原因 {len(billing['failures'])} 条，详见 工程/生产账单-汇总.json")
    return "\n".join(lines)
