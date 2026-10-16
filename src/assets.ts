import {
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
  link,
  lstat,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { IncomingMessage } from "node:http";
export type AssetKind = "source" | "control" | "mask" | "lora";
export interface InputAsset {
  id: string;
  name: string;
  kind: AssetKind;
  bytes: number;
  width?: number;
  height?: number;
  path?: string;
}
const exec = promisify(execFile);
const imageId = (id: string) => /^[a-f0-9]{32}$/.test(id);
export async function inputImagePath(dir: string, id: string) {
  if (!imageId(id)) throw Error("图片ID无效");
  const root = await realpath(dir),
    folder = join(root, "assets", "images", id);
  const path = join(folder, "image.png");
  try {
    if ((await realpath(path)) !== path) throw Error("输入图片路径无效");
    const meta = JSON.parse(await readFile(join(folder, "asset.json"), "utf8"));
    if (meta.id !== id || !["source", "control", "mask"].includes(meta.kind))
      throw Error("输入图片记录无效");
    return path;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
async function managedDirectory(root: string, ...parts: string[]) {
  const base = join(root, "assets");
  await mkdir(base, { recursive: true, mode: 0o700 });
  if ((await realpath(base)) !== base) throw Error("资源目录不可使用符号链接");
  const path = join(base, ...parts);
  await mkdir(path, { recursive: true, mode: 0o700 });
  if ((await realpath(path)) !== path) throw Error("资源目录不可使用符号链接");
  return path;
}
export async function validateLora(path: string, bytes: number) {
  const file = await open(path, "r");
  try {
    const size = Buffer.alloc(8);
    if ((await file.read(size, 0, 8, 0)).bytesRead !== 8)
      throw Error("LoRA 文件不完整");
    const length = Number(size.readBigUInt64LE());
    if (
      !Number.isSafeInteger(length) ||
      length < 2 ||
      length > 16 * 1024 * 1024 ||
      8 + length >= bytes
    )
      throw Error("不是有效的 safetensors 文件");
    const header = Buffer.alloc(length);
    if ((await file.read(header, 0, length, 8)).bytesRead !== length)
      throw Error("LoRA 文件头不完整");
    const data = JSON.parse(header.toString("utf8"));
    const entries = Object.entries(data).filter(
      ([key]) => key !== "__metadata__",
    );
    if (
      !entries.length ||
      !entries.some(([key]) =>
        /(?:lora_[AB]|lora_up|lora_down|lokr_w[12])(?:\.|$)/.test(key),
      )
    )
      throw Error("请选择 LoRA 权重，而不是底模或 ControlNet 模型权重");
    for (const [, value] of entries) {
      const tensor = value as {
        shape?: unknown[];
        data_offsets?: number[];
        dtype?: string;
      };
      if (
        !Array.isArray(tensor.shape) ||
        tensor.shape.some((n) => !Number.isSafeInteger(n) || Number(n) < 0) ||
        !Array.isArray(tensor.data_offsets) ||
        tensor.data_offsets.length !== 2 ||
        tensor.data_offsets.some((n) => !Number.isSafeInteger(n) || n < 0) ||
        tensor.data_offsets[0]! > tensor.data_offsets[1]! ||
        tensor.data_offsets[1]! > bytes - length - 8 ||
        typeof tensor.dtype !== "string"
      )
        throw Error("LoRA 张量记录无效或文件不完整");
    }
  } finally {
    await file.close();
  }
}
/** Own selected bytes. Never trust a client-provided local filesystem path. */
export async function importAsset(
  dir: string,
  python: string,
  kind: string,
  name: string,
  input: AsyncIterable<Uint8Array>,
): Promise<InputAsset> {
  if (!["source", "control", "mask", "lora"].includes(kind))
    throw Error("资源类型无效");
  if (kind === "lora" && !name.toLowerCase().endsWith(".safetensors"))
    throw Error("请选择 .safetensors 文件");
  name = name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 180) || "图片";
  await mkdir(dir, { recursive: true });
  dir = await realpath(dir);
  const temp = join(await managedDirectory(dir, ".incoming"), randomUUID());
  await mkdir(temp, { mode: 0o700 });
  const source = join(temp, "upload"),
    hash = createHash("sha256");
  let bytes = 0;
  try {
    const file = await open(source, "wx", 0o600);
    try {
      for await (const chunk of input) {
        bytes += chunk.byteLength;
        if (bytes > (kind === "lora" ? 2 * 1024 ** 3 : 64 * 1024 ** 2))
          throw Error(
            kind === "lora" ? "LoRA 文件不能超过2GB" : "图片不能超过64MB",
          );
        hash.update(chunk);
        await file.writeFile(chunk);
      }
      if (!bytes) throw Error("没有收到文件内容");
      await file.sync();
    } finally {
      await file.close();
    }
    if (kind === "lora") {
      await validateLora(source, bytes);
      const id = hash.digest("hex"),
        folder = await managedDirectory(dir, "loras"),
        path = join(folder, id + ".safetensors");
      try {
        await link(source, path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (!(await lstat(path)).isFile()) throw Error("LoRA 资源路径无效");
      }
      const asset: InputAsset = { id, kind: "lora", name, bytes, path };
      await writeFile(join(folder, id + ".json"), JSON.stringify(asset), {
        mode: 0o600,
      });
      return asset;
    }
    const output = join(temp, "image.png");
    const script = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../backend/normalize_image.py",
    );
    let dimensions: { width: number; height: number };
    try {
      const result = await exec(python, [script, source, output, kind], {
        timeout: 30000,
        maxBuffer: 65536,
      });
      dimensions = JSON.parse(result.stdout);
    } catch (error) {
      throw Error(
        (error as { stderr?: string }).stderr?.trim().split("\n")[0] ||
          "图片导入失败，请确认 Python 环境已安装 Pillow",
      );
    }
    await rm(source);
    const id = randomUUID().replaceAll("-", ""),
      asset: InputAsset = {
        id,
        name,
        kind: kind as AssetKind,
        bytes,
        ...dimensions,
      };
    await writeFile(join(temp, "asset.json"), JSON.stringify(asset), {
      mode: 0o600,
    });
    await rename(temp, join(await managedDirectory(dir, "images"), id));
    return asset;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
export async function receiveAsset(
  req: IncomingMessage,
  dir: string,
  python: string,
) {
  const url = new URL(req.url ?? "", "http://localhost");
  return importAsset(
    dir,
    python,
    url.searchParams.get("kind") ?? "",
    url.searchParams.get("name") ?? "",
    req,
  );
}
