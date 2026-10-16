import { test, expect } from "vitest";
import { createServer } from "node:http";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RemoteQueue } from "../src/remote.js";
import { readJobs } from "../src/storage.js";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
test("remote Images protocol persists response and deduplicates accepted receipt", async () => {
  let count = 0,
    received: any;
  const server = createServer(async (req, res) => {
    count++;
    let body = "";
    for await (const chunk of req) body += chunk;
    received = JSON.parse(body);
    expect(req.url).toBe("/v1/images/generations");
    expect(req.headers.authorization).toBe("Bearer test-only");
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const dir = await mkdtemp(join(tmpdir(), "qwen-remote-")),
    port = (server.address() as any).port,
    queue = new RemoteQueue(),
    config = {
      remoteBaseURL: `http://127.0.0.1:${port}/v1`,
      remoteApiKey: "test-only",
      remoteModel: "qwen-test",
    },
    data = {
      id: "c".repeat(32),
      prompt: "a cottage",
      width: 512,
      height: 512,
      steps: 4,
      seed: 42,
    };
  try {
    await expect(
      queue.submit(dir, config, {
        ...data,
        source_image_id: "a".repeat(32),
        change_strength: 0.4,
      }),
    ).rejects.toThrow("仅支持文生图");
    for (const params of [
      { negative_prompt: "blur" },
      { guidance: 2.5 },
      { scheduler: "linear" },
    ]) {
      await expect(
        queue.submit(dir, config, { ...data, ...params }),
      ).rejects.toThrow("仅接入本地模式");
    }
    for (const params of [{ lora_paths: ["/model/style.safetensors"] }, { mask_image_id: "a".repeat(32) }, { controlnet_image_id: "a".repeat(32) }])
      await expect(queue.submit(dir, config, { ...data, ...params })).rejects.toThrow("仅支持本地模式");
    expect(count).toBe(0);
    await Promise.all([
      queue.submit(dir, config, data),
      queue.submit(dir, config, data),
    ]);
    await expect
      .poll(async () => (await readJobs(dir))[0]?.status)
      .toBe("complete");
    expect(count).toBe(1);
    expect(received).toMatchObject({
      model: "qwen-test",
      num_inference_steps: 4,
      seed: 42,
      response_format: "b64_json",
    });
    expect(await readFile(join(dir, "images", data.id, "image.png"))).toEqual(
      png,
    );
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
