import { test, expect, vi } from "vitest";
vi.mock("@deepseek-ai/dsh-tools", () => ({ defineTool: (options: unknown) => options }));
import { jobToGenerationArgs } from "../src/reroll-tool.js";
import type { Job } from "../src/shared.js";

const base: Job = {
  id: "a".repeat(32), prompt: "bench portrait", status: "complete",
  width: 832, height: 1216, steps: 40, seed: 4294967295,
  started_at: 1, negative_prompt: "blur", guidance: 2.5, scheduler: "linear",
  source_image_id: "b".repeat(32), reference_mode: "edit",
  lora_paths: ["/tmp/lora.safetensors"], lora_scales: [0.7],
};

test("reroll rebuilds the original request and advances the seed", () => {
  const args = jobToGenerationArgs(base);
  expect(args).toMatchObject({
    prompt: "bench portrait", width: 832, height: 1216, steps: 40,
    seed: 0, negative_prompt: "blur", guidance: 2.5, scheduler: "linear",
    source_image_id: "b".repeat(32), reference_mode: "edit",
    lora_paths: ["/tmp/lora.safetensors"], lora_scales: [0.7],
  });
  expect(args).not.toHaveProperty("change_strength");
});

test("variation keeps change strength but mask rerolls drop it", () => {
  const variation: Job = { ...base, reference_mode: "variation", change_strength: 0.38 };
  expect(jobToGenerationArgs(variation).change_strength).toBe(0.38);
  const masked: Job = { ...base, mask_image_id: "c".repeat(32), change_strength: 0.38 };
  expect(jobToGenerationArgs(masked)).not.toHaveProperty("change_strength");
  expect(jobToGenerationArgs(masked).mask_image_id).toBe("c".repeat(32));
});

test("multi-image reroll retains every reference without adding a conflicting single reference", () => {
 const ids=["b".repeat(32),"c".repeat(32)];
 const args=jobToGenerationArgs({...base,source_image_ids:ids});
 expect(args.source_image_ids).toEqual(ids);expect(args).not.toHaveProperty("source_image_id");
});
