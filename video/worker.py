"""Run on the Windows GPU host via SSH. Only the four installed H3 presets are selectable."""
import os
import hashlib
import json
import shutil
import socket
import subprocess
import sys
import time
import uuid
from pathlib import Path
from urllib import error, request

HTTP = request.build_opener(request.ProxyHandler({}))


def api(port, path, data=None, headers=None):
    req = request.Request(f"http://127.0.0.1:{port}{path}",
                          None if data is None else json.dumps(data).encode(),
                          {"Content-Type": "application/json", **(headers or {})})
    try:
        with HTTP.open(req, timeout=12) as response:
            return json.load(response)
    except error.HTTPError as exc:
        raise RuntimeError(f"{path}: HTTP {exc.code}: {exc.read(500)!r}") from exc


def listening(port):
    with socket.socket() as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def save(path, data):
    tmp = path.with_suffix(f".{uuid.uuid4().hex}.tmp")
    tmp.write_text(json.dumps(data), encoding="utf-8")
    tmp.replace(path)


def prepare_qwen():
    if not CONFIG.get("qwenConfig"):
        return
    cfg = json.loads(Path(CONFIG["qwenConfig"]).read_text("utf-8-sig"))
    headers = {"Authorization": "Bearer " + cfg["api_key"]}
    port = CONFIG["qwenPort"]
    health = api(port, "/v1/qwen/health", headers=headers)
    if health["busy"]:
        raise ValueError("Qwen is generating. Retry after the image finishes.")
    if health["loaded"]:
        api(port, "/v1/qwen/unload", {}, headers)
    if CONFIG.get("qwenWorkerPort") and listening(CONFIG["qwenWorkerPort"]):
        raise ValueError("Qwen still occupies the GPU. Retry once it is idle.")


def service():
    if CONFIG.get("orchestratorPort") and listening(CONFIG["orchestratorPort"]):
        raise ValueError("The video orchestrator is online. Retry when idle.")
    prepare_qwen()
    ports = [p for p in (PORT, CONFIG.get("alternatePort")) if p and listening(p)]
    if len(ports) > 1:
        raise ValueError("Two GPU workspaces are open. Close one before generating.")
    started_here = False
    if ports:
        port = ports[0]
    else:
        if not CONFIG.get("startupTask"):
            raise ValueError("Start the configured ComfyUI workspace before submitting a job.")
        used = int(subprocess.check_output(["nvidia-smi", "--query-gpu=memory.used",
                    "--format=csv,noheader,nounits"]).splitlines()[0])
        if used > 6000:
            raise ValueError(f"GPU is occupied ({used} MiB). Retry when idle.")
        start = ("$ErrorActionPreference='Stop'; $t=Get-ScheduledTask -TaskName $env:DSH_H3_TASK; "
                 "if ($t.State -eq 'Running') { 'existing' } else { Start-ScheduledTask -InputObject $t; 'started' }")
        started_here = subprocess.check_output(["powershell", "-NoProfile", "-NonInteractive",
                                                "-Command", start], env={**os.environ, "DSH_H3_TASK": CONFIG["startupTask"]}).strip() == b"started"
        port = PORT
    for _ in range(100):
        if listening(port):
            api(port, "/system_stats")
            # argv[0] is often relative, so check the process working directory.
            import psutil
            owners = {c.pid for c in psutil.net_connections(kind="tcp")
                      if c.laddr.port == port and c.status == psutil.CONN_LISTEN and c.pid}
            processes = [psutil.Process(pid) for pid in owners]
            studio = next((p for p in processes if Path(p.cwd()).resolve() == STUDIO.resolve()), None)
            if not studio:
                raise ValueError(f"Port {port} belongs to another workspace.")
            if started_here:
                save(STATE / "started.json", {"pid": studio.pid, "created": studio.create_time()})
            return port
        time.sleep(1)
    raise TimeoutError("H3 startup timed out. Check the production ComfyUI log.")


def state_path(job_id):
    if str(uuid.UUID(job_id)) != job_id:
        raise ValueError("Invalid H3 job id")
    return STATE / (job_id + ".json")


def submit(args):
    job_id = args["id"]
    path = state_path(job_id)
    state = {"id": job_id, "preset": args["preset"], "seed": args["seed"]}
    state.update(duration_seconds=args["duration_seconds"], frames=args["frames"], actual_seconds=args["frames"] / 24)
    workflow = args["workflow"]
    def node(kind):
        matches = [n["inputs"] for n in workflow.values() if n["class_type"] == kind]
        if len(matches) != 1:
            raise ValueError(f"Unexpected workflow layout for {kind}")
        return matches[0]
    refs = args.get("reference_images", [])
    kind = "MiniMaxH3ReferenceToVideo" if refs else "MiniMaxH3ImageToVideo"
    state.update(mode="ref2va" if refs else "t2va", reference_images=refs)
    node(kind)["prompt"] = args["prompt"]
    node(kind)["length"] = state["frames"]
    node("RandomNoise")["noise_seed"] = state["seed"]
    node("SaveVideo")["filename_prefix"] = f"dsh-h3-video/{job_id}"
    STATE.mkdir(parents=True, exist_ok=True)
    # Serialise cold starts and registration; Windows releases the lock on process exit.
    import msvcrt
    with (STATE / "submit.lock").open("a+b") as lock:
        lock.seek(0)
        msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        if path.exists():
            return json.loads(path.read_text())
        state["port"] = service()
        if refs and args["port"] != state["port"]:
            raise ValueError("Workspace changed during reference upload. Retry the same job.")
        save(path, state)
        try:
            result = api(state["port"], "/prompt", {"prompt_id": job_id, "prompt": workflow})
        except RuntimeError as exc:
            state.update(status="failed", message=str(exc))
            save(path, state)
            raise
        if result.get("prompt_id") != job_id:
            raise ValueError(f"Unexpected job receipt: {result}")
    return state


def status(job_id):
    path = state_path(job_id)
    if not path.exists():
        raise ValueError("No job receipt for this ID. The submission did not reach H3.")
    state = json.loads(path.read_text())
    if state.get("status") in ("complete", "failed"):
        return state
    port = state["port"]
    if not listening(port):
        raise ValueError("H3 server is offline. Check the existing job before retrying.")
    row = api(port, "/history/" + job_id).get(job_id)
    if not row:
        queue = api(port, "/queue")
        for key, label in (("queue_running", "running"), ("queue_pending", "queued")):
            if any(item[1] == job_id for item in queue[key]):
                return {**state, "status": label}
        return {**state, "status": "unknown", "message": "Job absent from queue and history; check the server log."}
    result = row["status"]
    if result["status_str"] == "error":
        details = [m.get("exception_message") or name for name, m in result["messages"]
                   if name in ("execution_error", "execution_interrupted")]
        state.update(status="failed", message="; ".join(details)[:500] or "Execution failed")
    else:
        if not result["completed"]:
            return {**state, "status": "running"}
        artifacts = [item for output in row["outputs"].values()
                     for group in output.values() if isinstance(group, list)
                     for item in group if isinstance(item, dict)
                     and item.get("type") == "output" and item.get("subfolder") == "dsh-h3-video"
                     and item.get("filename", "").startswith(job_id + "_")
                     and Path(item["filename"]).name == item["filename"]
                     and item["filename"].lower().endswith(".mp4")]
        if len(artifacts) != 1:
            raise ValueError("Completed job has no unique H3 MP4")
        artifact = artifacts[0]
        video = OUTPUT / artifact["filename"]
        with video.open("rb") as f:
            digest = hashlib.file_digest(f, "sha256").hexdigest()
        state.update(status="complete", file=video.name, bytes=video.stat().st_size, sha256=digest)
    save(path, state)
    return state


def release():
    import psutil
    import msvcrt
    marker = STATE / "started.json"
    if not marker.exists():
        return {"status": "shared", "message": "No plugin-started service to release."}
    with (STATE / "submit.lock").open("a+b") as lock:
        lock.seek(0)
        msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        owner = json.loads(marker.read_text())
        if not psutil.pid_exists(owner["pid"]):
            marker.unlink()
            return {"status": "released"}
        proc = psutil.Process(owner["pid"])
        if proc.create_time() != owner["created"] or Path(proc.cwd()).resolve() != STUDIO.resolve():
            marker.unlink()
            return {"status": "shared", "message": "Server ownership has changed."}
        if CONFIG.get("orchestratorPort") and listening(CONFIG["orchestratorPort"]):
            return {"status": "busy", "message": "Production orchestrator is online."}
        queue = api(PORT, "/queue")
        if queue["queue_running"] or queue["queue_pending"]:
            return {"status": "busy", "message": "H3 still has active or queued work."}
        # Persist results before ComfyUI loses its in-memory history.
        for path in STATE.glob("*.json"):
            if path != marker:
                record = json.loads(path.read_text())
                if record.get("port") == PORT and not record.get("status"):
                    status(record["id"])
        proc.terminate()
        proc.wait(timeout=15)
        marker.unlink()
        return {"status": "released"}


def main(args):
    global CONFIG, STUDIO, STATE, OUTPUT, PORT
    CONFIG = args["config"]
    STUDIO = Path(CONFIG["studioDir"])
    if not STUDIO.is_absolute():
        raise ValueError("studioDir must be absolute on the GPU host")
    STATE = Path(CONFIG.get("stateDir", STUDIO / "user" / "dsh-h3-video"))
    OUTPUT = Path(CONFIG.get("outputDir", STUDIO / "output")) / "dsh-h3-video"
    PORT = CONFIG.get("port", 8188)
    if args["op"] == "release":
        return release()
    if args["op"] == "prepare":
        path = state_path(args["id"])
        return {"existing": json.loads(path.read_text())} if path.exists() else {"port": service()}
    if args["op"] == "submit":
        return submit(args)
    result = status(args["id"])
    if args["op"] == "download":
        if result.get("status") != "complete":
            raise ValueError("Video is not ready")
        with (OUTPUT / result["file"]).open("rb") as source:
            shutil.copyfileobj(source, sys.stdout.buffer)
        return None
    return result
