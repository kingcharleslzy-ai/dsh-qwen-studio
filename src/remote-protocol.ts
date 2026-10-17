import { constants } from "node:fs";
import { realpath, stat, open, copyFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { basename, join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { imagePath, validId } from "./storage.js";
import { fingerprint, listResources } from "./resources.js";
import { validateLora } from "./assets.js";
import { resolveConfig } from "./resolved-config.js";
import type { Config } from "./config.js";
export interface RemoteCapabilities {
  protocol: "dsh-qwen";
  version: 1;
  features: string[];
  schedulers: string[];
  verification?: "on_generation";
}
export const requiredFeatures = ["lora", "controlnet", "mask", "img2img", "negative_prompt", "guidance", "progress", "cancel"];
export async function responseJSON(response: Response) {
  const value = await response.json() as Record<string, any>;
  if (!response.ok) throw Error(`远程 HTTP ${response.status}：${typeof value.error === "string" ? value.error : value.error?.message || "请求失败"}`);
  return value;
}
export function advancedParameters(data: Record<string, any>, capabilities: RemoteCapabilities) {
  const result: Record<string, any> = {};
  for (const key of ["negative_prompt", "guidance", "scheduler", "source_image_id", "change_strength", "controlnet_image_id", "controlnet_strength", "mask_image_id", "lora_paths", "lora_scales", "lora_names"])
    if (data[key] != null) result[key] = data[key];
  const negative = result.negative_prompt ?? "";
  if (typeof negative !== "string" || negative.length > 8000) throw Error("负向提示词无效");
  const guidance = result.guidance ?? 1;
  if (!Number.isFinite(guidance) || guidance < 1 || guidance > 10) throw Error("CFG 范围1–10");
  if (!capabilities.schedulers.includes(result.scheduler ?? "linear")) throw Error("远程服务不支持所选调度器");
  for (const key of ["source_image_id", "controlnet_image_id", "mask_image_id"])
    if (result[key] && !validId(result[key])) throw Error("图片ID无效");
  if (result.mask_image_id && !result.source_image_id) throw Error("蒙版需要原图");
  if (result.change_strength !== undefined && (!result.source_image_id || result.mask_image_id || !Number.isFinite(result.change_strength) || result.change_strength < .05 || result.change_strength > .95)) throw Error("参考图变化幅度无效，蒙版不使用变化幅度");
  if (result.controlnet_strength !== undefined && (!result.controlnet_image_id || !Number.isFinite(result.controlnet_strength) || result.controlnet_strength < 0 || result.controlnet_strength > 1)) throw Error("控制强度无效");
  if (result.controlnet_image_id && result.source_image_id && !result.mask_image_id) throw Error("控制图与原图同时使用需要蒙版");
  if ((result.controlnet_image_id || result.mask_image_id) && result.scheduler && result.scheduler !== "linear") throw Error("结构控制和蒙版需要 linear 调度器");
  const paths = result.lora_paths ?? [], scales = result.lora_scales ?? paths.map(() => 1);
  if (!Array.isArray(paths) || paths.length > 8 || paths.some(p => typeof p !== "string") || !Array.isArray(scales) || scales.length !== paths.length || scales.some(s => !Number.isFinite(s) || s < 0 || s > 2)) throw Error("LoRA 路径与权重无效");
  if (paths.length) result.lora_scales = scales;
  if (negative.trim() && guidance <= 1) { result.guidance = 2.5; result.guidance_auto_raised = true; }
  return result;
}
export async function runExtended({ base, headers, dir, config, job, signal, patch, accepted, reconnect }: {
  base: string; headers: Record<string, string>; dir: string; config: Config;
  job: Record<string, any>; signal: AbortSignal; patch(value: object): Promise<void>;
  accepted(): void;
  reconnect?: (() => Promise<void>) | undefined;
}) {
  const inputs: { path: string; kind: "image" | "lora"; field: string; scale?: number }[] = [];
  const body: Record<string, any> = { id: job.id, model: config.remoteModel || "qwen-image", prompt: job.prompt, width: job.width, height: job.height, steps: job.steps, seed: job.seed, loras: [] };
  for (const k of ["negative_prompt", "guidance", "scheduler", "change_strength", "controlnet_strength"])
    if (job[k] != null) body[k] = job[k];
  for (const [key, field] of [["source_image_id", "source_sha"], ["controlnet_image_id", "control_sha"], ["mask_image_id", "mask_sha"]])
    if (job[key!]) inputs.push({ path: await imagePath(dir, job[key!]), kind: "image", field: field! });
  if (job.lora_paths?.length) {
    const resources = await listResources(resolveConfig({ ...config, localMfluxDirectory: dir }));
    for (const [index, path] of (job.lora_paths as string[]).entries()) {
      const canonical = await realpath(path);
      if (!resources.items.some(r => r.kind === "lora" && r.path === canonical)) throw Error("LoRA 必须来自配置的资源目录");
      const info = await stat(canonical);
      if (!info.isFile() || info.size > 2 * 1024 ** 3) throw Error("LoRA 文件无效或超过2GB");
      await validateLora(canonical, info.size);
      inputs.push({ path: canonical, kind: "lora", field: "loras", scale: job.lora_scales?.[index] ?? 1 });
    }
  }
  for (const [i, input] of inputs.entries()) {
    signal.throwIfAborted();
    await patch({ status: "uploading", phase: `同步资源 ${i + 1}/${inputs.length}：${input.kind === "lora" ? basename(input.path) : "图片"}` });
    if (input.field === "source_sha") await copyFile(input.path, join(dir, "images", job.id, "reference.png"));
    const sha = await fingerprint(input.path);
    const url = `${base}/qwen/assets/${sha}?kind=${input.kind}`;
    const exists = await fetch(url, { method: "HEAD", headers, signal, redirect: "error" });
    if (exists.status !== 200) {
      if (exists.status !== 404) throw Error(`远程资源检查失败：HTTP ${exists.status}`);
      const file = await open(input.path, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stream = file.createReadStream();
      try {
        await responseJSON(await fetch(url, {
          method: "PUT", headers: { ...headers, "content-type": "application/octet-stream", "content-length": String((await stat(input.path)).size) },
          body: Readable.toWeb(stream), duplex: "half", signal, redirect: "error",
        } as RequestInit));
      } finally { stream.destroy(); }
    }
    if (input.field === "loras") body.loras.push({ sha, scale: input.scale });
    else body[input.field] = sha;
  }
  signal.throwIfAborted();
  accepted(); // Submission may be accepted even if its response is lost.
  await responseJSON(await fetch(base + "/qwen/jobs", { method: "POST", headers, body: JSON.stringify(body), signal, redirect: "error" }));
  const started = Date.now();
  while (true) {
    signal.throwIfAborted();
    let response: Response;
    try {
      response = await fetch(base + "/qwen/jobs/" + job.id, { headers, signal, redirect: "error" });
      if ([502, 503, 504].includes(response.status)) throw Error("Remote temporarily unavailable");
    } catch (error) {
      signal.throwIfAborted();
      await patch({ phase: "连接中断，正在重连；不会重新提交" });
      if (reconnect) await reconnect().catch(() => {});
      await wait(1500, undefined, { signal });
      continue;
    }
    const remote = await responseJSON(response);
    const status = ["queued", "loading", "running", "saving", "cancelling", "complete", "cancelled", "failed"].includes(remote.status) ? remote.status : "running";
    // Publish completion only after the PNG has been saved locally.
    await patch({ status: status === "complete" ? "saving" : status, phase: String(remote.phase || ""), step: Number(remote.step) || 0, sampling_steps: Number(remote.sampling_steps) || job.steps, progress_supported: true, elapsed_seconds: (Date.now() - started) / 1000 });
    if (status === "failed") throw Error(remote.error || "远程生成失败");
    if (status === "cancelled") throw Error("远程任务已取消");
    if (status === "complete") {
      const response = await fetch(base + "/qwen/jobs/" + job.id + "/image", { headers, signal, redirect: "error" });
      if (!response.ok) throw Error("远程结果暂不可用，请查询原任务，勿重复提交");
      if (Number(response.headers.get("content-length")) > 64 * 1024 ** 2) throw Error("远程图片超过64MB");
      return Buffer.from(await response.arrayBuffer());
    }
    await wait(500, undefined, { signal });
  }
}
