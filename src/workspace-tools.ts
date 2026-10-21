import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { basename } from "node:path";
import type { Worker } from "./worker.js";
import { resolveConfig } from "./resolved-config.js";
import { listResources } from "./resources.js";
import { readPresets, loadPreset, mutatePresets, exportPresets } from "./presets.js";
import { readJob } from "./storage.js";
import { draftDefaults, generationPayload, reuseDraft, type CreationDraft } from "./client/creation-draft.js";
import { generationParameters } from "./generation-parameters.js";
import { importImage } from "./image-import.js";
import type { ImageAttachmentRef } from "@deepseek-ai/dsh-attachment";

// The agent and panel share the same preset store, resource validation and revision lock.
export function draftFromSettings(p: Record<string, any>): CreationDraft {
  const allowed = Object.keys(generationParameters).filter(k => k !== "prompt");
  if (Object.keys(p).some(k => !allowed.includes(k))) throw Error("预设仅接受生图参数，不能保存提示词正文、连接设置或密钥");
  const d: CreationDraft = {
    ...draftDefaults, prompt: "preset validation",
    size: `${p.width ?? 1024}x${p.height ?? 1024}`, steps: p.steps ?? 40,
    seed: p.seed == null ? "" : String(p.seed), negativePrompt: p.negative_prompt ?? "",
    guidance: p.guidance ?? 1, scheduler: p.scheduler ?? "linear",
    changeStrength: p.change_strength ?? .45,
    referenceMode: p.reference_mode ?? "variation",
    sourceId: p.mask_image_id ? "" : (p.source_image_ids?.[0] ?? p.source_image_id ?? ""),
    additionalSourceIds: p.mask_image_id ? [] : (p.source_image_ids?.slice(1) ?? []),
    additionalSourceNames: p.mask_image_id ? [] : (p.source_image_ids?.slice(1).map(() => "多图参考") ?? []),
    maskSourceId: p.mask_image_id ? (p.source_image_id ?? "") : "",
    maskId: p.mask_image_id ?? "", maskEnabled: Boolean(p.mask_image_id),
    controlId: p.controlnet_image_id ?? "", controlEnabled: Boolean(p.controlnet_image_id),
    controlStrength: p.controlnet_strength ?? 1,
    loras: (p.lora_paths ?? []).map((path: string, i: number) => ({
      path, name: basename(path), scale: p.lora_scales?.[i] ?? 1, enabled: true,
    })),
  };
  if (p.lora_scales && p.lora_scales.length !== d.loras.length) throw Error("每个 LoRA 必须对应一个权重");
  if (p.mask_image_id && p.change_strength !== undefined) throw Error("蒙版重绘不使用 change_strength");
  if (p.reference_mode === "edit" && ((!p.source_image_id && !p.source_image_ids?.length) || p.mask_image_id || p.change_strength !== undefined)) throw Error("原生参考编辑需要原图，且不能使用变化幅度或蒙版");
  generationPayload(d, false, "");
  return d;
}
export function settingsFromDraft(draft: CreationDraft) {
  const { id: _, prompt: __, lora_names: ___, ...data } = generationPayload({ ...draft, prompt: "preset validation" }, false, "");
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null));
}
export async function workspacePreset(worker: Worker, args: Record<string, any>) {
  const config = resolveConfig(worker.transportConfig()), store = await readPresets(config.localMfluxDirectory);
  const selected = store.items.find(p => p.id === args.id);
  if (args.action === "list") return {
    revision: store.revision, default_id: store.defaultId,
    presets: store.items.map(p => ({ id: p.id, name: p.name, is_default: p.id === store.defaultId })),
    note: "与高级设置共用预设。只读取，不改变面板草稿，也不启动生图。",
  };
  if (args.action === "load") {
    if (!selected) throw Error("预设不存在；先 list 获取真实 ID");
    const loaded = await loadPreset(config, selected);
    let settings: ReturnType<typeof settingsFromDraft> | null = null;
    const issues = [...loaded.issues];
    if (!issues.length) try { settings = settingsFromDraft(loaded.draft); } catch(e) { issues.push((e as Error).message); }
    return { id: selected.id, name: selected.name, revision: store.revision, mode: worker.mode(), reference_edit: await worker.referenceEditing(), remote_capabilities: worker.mode() === "remote" ? await worker.capabilities() : null, settings, issues,
      note: "这是供 qwen_generate_image 使用的参数，不会自动生图或覆盖面板草稿。保留用户当前 prompt，与 settings 合并调用。当前原生编辑能力以 reference_edit.supported 为准，远程高级能力以 remote_capabilities 为准；不支持的参数不要静默删除。" };
  }
  if (args.action === "export") {
    if (args.id && !selected) throw Error("预设不存在");
    return exportPresets(store, args.id);
  }
  if (!Number.isInteger(args.revision)) throw Error("写入前先 list，传入返回的 revision，避免覆盖其他页面的修改");
  const mutation: Record<string, any> = { action: args.action, id: args.id, revision: args.revision, name: args.name };
  if (args.action === "save") {
    if (Boolean(args.from_job_id) === Boolean(args.settings)) throw Error("save 需要且只能提供 from_job_id 或 settings 其中之一");
    let draft: CreationDraft;
    if (args.from_job_id) {
      const job = await readJob(config.localMfluxDirectory, args.from_job_id);
      if (!job || job.deleted || job.status !== "complete") throw Error("只能从有效且已完成的图片任务保存参数");
      draft = { ...draftDefaults, ...reuseDraft(job, false) };
    } else draft = draftFromSettings(args.settings);
    const { prompt: _, missingResources: __, ...values } = draft;
    mutation.values = values;
    mutation.id = args.id ?? null;
  } else if (args.action === "set_default" || args.action === "clear_default") {
    mutation.action = "default";
    mutation.id = args.action === "clear_default" ? null : args.id;
  } else if (args.action === "import") {
    if (typeof args.document_json !== "string" || Buffer.byteLength(args.document_json) > 1024 * 1024) throw Error("导入 JSON 需小于 1MiB");
    mutation.document = JSON.parse(args.document_json);
  } else if (!["rename", "delete"].includes(args.action)) throw Error("预设操作无效");
  const next = await mutatePresets(config, mutation);
  return { revision: next.revision, default_id: next.defaultId, presets: next.items.map(p => ({ id: p.id, name: p.name })),
    note: "已保存到与高级设置共用的预设库。不会启动模型、创建图片或改动已提交任务；已打开的预设列表可用管理中的刷新列表读取，也可重新进入高级设置。" };
}
const output = {
  schema: { type: "object", properties: { result: { type: "string", required: true } }, additionalProperties: false },
  render: (_args: unknown, value: { result: string }) => [{ type: "text" as const, text: value.result }],
} as const;
export function registerWorkspaceTools(ctx: Context, worker: Worker) {
  ctx.tools.register(defineTool({
    name: "qwen_image_import",
    description: "Import a reference image, control image or mask into the Qwen Image resource library without generating or starting the model/SSH. Accepts exactly one public HTTP(S) image URL, absolute local file path, or real conversation image attachment reference. For web-reference img2img, first use available search/browser tools to find a suitable image and its direct image URL, then import it here; do not ask the user to open the gallery or run a downloader script. Returns the real 32-character id, dimensions and parameter name for qwen_generate_image and presets. PNG/JPEG/WebP up to 64MiB; rejects HTML pages, private-network URLs and unsupported files. Original files are unchanged; imported inputs are resources, not generated gallery works. Remote Qwen automatically synchronizes selected resources on generation.",
    timeoutMs: 90000,
    parameters: {
      kind: { type: "string", description: "source (default) for img2img/inpaint source; control for an actual structure/pose/edge image; mask for a white-redraw/black-keep mask. Import does not extract edges, pose or create a mask." },
      url: { type: "string", description: "Public direct HTTP/HTTPS image URL, not a search-result page. Mutually exclusive with path and attachment. No login/cookies required; private/Tailscale URLs are rejected." },
      path: { type: "string", description: "Existing absolute or ~/ image path on the DSH host (Mac), obtained from user context or actual file tools. Not a Windows server path; never guess. Mutually exclusive with url and attachment." },
      name: { type: "string", description: "Optional recognizable resource name, e.g. mountain-reference.jpg." },
      attachment: {
        type: "object", additionalProperties: false,
        description: "Exact image attachment reference from conversation context, not just its hash. Mutually exclusive with url and path; never invent fields.",
        properties: {
          attachmentId: { type: "string", required: true },
          mediaType: { type: "string", required: true },
          bytes: { type: "integer", required: true },
          width: { type: "integer", required: true },
          height: { type: "integer", required: true },
          name: { type: "string" },
          originalDimensions: { type: "object", additionalProperties: false, properties: {
            width: { type: "integer", required: true }, height: { type: "integer", required: true },
          } },
        },
      },
    }, output,
    async execute(args, exec) {
      const config = resolveConfig(worker.transportConfig());
      const { attachment, ...input } = args;
      const asset = await (worker.withActivity ? worker.withActivity.bind(worker) : async (fn: () => Promise<any>) => fn())(() => importImage({ ...input, ...(attachment ? { attachment: attachment as ImageAttachmentRef } : {}) }, {
        directory: config.localMfluxDirectory, python: config.pythonPath, signal: exec.signal,
        readAttachment: (ref, signal) => ctx.attachments.readImage(ref, signal),
      }));
      const parameter = asset.kind === "control" ? "controlnet_image_id" : asset.kind === "mask" ? "mask_image_id" : "source_image_id";
      return { result: JSON.stringify({ ...asset, parameter, settings: { [parameter]: asset.id },
        note: "已导入资源库，尚未生图，也不覆盖面板草稿。用户要求生成时，把此 ID 与完整目标 prompt 交给 qwen_generate_image；不要把 URL、文件路径或附件哈希当图库 ID。" }) };
    },
  }));
  ctx.tools.register(defineTool({
    name: "qwen_image_import_many",
    description: "Import 1–20 existing host image files in one call into the managed source/control/mask library, without starting inference or SSH. Each path must be absolute or ~/; identical normalized bytes with the same kind reuse one resource id (deduped=true) instead of creating duplicates. Returns one item per path with real ids, dimensions and the parameter name; per-path failures never stop the rest. Use qwen_image_import for URLs or conversation attachments.",
    timeoutMs: 180000,
    parameters: {
      paths: { type: "array", required: true, items: { type: "string" }, description: "1–20 existing absolute or ~/ image paths on the DSH host. Not Windows/server paths." },
      kind: { type: "string", description: "source (default), control or mask; same kind is required for dedupe." },
      name_prefix: { type: "string", description: "Optional name prefix; each item gets prefix-1, prefix-2, …" },
    }, output,
    async execute({ paths, kind = "source", name_prefix: prefix }, exec) {
      if (!Array.isArray(paths) || !paths.length || paths.length > 20) throw Error("paths 需要 1–20 个本机图片路径");
      const config = resolveConfig(worker.transportConfig());
      const run = worker.withActivity ? worker.withActivity.bind(worker) : async (fn: () => Promise<any>) => fn();
      const items: any[] = [], failed: any[] = [];
      for (const [index, path] of paths.entries()) {
        exec.signal.throwIfAborted();
        try {
          const asset = await run(() => importImage({ path, kind, ...(prefix ? { name: `${prefix}-${index + 1}` } : {}) }, {
            directory: config.localMfluxDirectory, python: config.pythonPath, signal: exec.signal,
            readAttachment: async () => { throw Error("批量本机导入不读取对话附件"); },
          }));
          const parameter = asset.kind === "control" ? "controlnet_image_id" : asset.kind === "mask" ? "mask_image_id" : "source_image_id";
          items.push({ ...asset, parameter, settings: { [parameter]: asset.id } });
        } catch (error) {
          if (exec.signal.aborted) throw error;
          failed.push({ index, path, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return { result: JSON.stringify({ items, failed, imported: items.length,
        note: "已导入资源库，尚未生图。deduped=true 表示同内容同用途已存在，直接复用该 ID。" }) };
    },
  }));
  ctx.tools.register(defineTool({
    name: "qwen_image_resources",
    description: "List existing Qwen Image LoRAs and image inputs for advanced settings or presets. Read-only, no model startup, no generated image. Returns reference_edit.supported for the current local/remote backend; local probing checks MFLUX and vision checkpoint files without loading weights. Returns real resource ids/LoRA paths, names and sources; never invent them or search with shell. Image inputs can be used as source/control/mask according to their actual contents. Query by name; private image pixels and prompts are not returned.",
    parameters: {
      kind: { type: "string", description: "all (default), lora, or image. image includes imported source/control/mask and gallery images." },
      query: { type: "string", description: "Optional filename substring; use it to narrow a long list." },
      limit: { type: "integer", description: "1–100, default 50." },
    }, output,
    async execute({ kind = "all", query = "", limit = 50 }) {
      if (!["all", "lora", "image"].includes(kind) || !Number.isInteger(limit) || limit < 1 || limit > 100) throw Error("无效的资源筛选条件");
      const catalog = await listResources(resolveConfig(worker.transportConfig()));
      const items = catalog.items.filter(r => (kind === "all" || (kind === "lora" ? r.kind === "lora" : r.kind !== "lora")) && r.name.toLowerCase().includes(query.toLowerCase()));
      return { result: JSON.stringify({ items: items.slice(0, limit), total: items.length, truncated: items.length > limit, warnings: catalog.warnings, mode: worker.mode(), reference_edit: await worker.referenceEditing(), remote_capabilities: worker.mode() === "remote" ? await worker.capabilities() : null }) };
    },
  }));
  const { prompt: _, ...settings } = generationParameters;
  ctx.tools.register(defineTool({
    name: "qwen_image_presets",
    description: "Manage complete Qwen Image creation presets shared with the advanced-settings panel. List/load/export are read-only and do not generate. Save from a completed job id, or supply a complete settings combination using generation parameter names. For changes first list and pass its revision. Names/ids must come from actual results. load returns settings to merge with the user's prompt in qwen_generate_image; it does not change panel draft or start inference. Missing resources are reported and must be resolved before generating. Do not put prompts, connection paths or API keys in presets. delete affects only a preset, never images or weight files.",
    timeoutMs: 120000,
    parameters: {
      action: { type: "string", required: true, description: "list, load, save, rename, delete, set_default, clear_default, export, import." },
      id: { type: "string", description: "Existing preset id from list. Omit on save to create a new preset; provide it only for an explicitly requested overwrite." },
      name: { type: "string", description: "Required on save/rename, 1–80 characters." },
      revision: { type: "integer", description: "Required for writes. Use revision from latest list/result; on conflict re-read and check before retrying." },
      from_job_id: { type: "string", description: "save only: exact full id of a completed image; saves its advanced parameters without its prompt. Mutually exclusive with settings." },
      settings: { type: "object", properties: settings, additionalProperties: false, description: "save only: full parameter combination; omitted values use built-in defaults, so load first and merge returned settings when editing an existing preset. No prompt. Mutually exclusive with from_job_id." },
      document_json: { type: "string", description: "import only: portable JSON from export, at most 1MiB. Contains resource fingerprints, not image/model binaries." },
    }, output,
    async execute(args) { return { result: JSON.stringify(await workspacePreset(worker, args)) }; },
  }));
}
