import { test, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readJobs, setFlag, validId } from "../src/storage.js";
test("host recovers completed images from disk while worker is offline and retains archive flags", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qwen-")),
    id = "a".repeat(32);
  try {
    await mkdir(join(dir, "images", id), { recursive: true });
    await writeFile(
      join(dir, "images", id, "job.json"),
      JSON.stringify({
        id,
        prompt: "teapot",
        status: "complete",
        seed: 42,
        width: 512,
        height: 512,
        steps: 12,
        sampling_steps: 5,
        source_image_id: "b".repeat(32),
        change_strength: 0.4,
        started_at: 1,
        output: "/private/file",
      }),
    );
    await Promise.all([
      setFlag(dir, id, "favorite", true),
      setFlag(dir, id, "archived", true),
    ]);
    const jobs = await readJobs(dir);
    expect(jobs[0]).toMatchObject({
      id,
      status: "complete",
      favorite: true,
      archived: true,
      sampling_steps: 5,
      source_image_id: "b".repeat(32),
      change_strength: 0.4,
    });
    expect(jobs[0]).not.toHaveProperty("output");
    await setFlag(dir, id, "archived", false);
    expect((await readJobs(dir))[0]?.archived).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("path identifiers are closed to traversal", () => {
  expect(validId("../secret")).toBe(false);
  expect(validId("a".repeat(32))).toBe(true);
});
