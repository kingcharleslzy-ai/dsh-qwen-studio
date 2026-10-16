import { test, expect, vi } from "vitest";
// The DSH registry is supplied by the host; exercise our tool body and projections here.
vi.mock("@deepseek-ai/dsh-tools", () => ({ defineTool: (options: unknown) => options }));
import { mkdtemp, mkdir, writeFile, rm, symlink, rename } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { bundledImageSkill, parseImageSkill } from "../src/skill.js";
import { registerTools } from "../src/tools.js";
import { registerStatusTool } from "../src/status-tool.js";
import { readJob } from "../src/storage.js";
import { parseResult } from "../src/client/conversation-result.js";
import { request, APIError } from "../src/client/api.js";

test("one skill source supplies DSH catalog, trigger and invocable content", () => {
  const skill = bundledImageSkill();
  expect(skill).toMatchObject({ name: "qwen-image", invocation: { modelInvocable: true, userInvocable: true } });
  expect(skill.description).toContain("qwen_generate_image");
  expect(skill.whenToUse).toContain("仅写提示词");
  expect(skill.content).toContain("qwen_image_status");
  expect(skill.content).toContain("不要静默改跑脚本");
  expect(() => parseImageSkill("---\nname: other\n---\nx")).toThrow();
  expect(() => parseImageSkill("---\nname: qwen-image\nname: qwen-image\n---\nx")).toThrow();
});

test("single task recovery works offline, retains flags, rejects path escapes and ignores unrelated corrupt files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qwen-targeted-")), id = "e".repeat(32);
  try {
    await mkdir(join(dir, "images", id), { recursive: true });
    await mkdir(join(dir, "images", "f".repeat(32)), { recursive: true });
    await mkdir(join(dir, "state"));
    await writeFile(join(dir, "state/gallery.json"), JSON.stringify({ [id]: { favorite: true } }));
    await writeFile(join(dir, "images", id, "job.json"), JSON.stringify({ prompt: "A tree", status: "complete", steps: 40, started_at: 1, output: "/secret" }));
    await writeFile(join(dir, "images", "f".repeat(32), "job.json"), "{");
    expect(await readJob(dir, id)).toMatchObject({ id, favorite: true, deleted: false, status: "complete" });
    expect(await readJob(dir, id)).not.toHaveProperty("output");
    expect(await readJob(dir, "a".repeat(32))).toBeUndefined();
    await expect(readJob(dir, "../escape")).rejects.toThrow("ID");
    await mkdir(join(dir, "trash"));
    await rename(join(dir, "images", id), join(dir, "trash", id));
    expect(await readJob(dir, id)).toMatchObject({ deleted: true, favorite: true });
    await symlink(join(dir, "trash", id), join(dir, "images", "a".repeat(32)));
    await expect(readJob(dir, "a".repeat(32))).rejects.toThrow("路径");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("status tool returns the same visible image without starting inference, and does not redisplay trash", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qwen-status-")), id = "c".repeat(32);
  let tool: any;
  const attachment = { attachmentId: "test", mediaType: "image/png", bytes: 4, width: 512, height: 512 };
  const saveImage = vi.fn(async () => attachment), post = vi.fn(), ensure = vi.fn();
  registerStatusTool({ tools: { register: (value: any) => { tool = value; } }, attachments: { saveImage } } as any,
    { directory: () => dir, post, ensure } as any);
  try {
    await mkdir(join(dir, "images", id), { recursive: true });
    const path = join(dir, "images", id, "job.json");
    const job = { prompt: "A tree", status: "running", steps: 40, step: 12, started_at: 1 };
    await writeFile(path, JSON.stringify(job));
    const running = await tool.execute({ id }, {});
    expect(running).toMatchObject({ status: "running", step: 12 });
    expect(saveImage).not.toHaveBeenCalled();
    await writeFile(path, JSON.stringify({ ...job, status: "complete", step: 40 }));
    await writeFile(join(dir, "images", id, "image.png"), "mock");
    const complete = await tool.execute({ id }, {});
    expect(tool.output.render({ id }, complete)).toContainEqual({ type: "image", attachment });
    expect(parseResult({ type: "tool/result", seq: 7, data: { meta: tool.output.presentationMeta({ id }, complete) } })).toMatchObject({ id, attachment });
    await mkdir(join(dir, "trash"));
    await rename(join(dir, "images", id), join(dir, "trash", id));
    const trashed = await tool.execute({ id }, {});
    expect(trashed).toMatchObject({ status: "trashed" });
    expect(trashed).not.toHaveProperty("attachment");
    await expect(tool.execute({ id: "d".repeat(32) }, {})).rejects.toThrow("不存在");
    expect(post).not.toHaveBeenCalled(); expect(ensure).not.toHaveBeenCalled();
    expect(saveImage).toHaveBeenCalledTimes(1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("non-JSON host errors preserve HTTP status for actionable recovery", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>not found</html>", { status: 404 })));
  try {
    await expect(request("progress")).rejects.toMatchObject({ status: 404 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    await expect(request("state")).rejects.toBeInstanceOf(APIError);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 200 })));
    await expect(request("state")).rejects.toThrow("JSON");
  } finally { vi.unstubAllGlobals(); }
});


test("generation forwards advanced parameters into the same durable queue and returns a conversation image", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qwen-tool-route-"));
  const definitions: any[] = [];
  let payload: any;
  const attachment = { attachmentId: "mock", mediaType: "image/png", bytes: 4, width: 512, height: 512 };
  const post = vi.fn(async (_path, value) => {
    payload = value;
    await mkdir(join(dir, "images", value.id), { recursive: true });
    await writeFile(join(dir, "images", value.id, "job.json"), JSON.stringify({ ...value, status: "complete", started_at: 1 }));
    await writeFile(join(dir, "images", value.id, "image.png"), "mock");
  });
  registerTools({ tools: { register: (tool: any) => definitions.push(tool) }, attachments: { saveImage: async () => attachment } } as any,
    { directory: () => dir, post } as any);
  const tool = definitions.find(t => t.name === "qwen_generate_image");
  const args = { prompt: "A tree", width: 512, height: 512, steps: 4, source_image_id: "b".repeat(32), mask_image_id: "c".repeat(32), controlnet_image_id: "d".repeat(32), controlnet_strength: .8, lora_paths: ["/models/style.safetensors"], lora_scales: [.8] };
  try {
    const value = await tool.execute(args, { callId: "image-call", agent: { id: "qa" }, signal: new AbortController().signal });
    expect(payload).toMatchObject(args);
    expect(payload).not.toHaveProperty("change_strength");
    expect(post).toHaveBeenCalledTimes(1);
    expect(parseResult({ type: "tool/result", seq: 8, data: { meta: tool.output.presentationMeta(args, value) } })).toMatchObject({ id: value.id, attachment });
    await expect(tool.execute({ ...args, change_strength: .4 }, {})).rejects.toThrow("蒙版");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a rejected or unconfirmed submission returns its task ID for recovery instead of suggesting a script", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qwen-tool-error-")), definitions: any[] = [];
  const post = vi.fn(async () => { throw Error("connection interrupted"); });
  registerTools({ tools: { register: (tool: any) => definitions.push(tool) }, attachments: {} } as any,
    { directory: () => dir, post } as any);
  try {
    await expect(definitions.find(t => t.name === "qwen_generate_image").execute({ prompt: "A tree" }, { callId: "qa", signal: new AbortController().signal }))
      .rejects.toThrow(/任务 [a-f0-9]{32}.*qwen_image_status/);
    expect(post).toHaveBeenCalledTimes(1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
