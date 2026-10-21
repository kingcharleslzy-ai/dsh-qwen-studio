export declare const generationParameters: {
    readonly prompt: {
        readonly type: "string";
        readonly required: true;
        readonly description: "Visual description: subject, composition, lighting, style and exact text if needed.";
    };
    readonly width: {
        readonly type: "integer";
        readonly description: "Width in pixels, 512–2048, multiple of16; default1024.";
    };
    readonly height: {
        readonly type: "integer";
        readonly description: "Height in pixels, 512–2048, multiple of16; default1024.";
    };
    readonly steps: {
        readonly type: "integer";
        readonly description: "Sampling steps1–60, default40.";
    };
    readonly seed: {
        readonly type: "integer";
        readonly description: "Optional reproducible seed0–4294967295.";
    };
    readonly source_image_ids: {
        readonly type: "array";
        readonly items: {
            readonly type: "string";
        };
        readonly description: "Qwen 2.1 native multi-image edit: 2–8 imported image ids. Use only with reference_mode=edit; the prompt addresses them as <image1>, <image2>, …. Do not combine with source_image_id, change_strength, mask or ControlNet. Remote gateway only.";
    };
    readonly source_image_id: {
        readonly type: "string";
        readonly description: "Optional real 32-character image id from qwen_image_import, qwen_image_resources or an earlier qwen_generate_image result. Import new URLs/files/attachments with qwen_image_import first. Img2img on local or the Qwen gateway; never invent an id or pass a filesystem path. Omit for a new composition.";
    };
    readonly change_strength: {
        readonly type: "number";
        readonly description: "Only with source_image_id and variation mode (never edit): variation strength 0.05–0.95, default 0.45. Lower preserves more of the source; higher changes more. Not a guarantee of exact local edits.";
    };
    readonly reference_mode: {
        readonly type: "string";
        readonly description: "variation (default, preserves old presets) uses partial denoising and change_strength; edit uses native Qwen 2.1 image+text reference conditioning and the full sampling schedule for instruction/style edits. edit requires supported local MFLUX with a complete vision-capable checkpoint or the updated Qwen remote gateway, source_image_id, linear scheduler and dimensions divisible by32; do not supply change_strength, mask or ControlNet. Query qwen_image_resources reference_edit.supported for the current backend. Use edit for watercolor/style transfer or requested changes; variation may strongly reconstruct the photo despite a different prompt.";
    };
    readonly negative_prompt: {
        readonly type: "string";
        readonly description: "Qwen-Image-Edit officially recommends an empty or whitespace negative prompt. A long list fights the reference attributes and raises guidance to 2.5 (about 2× slower); use at most a few targeted terms. For text-to-image, a short quality list is enough. Omit to skip the negative branch entirely.";
    };
    readonly guidance: {
        readonly type: "number";
        readonly description: "Local or Qwen gateway: true CFG strength 1–10, default 1. For plain text-to-image it requires a nonempty negative_prompt. ControlNet/mask branches can use it with an empty negative prompt. Not a general quality control.";
    };
    readonly scheduler: {
        readonly type: "string";
        readonly description: "Local or Qwen gateway: linear (default), flow_match_euler_discrete, or seedvr2_euler. Use linear unless the user requests another supported scheduler.";
    };
    readonly lora_paths: {
        readonly type: "array";
        readonly items: {
            readonly type: "string";
        };
        readonly description: "Local or Qwen gateway: absolute paths of 1–8 LoRA .safetensors files, stacked on the base model. The files must exist and live under one of the allowed LoRA roots. Pair with lora_scales.";
    };
    readonly lora_scales: {
        readonly type: "array";
        readonly items: {
            readonly type: "number";
        };
        readonly description: "One weight per lora_paths entry, 0.0–2.0. Omit to use 1.0 for every entry. Use weights compatible with the specific LoRA; do not invent paths.";
    };
    readonly controlnet_image_id: {
        readonly type: "string";
        readonly description: "Local or Qwen gateway: 32-character id of an imported or gallery control image (line art, Canny, depth, pose). Structure comes from the control image and content from the prompt, so it pins composition and pose. Import new control images with qwen_image_import(kind=control) or select an existing id with qwen_image_resources; never invent an id or pass a filesystem path.";
    };
    readonly controlnet_strength: {
        readonly type: "number";
        readonly description: "Only with controlnet_image_id: 0.0–1.0, default 1.0 (strongest); 0 turns the control off. 0.7–1.0 is the common range.";
    };
    readonly mask_image_id: {
        readonly type: "string";
        readonly description: "Inpaint on local or Qwen gateway. 32-character id of an imported or gallery mask where white is redrawn from the prompt and black is preserved. Import new masks with qwen_image_import(kind=mask). Requires source_image_id as the source image; black areas are copied from the source at output size. Do not pass change_strength with a mask. ControlNet and masks require a complete Union checkpoint on the executing server and the default scheduler; source_image_id with ControlNet requires a mask.";
    };
};
