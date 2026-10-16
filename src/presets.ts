import { readFile, mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { atomicJSON } from "./storage.js";
import { draftDefaults, type CreationDraft } from "./client/creation-draft.js";
import {
  listResources,
  resourceFingerprint,
  type Resource,
} from "./resources.js";
import type { EffectiveConfig } from "./resolved-config.js";
type Values = Omit<CreationDraft, "prompt" | "missingResources">;
export interface ResourceRef {
  id?: string;
  kind: Resource["kind"];
  name: string;
  bytes: number;
  fingerprint: string;
}
export interface Preset {
  id: string;
  name: string;
  values: Values;
  resources: Record<string, ResourceRef>;
}
export interface PresetStore {
  schemaVersion: 1;
  revision: number;
  defaultId: string | null;
  items: Preset[];
}
const imageKeys = ["sourceId", "controlId", "maskId", "maskSourceId"] as const;
const cleanName = (name: unknown) => {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80)
    throw Error("预设名称需为1–80个字符");
  return name.trim();
};
const id = () => randomUUID().replaceAll("-", "");
export function presetValues(input: unknown): Values {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("预设参数格式无效");
  const value = input as Record<string, any>,
    allowed = Object.keys(draftDefaults).filter((k) => k !== "prompt");
  if (Object.keys(value).some((k) => !allowed.includes(k)))
    throw Error("预设含有不支持的字段；连接配置、路径设置和密钥不可导入");
  const d: any = { ...draftDefaults, ...value };
  delete d.prompt;
  for (const key of [
    "size",
    "seed",
    "sourceId",
    "sourceName",
    "controlId",
    "controlName",
    "maskId",
    "maskName",
    "maskSourceId",
    "maskSourceName",
    "negativePrompt",
  ])
    if (typeof d[key] !== "string") throw Error("预设文本字段无效");
  for (const key of imageKeys)
    if (d[key] && !/^[a-f0-9]{32}$/.test(d[key]))
      throw Error("图片资源 ID 无效");
  if (
    !/^\d+x\d+$/.test(d.size) ||
    d.size
      .split("x")
      .some(
        (n: string) =>
          !Number.isInteger(+n) || +n < 512 || +n > 2048 || +n % 16,
      )
  )
    throw Error("预设尺寸无效");
  if (
    !Number.isInteger(d.steps) ||
    d.steps < 1 ||
    d.steps > 60 ||
    (d.seed !== "" && (!/^\d+$/.test(d.seed) || +d.seed >= 2 ** 32))
  )
    throw Error("预设步数或种子无效");
  for (const [key, min, max] of [
    ["changeStrength", 0.05, 0.95],
    ["controlStrength", 0, 1],
    ["guidance", 1, 10],
  ] as const)
    if (!Number.isFinite(d[key]) || d[key] < min || d[key] > max)
      throw Error("预设参数范围无效：" + key);
  for (const key of ["controlEnabled", "maskEnabled"])
    if (typeof d[key] !== "boolean") throw Error("预设开关无效");
  if (
    d.negativePrompt.length > 8000 ||
    !["linear", "flow_match_euler_discrete", "seedvr2_euler"].includes(
      d.scheduler,
    )
  )
    throw Error("负向提示词或调度器无效");
  if (!Array.isArray(d.loras) || d.loras.length > 8)
    throw Error("预设最多8个 LoRA");
  d.loras = d.loras.map((l: any) => {
    if (
      !l ||
      typeof l.path !== "string" ||
      typeof l.name !== "string" ||
      l.name.length > 180 ||
      !Number.isFinite(l.scale) ||
      l.scale < 0 ||
      l.scale > 2 ||
      (l.enabled !== undefined && typeof l.enabled !== "boolean")
    )
      throw Error("预设 LoRA 无效");
    return {
      path: l.path,
      name: l.name,
      scale: l.scale,
      enabled: l.enabled !== false,
    };
  });
  return d;
}
async function reference(
  config: EffectiveConfig,
  r: Resource,
): Promise<ResourceRef> {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    bytes: r.bytes,
    fingerprint: await resourceFingerprint(config, r),
  };
}
export async function capturePreset(
  config: EffectiveConfig,
  name: unknown,
  input: unknown,
): Promise<Preset> {
  const values = presetValues(input),
    { items } = await listResources(config),
    resources: Record<string, ResourceRef> = {};
  for (const key of imageKeys)
    if (values[key]) {
      const r = items.find((r) => r.kind !== "lora" && r.id === values[key]);
      if (!r) throw Error("图片资源已失效，请重新选择：" + key);
      resources[key] = await reference(config, r);
    }
  for (const [i, l] of values.loras.entries()) {
    const canonical = await realpath(l.path).catch(() => null),
      r = items.find((r) => r.kind === "lora" && r.path === canonical);
    if (!r) throw Error("LoRA 不在可用资源库：" + l.name);
    resources["lora:" + i] = await reference(config, r);
  }
  return { id: id(), name: cleanName(name), values, resources };
}
export async function loadPreset(config: EffectiveConfig, preset: Preset) {
  const draft: CreationDraft = {
      ...draftDefaults,
      ...preset.values,
      prompt: "",
      loras: preset.values.loras.map((l) => ({ ...l })),
    },
    issues: string[] = [],
    missingResources: Record<string, string> = {};
  const { items } = await listResources(config);
  for (const [key, ref] of Object.entries(preset.resources)) {
    let found: Resource | undefined;
    const candidates = items.filter(
      (r) =>
        (ref.kind === "lora") === (r.kind === "lora") && r.bytes === ref.bytes,
    );
    candidates.sort(
      (a, b) => Number(b.id === ref.id) - Number(a.id === ref.id),
    );
    for (const r of candidates)
      if ((await resourceFingerprint(config, r)) === ref.fingerprint) {
        found = r;
        break;
      }
    const match = /^lora:(\d)$/.exec(key);
    if (match) {
      const l = draft.loras[+match[1]!];
      if (!l) throw Error("预设 LoRA 引用无效");
      l.path = found?.path || "";
      l.name = found?.name || ref.name;
      l.missing = !found;
    } else if (imageKeys.includes(key as any)) {
      (draft as any)[key] = found?.id || "";
      if (!found) missingResources[key] = ref.name;
    } else throw Error("预设资源引用无效");
    if (!found) issues.push("缺失或已变化：" + ref.name);
  }
  draft.missingResources = missingResources;
  return { draft, issues };
}
function validatePreset(p: any): Preset {
  if (
    !p ||
    typeof p !== "object" ||
    !p.resources ||
    typeof p.resources !== "object" ||
    Array.isArray(p.resources)
  )
    throw Error("预设记录无效");
  const values = presetValues(p.values),
    resources: Record<string, ResourceRef> = {};
  for (const [key, value] of Object.entries(p.resources)) {
    const r = value as ResourceRef;
    if (
      (!imageKeys.includes(key as any) && !/^lora:[0-7]$/.test(key)) ||
      !r ||
      typeof r.name !== "string" ||
      r.name.length > 180 ||
      !["lora", "source", "control", "mask", "image"].includes(r.kind) ||
      !Number.isSafeInteger(r.bytes) ||
      r.bytes < 0 ||
      !/^[a-f0-9]{64}$/.test(r.fingerprint) ||
      /^lora:/.test(key) !== (r.kind === "lora")
    )
      throw Error("预设资源清单无效");
    resources[key] = {
      kind: r.kind,
      name: r.name,
      bytes: r.bytes,
      fingerprint: r.fingerprint,
      ...(typeof r.id === "string" && /^(?:lora-)?[a-f0-9]{32,64}$/.test(r.id)
        ? { id: r.id }
        : {}),
    };
  }
  for (const [i] of values.loras.entries())
    if (!resources["lora:" + i]) throw Error("LoRA 缺少资源清单");
  for (const key of imageKeys)
    if (values[key] && !resources[key]) throw Error("图片缺少资源清单");
  return {
    id: typeof p.id === "string" && /^[a-f0-9]{32}$/.test(p.id) ? p.id : id(),
    name: cleanName(p.name),
    values,
    resources,
  };
}
export function exportPresets(store: PresetStore, selectedId?: string) {
  const items = (
    selectedId ? store.items.filter((p) => p.id === selectedId) : store.items
  ).map((p) => {
    const values = structuredClone(p.values);
    values.loras.forEach((l) => (l.path = ""));
    imageKeys.forEach((key) => (values[key] = ""));
    return {
      ...p,
      values,
      resources: Object.fromEntries(
        Object.entries(p.resources).map(([key, r]) => {
          const { id: _, ...portable } = r;
          return [key, portable];
        }),
      ),
    };
  });
  return { format: "qwen-studio-presets", schemaVersion: 1, items };
}
export async function readPresets(dir: string): Promise<PresetStore> {
  try {
    const data = JSON.parse(
      await readFile(join(dir, "state/presets.json"), "utf8"),
    );
    if (
      data.schemaVersion !== 1 ||
      !Array.isArray(data.items) ||
      !Number.isSafeInteger(data.revision)
    )
      throw Error("预设文件格式无效");
    return { ...data, items: data.items.map(validatePreset) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { schemaVersion: 1, revision: 0, defaultId: null, items: [] };
    throw error;
  }
}
const locks = new Map<string, Promise<unknown>>();
export function mutatePresets(
  config: EffectiveConfig,
  data: Record<string, any>,
): Promise<PresetStore> {
  const dir = config.localMfluxDirectory,
    previous = locks.get(dir) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      const store = await readPresets(dir);
      if (data.revision !== store.revision)
        throw Error("预设已在其他页面更新，请刷新后重试");
      const item = store.items.find((p) => p.id === data.id);
      if (data.action === "save") {
        const created = await capturePreset(config, data.name, data.values);
        if (data.id && !item) throw Error("预设不存在");
        if (item) {
          created.id = item.id;
          store.items[store.items.indexOf(item)] = created;
        } else store.items.push(created);
      } else if (data.action === "rename") {
        if (!item) throw Error("预设不存在");
        item.name = cleanName(data.name);
      } else if (data.action === "delete") {
        if (!item) throw Error("预设不存在");
        store.items = store.items.filter((p) => p !== item);
        if (store.defaultId === item.id) store.defaultId = null;
      } else if (data.action === "default") {
        if (data.id !== null && !item) throw Error("预设不存在");
        store.defaultId = data.id;
      } else if (data.action === "restore") {
        const backup = JSON.parse(
          await readFile(join(dir, "state/presets.backup.json"), "utf8"),
        );
        if (backup.schemaVersion !== 1 || !Array.isArray(backup.items))
          throw Error("没有可恢复的预设");
        store.items = backup.items.map(validatePreset);
        store.defaultId = backup.defaultId;
      } else if (data.action === "import") {
        const document = data.document;
        if (
          document?.format !== "qwen-studio-presets" ||
          document.schemaVersion !== 1 ||
          !Array.isArray(document.items) ||
          document.items.length > 100
        )
          throw Error("不支持的预设文件");
        const incoming = document.items.map(validatePreset);
        for (const p of incoming) {
          p.id = id();
          store.items.push(p);
        }
      } else throw Error("预设操作无效");
      if (store.items.length > 100) throw Error("最多保存100个预设");
      const state = join(dir, "state");
      await mkdir(state, { recursive: true });
      if ((await realpath(state)) !== join(await realpath(dir), "state"))
        throw Error("预设目录不可使用符号链接");
      if (store.revision)
        await atomicJSON(
          join(state, "presets.backup.json"),
          await readPresets(dir),
        );
      store.revision++;
      await atomicJSON(join(state, "presets.json"), store);
      return store;
    });
  locks.set(dir, next);
  void next
    .finally(() => {
      if (locks.get(dir) === next) locks.delete(dir);
    })
    .catch(() => {});
  return next;
}
