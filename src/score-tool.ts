import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { imagePath, readJob } from "./storage.js";
import { resolveConfig } from "./resolved-config.js";
import { scoreImage, type ImageScore } from "./scoring.js";
import type { Worker } from "./worker.js";
const output = {
  schema: {
    type: "object",
    properties: { result: { type: "string", required: true } },
    additionalProperties: false,
  },
  render: (_args: unknown, value: { result: string }) => [{ type: "text" as const, text: value.result }],
} as const;

export function registerScoreTool(ctx: Context, worker: Worker) {
  ctx.tools.register(defineTool({
    name: "qwen_image_score",
    description: "Compute objective local QA metrics for 1–30 completed Qwen images: edge/detail strength, high-frequency grain, saturation, brightness, skin ratio, highlight/shadow clipping. Reports provisional flags such as heavy-grain or texture-overload; this is a diagnostic report, not a pass/fail gate. Optional write=true stores qa.json inside each job folder; images and gallery flags are untouched. Does not start the model or SSH.",
    timeoutMs: 300000,
    parameters: {
      ids: { type: "array", required: true, items: { type: "string" }, description: "1–30 completed 32-character task ids." },
      write: { type: "boolean", description: "Write qa.json into each job folder. Default false; read-only." },
    },
    output,
    async execute({ ids, write = false }) {
      if (!Array.isArray(ids) || !ids.length || ids.length > 30 || ids.some((id) => !/^[a-f0-9]{32}$/.test(id))) throw Error("ids 需要 1–30 个 32 位十六进制任务 ID");
      const config = resolveConfig(worker.transportConfig());
      const items: Array<{ id: string; metrics?: Record<string, number>; flags?: string[]; error?: string }> = [];
      const counts: Record<string, number> = {};
      for (const id of ids) {
        const job = await readJob(worker.directory(), id);
        if (!job) { items.push({ id, error: "任务不存在" }); continue; }
        if (job.deleted) { items.push({ id, error: "任务在回收站" }); continue; }
        if (job.status !== "complete") { items.push({ id, error: `任务未完成（${job.status}）` }); continue; }
        try {
          const path = await imagePath(worker.directory(), id);
          const score: ImageScore = await scoreImage(worker.directory(), config.pythonPath, id);
          items.push({ id, ...score });
          for (const flag of score.flags) counts[flag] = (counts[flag] ?? 0) + 1;
          if (write) await writeFile(join(dirname(path), "qa.json"), JSON.stringify({ ...score, scored_at: new Date().toISOString() }, null, 2), { mode: 0o600 });
        } catch (error) {
          items.push({ id, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return {
        result: JSON.stringify({ items, flag_counts: counts, scored: items.filter((item) => item.metrics).length,
          note: "客观指标报告，不是质量门禁；阈值待人工 ground truth 校准。write=true 只新增 qa.json，不改图片或收藏。" }),
      };
    },
  }));
}
