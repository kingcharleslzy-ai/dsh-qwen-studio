import { test, expect } from "vitest";
import {
  draftDefaults,
  generationPayload,
  reuseDraft,
} from "../src/client/creation-draft.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdvancedSettings } from "../src/client/advanced-settings.js";
const base = { ...draftDefaults, prompt: "A ceramic teapot", size: "512x512" };
test("advanced creation sends the same plugin parameters and does not silently discard incomplete combinations", () => {
  const draft = {
    ...base,
    loras: [
      {
        path: "/assets/style.safetensors",
        name: "style.safetensors",
        scale: 0.8,
      },
    ],
    controlId: "a".repeat(32),
    controlEnabled: true,
    controlStrength: 0.8,
    maskSourceId: "b".repeat(32),
    maskEnabled: true,
    maskId: "c".repeat(32),
  };
  const payload = generationPayload(draft, false, "d".repeat(32));
  expect(payload).toMatchObject({
    lora_paths: ["/assets/style.safetensors"],
    lora_scales: [0.8],
    lora_names: ["style.safetensors"],
    controlnet_image_id: draft.controlId,
    controlnet_strength: 0.8,
    source_image_id: draft.maskSourceId,
    mask_image_id: draft.maskId,
  });
  expect(payload).not.toHaveProperty("change_strength");
  expect(() =>
    generationPayload({ ...draft, maskId: "" }, false, "id"),
  ).toThrow("蒙版");
  expect(() =>
    generationPayload(
      { ...draft, maskEnabled: false, sourceId: "b".repeat(32) },
      false,
      "id",
    ),
  ).toThrow("同时使用");
  expect(() => generationPayload(draft, true, "id")).toThrow("仅支持本地");
});
test("disabled effects retain their selections without leaking into plain generation", () => {
  const payload = generationPayload(
    {
      ...base,
      loras: [
        {
          path: "/style.safetensors",
          name: "style",
          scale: 0.8,
          enabled: false,
        },
      ],
      controlId: "a".repeat(32),
      maskSourceId: "b".repeat(32),
      maskId: "c".repeat(32),
    },
    false,
    "id",
  );
  expect(payload).not.toHaveProperty("lora_paths");
  expect(payload).not.toHaveProperty("controlnet_image_id");
  expect(payload).not.toHaveProperty("source_image_id");
  expect(payload).not.toHaveProperty("mask_image_id");
});
test("reuse restores advanced selections and reference variations clear obsolete control/mask associations", () => {
  const job = {
    id: "d".repeat(32),
    prompt: "A tree",
    width: 512,
    height: 512,
    steps: 4,
    seed: 42,
    status: "complete",
    started_at: 1,
    source_image_id: "a".repeat(32),
    mask_image_id: "b".repeat(32),
    controlnet_image_id: "c".repeat(32),
    controlnet_strength: 0.8,
    lora_paths: ["/assets/weight.safetensors"],
    lora_names: ["style.safetensors"],
    lora_scales: [0.7],
  };
  const reused = reuseDraft(job, false);
  expect(reused).toMatchObject({
    sourceId: "",
    maskSourceId: job.source_image_id,
    maskEnabled: true,
    controlEnabled: true,
    loras: [{ name: "style.safetensors", scale: 0.7 }],
  });
  expect(reuseDraft(job, true)).toMatchObject({
    sourceId: job.id,
    maskEnabled: false,
    controlEnabled: false,
    maskSourceId: "",
  });
});
test("advanced settings expose native file inputs and preserve the DSH vocabulary", () => {
  const html = renderToStaticMarkup(
    createElement(AdvancedSettings, {
      draft: base,
      update: () => {},
      remote: false,
      ready: true,
      close: () => {},
    }),
  );
  expect(html).toContain('aria-label="高级生成设置"');
  expect((html.match(/type="file"/g) || []).length).toBe(5);
  for (const text of [
    "添加 LoRA 文件",
    "选择控制图",
    "选择重绘原图",
    "选择蒙版",
    "白色：重新生成",
    "黑色：保留原图",
    "完成设置",
  ])
    expect(html).toContain(text);
});
