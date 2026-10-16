import { readdir, readFile, realpath, stat, open } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { join, basename, extname } from "node:path";
import { loraRoots, type EffectiveConfig } from "./resolved-config.js";
import { readJobs, imagePath } from "./storage.js";
export interface Resource {
  id: string;
  kind: "lora" | "source" | "control" | "mask" | "image";
  name: string;
  bytes: number;
  origin: "imported" | "default" | "custom" | "gallery";
  path?: string;
  fingerprint?: string;
}
export interface ResourceCatalog {
  items: Resource[];
  warnings: string[];
}
async function entries(path: string) {
  try {
    return await readdir(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
// Hash selected preset references as streams; catalog discovery only reads metadata.
const hashes = new Map<string, { stamp: string; hash: string }>();
export async function fingerprint(path: string) {
  path = await realpath(path);
  const info = await stat(path, { bigint: true }),
    stamp = [info.size, info.mtimeNs, info.ctimeNs].join(":");
  const cached = hashes.get(path);
  if (cached?.stamp === stamp) return cached.hash;
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  const after = await stat(path, { bigint: true });
  if ([after.size, after.mtimeNs, after.ctimeNs].join(":") !== stamp)
    throw Error("资源在校验期间发生变化，请重试");
  const result = hash.digest("hex");
  if (hashes.size > 1024) hashes.clear();
  hashes.set(path, { stamp, hash: result });
  return result;
}
export async function listResources(
  config: EffectiveConfig,
): Promise<ResourceCatalog> {
  const items: Resource[] = [],
    warnings: string[] = [],
    seen = new Set<string>(),
    dir = config.localMfluxDirectory;
  const roots = loraRoots(config);
  for (const [index, root] of roots.entries()) {
    try {
      const canonicalRoot = await realpath(root);
      for (const name of await entries(canonicalRoot)) {
        if (extname(name).toLowerCase() !== ".safetensors") continue;
        try {
          const file = await realpath(join(canonicalRoot, name));
          if (!file.startsWith(canonicalRoot + "/") || seen.has(file)) continue;
          const info = await stat(file);
          if (!info.isFile()) continue;
          seen.add(file);
          let title = name;
          if (index === 0)
            try {
              const meta = JSON.parse(
                await readFile(
                  join(canonicalRoot, name.replace(/\.safetensors$/i, ".json")),
                  "utf8",
                ),
              );
              if (typeof meta.name === "string") title = meta.name;
            } catch {}
          items.push({
            id: "lora-" + createHash("sha256").update(file).digest("hex"),
            kind: "lora",
            name: title,
            bytes: info.size,
            path: file,
            origin:
              index === 0
                ? "imported"
                : root === join(dir, "loras")
                  ? "default"
                  : "custom",
          });
        } catch {
          warnings.push("无法读取 LoRA 文件：" + name);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        warnings.push("无法读取 LoRA 目录：" + root);
    }
  }
  const imageRoot = join(dir, "assets/images");
  for (const id of await entries(imageRoot)) {
    if (!/^[a-f0-9]{32}$/.test(id)) continue;
    try {
      const file = await imagePath(dir, id),
        info = await stat(file);
      const meta = JSON.parse(
        await readFile(join(imageRoot, id, "asset.json"), "utf8"),
      );
      if (!["source", "control", "mask"].includes(meta.kind)) continue;
      items.push({
        id,
        kind: meta.kind,
        name: String(meta.name || id),
        bytes: info.size,
        origin: "imported",
      });
    } catch {
      warnings.push("输入资源不可用：" + id.slice(0, 8));
    }
  }
  for (const job of await readJobs(dir)) {
    if (job.status !== "complete" || job.deleted) continue;
    try {
      const info = await stat(await imagePath(dir, job.id));
      items.push({
        id: job.id,
        kind: "image",
        name: "作品 " + job.id.slice(0, 8),
        bytes: info.size,
        origin: "gallery",
      });
    } catch {}
  }
  return { items, warnings };
}
export async function resourceFingerprint(
  config: EffectiveConfig,
  resource: Resource,
) {
  return (
    resource.fingerprint ||
    fingerprint(
      resource.kind === "lora"
        ? resource.path!
        : await imagePath(config.localMfluxDirectory, resource.id),
    )
  );
}
