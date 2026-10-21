import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { setTimeout as wait } from "node:timers/promises";
import { active } from "./shared.js";
import { readJobs } from "./storage.js";
import { recordInvocation } from "./invocations.js";
import type { Worker } from "./worker.js";
import { generationParameters } from "./generation-parameters.js";
import { generationPayload, newJobId, validateGeneration, type GenerationArgs } from "./generation-request.js";

const output = {
  schema: {
    type: "object",
    properties: { result: { type: "string", required: true } },
    additionalProperties: false,
  },
  render: (_args: unknown, value: { result: string }) => [{ type: "text" as const, text: value.result }],
} as const;

async function slot(dir: string, maxParallel: number, deadline: number) {
  for (;;) {
    const running = (await readJobs(dir)).filter(active).length;
    if (running < maxParallel) return;
    if (Date.now() > deadline) throw Error("等待队列空位超时；已提交的任务保留，请用 qwen_image_jobs 查看");
    await wait(500);
  }
}

async function visible(dir: string, id: string, deadline: number) {
  while (Date.now() < deadline) {
    if ((await readJobs(dir)).some((job) => job.id === id)) return;
    await wait(200);
  }
}

export function registerBatchTool(ctx: Context, worker: Worker) {
  ctx.tools.register(defineTool({
    name: "qwen_image_batch",
    description: "Submit 1–10 independent Qwen image jobs in one call, then return their real task ids without waiting for pixels. Each job accepts the same parameters as qwen_generate_image. Submission auto-waves to the backend's 4-job admission limit; a failed job is reported per index and never stops the rest. This tool only submits: poll qwen_image_jobs / qwen_image_status for progress, and use qwen_image_gallery for lineage. Never invent ids, never retry accepted jobs automatically.",
    timeoutMs: 900000,
    parameters: {
      jobs: {
        type: "array",
        required: true,
        description: "1–10 independent jobs. Each item requires prompt and accepts the same generation parameters as qwen_generate_image.",
        items: {
          type: "object",
          properties: generationParameters,
          additionalProperties: false,
        },
      },
      max_parallel: {
        type: "integer",
        description: "How many jobs may be active before the next submission, 1–4, default 4 (backend admission cap).",
      },
    },
    output,
    async execute({ jobs, max_parallel: maxParallel = 4 }, exec) {
      if (!Array.isArray(jobs) || !jobs.length || jobs.length > 10) throw Error("jobs 需要 1–10 个独立任务");
      if (!Number.isInteger(maxParallel) || maxParallel < 1 || maxParallel > 4) throw Error("max_parallel 需为 1–4");
      const dir = worker.directory(), deadline = Date.now() + 15 * 60 * 1000;
      const accepted: Array<{ index: number; id: string; seed?: number }> = [];
      const failed: Array<{ index: number; error: string }> = [];
      for (const [index, raw] of jobs.entries()) {
        exec.signal.throwIfAborted();
        const args = raw as GenerationArgs;
        try {
          if (!args.prompt?.trim()) throw Error("prompt 不能为空");
          validateGeneration(args);
          await slot(dir, maxParallel, deadline);
          const id = newJobId();
          await recordInvocation(dir, `${exec.callId}:${index}`, args.prompt, id, undefined, exec.agent?.id ?? "");
          try {
            await worker.post("/v1/jobs", generationPayload(args, id), true);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await recordInvocation(dir, `${exec.callId}:${index}`, args.prompt, id, message, exec.agent?.id ?? "");
            throw error;
          }
          await visible(dir, id, Math.min(deadline, Date.now() + 5000));
          accepted.push({ index, id, ...(args.seed !== undefined ? { seed: args.seed } : {}) });
        } catch (error) {
          if (exec.signal.aborted) throw error;
          failed.push({ index, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return {
        result: JSON.stringify({
          accepted, failed,
          submitted: accepted.length,
          note: "任务已异步提交，图片尚未生成；用 qwen_image_jobs 或 qwen_image_status 查进度。失败项未重试，确认原因后再提交。",
        }),
      };
    },
  }));
}
