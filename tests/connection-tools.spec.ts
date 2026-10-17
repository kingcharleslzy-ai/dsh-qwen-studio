import { test, expect, vi } from "vitest";
vi.mock("@deepseek-ai/dsh-tools", () => ({ defineTool: (x: unknown) => x }));
import { connectionOperation, registerConnectionTool } from "../src/connection-tools.js";
import { Worker } from "../src/worker.js";
import type { Config } from "../src/config.js";
async function fixture() {
  const config: Config = { connectionMode: "remote", pythonPath: process.execPath, modelPath: process.cwd(), remoteBaseURL: "http://127.0.0.1:19488/v1", remoteSshHost: "test-gpu", remoteApiKey: "do-not-return-this-secret", localMfluxIdleMinutes: 10 };
  const worker = new Worker(() => config); let revision = 4;
  const changes: any[] = [];
  const settings = {
    describe: () => [{ ns: "qwen-studio", revision }],
    mutate: async (_ns: string, ops: any[], expected: number) => {
      expect(expected).toBe(revision); changes.push(ops);
      for (const op of ops) (config as any)[op.path[0]] = op.value; revision++;
    },
  };
  return { config, worker, settings, changes };
}
test("agent switches saved connections live, preserving credentials and using only narrow revision-checked writes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw Error("offline local worker"); }));
  const f = await fixture();
  try {
    const tools: any[] = []; registerConnectionTool({ tools: { register: (t: any) => tools.push(t) } } as any, f.worker, f.settings);
    expect(tools[0].name).toBe("qwen_image_connection");
    const status = await connectionOperation(f.worker, f.settings, {}); expect(status.revision).toBe(4);
    expect(JSON.stringify(status)).not.toContain(f.config.remoteApiKey);
    const local = await connectionOperation(f.worker, f.settings, { action: "switch", mode: "local", revision: 4 });
    expect(local).toMatchObject({ mode: "local", restart_required: false, revision: 5 });
    const remote = await connectionOperation(f.worker, f.settings, { action: "switch", mode: "remote", revision: 5 });
    expect(remote.mode).toBe("remote"); expect(f.worker.lifecycle.connected).toBe(false);
    expect(f.changes).toEqual([[{ op: "set", path: ["connectionMode"], value: "local" }], [{ op: "set", path: ["connectionMode"], value: "remote" }]]);
    expect(f.config.remoteApiKey).toBe("do-not-return-this-secret");
    await expect(connectionOperation(f.worker, f.settings, { action: "set_idle", idle_minutes: 7, revision: 4 })).rejects.toThrow("已被其他页面修改");
    await connectionOperation(f.worker, f.settings, { action: "set_idle", idle_minutes: 7, revision: 6 });
    expect(f.config.localMfluxIdleMinutes).toBe(7); expect(f.worker.lifecycle.connected).toBe(false);
  } finally { await f.worker.dispose(); vi.unstubAllGlobals(); }
});
test("switching while queued/uploading is blocked without writing settings or cutting SSH", async () => {
  const f = await fixture();
  try {
    vi.spyOn(f.worker.remote, "size", "get").mockReturnValue(1);
    await expect(connectionOperation(f.worker, f.settings, { action: "switch", mode: "local", revision: 4 })).rejects.toThrow("正在上传、排队或生成");
    expect(f.changes).toEqual([]); expect(f.worker.mode()).toBe("remote");
  } finally { vi.restoreAllMocks(); await f.worker.dispose(); }
});
