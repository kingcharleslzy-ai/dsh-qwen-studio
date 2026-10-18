import {
  readFile,
  readdir,
  writeFile,
  rename,
  mkdir,
  rm,
  realpath,
  stat,
} from "node:fs/promises";
import { join } from "node:path";
import { watch, type FSWatcher } from "node:fs";
import { randomUUID } from "node:crypto";
import { inputImagePath } from "./assets.js";
import { active, type Job } from "./shared.js";
export const validId = (id: string) => /^[a-f0-9]{32}$/.test(id);
export async function atomicJSON(path: string, value: unknown) {
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temp, path);
}
type Flags = Record<string, { favorite?: boolean; archived?: boolean }>;
function parseFlags(text: string): Flags {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("收藏记录格式错误");
  for (const [id, mark] of Object.entries(value)) {
    if (!validId(id) || !mark || typeof mark !== "object" || Array.isArray(mark) ||
      Object.entries(mark).some(([k,v]) => !["favorite", "archived"].includes(k) || typeof v !== "boolean"))
      throw Error("收藏记录格式错误");
  }
  return value as Flags;
}
async function flags(dir: string): Promise<Flags> {
  try { return parseFlags(await readFile(join(dir, "state/gallery.json"), "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // A missing primary with a backup is data loss, not a new empty library.
      try { await accessBackup(dir); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return {}; throw e; }
    }
    throw Error("收藏记录无法读取，已停止写入以保护收藏。请在插件设置中恢复收藏备份；原文件保留。", { cause: error });
  }
}
async function accessBackup(dir: string) { await stat(join(dir, "state/gallery.json.bak")); }
export function restoreGalleryFlags(dir: string) {
  const result = mutation.then(async () => {
    const backup = parseFlags(await readFile(join(dir, "state/gallery.json.bak"), "utf8"));
    try {
      const original = await readFile(join(dir, "state/gallery.json"));
      await writeFile(join(dir, `state/gallery.damaged-${Date.now()}-${randomUUID()}.json`), original, { mode: 0o600 });
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    await atomicJSON(join(dir, "state/gallery.json"), backup);
    invalidateGallery(dir);
    return { ok: true };
  });
  mutation = result.catch(() => {}); return result;
}
function jobRecord(
  raw: Record<string, any>,
  id: string,
  marks: Flags,
  folder: string,
): Job {
  return {
    id,
    worker_pid: raw.worker_pid,
    prompt: raw.prompt,
    status: raw.status,
    width: raw.width,
    height: raw.height,
    steps: raw.steps,
    sampling_steps: raw.sampling_steps,
    progress_supported: raw.progress_supported,
    phase: raw.phase,
    negative_prompt: raw.negative_prompt,
    guidance: raw.guidance,
    scheduler: raw.scheduler,
    guidance_auto_raised: raw.guidance_auto_raised,
    source_image_id: raw.source_image_id,
    reference_mode: raw.reference_mode,
    controlnet_image_id: raw.controlnet_image_id,
    controlnet_strength: raw.controlnet_strength,
    mask_image_id: raw.mask_image_id,
    lora_paths: raw.lora_paths,
    lora_scales: raw.lora_scales,
    lora_names: raw.lora_names,
    change_strength: raw.change_strength,
    seed: raw.seed,
    started_at: raw.started_at,
    step: raw.step,
    elapsed_seconds: raw.elapsed_seconds,
    error: raw.error,
    source: raw.source ?? "local",
    ...marks[id],
    deleted: folder === "trash",
  };
}
async function recordAt(dir: string, folder: string, id: string, marks: Flags) {
  const path = join(dir, folder, id, "job.json");
  try {
    if ((await realpath(path)) !== path) throw Error("任务路径无效");
    return jobRecord(
      JSON.parse(await readFile(path, "utf8")),
      id,
      marks,
      folder,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
/** Read only the accepted task; unrelated gallery records cannot delay or break progress. */
export async function readJob(
  dir: string,
  id: string,
): Promise<Job | undefined> {
  if (!validId(id)) throw Error("图片ID无效");
  try {
    dir = await realpath(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  const marks = await flags(dir);
  return (
    (await recordAt(dir, "images", id, marks)) ??
    (await recordAt(dir, "trash", id, marks))
  );
}
/** Incremental gallery index. Terminal records are read once, then only on change.
 * Recursive watches catch external worker writes; periodic reconciliation covers
 * dropped/unsupported watch events. Active tasks are always read afresh. */
export class GalleryIndex {
  private jobs = new Map<string, Job>();
  private dirty = new Set<string>();
  private watchers: FSWatcher[] = [];
  private rescan = true;
  private refreshed = 0;
  private foldersKey = "";
  private serial: Promise<unknown> = Promise.resolve();
  readonly metrics = { recordReads: 0, scans: 0 };
  constructor(readonly dir: string) {
    for (const folder of ["images", "trash"]) {
      try {
        const watcher = watch(join(dir, folder), { recursive: true, persistent: false }, (_event, filename) => {
          const id = String(filename ?? "").split(/[\\/]/)[0] ?? "";
          if (validId(id)) this.dirty.add(id); else this.rescan = true;
        });
        watcher.on("error", () => { this.rescan = true; });
        this.watchers.push(watcher);
      } catch { /* The reconciliation path also works without recursive watches. */ }
    }
  }
  invalidate() { this.rescan = true; }
  close() { this.watchers.forEach(w => w.close()); this.watchers = []; }
  read(): Promise<Job[]> {
    const next = this.serial.then(async () => {
      const marks = await flags(this.dir);
      // Directory mtimes catch membership changes even before a watch event.
      const stamps = await Promise.all(["images", "trash"].map(async folder => {
        try { const s = await stat(join(this.dir, folder)); return `${s.mtimeMs}:${s.ctimeMs}`; }
        catch(e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return "missing"; throw e; }
      }));
      const key = stamps.join("|");
      if (key !== this.foldersKey) this.rescan = true;
      if (this.rescan || Date.now() - this.refreshed > 30000) {
        const present = new Set<string>(); this.metrics.scans++;
        for (const folder of ["images", "trash"]) {
          let entries: string[];
          try { entries = await readdir(join(this.dir, folder)); }
          catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") entries = []; else throw e; }
          for (const id of entries.filter(validId)) { present.add(id); this.dirty.add(id); }
        }
        for (const id of this.jobs.keys()) if (!present.has(id)) this.jobs.delete(id);
        this.rescan = false; this.refreshed = Date.now(); this.foldersKey = key;
      }
      for (const job of this.jobs.values()) if (active(job)) this.dirty.add(job.id);
      const pending = [...this.dirty]; this.dirty.clear();
      for (const id of pending) {
        this.metrics.recordReads++;
        try {
          const job = await recordAt(this.dir, "images", id, {}) ?? await recordAt(this.dir, "trash", id, {});
          if (job) this.jobs.set(id, job); else this.jobs.delete(id);
        } catch { this.jobs.delete(id); /* One damaged job never hides other jobs. */ }
      }
      return [...this.jobs.values()].map(j => ({ ...j, ...marks[j.id] })).sort((a,b) => b.started_at-a.started_at);
    });
    this.serial = next.catch(() => {}); return next;
  }
}
const indexes = new Map<string, GalleryIndex>();
export function invalidateGallery(dir: string) { indexes.get(dir)?.invalidate(); }
export function closeGalleryIndexes() { for (const index of indexes.values()) index.close(); indexes.clear(); }
export async function readJobs(dir: string): Promise<Job[]> {
  try { dir = await realpath(dir); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; }
  let index = indexes.get(dir);
  if (!index) {
    if (indexes.size >= 8) { const oldest = indexes.keys().next().value!; indexes.get(oldest)?.close(); indexes.delete(oldest); }
    indexes.set(dir, index = new GalleryIndex(dir));
  }
  return index.read();
}
let mutation: Promise<unknown> = Promise.resolve();
export type GalleryAction =
  | "favorite"
  | "archived"
  | "delete"
  | "restore"
  | "purge";
export function batchAction(
  dir: string,
  ids: string[],
  action: GalleryAction,
  value?: boolean,
): Promise<unknown> {
  const result = mutation.then(async () => {
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 1000 ||
      ids.some((id) => !validId(id))
    )
      throw Error("请选择1–1000张图片");
    dir = await realpath(dir);
    const marks = await flags(dir);
    const selected = await Promise.all([...new Set(ids)].map(async id => {
      const job = await recordAt(dir,"images",id,{}) ?? await recordAt(dir,"trash",id,{});
      if(!job) throw Error("图片不存在");
      return job;
    }));
    if (selected.some(active) && action !== "favorite")
      throw Error("请先取消生成中的任务");
    if (["favorite", "archived"].includes(action) && typeof value !== "boolean")
      throw Error("操作参数无效");
    if (action === "purge" && selected.some((j) => !j.deleted))
      throw Error("只能清空回收站中的图片");
    if (
      !["favorite", "archived", "delete", "restore", "purge"].includes(action)
    )
      throw Error("操作无效");
    const before = structuredClone(marks);
    await mkdir(join(dir, "state"), { recursive: true });
    const completed: string[] = [];
    for (const job of selected) {
      if (action === "favorite" || action === "archived")
        marks[job.id] = { ...marks[job.id], [action]: value };
      else {
        const from = join(dir, job.deleted ? "trash" : "images", job.id);
        if ((await realpath(from)) !== from) throw Error("图片路径无效");
        if (action === "purge") {
          await rm(from, { recursive: true });
          delete marks[job.id];
        } else if (
          (action === "delete" && !job.deleted) ||
          (action === "restore" && job.deleted)
        ) {
          const to = join(dir, action === "delete" ? "trash" : "images");
          await mkdir(to, { recursive: true });
          await rename(from, join(to, job.id));
        }
      }
      completed.push(job.id);
    }
    await atomicJSON(join(dir, "state/gallery.json.bak"), before);
    await atomicJSON(join(dir, "state/gallery.json"), marks);
    invalidateGallery(dir);
    return { ok: true, ids: completed };
  });
  mutation = result.catch(() => {});
  return result;
}
export function setFlag(
  dir: string,
  id: string,
  field: "favorite" | "archived",
  value: boolean,
) {
  return batchAction(dir, [id], field, value);
}
export async function imagePath(dir: string, id: string) {
  if (!validId(id)) throw Error("图片ID无效");
  const job = await readJob(dir, id);
  if (!job) {
    const input = await inputImagePath(dir, id);
    if (input) return input;
    throw Error("图片不存在");
  }
  const parent = await realpath(join(dir, job.deleted ? "trash" : "images"));
  const path = await realpath(join(parent, id, "image.png"));
  if (path !== join(parent, id, "image.png")) throw Error("图片路径无效");
  return path;
}
