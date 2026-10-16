import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";
import type {} from "@deepseek-ai/dsh-attachment";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";
import { readJobs, imagePath } from "./storage.js";
import { active } from "./shared.js";
import { recordInvocation } from "./invocations.js";
import type { Worker } from "./worker.js";
export function registerTools(ctx: Context, worker: Worker) {
  ctx.tools.register(
    defineTool({
      name: "qwen_generate_image",
      description:
        "Create images with the configured local Qwen Image or self-hosted server. Use for requests to draw, illustrate, make a poster/product image, or generate a picture (画一张、配图、生图). To make a variation of a previous result while retaining its composition, pass that result's source_image_id and change_strength (local only). Describe the complete desired image, not just an edit instruction. This is strength-based img2img, not precise masked or instruction editing; external reference attachments and multiple reference images are not supported. Local-only negative_prompt / guidance / scheduler are supported. Negative prompts require guidance above 1; the worker uses 2.5 if a negative prompt is supplied with the default guidance. Returns a visible image attachment plus an id for follow-up variations. No shell, manual server startup, file search, or manual skill installation is needed.",
      timeoutMs: 1200000,
      parameters: {
        prompt: {
          type: "string",
          required: true,
          description:
            "Visual description: subject, composition, lighting, style and exact text if needed.",
        },
        width: {
          type: "integer",
          description: "Width in pixels, 512–2048, multiple of16; default1024.",
        },
        height: {
          type: "integer",
          description:
            "Height in pixels, 512–2048, multiple of16; default1024.",
        },
        steps: {
          type: "integer",
          description: "Sampling steps1–60, default40.",
        },
        seed: {
          type: "integer",
          description: "Optional reproducible seed0–4294967295.",
        },
        source_image_id: {
          type: "string",
          description:
            "Optional 32-character image id from an earlier qwen_generate_image result. Local-only img2img; never invent an id or pass a filesystem path. Omit for a new composition.",
        },
        change_strength: {
          type: "number",
          description:
            "Only with source_image_id: variation strength 0.05–0.95, default 0.45. Lower preserves more of the source; higher changes more. Not a guarantee of exact local edits.",
        },
        negative_prompt: {
          type: "string",
          description:
            "Local only: unwanted visual characteristics, up to 8000 characters. With a negative prompt, guidance defaults to 2.5 if not above 1. Omit to skip the negative branch.",
        },
        guidance: {
          type: "number",
          description:
            "Local only: true CFG strength 1–10, default 1. Only affects sampling together with a nonempty negative_prompt; it is not a general quality control.",
        },
        scheduler: {
          type: "string",
          description:
            "Local only: linear (default), flow_match_euler_discrete, or seedvr2_euler. Use linear unless the user requests another supported scheduler.",
        },
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", required: true },
            attachment: {
              type: "object",
              required: true,
              additionalProperties: false,
              properties: {
                attachmentId: { type: "string", required: true },
                mediaType: { type: "string", required: true },
                bytes: { type: "integer", required: true },
                width: { type: "integer", required: true },
                height: { type: "integer", required: true },
                name: { type: "string" },
                originalDimensions: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    width: { type: "integer", required: true },
                    height: { type: "integer", required: true },
                  },
                },
              },
            },
          },
        },
        presentationMeta: (args, value) => ({
          kind: "qwen-studio",
          id: value.id,
          prompt: args.prompt,
          attachment: value.attachment,
        }),
        render: (_args, value) => [
          {
            type: "text",
            text: `图像任务${value.id}已完成。图片已自动入库并附在对话中，无需搜索或重新读取。`,
          },
          {
            type: "image",
            attachment:
              value.attachment as import("@deepseek-ai/dsh-attachment").ImageAttachmentRef,
          },
        ],
      },
      async execute(args, exec) {
        if (args.change_strength !== undefined && !args.source_image_id)
          throw Error("变化幅度必须配合上一张图片的source_image_id");
        const id = randomUUID().replaceAll("-", ""),
          dir = worker.directory();
        await recordInvocation(
          dir,
          exec.callId,
          args.prompt,
          id,
          undefined,
          exec.agent?.id ?? "",
        );
        try {
          await worker.post(
            "/v1/jobs",
            {
              id,
              prompt: args.prompt,
              width: args.width ?? 1024,
              height: args.height ?? 1024,
              steps: args.steps ?? 40,
              seed: args.seed ?? null,
              ...(args.source_image_id
                ? {
                    source_image_id: args.source_image_id,
                    change_strength: args.change_strength ?? 0.45,
                  }
                : {}),
              ...(args.negative_prompt
                ? { negative_prompt: args.negative_prompt }
                : {}),
              ...(args.guidance !== undefined
                ? { guidance: args.guidance }
                : {}),
              ...(args.scheduler ? { scheduler: args.scheduler } : {}),
            },
            true,
          );
        } catch (error) {
          await recordInvocation(
            dir,
            exec.callId,
            args.prompt,
            id,
            error instanceof Error ? error.message : String(error),
            exec.agent?.id ?? "",
          );
          throw error;
        }
        const started = Date.now();
        while (Date.now() - started < 20 * 60 * 1000) {
          if (exec.signal.aborted)
            throw Error(`等待已取消，任务${id}仍可在图像查看或取消。`);
          const job = (await readJobs(dir)).find((j) => j.id === id);
          if (job && !active(job)) {
            if (job.status !== "complete")
              throw Error(job.error ?? `生成${job.status}`);
            const data = await readFile(await imagePath(dir, id));
            const attachment = await ctx.attachments.saveImage({
              data,
              mediaType: "image/png",
              name: `qwen-${id.slice(0, 8)}.png`,
            });
            return { id, attachment };
          }
          await wait(1000, undefined, { signal: exec.signal });
        }
        throw Error(
          `等待超时，任务${id}仍保留在图像，先查看状态，不要重复提交。`,
        );
      },
      presentResult: (_args, result) => ({
        card: "generic",
        title: "图像",
        content: result.content,
      }),
    }),
  );
}
