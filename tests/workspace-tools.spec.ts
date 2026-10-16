import { test, expect, vi } from "vitest";
vi.mock("@deepseek-ai/dsh-tools", () => ({ defineTool: (options: unknown) => options }));
import { mkdtemp, mkdir, writeFile, rm, unlink, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerWorkspaceTools, draftFromSettings, settingsFromDraft } from "../src/workspace-tools.js";
import { readPresets, mutatePresets } from "../src/presets.js";
import { resolveConfig } from "../src/resolved-config.js";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
async function setup() {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "qwen-workspace-tools-")));
  const config = { localMfluxDirectory: dir, remoteApiKey: "never-return-this-secret" };
  const worker = { transportConfig: () => config, directory: () => dir, mode: () => "local", ensure: vi.fn(), post: vi.fn() };
  const tools = new Map<string, any>();
  registerWorkspaceTools({ tools: { register: (t: any) => tools.set(t.name, t) } } as any, worker as any);
  const run = async (name: string, args: object) => JSON.parse((await tools.get(name).execute(args)).result);
  return { dir, config, worker, tools, run, preset: (args: object) => run("qwen_image_presets", args) };
}
test("agent discovers real allowed resources without inference, image pixels or unrelated prompts", async () => {
  const f = await setup();
  try {
    await mkdir(join(f.dir, "loras"));
    await writeFile(join(f.dir, "loras", "ceramic.safetensors"), "dummy fixture");
    const r = await f.run("qwen_image_resources", { kind: "lora", query: "ceramic", limit: 1 });
    expect(r.items[0]).toMatchObject({ name: "ceramic.safetensors", origin: "default", path: join(f.dir, "loras", "ceramic.safetensors") });
    expect(JSON.stringify(r)).not.toContain("never-return-this-secret");
    expect(f.worker.ensure).not.toHaveBeenCalled(); expect(f.worker.post).not.toHaveBeenCalled();
    await expect(f.run("qwen_image_resources", { kind: "all", limit: 1000 })).rejects.toThrow();
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});
test("agent presets share the panel store, roundtrip all advanced parameters, enforce revisions and stop on missing resources", async () => {
  const f = await setup();
  try {
    await mkdir(join(f.dir, "loras")); const path = join(f.dir, "loras", "ceramic.safetensors"); await writeFile(path, "fixture");
    const ids = ["1".repeat(32), "2".repeat(32), "3".repeat(32)];
    for (const [i, id] of ids.entries()) {
      const p = join(f.dir, "assets/images", id); await mkdir(p, { recursive: true });
      await writeFile(join(p, "image.png"), png); await writeFile(join(p, "asset.json"), JSON.stringify({ id, kind: ["source", "control", "mask"][i], name: `${i}.png` }));
    }
    const settings = { width: 512, height: 512, steps: 8, seed: 0, negative_prompt: "blur", guidance: 2.5, scheduler: "linear", lora_paths: [path], lora_scales: [.8], source_image_id: ids[0], controlnet_image_id: ids[1], controlnet_strength: .7, mask_image_id: ids[2] };
    const s = await f.preset({ action: "save", name: "产品", revision: 0, settings }); const id = s.presets[0].id;
    const loaded = await f.preset({ action: "load", id }); expect(loaded.settings).toMatchObject(settings); expect(loaded.issues).toEqual([]);
    expect((await readPresets(f.dir)).items[0].name).toBe("产品");
    await mutatePresets(resolveConfig(f.config), { action: "rename", id, name: "面板改名", revision: s.revision });
    await expect(f.preset({ action: "rename", id, name: "旧修订", revision: s.revision })).rejects.toThrow();
    await unlink(path); const missing = await f.preset({ action: "load", id }); expect(missing.settings).toBeNull(); expect(missing.issues.join()).toContain("ceramic");
    expect(f.worker.ensure).not.toHaveBeenCalled(); expect(f.worker.post).not.toHaveBeenCalled();
    expect(() => draftFromSettings({ prompt: "must not save prompt" })).toThrow();
    expect(() => draftFromSettings({ mask_image_id: ids[2], source_image_id: ids[0], change_strength: .4 })).toThrow();
    expect(settingsFromDraft(draftFromSettings({ steps: 20 }))).not.toHaveProperty("seed");
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});
test("save from completed job retains actual seed and parameters, never its prompt, and supports explicit management", async () => {
  const f = await setup();
  try {
    const jobId = "4".repeat(32), p = join(f.dir, "images", jobId); await mkdir(p, { recursive: true });
    await writeFile(join(p, "image.png"), png); await writeFile(join(p, "job.json"), JSON.stringify({ status: "complete", prompt: "private image description", width: 512, height: 512, steps: 12, seed: 9, guidance: 2.5, negative_prompt: "blur", scheduler: "flow_match_euler_discrete", started_at: 1 }));
    let s = await f.preset({ action: "save", name: "静物", from_job_id: jobId, revision: 0 }); const id = s.presets[0].id;
    const r = await f.preset({ action: "load", id }); expect(r.settings).toMatchObject({ seed: 9, steps: 12, scheduler: "flow_match_euler_discrete" });
    const exp = await f.preset({ action: "export", id }); expect(JSON.stringify(exp)).not.toContain("private image description");
    s = await f.preset({ action: "set_default", id, revision: s.revision }); expect(s.default_id).toBe(id);
    s = await f.preset({ action: "clear_default", revision: s.revision }); expect(s.default_id).toBeNull();
    s = await f.preset({ action: "delete", id, revision: s.revision }); expect(s.presets).toHaveLength(0);
    s = await f.preset({ action: "import", revision: s.revision, document_json: JSON.stringify(exp) }); expect(s.presets).toHaveLength(1);
    await expect(f.preset({ action: "save", name: "bad", settings: {} })).rejects.toThrow("revision");
    await expect(f.preset({ action: "save", name: "bad", settings: {}, from_job_id: jobId, revision: s.revision })).rejects.toThrow("其中之一");
    expect(f.worker.post).not.toHaveBeenCalled();
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});
