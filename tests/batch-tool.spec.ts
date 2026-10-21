import { test, expect, vi } from "vitest";
vi.mock("@deepseek-ai/dsh-tools", () => ({ defineTool: (options: unknown) => options }));
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerBatchTool } from "../src/batch-tool.js";

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "qwen-batch-"));
  const tools = new Map<string, any>();
  const worker = {
    directory: () => dir,
    post: vi.fn(async (path: string, payload: any) => {
      if (payload.prompt.includes("fail")) throw Error("backend rejected");
      await mkdir(join(dir, "images", payload.id), { recursive: true });
      await writeFile(join(dir, "images", payload.id, "job.json"), JSON.stringify({
        id: payload.id, prompt: payload.prompt, status: "queued", seed: payload.seed,
        width: payload.width, height: payload.height, steps: payload.steps, started_at: Date.now() / 1000,
      }));
      return { ok: true };
    }),
  };
  registerBatchTool({ tools: { register: (t: any) => tools.set(t.name, t) } } as any, worker as any);
  const run = async (args: object) => JSON.parse((await tools.get("qwen_image_batch").execute(args, {
    callId: "call-1", agent: { id: "agent" }, signal: new AbortController().signal,
  })).result);
  return { dir, worker, run };
}

test("batch submits independent jobs, returns real ids and reports per-job failures", async () => {
  const f = await setup();
  try {
    const result = await f.run({ jobs: [
      { prompt: "first", seed: 1 },
      { prompt: "fail this", seed: 2 },
      { prompt: "third", seed: 3 },
    ] });
    expect(result.submitted).toBe(2);
    expect(result.accepted.map((a: any) => a.seed)).toEqual([1, 3]);
    expect(result.accepted[0].id).toMatch(/^[a-f0-9]{32}$/);
    expect(result.failed).toEqual([{ index: 1, error: "backend rejected" }]);
    expect(f.worker.post).toHaveBeenCalledTimes(3);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test("batch rejects invalid job counts and impossible parallelism", async () => {
  const f = await setup();
  try {
    await expect(f.run({ jobs: [] })).rejects.toThrow("1–10");
    await expect(f.run({ jobs: [{ prompt: "ok" }], max_parallel: 5 })).rejects.toThrow("1–4");
    const invalid = await f.run({ jobs: [{ prompt: "ok", reference_mode: "edit" }] });
    expect(invalid.submitted).toBe(0);
    expect(invalid.failed[0].error).toContain("source_image_id");
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});
