import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";
import type {} from "@deepseek-ai/dsh-attachment";
import { readFile } from "node:fs/promises";
import { imagePath, readJob } from "./storage.js";
import type { Worker } from "./worker.js";

/** Recovery never starts inference, submits a new task, or changes gallery flags. */
export function registerStatusTool(ctx: Context, worker: Worker) {
  ctx.tools.register(defineTool({
    name: "qwen_image_status",
    description: "Read an existing Qwen image task by its full returned id; recover progress or the completed visible image attachment after a timeout, interruption, or later request. Read-only: never starts the model or submits again. Do not use shell/file search or a standalone script to recover results. Do not poll repeatedly in a tight loop; active tasks continue in the image workspace and original conversation progress card.",
    parameters: {
      id: { type: "string", required: true, description: "The exact 32-character task id returned by qwen_generate_image or its error. Never invent an id or use a filesystem path." },
    },
    output: {
      schema: {
        type: "object", additionalProperties: false,
        properties: {
          id: { type: "string", required: true },
          status: { type: "string", required: true },
          prompt: { type: "string", required: true },
          step: { type: "integer" }, steps: { type: "integer", required: true },
          error: { type: "string" },
          attachment: {
            type: "object", additionalProperties: false,
            properties: {
              attachmentId: { type: "string", required: true },
              mediaType: { type: "string", required: true },
              bytes: { type: "integer", required: true },
              width: { type: "integer", required: true },
              height: { type: "integer", required: true }, name: { type: "string" },
              originalDimensions: { type: "object", additionalProperties: false, properties: {
                width: { type: "integer", required: true }, height: { type: "integer", required: true },
              } },
            },
          },
        },
      },
      presentationMeta: (_args, value) => value.attachment
        ? { kind: "qwen-studio", id: value.id, prompt: value.prompt, attachment: value.attachment }
        : { kind: "qwen-studio-status", id: value.id },
      render: (_args, value) => [
        { type: "text", text: `图像任务 ${value.id}：${value.status}；${value.step ?? 0}/${value.steps} 步。${value.error ?? ""}${value.attachment ? "图片已附在对话中，图库归属不影响对话显示。" : "未重新提交，也未启动模型。"}` },
        ...(value.attachment ? [{ type: "image" as const, attachment: value.attachment as import("@deepseek-ai/dsh-attachment").ImageAttachmentRef }] : []),
      ],
    },
    async execute({ id }) {
      const dir = worker.directory(), job = await readJob(dir, id);
      if (!job) throw Error(`任务 ${id} 不存在，请确认原始 ID；未提交新任务。`);
      const attachment = job.status === "complete" && !job.deleted
        ? await ctx.attachments.saveImage({ data: await readFile(await imagePath(dir, id)), mediaType: "image/png", name: `qwen-${id.slice(0, 8)}.png` })
        : undefined;
      return { id, status: job.deleted ? "trashed" : job.status, prompt: job.prompt,
        steps: job.sampling_steps ?? job.steps,
        ...(job.step !== undefined ? { step: job.step } : {}),
        ...(job.error ? { error: job.error } : {}), ...(attachment ? { attachment } : {}),
      };
    },
    presentResult: (_args, result) => ({ card: "generic", title: "图像任务", content: result.content }),
  }));
}
