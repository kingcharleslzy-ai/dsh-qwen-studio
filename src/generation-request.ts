import { randomUUID } from "node:crypto";

export interface GenerationArgs {
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  negative_prompt?: string;
  guidance?: number;
  scheduler?: string;
  source_image_id?: string;
  source_image_ids?: string[];
  change_strength?: number;
  reference_mode?: string;
  controlnet_image_id?: string;
  controlnet_strength?: number;
  mask_image_id?: string;
  lora_paths?: string[];
  lora_scales?: number[];
}

/** Same validation as the single-image tool, shared with batch submission. */
export function validateGeneration(args: GenerationArgs) {
  if (args.reference_mode !== undefined && !["variation", "edit"].includes(args.reference_mode)) throw Error("参考图模式无效");
  if (args.source_image_ids?.length) {
    if (args.reference_mode !== "edit") throw Error("多图参考只用于 reference_mode=edit");
    if (args.source_image_id) throw Error("source_image_ids 与 source_image_id 只能二选一");
    if (args.source_image_ids.length < 2 || args.source_image_ids.length > 8) throw Error("多图参考需要 2–8 张图片");
    if (args.change_strength !== undefined || args.mask_image_id || args.controlnet_image_id) throw Error("多图参考不使用变化幅度、蒙版或结构控制");
  } else if (args.reference_mode === "edit" && (!args.source_image_id || args.change_strength !== undefined || args.mask_image_id || args.controlnet_image_id))
    throw Error("原生参考编辑需要 source_image_id 或 source_image_ids，不使用变化幅度、蒙版或结构控制");
  if (args.mask_image_id && args.change_strength !== undefined) throw Error("蒙版重绘不使用 change_strength，请移除此参数");
  if (args.change_strength !== undefined && !args.source_image_id)
    throw Error("变化幅度必须配合上一张图片的source_image_id");
  if (args.lora_paths && args.lora_scales && args.lora_paths.length !== args.lora_scales.length)
    throw Error("每个 LoRA 必须对应一个权重");
}

export function newJobId() {
  return randomUUID().replaceAll("-", "");
}

/** Build the worker payload; callers submit it through the same queue. */
export function generationPayload(args: GenerationArgs, id: string) {
  return {
    id,
    prompt: args.prompt,
    width: args.width ?? 1024,
    height: args.height ?? 1024,
    steps: args.steps ?? 40,
    seed: args.seed ?? null,
    ...(args.source_image_ids?.length
      ? { source_image_ids: args.source_image_ids, reference_mode: "edit" }
      : args.source_image_id
      ? {
          source_image_id: args.source_image_id,
          ...(!args.mask_image_id ? args.reference_mode === "edit" ? { reference_mode: "edit" } : { change_strength: args.change_strength ?? 0.45 } : {}),
        }
      : {}),
    ...(args.negative_prompt ? { negative_prompt: args.negative_prompt } : {}),
    ...(args.guidance !== undefined ? { guidance: args.guidance } : {}),
    ...(args.scheduler ? { scheduler: args.scheduler } : {}),
    ...(args.lora_paths ? { lora_paths: args.lora_paths } : {}),
    ...(args.lora_scales ? { lora_scales: args.lora_scales } : {}),
    ...(args.controlnet_image_id ? { controlnet_image_id: args.controlnet_image_id } : {}),
    ...(args.controlnet_strength !== undefined ? { controlnet_strength: args.controlnet_strength } : {}),
    ...(args.mask_image_id ? { mask_image_id: args.mask_image_id } : {}),
  };
}
