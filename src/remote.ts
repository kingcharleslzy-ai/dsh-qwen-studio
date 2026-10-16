import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { atomicJSON, validId } from "./storage.js";
import type { Config } from "./config.js";
import type { Job } from "./shared.js";
export function remoteURL(config: Config) {
  const url = new URL(config.remoteBaseURL ?? "");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error("请填写不含账号、查询参数的HTTP(S)接口地址");
  return url.toString().replace(/\/$/, "");
}
export function headers(config: Config) {
  return {
    "content-type": "application/json",
    ...(config.remoteApiKey
      ? { authorization: `Bearer ${config.remoteApiKey}` }
      : {}),
  };
}
export class RemoteQueue {
  private admission: Promise<unknown> = Promise.resolve();
  private tail: Promise<unknown> = Promise.resolve();
  private pending = new Map<string, AbortController>();
  private configs = new Map<string, { dir: string; config: Config }>();
  submit(dir: string, config: Config, data: Record<string, unknown>) {
    const result = this.admission.then(() => this.admit(dir, config, data));
    this.admission = result.catch(() => {});
    return result;
  }
  private async admit(
    dir: string,
    config: Config,
    data: Record<string, unknown>,
  ) {
    if (data.source_image_id != null || data.change_strength != null)
      throw Error(
        "当前远程接口仅支持文生图，不能忽略参考图继续生成；请切换本地模式或移除参考图",
      );
    if (
      data.negative_prompt != null ||
      data.guidance != null ||
      data.scheduler != null
    )
      throw Error(
        "负向提示词、CFG 与调度器目前仅接入本地模式；远程接口不会忽略这些参数继续生成",
      );
    remoteURL(config);
    const id = data.id as string;
    if (!validId(id)) throw Error("任务ID无效");
    const prompt = data.prompt,
      width = data.width ?? 1024,
      height = data.height ?? 1024,
      steps = data.steps ?? 40,
      seed = data.seed ?? null;
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 16000)
      throw Error("请填写1–16000字的描述");
    if (
      [width, height].some(
        (v) =>
          typeof v !== "number" ||
          !Number.isInteger(v) ||
          v < 512 ||
          v > 2048 ||
          v % 16,
      )
    )
      throw Error("尺寸无效");
    if (
      typeof steps !== "number" ||
      !Number.isInteger(steps) ||
      steps < 1 ||
      steps > 60
    )
      throw Error("步数应为1–60");
    if (
      seed !== null &&
      (typeof seed !== "number" ||
        !Number.isInteger(seed) ||
        seed < 0 ||
        seed >= 2 ** 32)
    )
      throw Error("种子无效");
    const request = {
        prompt,
        width: width as number,
        height: height as number,
        steps,
        seed,
      },
      folder = join(dir, "images", id),
      file = join(folder, "job.json");
    try {
      const old = JSON.parse(await readFile(file, "utf8"));
      if (JSON.stringify(old.request) !== JSON.stringify(request))
        throw Error("任务ID参数冲突");
      return old;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    if (this.pending.size >= 4) throw Error("远程队列已满");
    const job = {
      id,
      ...request,
      seed: seed ?? Math.floor(Math.random() * 2 ** 32),
      status: "queued",
      source: "remote" as const,
      started_at: Date.now() / 1000,
      worker_pid: process.pid,
      request,
    };
    await mkdir(folder, { recursive: true });
    await atomicJSON(file, job);
    this.pending.set(id, new AbortController());
    this.configs.set(id, { dir, config: { ...config } });
    this.tail = this.tail.then(() => this.run(job as Job)).catch(() => {});
    return job;
  }
  private async run(job: Job) {
    const controller = this.pending.get(job.id)!,
      { dir, config } = this.configs.get(job.id)!,
      folder = join(dir, "images", job.id),
      file = join(folder, "job.json"),
      start = Date.now();
    const timer = setTimeout(
      () => controller.abort(Error("远程生成超过30分钟")),
      30 * 60 * 1000,
    );
    const patch = async (value: object) => {
      const old = JSON.parse(await readFile(file, "utf8"));
      await atomicJSON(file, { ...old, ...value });
    };
    try {
      controller.signal.throwIfAborted();
      await patch({ status: "running" });
      const response = await fetch(remoteURL(config) + "/images/generations", {
        method: "POST",
        headers: headers(config),
        redirect: "error",
        signal: controller.signal,
        body: JSON.stringify({
          model: config.remoteModel || "qwen-image",
          prompt: job.prompt,
          size: `${job.width}x${job.height}`,
          n: 1,
          response_format: "b64_json",
          seed: job.seed,
          num_inference_steps: job.steps,
        }),
      });
      if (!response.ok)
        throw Error(
          `远程服务返回HTTP ${response.status}，请检查服务日志或接口配置`,
        );
      const payload = (await response.json()) as {
        data?: { b64_json?: string; url?: string }[];
      };
      const item = payload.data?.[0];
      if (!item?.b64_json)
        throw Error(
          "远程接口需返回 data[0].b64_json（PNG），当前不支持图片URL返回",
        );
      const bytes = Buffer.from(item.b64_json, "base64");
      if (
        bytes.length > 64 * 1024 * 1024 ||
        bytes.length < 24 ||
        !bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        throw Error("远程返回不是有效PNG或超过64MB");
      controller.signal.throwIfAborted();
      await patch({ status: "saving" });
      await writeFile(join(folder, "image.pending.png"), bytes);
      await rename(
        join(folder, "image.pending.png"),
        join(folder, "image.png"),
      );
      await patch({
        status: "complete",
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
        step: job.steps,
        elapsed_seconds: Math.round((Date.now() - start) / 10) / 100,
      });
    } catch (e) {
      await patch({
        status: controller.signal.aborted ? "cancelled" : "failed",
        error: controller.signal.aborted
          ? "已停止等待；远程服务可能仍在计算"
          : e instanceof Error
            ? e.message
            : String(e),
      });
    } finally {
      clearTimeout(timer);
      this.pending.delete(job.id);
      this.configs.delete(job.id);
    }
  }
  cancel(id: string) {
    const controller = this.pending.get(id);
    if (!controller) throw Error("远程任务已结束或当前DSH进程不持有该任务");
    controller.abort();
    return { ok: true };
  }
  get size() {
    return this.pending.size;
  }
}
