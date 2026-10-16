import { test, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readJobs, batchAction, imagePath } from "../src/storage.js";
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "qwen-gallery-"));
  const ids = ["a".repeat(32), "b".repeat(32)];
  for (const id of ids) {
    await mkdir(join(dir, "images", id), { recursive: true });
    await writeFile(
      join(dir, "images", id, "job.json"),
      JSON.stringify({ id, status: "complete", prompt: "test", started_at: 1 }),
    );
    await writeFile(join(dir, "images", id, "image.png"), "fixture");
  }
  return { dir, ids };
}
test("batch archive, delete and restore preserve original files and flags", async () => {
  const { dir, ids } = await fixture();
  try {
    await batchAction(dir, ids, "archived", true);
    await batchAction(dir, ids, "delete");
    expect((await readJobs(dir)).every((j) => j.deleted && j.archived)).toBe(
      true,
    );
    await expect(access(join(dir, "images", ids[0]!))).rejects.toThrow();
    expect(await imagePath(dir, ids[0]!)).toContain("/trash/");
    await batchAction(dir, ids, "restore");
    expect((await readJobs(dir)).every((j) => !j.deleted && j.archived)).toBe(
      true,
    );
    await batchAction(dir, ids, "archived", false);
    expect((await readJobs(dir)).every((j) => !j.archived)).toBe(true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("purge refuses live library and only removes explicitly selected trash fixture", async () => {
  const { dir, ids } = await fixture();
  try {
    await expect(batchAction(dir, ids, "purge")).rejects.toThrow("只能");
    await batchAction(dir, ids, "delete");
    await batchAction(dir, [ids[0]!], "purge");
    expect((await readJobs(dir)).map((j) => j.id)).toEqual([ids[1]]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("mixed active selection rejected before moving any completed image", async () => {
  const { dir, ids } = await fixture();
  try {
    await writeFile(
      join(dir, "images", ids[1]!, "job.json"),
      JSON.stringify({ id: ids[1], status: "running" }),
    );
    await expect(batchAction(dir, ids, "delete")).rejects.toThrow("取消");
    await expect(access(join(dir, "images", ids[0]!))).resolves.toBeUndefined();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
