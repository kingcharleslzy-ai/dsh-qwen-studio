import { test, expect } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "../src/worker.js";
test("local connection check accepts actual Qwen pipeline model_index layout", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qwen-model-"));
  try {
    await writeFile(join(dir, "model_index.json"), "{}");
    const worker = new Worker(() => ({
      pythonPath: process.execPath,
      modelPath: dir,
    }));
    expect(await worker.check()).toMatchObject({ ok: true, model: dir });
    await rm(join(dir, "model_index.json"));
    await expect(worker.check()).rejects.toThrow("模型目录中未找到");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
