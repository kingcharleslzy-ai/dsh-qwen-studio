import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { openSync, closeSync } from "node:fs";
import { access, readFile, mkdir } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { resolveConfig } from "./resolved-config.js";
import { fileURLToPath } from "node:url";
import { copyFile } from "node:fs/promises";
import { RemoteQueue, remoteURL, headers } from "./remote.js";
import { readJobs } from "./storage.js";
import { atomicJSON } from "./storage.js";
import { upgradeIdleWorker } from "./worker-upgrade.js";
import type { Config } from "./config.js";
import type { Health } from "./shared.js";
import { RemoteLifecycle, SshTunnel, sshOptions } from "./remote-lifecycle.js";
import { requiredFeatures, type RemoteCapabilities } from "./remote-protocol.js";
const BASE = "http://127.0.0.1:19388";
const exec = promisify(execFile);
export interface ReferenceEditing { supported: boolean; reason?: string; mflux_version?: string; verification?: string }
export class Worker {
  readonly remote = new RemoteQueue();
  transportConfig(): Config {
    return { ...this.config(), ...resolveConfig(this.config()) };
  }
  mode() {
    return resolveConfig(this.config()).connectionMode;
  }
  private starting: Promise<void> | undefined;
  private editProbe?: { key: string; expires: number; value: Promise<ReferenceEditing> };
  async referenceEditing(): Promise<ReferenceEditing> {
    if (this.mode() === "remote") return { supported: Boolean((await this.capabilities().catch(() => null))?.features.includes("reference_edit")), verification: this.managedSSH() ? "on_generation" : "handshake" };
    const { pythonPath, modelPath } = resolveConfig(this.config()), key = JSON.stringify([pythonPath, modelPath]);
    if (this.editProbe?.key === key && this.editProbe.expires > Date.now()) return this.editProbe.value;
    const bundled = resolve(dirname(fileURLToPath(import.meta.url)), "../backend/server.py");
    const value = exec(pythonPath, [bundled, "--check-reference-edit", modelPath], {
      timeout: 15000, maxBuffer: 65536, env: { ...process.env, HF_HUB_OFFLINE: "1" },
    }).then(({ stdout }) => {
      const result = JSON.parse(stdout.trim()) as ReferenceEditing;
      if (typeof result.supported !== "boolean") throw Error("MFLUX 能力检测响应无效");
      return result;
    }).catch((e: Error) => ({ supported: false, reason: `本机原生编辑检查失败：${e.message}` }));
    this.editProbe = { key, expires: Date.now() + 30000, value }; return value;
  }
  private modeGate: Promise<unknown> = Promise.resolve();
  private serialized<T>(fn: () => Promise<T>) {
    const result = this.modeGate.then(fn); this.modeGate = result.catch(() => {}); return result;
  }
  switchConnection(mode: "local" | "remote", persist: () => Promise<void>) {
    return this.serialized(async () => {
      if (mode === this.mode()) return;
      if (this.remote.size) throw Error("有远程任务正在上传、排队或生成，结束后再切换");
      // Also protect a local worker left running by a previous process.
      try {
        const r = await fetch(BASE + "/health", { signal: AbortSignal.timeout(1500) });
        if (r.ok && (await r.json() as Health).busy) throw Error("有本机生图任务正在运行，结束后再切换");
      } catch (e) { if (e instanceof Error && e.message.includes("本机生图任务")) throw e; }
      if (mode === "local") {
        const local = resolveConfig(this.config()); await access(local.pythonPath); await access(local.modelPath);
      } else {
        remoteURL(this.transportConfig()); sshOptions(this.transportConfig());
      }
      if (this.mode() === "remote" && this.managedSSH()) await this.lifecycle.unload();
      if (this.mode() === "local") {
        const health = await this.health();
        if (health.status === "ok") await this.post("/v1/unload", {});
      }
      await persist();
      if (this.mode() !== mode) throw Error("宿主尚未确认运行位置更新，请重新读取状态");
    });
  }
  private settingsKey = "";
  readonly lifecycle: RemoteLifecycle;
  constructor(private config: () => Config) {
    this.lifecycle = new RemoteLifecycle(() => this.transportConfig(), new SshTunnel(), {
      configure: (c, seconds) => this.configureRemote(c, seconds),
      unload: (c) => this.unloadRemote(c),
    });
  }
  managedSSH() { return this.mode() === "remote" && Boolean(this.transportConfig().remoteSshHost?.trim()); }
  async capabilities(): Promise<RemoteCapabilities | null> {
    if (this.managedSSH() && !this.lifecycle.connected) {
      sshOptions(this.transportConfig());
      // Configured Qwen protocol contract; actual handshake is mandatory at submission.
      // Passive reads must never create an SSH connection.
      return { protocol: "dsh-qwen", version: 1, features: [...requiredFeatures, "reference_edit"], schedulers: ["linear", "flow_match_euler_discrete", "seedvr2_euler"], verification: "on_generation" } as RemoteCapabilities;
    }
    return this.remote.capabilities(this.transportConfig());
  }
  private async configureRemote(config: Config, seconds: number) {
    const r = await fetch(remoteURL(config) + "/qwen/runtime-config", { method: "POST", headers: headers(config), body: JSON.stringify({ idle_seconds: seconds }), signal: AbortSignal.timeout(5000), redirect: "error" });
    if (!r.ok) throw Error(`远程空闲设置失败：HTTP ${r.status}；请更新配套 Qwen 网关`);
    const value = await r.json() as { idle_seconds?: number };
    if (value.idle_seconds !== seconds) throw Error("远程空闲时间未确认，请检查网关版本");
  }
  private async unloadRemote(config: Config) {
    const r = await fetch(remoteURL(config) + "/qwen/unload", { method: "POST", headers: headers(config), body: "{}", signal: AbortSignal.timeout(45000), redirect: "error" });
    if (!r.ok || !(await r.json() as { unloaded?: boolean }).unloaded) throw Error("远程仍有任务或模型卸载未确认；保留连接稍后重试");
    const h = await fetch(remoteURL(config) + "/qwen/health", { headers: headers(config), signal: AbortSignal.timeout(5000), redirect: "error" });
    if (!h.ok) throw Error("未能核对远程模型已卸载，保留连接");
    const health = await h.json() as Health;
    if (health.loaded || health.busy) throw Error("远程仍有任务或模型尚未退出，保留连接");
  }
  async dispose() { await this.remote.dispose(); await this.lifecycle.dispose(); }
  directory() {
    return resolveConfig(this.config()).localMfluxDirectory;
  }

  async sync() {
    const effective = resolveConfig(this.config()),
      dir = effective.localMfluxDirectory,
      minutes = effective.localMfluxIdleMinutes,
      loraDirectory = effective.loraDirectory;
    const key = JSON.stringify([dir, minutes, loraDirectory]);
    if (key === this.settingsKey) return;
    await mkdir(join(dir, "state"), { recursive: true });
    await atomicJSON(join(dir, "state/runtime-config.json"), {
      idle_seconds: Math.round(minutes * 60),
      lora_directory: loraDirectory,
    });
    this.settingsKey = key;
  }
  async health(): Promise<Health> {
    try {
      if (this.mode() === "remote") {
        if (this.managedSSH() && !this.lifecycle.connected) return { status: "remote", loaded: false, busy: this.remote.size > 0, ssh_status: "disconnected" };
        if (!await this.capabilities()) return { status: "remote", busy: this.remote.size > 0 };
        const r = await fetch(remoteURL(this.transportConfig()) + "/qwen/health", { headers: headers(this.transportConfig()), signal: AbortSignal.timeout(2000), redirect: "error" });
        if (!r.ok) throw Error("远程状态不可用");
        return { ...await r.json() as Health, status: "remote", ...(this.managedSSH() ? { ssh_status: "connected", ...(this.lifecycle.remaining !== undefined ? { idle_remaining_seconds: this.lifecycle.remaining } : {}), connection_error: this.lifecycle.error } : {}) };
      }
      const r = await fetch(BASE + "/health", {
        signal: AbortSignal.timeout(1500),
      });
      if (!r.ok) throw Error();
      return (await r.json()) as Health;
    } catch {
      return { status: "offline" };
    }
  }
  async ensure() {
    if (!this.starting)
      this.starting = this.start().finally(() => {
        this.starting = undefined;
      });
    return this.starting;
  }
  private async start() {
    await this.sync();
    let h = await upgradeIdleWorker(
      await this.health(),
      () => this.post("/v1/unload", {}),
      () => this.health(),
    );
    if (h.status === "ok" && !h.closing) {
      if (h.version !== 8)
        throw Error("旧版生图服务尚未退出，请等待空闲卸载后重试");
      return;
    }
    // A worker can be in the last milliseconds of idle shutdown.
    for (let n = 0; h.closing && n < 20; n++) {
      await new Promise((r) => setTimeout(r, 200));
      h = await this.health();
    }
    const dir = this.directory(),
      python = resolveConfig(this.config()).pythonPath;
    const model = resolveConfig(this.config()).modelPath;
    await access(model);
    const bundled = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../backend/server.py",
    );
    await copyFile(bundled, join(dir, "server.py"));
    await access(python);
    const fd = openSync(join(dir, "state/service.log"), "a", 0o600);
    const child = spawn(python, ["-u", join(dir, "server.py")], {
      cwd: dir,
      stdio: ["ignore", fd, fd],
      env: {
        ...process.env,
        HF_HUB_OFFLINE: "1",
        QWEN_DATA_DIR: dir,
        QWEN_MODEL_PATH: model,
        HF_HOME: resolveConfig(this.config()).hfHome,
      },
    });
    closeSync(fd);
    child.unref();
    let error: Error | undefined;
    child.once("error", (e) => {
      error = e;
    });
    for (let i = 0; i < 100; i++) {
      if (error) throw error;
      if (child.exitCode !== null)
        throw Error("本地服务启动失败，请查看service.log");
      h = await this.health();
      if (h.status === "ok" && h.version === 8 && !h.closing) return;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw Error("本地服务启动超时");
  }

  async check() {
    if (this.mode() === "remote") {
      if (this.managedSSH() && !this.lifecycle.connected) {
        sshOptions(this.transportConfig());
        return { ok: true, message: "按需 SSH 配置格式有效。当前未连接；真正提交生图时才建立连接并验证服务器，不启动模型。" };
      }
      const response = await fetch(
        remoteURL(this.transportConfig()) + "/models",
        {
          headers: headers(this.transportConfig()),
          signal: AbortSignal.timeout(8000),
          redirect: "error",
        },
      );
      if (!response.ok) throw Error(`远程连接失败：HTTP ${response.status}`);
      const data = (await response.json()) as { data?: { id: string }[] };
      const advanced = await this.remote.capabilities(this.transportConfig());
      return {
        ok: true,
        message: advanced ? "Qwen 远程网关可达；支持 LoRA、结构控制、蒙版、参考变体和真实步数进度。" : "远程接口可达；基础 Images API，仅支持文生图。",
        models: data.data?.map((m) => m.id) ?? [],
      };
    }
    const dir = this.directory(),
      python = resolveConfig(this.config()).pythonPath,
      model = resolveConfig(this.config()).modelPath;
    await access(python);
    try {
      await Promise.any(
        ["model_index.json", "config.json", "transformer/config.json"].map(
          (file) => access(join(model, file)),
        ),
      );
    } catch {
      throw Error(
        "模型目录中未找到model_index.json或模型配置文件，请选择完整的Qwen模型目录",
      );
    }
    return {
      ok: true,
      message: "Python与模型目录存在。首次生成会验证MFLUX及模型组件。",
      python,
      model,
    };
  }
  private transfers = 0;
  private maintenance = false;
  private retired = false;
  async withActivity<T>(fn: () => Promise<T>): Promise<T> {
    if (this.maintenance || this.retired) throw Error("插件正在维护或等待手动重启，请稍后再试");
    this.transfers++;
    try { return await fn(); } finally { this.transfers--; }
  }
  withMaintenance<T>(fn: () => Promise<T>): Promise<T> {
    return this.serialized(async () => {
      if (this.transfers || this.remote.size) throw Error("正在上传、排队或生成，更新已延后；任务结束后重试");
      this.maintenance = true;
      try {
        // Check both backends, including a local worker left by another process.
        if ((await readJobs(this.directory())).some(j => ["queued","uploading","loading","running","saving","cancelling"].includes(j.status))) throw Error("图库仍有未结束任务，更新已延后");
        const current = await this.health();
        if (current.busy) throw Error("生图服务正在工作，更新已延后");
        let localBusy = false;
        try { const r = await fetch(BASE + "/health", { signal: AbortSignal.timeout(1500) }); if(r.ok) localBusy = Boolean((await r.json() as Health).busy); } catch {}
        if(localBusy) throw Error("本机仍有生图任务，更新已延后");
        const result = await fn(); this.retired = true; return result;
      } finally { this.maintenance = false; }
    });
  }
  async post(path: string, data: unknown, start = false) {
    if (start) return this.serialized(() => this.withActivity(() => this.submit(path, data)));
    return this.submit(path, data, false);
  }
  private async submit(path: string, data: unknown, start = true) {
    const referenceMode = (data as Record<string, unknown>)?.reference_mode;
    if (path === "/v1/jobs" && referenceMode === "edit" && this.mode() === "local") {
      const support = await this.referenceEditing();
      if (!support.supported) throw Error(support.reason || "当前本机 MFLUX 或模型不支持原生参考编辑；不会自动切换后端");
    }
    if (start && this.mode() === "remote") {
      const config = this.transportConfig();
      let release: (() => void) | undefined;
      try {
        if (this.managedSSH()) release = await this.lifecycle.acquire(config);
        else if (await this.capabilities()) await this.configureRemote(config, Math.round((config.localMfluxIdleMinutes ?? 10) * 60));
        return await this.remote.submit(this.directory(), config, data as Record<string, unknown>, release, this.managedSSH() ? () => this.lifecycle.reconnect(config) : undefined);
      } catch (e) { release?.(); throw e; }
    }
    if (path === "/v1/unload" && this.mode() === "remote") {
      if (this.managedSSH()) { await this.lifecycle.unload(); return { unloaded: true, disconnected: true }; }
      if (!await this.remote.capabilities(this.transportConfig())) throw Error("普通远程接口不支持释放模型");
      const r = await fetch(remoteURL(this.transportConfig()) + "/qwen/unload", { method: "POST", headers: headers(this.transportConfig()), body: "{}", signal: AbortSignal.timeout(45000), redirect: "error" });
      if (!r.ok) throw Error("远程仍有任务或释放失败，请查询当前任务状态");
      return r.json();
    }
    if (path === "/v1/cancel") {
      const id = (data as { id: string }).id;
      const job = (await readJobs(this.directory())).find((j) => j.id === id);
      if (job?.source === "remote") return this.remote.cancel(id);
    }
    if (start) await this.ensure();
    const token = (
      await readFile(join(this.directory(), "state/api-key"), "utf8")
    ).trim();
    const response = await fetch(BASE + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
    });
    const value = (await response.json()) as { error?: string };
    if (!response.ok) throw Error(value.error ?? "本地任务请求失败");
    return value;
  }
}
