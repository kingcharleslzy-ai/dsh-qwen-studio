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
      { status: "ok", version: 7, busy: true },
      unload,
      read,
      pause,
    ),
  ).toMatchObject({ version: 7 });
  expect(unloads).toBe(1);
});


test("local worker rejects unsupported native editing before model startup", async () => {
 const worker = new Worker(() => ({ connectionMode: "local" }));
 try { await expect(worker.post("/v1/jobs", { reference_mode: "edit" }, true)).rejects.toThrow("远程 Qwen 网关"); }
 finally { await worker.dispose(); }
});
