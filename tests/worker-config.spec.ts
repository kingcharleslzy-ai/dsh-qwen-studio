import { test, expect, vi } from "vitest";
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

test("worker upgrade releases only a known idle worker and never interrupts busy or unknown services", async () => {
  const { upgradeIdleWorker } = await import("../src/worker-upgrade.js");
  let unloads = 0,
    reads = 0;
  const unload = async () => {
      unloads++;
    },
    read = async () => {
      reads++;
      return { status: "offline" };
    },
    pause = async () => {};
  await expect(
    upgradeIdleWorker(
      { status: "ok", version: 5, busy: true },
      unload,
      read,
      pause,
    ),
  ).rejects.toThrow("不会中断");
  expect(unloads).toBe(0);
  expect(reads).toBe(0);
  await expect(
    upgradeIdleWorker(
      { status: "ok", version: 99, busy: false },
      unload,
      read,
      pause,
    ),
  ).rejects.toThrow("版本未知");
  expect(unloads).toBe(0);
  expect(
    await upgradeIdleWorker(
      { status: "ok", version: 5, busy: false },
      unload,
      read,
      pause,
    ),
  ).toEqual({ status: "offline" });
  expect(unloads).toBe(1);
  expect(
    await upgradeIdleWorker(
      { status: "ok", version: 8, busy: true },
      unload,
      read,
      pause,
    ),
  ).toMatchObject({ version: 8 });
  expect(unloads).toBe(1);
});


test("local native editing checks capability before startup without backend fallback", async () => {
 const worker = new Worker(() => ({ connectionMode: "local" }));
 const support = vi.spyOn(worker, "referenceEditing").mockResolvedValue({ supported: false, reason: "模型缺少视觉编码器" });
 const ensure = vi.spyOn(worker, "ensure").mockRejectedValue(Error("validated and reached startup"));
 try {
   await expect(worker.post("/v1/jobs", { reference_mode: "edit" }, true)).rejects.toThrow("视觉编码器");
   expect(ensure).not.toHaveBeenCalled();
   support.mockResolvedValue({ supported: true });
   await expect(worker.post("/v1/jobs", { reference_mode: "edit" }, true)).rejects.toThrow("reached startup");
   expect(worker.mode()).toBe("local");
 } finally { await worker.dispose(); }
});
