import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { readJob } from "./storage.js";
import { recordInvocation } from "./invocations.js";
import { resolveConfig } from "./resolved-config.js";
import { scoreImage } from "./scoring.js";
import { generationPayload, newJobId, validateGeneration, type GenerationArgs } from "./generation-request.js";
import type { Job } from "./shared.js";
import type { Worker } from "./worker.js";

const DEFAULT_FLAGS = ["heavy-grain", "texture-overload"];

/** Rebuild the original request from a completed job, advancing the seed by one. */
export function jobToGenerationArgs(job: Job, stride = 1): GenerationArgs {
  const seed = Number.isFinite(job.seed) ? (job.seed + stride) % 4294967296 : undefined;
  return {
    prompt: job.prompt,
    width: job.width,
    height: job.height,
    steps: job.steps,
    ...(seed !== undefined ? { seed } : {}),
    ...(job.negative_prompt ? { negative_prompt: job.negative_prompt } : {}),
    ...(job.guidance !== undefined ? { guidance: job.guidance } : {}),
    ...(job.scheduler ? { scheduler: job.scheduler } : {}),
    ...(job.source_image_ids?.length ? { source_image_ids: [...job.source_image_ids] } : job.source_image_id ? { source_image_id: job.source_image_id } : {}),
    ...(job.reference_mode ? { reference_mode: job.reference_mode } : {}),
    ...(job.change_strength !== undefined && !job.mask_image_id && job.reference_mode !== "edit" ? { change_strength: job.change_strength } : {}),
    ...(job.controlnet_image_id ? { controlnet_image_id: job.controlnet_image_id } : {}),
    ...(job.controlnet_strength !== undefined ? { controlnet_strength: job.controlnet_strength } : {}),
    ...(job.mask_image_id ? { mask_image_id: job.mask_image_id } : {}),
    ...(job.lora_paths ? { lora_paths: job.lora_paths } : {}),
    ...(job.lora_scales ? { lora_scales: job.lora_scales } : {}),
  };
}

const output = {
  schema: {
    type: "object",
    properties: { result: { type: "string", required: true } },
    additionalProperties: false,
  },
  render: (_args: unknown, value: { result: string }) => [{ type: "text" as const, text: value.result }],
} as const;

export function registerRerollTool(ctx: Context, worker: Worker) {
  ctx.tools.register(defineTool({
    name: "qwen_image_reroll",
    description: "Re-score completed Qwen images and automatically submit a new job (seed + 1, same prompt/params) only when a requested QA flag is present, by default heavy-grain or texture-overload. Returns new task ids; originals are kept for comparison and never deleted. Bounded to 20 ids per call; does not wait for the new images and never retries a task that did not match a flag.",
    timeoutMs: 180000,
    parameters: {
      ids: { type: "array", required: true, items: { type: "string" }, description: "1–20 completed 32-character task ids." },
      flags: { type: "array", items: { type: "string" }, description: "QA flags that trigger a reroll; default heavy-grain, texture-overload." },
      seed_stride: { type: "integer", description: "Seed advance for the new job, default 1." },
    },
    output,
    async execute({ ids, flags = DEFAULT_FLAGS, seed_stride: stride = 1 }, exec) {
      if (!Array.isArray(ids) || !ids.length || ids.length > 20 || ids.some((id) => !/^[a-f0-9]{32}$/.test(id))) throw Error("ids 需要 1–20 个 32 位十六进制任务 ID");
      if (!Array.isArray(flags) || !flags.length) throw Error("flags 不能为空");
      if (!Number.isInteger(stride) || stride < 1 || stride > 1000000) throw Error("seed_stride 需为 1–1000000");
      const config = resolveConfig(worker.transportConfig()), dir = worker.directory();
      const rerolled: Array<Record<string, unknown>> = [], skipped: Array<Record<string, unknown>> = [];
      for (const id of ids) {
        exec.signal.throwIfAborted();
        const job = await readJob(dir, id);
        if (!job) { skipped.push({ id, reason: "任务不存在" }); continue; }
        if (job.deleted) { skipped.push({ id, reason: "任务在回收站" }); continue; }
        if (job.status !== "complete") { skipped.push({ id, reason: `任务未完成（${job.status}）` }); continue; }
        try {
          const score = await scoreImage(dir, config.pythonPath, id);
          const hits = score.flags.filter((flag) => flags.includes(flag));
          if (!hits.length) { skipped.push({ id, reason: "没有命中的 QA 标记", flags: score.flags }); continue; }
          const args = jobToGenerationArgs(job, stride);
          validateGeneration(args);
          const next = newJobId();
          await recordInvocation(dir, `${exec.callId}:${id}`, args.prompt, next, undefined, exec.agent?.id ?? "");
          await worker.post("/v1/jobs", generationPayload(args, next), true);
          rerolled.push({ from: id, to: next, flags: hits, seed: args.seed });
        } catch (error) {
          skipped.push({ id, reason: error instanceof Error ? error.message : String(error) });
        }
      }
      return { result: JSON.stringify({ rerolled, skipped, submitted: rerolled.length,
        note: "只重投命中标记的图，原图保留；新任务异步执行，用 qwen_image_jobs 查进度。新图再次评分后再决定是否继续重抽。" }) };
    },
  }));
}
