import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { setTimeout as wait } from "node:timers/promises";
import { constants } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { active, type Job } from "./shared.js";
import { imagePath, readJob, readJobs, validId } from "./storage.js";
import type { Worker } from "./worker.js";

export interface GalleryQuery {
  query?: string;
  seed?: number;
  status?: string;
  favorite?: boolean;
  archived?: boolean;
  sourceImageId?: string;
  since?: number;
  until?: number;
  includeDeleted?: boolean;
}

/** Pure filter shared by the gallery tool and tests. `started_at` is in seconds. */
export function selectJobs(jobs: Job[], query: GalleryQuery): Job[] {
  const text = query.query?.trim().toLowerCase();
  return jobs.filter((job) => {
    if (!query.includeDeleted && job.deleted && query.status !== "trashed") return false;
    if (query.seed !== undefined && job.seed !== query.seed) return false;
    if (query.favorite !== undefined && Boolean(job.favorite) !== query.favorite) return false;
    if (query.archived !== undefined && Boolean(job.archived) !== query.archived) return false;
    if (query.sourceImageId && job.source_image_id !== query.sourceImageId && !job.source_image_ids?.includes(query.sourceImageId)) return false;
    if (query.status) {
      if (query.status === "active") {
        if (!active(job)) return false;
      } else if (query.status === "trashed") {
        if (!job.deleted) return false;
      } else if (job.status !== query.status || job.deleted) return false;
    }
    if (query.since !== undefined && job.started_at < query.since) return false;
    if (query.until !== undefined && job.started_at > query.until) return false;
    if (text && !job.prompt.toLowerCase().includes(text)) return false;
    return true;
  });
}

function summary(job: Job) {
  return {
    id: job.id,
    status: job.deleted ? "trashed" : job.status,
    prompt: job.prompt,
    seed: job.seed,
    width: job.width,
    height: job.height,
    steps: job.steps,
    ...(job.step !== undefined ? { step: job.step } : {}),
    source: job.source ?? "local",
    ...(job.source_image_id ? { source_image_id: job.source_image_id } : {}),
    ...(job.source_image_ids?.length ? { source_image_ids: job.source_image_ids } : {}),
    ...(job.reference_mode ? { reference_mode: job.reference_mode } : {}),
    ...(job.lora_names?.length ? { lora_names: job.lora_names } : {}),
    ...(job.elapsed_seconds !== undefined ? { elapsed_seconds: job.elapsed_seconds } : {}),
    started_at: job.started_at,
    ...(job.error ? { error: job.error } : {}),
    ...(job.favorite ? { favorite: true } : {}),
    ...(job.archived ? { archived: true } : {}),
    ...(job.deleted ? { deleted: true } : {}),
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

const STATUSES = ["queued", "uploading", "loading", "running", "saving", "cancelling", "complete", "failed", "cancelled", "active", "trashed"] as const;

function timestamp(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw Error(`${name} 需要 ISO 8601 时间，例如 2026-10-18T12:00:00Z`);
  return ms / 1000;
}

export function registerGalleryTools(ctx: Context, worker: Worker) {
  ctx.tools.register(defineTool({
    name: "qwen_image_jobs",
    description: "Read the Qwen image task queue and batch-read task states without starting inference. Use ids[] to check up to 200 tasks in one call; omit ids to snapshot the active queue (queued/uploading/loading/running/saving/cancelling) plus status counts. Read-only: never submits, cancels or changes gallery flags. For one completed image with its attachment, use qwen_image_status instead.",
    timeoutMs: 30000,
    parameters: {
      ids: { type: "array", items: { type: "string" }, description: "Optional exact 32-character task ids, up to 200. Omit for a queue snapshot." },
      status: { type: "string", description: "Optional filter: queued, uploading, loading, running, saving, cancelling, complete, failed, cancelled, active, trashed." },
      limit: { type: "integer", description: "Max tasks returned, 1–200, default 50." },
    },
    output,
    async execute({ ids, status, limit = 50 }) {
      if (status !== undefined && !STATUSES.includes(status as typeof STATUSES[number])) throw Error("状态筛选无效");
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw Error("limit 需为 1–200");
      const dir = worker.directory(), all = await readJobs(dir);
      let jobs: Job[];
      const missing: string[] = [];
      if (ids?.length) {
        if (ids.length > 200 || ids.some((id) => !validId(id))) throw Error("ids 需要 1–200 个 32 位十六进制任务 ID");
        jobs = [];
        for (const id of ids) {
          const job = all.find((item) => item.id === id) ?? await readJob(dir, id);
          if (job) jobs.push(job); else missing.push(id);
        }
      } else jobs = all;
      if (status) jobs = selectJobs(jobs, { status, includeDeleted: true });
      jobs.sort((a, b) => b.started_at - a.started_at);
      const counts: Record<string, number> = {};
      for (const job of all) {
        const key = job.deleted ? "trashed" : job.status;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      const queue = all.filter(active).sort((a, b) => a.started_at - b.started_at).map(summary);
      return {
        result: JSON.stringify({
          jobs: jobs.slice(0, limit).map(summary),
          total: jobs.length,
          returned: Math.min(jobs.length, limit),
          truncated: jobs.length > limit,
          missing,
          active: queue.length,
          queue,
          counts,
          note: "只读快照；取消任务用 qwen_image_cancel。远程任务的队列由当前 DSH 进程持有。",
        }),
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: "qwen_image_cancel",
    description: "Request cancellation for up to 50 Qwen image tasks by id, without deleting images or changing gallery flags. Unknown or already-finished tasks are reported per id and never fail the whole batch. Local worker cancellation is immediate; a remote task can only be cancelled while the current DSH process still holds its pending request. This tool never submits or retries generation.",
    timeoutMs: 60000,
    parameters: {
      ids: { type: "array", items: { type: "string" }, required: true, description: "1–50 exact 32-character task ids to cancel." },
    },
    output,
    async execute({ ids }) {
      if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some((id) => !validId(id))) throw Error("ids 需要 1–50 个 32 位十六进制任务 ID");
      const dir = worker.directory(), results: Array<Record<string, unknown>> = [];
      for (const id of ids) {
        const job = await readJob(dir, id);
        if (!job) { results.push({ id, ok: false, error: "任务不存在" }); continue; }
        if (!active(job)) { results.push({ id, ok: false, error: `任务已结束（${job.deleted ? "trashed" : job.status}）` }); continue; }
        try {
          await worker.post("/v1/cancel", { id });
          await wait(150);
          const next = await readJob(dir, id);
          results.push({ id, ok: true, status: next?.deleted ? "trashed" : next?.status ?? "cancelling" });
        } catch (error) {
          results.push({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return { result: JSON.stringify({ results, requested: ids.length, note: "取消只影响任务，不删除图片；稍后用 qwen_image_jobs 复核最终状态。" }) };
    },
  }));

  ctx.tools.register(defineTool({
    name: "qwen_image_gallery",
    description: "Search the Qwen image gallery read-only by prompt substring, seed, status, favorite/archive flag, source image id or start time, and page through results. Returns task metadata and lineage fields (seed, source_image_id, reference_mode, lora_names, elapsed_seconds) — never pixels, attachments or filesystem paths. Zero writes: cannot favorite, archive, delete or submit. Use qwen_image_resources for importable image ids and qwen_image_status for one image's attachment.",
    timeoutMs: 30000,
    parameters: {
      query: { type: "string", description: "Case-insensitive substring of the prompt." },
      seed: { type: "integer", description: "Exact seed." },
      status: { type: "string", description: "queued, uploading, loading, running, saving, cancelling, complete, failed, cancelled, active or trashed." },
      favorite: { type: "boolean", description: "Filter by favorite flag." },
      archived: { type: "boolean", description: "Filter by archived flag." },
      source_image_id: { type: "string", description: "Exact 32-character source image id used for img2img or reference edit." },
      since: { type: "string", description: "Inclusive ISO 8601 start time, e.g. 2026-10-18T00:00:00+08:00." },
      until: { type: "string", description: "Inclusive ISO 8601 end time." },
      include_deleted: { type: "boolean", description: "Include trashed tasks, default false." },
      limit: { type: "integer", description: "Page size 1–200, default 50." },
      offset: { type: "integer", description: "Page offset, default 0." },
    },
    output,
    async execute(args) {
      const { query, seed, status, favorite, archived, source_image_id: sourceImageId,
        since, until, include_deleted: includeDeleted = false, limit = 50, offset = 0 } = args;
      if (status !== undefined && !STATUSES.includes(status as typeof STATUSES[number])) throw Error("状态筛选无效");
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw Error("limit 需为 1–200");
      if (!Number.isInteger(offset) || offset < 0) throw Error("offset 需为非负整数");
      if (sourceImageId !== undefined && !validId(sourceImageId)) throw Error("source_image_id 无效");
      const from = timestamp(since, "since"), to = timestamp(until, "until");
      if (from !== undefined && to !== undefined && from > to) throw Error("since 不能晚于 until");
      const jobs = selectJobs(await readJobs(worker.directory()), {
        ...(query ? { query } : {}), ...(seed !== undefined ? { seed } : {}),
        ...(status ? { status } : {}), ...(favorite !== undefined ? { favorite } : {}),
        ...(archived !== undefined ? { archived } : {}), ...(sourceImageId ? { sourceImageId } : {}),
        ...(from !== undefined ? { since: from } : {}), ...(to !== undefined ? { until: to } : {}),
        includeDeleted,
      });
      jobs.sort((a, b) => b.started_at - a.started_at);
      const page = jobs.slice(offset, offset + limit);
      return {
        result: JSON.stringify({
          jobs: page.map(summary), total: jobs.length, offset, limit,
          returned: page.length, has_more: offset + page.length < jobs.length,
          note: "只读检索，未触碰 gallery.json；favorite/archived 来自现有收藏记录。",
        }),
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: "qwen_image_export",
    description: "Copy 1–50 completed, non-trashed Qwen jobs into a caller-selected directory as <id>/image.png plus <id>/job.json, and write manifest.json with lineage fields. This is a copy-only handoff for an external library/tool (for example an encrypted reference library); originals stay in the gallery and no flags change. Existing target files are never overwritten. Returns absolute paths.",
    timeoutMs: 120000,
    parameters: {
      ids: { type: "array", required: true, items: { type: "string" }, description: "1–50 exact 32-character task ids." },
      out_dir: { type: "string", required: true, description: "Absolute or ~/ destination directory; created if missing." },
    },
    output,
    async execute({ ids, out_dir: outDir }) {
      if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some((id) => !validId(id))) throw Error("ids 需要 1–50 个 32 位十六进制任务 ID");
      const root = outDir.startsWith("~/") ? join(homedir(), outDir.slice(2)) : outDir;
      if (!isAbsolute(root)) throw Error("out_dir 需要绝对路径或 ~/ 路径");
      await mkdir(root, { recursive: true });
      const dir = worker.directory(), files: string[] = [], failed: Array<{ id: string; error: string }> = [], manifest: Array<Record<string, unknown>> = [];
      for (const id of ids) {
        const job = await readJob(dir, id);
        if (!job) { failed.push({ id, error: "任务不存在" }); continue; }
        if (job.deleted) { failed.push({ id, error: "任务在回收站" }); continue; }
        if (job.status !== "complete") { failed.push({ id, error: `任务未完成（${job.status}）` }); continue; }
        try {
          const target = join(root, id);
          await mkdir(target, { recursive: true });
          const image = join(target, "image.png"), record = join(target, "job.json");
          await copyFile(await imagePath(dir, id), image, constants.COPYFILE_EXCL);
          await writeFile(record, JSON.stringify(job, null, 2), { mode: 0o600, flag: "wx" });
          files.push(image, record);
          manifest.push(summary(job));
        } catch (error) {
          failed.push({ id, error: error instanceof Error ? error.message : String(error) });
        }
      }
      if (manifest.length) {
        const body = JSON.stringify({ jobs: manifest }, null, 2);
        try { await writeFile(join(root, "manifest.json"), body, { mode: 0o600, flag: "wx" }); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          await writeFile(join(root, `manifest-${Date.now()}.json`), body, { mode: 0o600, flag: "wx" });
        }
      }
      return { result: JSON.stringify({ out_dir: root, files, failed, exported: manifest.length,
        note: "只复制，不移动、不改图库；目标已存在时拒绝覆盖。可交给外部图库工具或 外部图库的复制导入 使用。" }) };
    },
  }));
}