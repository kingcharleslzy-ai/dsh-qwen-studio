import { API, type Snapshot } from "../shared.js";
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(path: string, data?: unknown): Promise<T> {
  const r = await fetch(
    `${API}/${path}`,
    data === undefined
      ? { cache: "no-store", signal: AbortSignal.timeout(5000) }
      : {
          method: "POST",
          signal: AbortSignal.timeout(["presets", "updates"].includes(path) ? 240000 : 15000),
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        },
  );
  let value: any;
  try { value = await r.json(); }
  catch {
    if (!r.ok) throw new APIError(`请求失败 (${r.status})`, r.status);
    throw new APIError("服务返回了无效的 JSON 数据", r.status);
  }
  if (!r.ok)
    throw new APIError(typeof value?.error === "string" ? value.error : `请求失败 (${r.status})`, r.status);
  return value as T;
}
export const imageURL = (id: string) => `${API}/image?id=${id}`;
export async function download(id: string) {
  const r = await fetch(imageURL(id));
  if (!r.ok) throw Error("无法读取图片");
  const blob = await r.blob(),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `qwen-${id.slice(0, 8)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export let lastSnapshot: Snapshot | undefined;
export function cache(snapshot: Snapshot) {
  lastSnapshot = snapshot;
}

/** Unchanged gallery responses contain only health/capabilities and a revision. */
export async function pollSnapshot(previous?: Snapshot): Promise<Snapshot> {
  const data = await request<Omit<Snapshot, "jobs"> & { jobs?: Snapshot["jobs"]; jobChanges?: Snapshot["jobs"]; removedJobIds?: string[] }>(`state${previous?.jobsRevision ? "?revision=" + encodeURIComponent(previous.jobsRevision) : ""}`);
  if (!data.jobs && !previous) throw Error("图库快照缺少初始记录");
  if (data.jobs) return { ...data, jobs: data.jobs };
  if(!data.jobChanges) return { ...data, jobs: previous!.jobs };
  const jobs = new Map(previous!.jobs.map(j => [j.id,j]));
  for(const id of data.removedJobIds ?? []) jobs.delete(id);
  for(const job of data.jobChanges) jobs.set(job.id,job);
  return { ...data, jobs: [...jobs.values()].sort((a,b)=>b.started_at-a.started_at) };
}
