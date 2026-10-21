import { test, expect, vi } from "vitest";
vi.mock("@deepseek-ai/dsh-tools", () => ({ defineTool: (options: unknown) => options }));
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { selectJobs, registerGalleryTools } from "../src/gallery-tool.js";
import type { Job } from "../src/shared.js";

const job = (patch: Partial<Job>): Job => ({
  id: "a".repeat(32),
  prompt: "quiet bedroom portrait",
  status: "complete",
  width: 832,
  height: 1216,
  steps: 40,
  seed: 7,
  started_at: 1_800_000_000,
  ...patch,
});

const jobs: Job[] = [
  job({ id: "1".repeat(32), prompt: "bench landscape", seed: 101, favorite: true }),
  job({ id: "2".repeat(32), prompt: "Bedroom natural skin", seed: 202, archived: true }),
  job({ id: "3".repeat(32), prompt: "queued prompt", status: "running", seed: 303 }),
  job({ id: "4".repeat(32), prompt: "trashed prompt", deleted: true }),
  job({ id: "5".repeat(32), prompt: "reference edit", source_image_id: "b".repeat(32), reference_mode: "edit" }),
];

test("gallery query filters by substring, seed and flags without touching storage", () => {
  expect(selectJobs(jobs, { query: "BEDROOM" }).map((j) => j.id)).toEqual(["2".repeat(32)]);
  expect(selectJobs(jobs, { seed: 101 }).map((j) => j.id)).toEqual(["1".repeat(32)]);
  expect(selectJobs(jobs, { favorite: true }).map((j) => j.id)).toEqual(["1".repeat(32)]);
  expect(selectJobs(jobs, { archived: true }).map((j) => j.id)).toEqual(["2".repeat(32)]);
  expect(selectJobs(jobs, { sourceImageId: "b".repeat(32) }).map((j) => j.id)).toEqual(["5".repeat(32)]);
});

test("gallery excludes trash by default and can page through active tasks", () => {
  expect(selectJobs(jobs, {}).map((j) => j.id)).not.toContain("4".repeat(32));
  expect(selectJobs(jobs, { includeDeleted: true }).map((j) => j.id)).toContain("4".repeat(32));
  expect(selectJobs(jobs, { status: "active" }).map((j) => j.id)).toEqual(["3".repeat(32)]);
  expect(selectJobs(jobs, { status: "complete" }).map((j) => j.id)).toEqual(["1".repeat(32), "2".repeat(32), "5".repeat(32)]);
  expect(selectJobs(jobs, { status: "trashed" }).map((j) => j.id)).toEqual(["4".repeat(32)]);
});

test("gallery time bounds are inclusive and use started_at seconds", () => {
  const older = job({ id: "6".repeat(32), prompt: "old", started_at: 1_700_000_000 });
  const list = [...jobs, older];
  expect(selectJobs(list, { since: 1_750_000_000 }).map((j) => j.id)).not.toContain("6".repeat(32));
  expect(selectJobs(list, { until: 1_750_000_000 }).map((j) => j.id)).toEqual(["6".repeat(32)]);
});

async function toolFixture() {
  const dir = await mkdtemp(join(tmpdir(), "qwen-gallery-tools-"));
  const ids = { done: "a".repeat(32), running: "b".repeat(32), old: "c".repeat(32) };
  for (const [name, id] of Object.entries(ids)) {
    await mkdir(join(dir, "images", id), { recursive: true });
    await writeFile(join(dir, "images", id, "image.png"), "fixture");
    await writeFile(join(dir, "images", id, "job.json"), JSON.stringify({
      id, prompt: `${name} prompt`, status: name === "running" ? "running" : "complete",
      seed: name === "old" ? 1 : 2, width: 832, height: 1216, steps: 40,
      started_at: name === "old" ? 1_700_000_000 : 1_800_000_000,
      source_image_id: name === "done" ? "d".repeat(32) : undefined,
      reference_mode: name === "done" ? "edit" : undefined,
      lora_names: name === "done" ? ["look.safetensors"] : undefined,
    }));
  }
  const tools = new Map<string, any>();
  const worker = { directory: () => dir, post: vi.fn(async () => ({ ok: true })) };
  registerGalleryTools({ tools: { register: (t: any) => tools.set(t.name, t) } } as any, worker as any);
  const run = async (name: string, args: object) =>
    JSON.parse((await tools.get(name).execute(args, { signal: new AbortController().signal })).result);
  return { dir, ids, worker, run };
}

test("jobs and gallery tools are read-only, expose lineage, and never call the worker", async () => {
  const f = await toolFixture();
  try {
    const queue = await f.run("qwen_image_jobs", {});
    expect(queue.active).toBe(1);
    expect(queue.queue[0].id).toBe(f.ids.running);
    expect(queue.counts).toMatchObject({ complete: 2, running: 1 });
    expect(f.worker.post).not.toHaveBeenCalled();

    const batch = await f.run("qwen_image_jobs", { ids: [f.ids.done, "e".repeat(32)] });
    expect(batch.jobs[0]).toMatchObject({ id: f.ids.done, source_image_id: "d".repeat(32), reference_mode: "edit", lora_names: ["look.safetensors"] });
    expect(batch.missing).toEqual(["e".repeat(32)]);

    const gallery = await f.run("qwen_image_gallery", { query: "DONE", limit: 1 });
    expect(gallery.total).toBe(1);
    expect(gallery.jobs[0].seed).toBe(2);
    expect(gallery.has_more).toBe(false);
    expect(f.worker.post).not.toHaveBeenCalled();

    const old = await f.run("qwen_image_gallery", { since: "2026-01-01T00:00:00Z" });
    expect(old.jobs.map((j: Job) => j.id)).not.toContain(f.ids.old);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test("export copies completed jobs with lineage and never moves gallery originals", async () => {
  const f = await toolFixture();
  const out = join(f.dir, "export");
  try {
    const result = await f.run("qwen_image_export", { ids: [f.ids.done, f.ids.running], out_dir: out });
    expect(result.exported).toBe(1);
    expect(result.files.some((p: string) => p.endsWith("image.png"))).toBe(true);
    expect(result.failed[0]).toMatchObject({ id: f.ids.running });
    expect(await readFile(join(f.dir, "images", f.ids.done, "image.png"), "utf8")).toBe("fixture");
    expect(JSON.parse(await readFile(join(out, f.ids.done, "job.json"), "utf8"))).toMatchObject({ id: f.ids.done, reference_mode: "edit" });
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test("cancel targets only active tasks and reports finished ids without failing the batch", async () => {
  const f = await toolFixture();
  try {
    const cancelled = await f.run("qwen_image_cancel", { ids: [f.ids.running, f.ids.done] });
    expect(cancelled.results[0]).toMatchObject({ id: f.ids.running, ok: true });
    expect(cancelled.results[1]).toMatchObject({ id: f.ids.done, ok: false });
    expect(f.worker.post).toHaveBeenCalledTimes(1);
    expect(f.worker.post).toHaveBeenCalledWith("/v1/cancel", { id: f.ids.running });
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test("lineage query finds every multi-image reference", () => {
 const ids=["b".repeat(32),"c".repeat(32)], j=job({source_image_ids:ids});
 expect(selectJobs([j],{sourceImageId:ids[1]})).toEqual([j]);
});
