import {
  readFile,
  readdir,
  writeFile,
  rename,
  mkdir,
  rm,
  realpath,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { active, type Job } from "./shared.js";
export const validId = (id: string) => /^[a-f0-9]{32}$/.test(id);
export async function atomicJSON(path: string, value: unknown) {
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temp, path);
}
type Flags = Record<string, { favorite?: boolean; archived?: boolean }>;
async function flags(dir: string): Promise<Flags> {
  try {
    return JSON.parse(await readFile(join(dir, "state/gallery.json"), "utf8"));
  } catch {
    return {};
  }
}
export async function readJobs(dir: string): Promise<Job[]> {
  const marks = await flags(dir),
    jobs: Job[] = [];
  for (const folder of ["images", "trash"]) {
    const entries = await readdir(join(dir, folder)).catch(() => []);
    for (const id of entries.filter(validId))
      try {
        const raw = JSON.parse(
          await readFile(join(dir, folder, id, "job.json"), "utf8"),
        );
        jobs.push({
          id,
          worker_pid: raw.worker_pid,
          prompt: raw.prompt,
          status: raw.status,
          width: raw.width,
          height: raw.height,
          steps: raw.steps,
          sampling_steps: raw.sampling_steps,
          source_image_id: raw.source_image_id,
          change_strength: raw.change_strength,
          seed: raw.seed,
          started_at: raw.started_at,
          step: raw.step,
          elapsed_seconds: raw.elapsed_seconds,
          error: raw.error,
          source: raw.source ?? "local",
          ...marks[id],
          deleted: folder === "trash",
        });
      } catch {}
  }
  return jobs.sort((a, b) => b.started_at - a.started_at);
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
    const jobs = await readJobs(dir),
      selected = [...new Set(ids)].map((id) => {
        const job = jobs.find((j) => j.id === id);
        if (!job) throw Error("图片不存在");
        return job;
      });
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
    const marks = await flags(dir);
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
    await atomicJSON(join(dir, "state/gallery.json"), marks);
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
  const job = (await readJobs(dir)).find((j) => j.id === id);
  if (!job) throw Error("图片不存在");
  const parent = await realpath(join(dir, job.deleted ? "trash" : "images"));
  const path = await realpath(join(parent, id, "image.png"));
  if (path !== join(parent, id, "image.png")) throw Error("图片路径无效");
  return path;
}
