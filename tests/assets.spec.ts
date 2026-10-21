import { test, expect } from "vitest";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  mkdir,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importAsset, inputImagePath } from "../src/assets.js";
import { imagePath, readJobs } from "../src/storage.js";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
async function* chunks(data: Buffer) {
  for (let i = 0; i < data.length; i += 7) yield data.subarray(i, i + 7);
}
function lora() {
  const header = Buffer.from(
    JSON.stringify({
      "transformer.transformer_blocks.0.attn.to_q.lora_A.weight": {
        dtype: "F32",
        shape: [1, 1],
        data_offsets: [0, 4],
      },
    }),
  );
  const length = Buffer.alloc(8);
  length.writeBigUInt64LE(BigInt(header.length));
  return Buffer.concat([length, header, Buffer.alloc(4)]);
}
test("selected images normalize without becoming gallery results and reject malformed uploads", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qwen-inputs-"));
  try {
    const asset = await importAsset(
      dir,
      process.env.QWEN_TEST_PYTHON || "python3",
      "control",
      "edge.png",
      chunks(png),
    );
    expect(asset).toMatchObject({
      name: "edge.png",
      kind: "control",
      width: 1,
      height: 1,
    });
    expect(await readJobs(dir)).toEqual([]);
    expect(await readFile(await imagePath(dir, asset.id))).toMatchObject({
      length: expect.any(Number),
    });
    const again = await importAsset(dir, process.env.QWEN_TEST_PYTHON || "python3", "control", "edge-copy.png", chunks(png));
    expect(again).toMatchObject({ id: asset.id, deduped: true });
    const asSource = await importAsset(dir, process.env.QWEN_TEST_PYTHON || "python3", "source", "edge-source.png", chunks(png));
    expect(asSource.id).not.toBe(asset.id);
    expect(await inputImagePath(dir, asset.id)).toBeTruthy();
    await expect(
      importAsset(
        dir,
        "python3",
        "mask",
        "broken.png",
        chunks(Buffer.from("not an image")),
      ),
    ).rejects.toThrow();
    expect(await readdir(join(dir, "assets/.incoming"))).toEqual([]);
    await expect(inputImagePath(dir, "../secret")).rejects.toThrow("ID");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("LoRA uploads stream, deduplicate content, preserve selected names and cannot read arbitrary local paths", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qwen-lora-assets-"));
  try {
    const a = await importAsset(
      dir,
      "not-used",
      "lora",
      "style.safetensors",
      chunks(lora()),
    );
    const b = await importAsset(
      dir,
      "not-used",
      "lora",
      "copy.safetensors",
      chunks(lora()),
    );
    expect(a.path).toBe(b.path);
    expect(b.name).toBe("copy.safetensors");
    expect(await readFile(a.path!)).toEqual(lora());
    expect(await readJobs(dir)).toEqual([]);
    await expect(
      importAsset(
        dir,
        "",
        "lora",
        "model.safetensors",
        chunks(Buffer.from("bad")),
      ),
    ).rejects.toThrow();
    await expect(
      importAsset(dir, "", "lora", "script.py", chunks(lora())),
    ).rejects.toThrow("safetensors");
    await expect(
      importAsset(dir, "", "unknown", "file", chunks(png)),
    ).rejects.toThrow("类型");
    expect(await readdir(join(dir, "assets/.incoming"))).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("aborted streams and symlinked resource directories do not leave accepted assets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qwen-abort-")),
    outside = await mkdtemp(join(tmpdir(), "qwen-outside-"));
  try {
    async function* aborted() {
      yield Buffer.from("part");
      throw Error("disconnected");
    }
    await expect(
      importAsset(dir, "", "lora", "style.safetensors", aborted()),
    ).rejects.toThrow("disconnected");
    expect(await readdir(join(dir, "assets/.incoming"))).toEqual([]);
    await rm(join(dir, "assets"), { recursive: true });
    await symlink(outside, join(dir, "assets"));
    await expect(
      importAsset(dir, "", "lora", "style.safetensors", chunks(lora())),
    ).rejects.toThrow("符号链接");
    expect(await readdir(outside)).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
