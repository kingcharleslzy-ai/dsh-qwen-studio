import { test, expect } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  rename,
  copyFile,
  realpath,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig } from "../src/resolved-config.js";
import { listResources } from "../src/resources.js";
import {
  draftDefaults,
  generationPayload,
} from "../src/client/creation-draft.js";
import {
  capturePreset,
  loadPreset,
  readPresets,
  mutatePresets,
  exportPresets,
} from "../src/presets.js";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "qwen-presets-")),
    config = resolveConfig({
      localMfluxDirectory: dir,
      loraDirectory: join(dir, "custom"),
    });
  for (const root of ["assets/loras", "loras", "custom"])
    await mkdir(join(dir, root), { recursive: true });
  await writeFile(
    join(dir, "assets/loras", "a".repeat(64) + ".safetensors"),
    "managed",
  );
  await writeFile(
    join(dir, "assets/loras", "a".repeat(64) + ".json"),
    JSON.stringify({ name: "managed-style.safetensors" }),
  );
  await writeFile(join(dir, "loras/manual.safetensors"), "manual");
  await writeFile(join(dir, "custom/custom.safetensors"), "custom");
  for (const [i, kind] of ["source", "control", "mask"].entries()) {
    const id = String(i + 1).repeat(32),
      folder = join(dir, "assets/images", id);
    await mkdir(folder, { recursive: true });
    await writeFile(
      join(folder, "image.png"),
      Buffer.concat([png, Buffer.from(kind)]),
    );
    await writeFile(
      join(folder, "asset.json"),
      JSON.stringify({ id, kind, name: kind + ".png" }),
    );
  }
  return { dir, config };
}
test("effective configuration is shared, environment-aware, secret-free and does not mutate inherited defaults", () => {
  const raw = { remoteApiKey: "private-key" };
  const config = resolveConfig(raw, { HF_HOME: "/cache/env" }, "/home/example");
  expect(config).toMatchObject({
    localMfluxDirectory: "/home/example/.dsh/qwen-studio",
    pythonPath: "/home/example/.dsh/qwen-studio/venv/bin/python",
    loraDirectory: "/home/example/.dsh/qwen-studio/loras",
    hfHome: "/cache/env",
    hfHomeSource: "environment",
    localMfluxIdleMinutes: 10,
    remoteApiKeyConfigured: true,
  });
  expect(JSON.stringify(config)).not.toContain("private-key");
  expect(raw).toEqual({ remoteApiKey: "private-key" });
  expect(
    resolveConfig({ localMfluxDirectory: "/new" }, {}, "/home/example")
      .loraDirectory,
  ).toBe("/new/loras");
  expect(() => resolveConfig({ localMfluxIdleMinutes: 0 })).toThrow();
});
test("catalog merges imported, default and custom LoRA without loading inference or requiring upload metadata", async () => {
  const { dir, config } = await fixture();
  try {
    const catalog = await listResources(config);
    expect(catalog.warnings).toEqual([]);
    expect(
      catalog.items
        .filter((r) => r.kind === "lora")
        .map((r) => r.origin)
        .sort(),
    ).toEqual(["custom", "default", "imported"]);
    expect(
      catalog.items.some((r) => r.name === "managed-style.safetensors"),
    ).toBe(true);
    expect(catalog.items.filter((r) => r.kind !== "lora")).toHaveLength(3);
    expect((await readPresets(dir)).items).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("presets roundtrip complete selections and sampling, preserve randomness, and missing resources cannot silently turn into plain generation", async () => {
  const { dir, config } = await fixture();
  try {
    const values = {
      ...draftDefaults,
      prompt: undefined,
      sourceId: "",
      maskSourceId: "1".repeat(32),
      maskId: "3".repeat(32),
      controlId: "2".repeat(32),
      controlEnabled: true,
      maskEnabled: true,
      controlStrength: 0.8,
      negativePrompt: "blurry",
      guidance: 2.5,
      loras: [
        {
          path: join(dir, "loras/manual.safetensors"),
          name: "manual",
          scale: 0.75,
          enabled: true,
        },
      ],
    };
    delete values.prompt;
    const p = await capturePreset(config, "静物组合", values);
    const loaded = await loadPreset(config, p);
    expect(loaded.issues).toEqual([]);
    const payload = generationPayload(
      { ...loaded.draft, prompt: "A teapot" },
      false,
      "id",
    );
    expect(payload).toMatchObject({
      negative_prompt: "blurry",
      guidance: 2.5,
      controlnet_strength: 0.8,
      seed: null,
      lora_scales: [0.75],
    });
    await rm(join(dir, "loras/manual.safetensors"));
    const missing = await loadPreset(config, p);
    expect(missing.issues.join()).toContain("manual");
    expect(() =>
      generationPayload({ ...missing.draft, prompt: "A teapot" }, false, "id"),
    ).toThrow("失效");
    await rm(join(dir, "assets/images", "1".repeat(32)), { recursive: true });
    const missingImage = await loadPreset(config, p);
    expect(missingImage.draft.missingResources?.maskSourceId).toBeTruthy();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("portable JSON strips absolute paths and remaps different local IDs by content hashes", async () => {
  const a = await fixture(),
    b = await fixture();
  try {
    const values = { ...draftDefaults };
    delete (values as any).prompt;
    values.controlId = "2".repeat(32);
    values.controlEnabled = true;
    values.loras = [
      {
        path: join(a.dir, "custom/custom.safetensors"),
        name: "custom",
        scale: 0.8,
      },
    ];
    const store = await mutatePresets(a.config, {
      action: "save",
      revision: 0,
      name: "Shared preset",
      values,
    });
    const exported = exportPresets(store);
    expect(JSON.stringify(exported)).not.toContain(a.dir);
    expect(JSON.stringify(exported)).not.toContain("remoteApiKey");
    const old = join(b.dir, "assets/images", "2".repeat(32));
    await rename(old, join(b.dir, "assets/images", "a".repeat(32)));
    await writeFile(
      join(b.dir, "assets/images", "a".repeat(32), "asset.json"),
      JSON.stringify({
        id: "a".repeat(32),
        kind: "control",
        name: "renamed.png",
      }),
    );
    const imported = await mutatePresets(b.config, {
      action: "import",
      revision: 0,
      document: exported,
    });
    const loaded = await loadPreset(b.config, imported.items[0]!);
    expect(loaded.issues).toEqual([]);
    expect(loaded.draft.controlId).not.toBe("2".repeat(32));
    expect(loaded.draft.loras[0]?.path).toBe(
      await realpath(join(b.dir, "custom/custom.safetensors")),
    );
  } finally {
    await rm(a.dir, { recursive: true, force: true });
    await rm(b.dir, { recursive: true, force: true });
  }
});
test("revision fencing, rename/default/delete/undo preserve other presets and never touch runtime configuration", async () => {
  const { dir, config } = await fixture();
  try {
    await mkdir(join(dir, "state"), { recursive: true });
    await writeFile(
      join(dir, "state/runtime-config.json"),
      "existing runtime config",
    );
    const values = { ...draftDefaults };
    delete (values as any).prompt;
    let s = await mutatePresets(config, {
      action: "save",
      revision: 0,
      name: "First",
      values,
    });
    const id = s.items[0]!.id;
    await expect(
      mutatePresets(config, {
        action: "rename",
        revision: 0,
        id,
        name: "stale",
      }),
    ).rejects.toThrow("其他页面");
    s = await mutatePresets(config, {
      action: "default",
      revision: s.revision,
      id,
    });
    expect(s.defaultId).toBe(id);
    s = await mutatePresets(config, {
      action: "rename",
      revision: s.revision,
      id,
      name: "Renamed",
    });
    expect(s.items[0]?.name).toBe("Renamed");
    s = await mutatePresets(config, {
      action: "delete",
      revision: s.revision,
      id,
    });
    expect(s.items).toEqual([]);
    s = await mutatePresets(config, {
      action: "restore",
      revision: s.revision,
    });
    expect(s.items[0]?.id).toBe(id);
    expect(s.defaultId).toBe(id);
    expect(await readFile(join(dir, "state/runtime-config.json"), "utf8")).toBe(
      "existing runtime config",
    );
    await expect(
      mutatePresets(config, {
        action: "import",
        revision: s.revision,
        document: {
          format: "qwen-studio-presets",
          schemaVersion: 1,
          items: [
            { name: "attack", values: { remoteApiKey: "bad" }, resources: {} },
          ],
        },
      }),
    ).rejects.toThrow("不支持");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
