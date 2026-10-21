import type { Job } from "../shared.js";
export interface LoraChoice {
  path: string;
  name: string;
  scale: number;
  enabled?: boolean;
  missing?: boolean;
}
export interface CreationDraft {
  prompt: string;
  negativePrompt: string;
  guidance: number;
  scheduler: "linear" | "flow_match_euler_discrete" | "seedvr2_euler";
  missingResources?: Record<string, string>;
  size: string;
  steps: number;
  seed: string;
  sourceId: string;
  sourceName: string;
  additionalSourceIds: string[];
  additionalSourceNames: string[];
  referenceMode: "variation" | "edit";
  changeStrength: number;
  loras: LoraChoice[];
  controlId: string;
  controlName: string;
  controlEnabled: boolean;
  controlStrength: number;
  maskId: string;
  maskName: string;
  maskEnabled: boolean;
  maskSourceId: string;
  maskSourceName: string;
}
export const draftDefaults: CreationDraft = {
  prompt: "",
  negativePrompt: "",
  guidance: 1,
  scheduler: "linear",
  size: "1024x1024",
  steps: 40,
  seed: "",
  sourceId: "",
  sourceName: "",
  additionalSourceIds: [],
  additionalSourceNames: [],
  referenceMode: "variation",
  changeStrength: 0.45,
  loras: [],
  controlId: "",
  controlName: "",
  controlEnabled: false,
  controlStrength: 1,
  maskId: "",
  maskName: "",
  maskEnabled: false,
  maskSourceId: "",
  maskSourceName: "",
};
export const controlled = (draft: CreationDraft) =>
  Boolean(draft.controlEnabled || draft.maskEnabled);
export function generationPayload(
  draft: CreationDraft,
  remote: boolean,
  id: string,
) {
  const loras = draft.loras.filter((l) => l.enabled !== false),
    sourceId = draft.maskEnabled
      ? draft.maskSourceId || draft.sourceId
      : draft.sourceId;
  const [width, height] = draft.size.split("x").map(Number),
    seed = draft.seed.trim() === "" ? null : Number(draft.seed);
  if (!["variation", "edit"].includes(draft.referenceMode ?? "variation")) throw Error("参考图模式无效");
  const additional = (draft.additionalSourceIds ?? []).filter(Boolean);
  const allSources = sourceId ? [sourceId, ...additional] : [];
  if (additional.length && (draft.referenceMode !== "edit" || draft.maskEnabled || draft.controlEnabled))
    throw Error("多图参考只用于原生参考编辑，不能叠加蒙版或结构控制");
  if (allSources.length > 8) throw Error("多图参考最多8张");
  const editing = draft.referenceMode === "edit" && Boolean(sourceId) && !draft.maskEnabled;
  if (editing && (draft.controlEnabled || draft.scheduler !== "linear" || width! % 32 || height! % 32))
    throw Error("原生参考编辑需要 linear、32的倍数尺寸，且不能叠加结构控制");
  if (loras.some((l) => l.missing))
    throw Error("请重新选择失效的 LoRA，或停用它");
  const missing = draft.missingResources ?? {};
  if (
    (draft.maskEnabled &&
      (missing.maskSourceId ||
        (!draft.maskSourceId && missing.sourceId) ||
        missing.maskId)) ||
    (draft.controlEnabled && missing.controlId) ||
    (!draft.maskEnabled && missing.sourceId)
  )
    throw Error("预设引用的图片已失效，请重新选择或移除失效引用");
  if (missing.sourceExtra)
    throw Error("多图参考中有图片已失效，请重新选择或移除");
  if (
    !Number.isFinite(draft.guidance) ||
    draft.guidance < 1 ||
    draft.guidance > 10 ||
    draft.negativePrompt.length > 8000
  )
    throw Error("负向提示词或引导强度无效");
  if (
    !["linear", "flow_match_euler_discrete", "seedvr2_euler"].includes(
      draft.scheduler,
    )
  )
    throw Error("调度器无效");
  if (controlled(draft) && draft.scheduler !== "linear")
    throw Error("结构控制与局部重绘仅支持 linear 调度器，请切换后再生成");
  if (
    remote &&
    (draft.negativePrompt.trim() ||
      draft.guidance !== 1 ||
      draft.scheduler !== "linear")
  )
    throw Error("当前远程接口不支持负向提示词、CFG 与调度器");
  if (!draft.prompt.trim()) throw Error("先描述你想看到的画面");
  if (seed !== null && (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32))
    throw Error("种子需为0–4294967295的整数");
  if (!Number.isInteger(draft.steps) || draft.steps < 1 || draft.steps > 60)
    throw Error("步数需为1–60");
  if (
    [width, height].some(
      (n) =>
        !Number.isInteger(n) ||
        Number(n) < 512 ||
        Number(n) > 2048 ||
        Number(n) % 16,
    )
  )
    throw Error("输出尺寸无效");
  if (remote && (sourceId || additional.length || loras.length || controlled(draft)))
    throw Error(
      "参考图、LoRA、ControlNet 和蒙版仅支持本地模式；请切换本地模式或移除已选参数",
    );
  if (draft.controlEnabled && !draft.controlId)
    throw Error("请先选择 ControlNet 控制图，或关闭结构控制");
  if (draft.maskEnabled && (!draft.maskId || !sourceId))
    throw Error("局部重绘需要同时选择原图和蒙版，或关闭局部重绘");
  if (draft.controlEnabled && sourceId && !draft.maskEnabled)
    throw Error(
      "控制图与参考原图同时使用时，请开启局部重绘并选择蒙版；仅用结构控制时可移除原图",
    );
  if (
    sourceId &&
    !draft.maskEnabled &&
    !additional.length &&
    (!Number.isFinite(draft.changeStrength) ||
      draft.changeStrength < 0.05 ||
      draft.changeStrength > 0.95)
  )
    throw Error("参考图变化幅度范围5%–95%");
  if (
    draft.loras.length > 8 ||
    loras.some((l) => !Number.isFinite(l.scale) || l.scale < 0 || l.scale > 2)
  )
    throw Error("LoRA 最多8个，权重范围0–2");
  if (
    draft.controlEnabled &&
    (!Number.isFinite(draft.controlStrength) ||
      draft.controlStrength < 0 ||
      draft.controlStrength > 1)
  )
    throw Error("控制强度范围0–1");
  return {
    id,
    prompt: draft.prompt,
    width,
    height,
    steps: draft.steps,
    seed,
    ...(!remote
      ? {
          negative_prompt: draft.negativePrompt.trim() || null,
          guidance: draft.guidance,
          scheduler: draft.scheduler,
        }
      : {}),
    ...(allSources.length > 1
      ? { source_image_ids: allSources, reference_mode: "edit" as const }
      : sourceId
      ? {
          source_image_id: sourceId,
          ...(!draft.maskEnabled
            ? editing ? { reference_mode: "edit" as const } : { change_strength: draft.changeStrength }
            : {}),
        }
      : {}),
    ...(loras.length
      ? {
          lora_paths: loras.map((l) => l.path),
          lora_scales: loras.map((l) => l.scale),
          lora_names: loras.map((l) => l.name),
        }
      : {}),
    ...(draft.controlEnabled
      ? {
          controlnet_image_id: draft.controlId,
          controlnet_strength: draft.controlStrength,
        }
      : {}),
    ...(draft.maskEnabled ? { mask_image_id: draft.maskId } : {}),
  };
}
export function reuseDraft(
  job: Job,
  asReference: boolean,
): Partial<CreationDraft> {
  return {
    prompt: job.prompt,
    negativePrompt: job.negative_prompt ?? "",
    guidance: job.guidance ?? 1,
    scheduler: job.scheduler ?? "linear",
    missingResources: {},
    size: `${job.width}x${job.height}`,
    steps: job.steps,
    seed: String(job.seed),
    sourceId: asReference
      ? job.id
      : job.mask_image_id
        ? ""
        : (job.source_image_ids?.[0] ?? job.source_image_id ?? ""),
    sourceName: asReference ? "上一张生成结果" : "参考原图",
    additionalSourceIds: !asReference && !job.mask_image_id ? (job.source_image_ids?.slice(1) ?? []) : [],
    additionalSourceNames: !asReference && !job.mask_image_id ? (job.source_image_ids?.slice(1).map(() => "多图参考") ?? []) : [],
    referenceMode: asReference ? "variation" : job.reference_mode ?? "variation",
    changeStrength: asReference ? 0.45 : (job.change_strength ?? 0.45),
    // A new reference variation starts with no previous control/mask; parameter reuse retains them.
    controlId: asReference ? "" : (job.controlnet_image_id ?? ""),
    controlName: "控制图",
    controlEnabled: !asReference && Boolean(job.controlnet_image_id),
    maskSourceId:
      asReference || !job.mask_image_id ? "" : (job.source_image_id ?? ""),
    maskSourceName: "参考原图",
    maskId: asReference ? "" : (job.mask_image_id ?? ""),
    maskName: "蒙版",
    maskEnabled: !asReference && Boolean(job.mask_image_id),
    controlStrength: job.controlnet_strength ?? 1,
    loras: (job.lora_paths ?? []).map((path, i) => ({
      path,
      name: job.lora_names?.[i] ?? path.split("/").at(-1) ?? "LoRA",
      scale: job.lora_scales?.[i] ?? 1,
    })),
  };
}
