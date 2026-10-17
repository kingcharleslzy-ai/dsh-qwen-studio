import { spawn } from "node:child_process";
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
const BASE = "http://127.0.0.1:19388";
export class Worker {
  readonly remote = new RemoteQueue();
  transportConfig(): Config {
    return { ...this.config(), ...resolveConfig(this.config()) };
  }
  mode() {
    return resolveConfig(this.config()).connectionMode;
  }
  private starting: Promise<void> | undefined;
  private settingsKey = "";
  constructor(private config: () => Config) {}
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
        if (!await this.remote.capabilities(this.transportConfig())) return { status: "remote", busy: this.remote.size > 0 };
        const r = await fetch(remoteURL(this.transportConfig()) + "/qwen/health", { headers: headers(this.transportConfig()), signal: AbortSignal.timeout(2000), redirect: "error" });
        if (!r.ok) throw Error("远程状态不可用");
        return { ...await r.json() as Health, status: "remote" };
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
      if (h.version !== 7)
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
      if (h.status === "ok" && h.version === 7 && !h.closing) return;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw Error("本地服务启动超时");
  }

  async check() {
    if (this.mode() === "remote") {
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
  async post(path: string, data: unknown, start = false) {
    if (start && this.mode() === "remote")
      return this.remote.submit(
        this.directory(),
        this.transportConfig(),
        data as Record<string, unknown>,
      );
    if (path === "/v1/unload" && this.mode() === "remote") {
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
