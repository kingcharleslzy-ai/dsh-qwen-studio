import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-host-webserver";
import type { IncomingMessage } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { join, dirname } from "node:path";
import { Config } from "./config.js";
import { invocationProgress } from "./invocations.js";
import { Worker } from "./worker.js";
import {
  readJobs,
  batchAction,
  imagePath,
  validId,
  type GalleryAction,
} from "./storage.js";
import { registerTools } from "./tools.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { API, active } from "./shared.js";
export { Config };
export const name = "qwen-studio";
export const inject = ["webServer", "tools", "attachments"];
async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) throw Error("请求过大");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function apply(ctx: Context, config: Config = {}) {
  const current = () =>
    Object.fromEntries(
      Object.entries(config).map(([k, v]) => [
        k,
        v && typeof v === "object" && "get" in v
          ? (v as { get(): unknown }).get()
          : v,
      ]),
    ) as Config;
  const worker = new Worker(current);
  registerTools(ctx, worker);
  (
    ctx.inject as unknown as (
      services: string[],
      callback: (owner: Context) => void,
    ) => void
  )(["skills"], (owner) => {
    const skills = owner.get("skills") as {
      register(skill: object): () => void;
    };
    const path = fileURLToPath(
      new URL("../skills/qwen-image/SKILL.md", import.meta.url),
    );
    const content = readFileSync(path, "utf8").replace(
      /^---[\s\S]*?---\s*/,
      "",
    );
    owner.effect(
      () =>
        skills.register({
          name: "qwen-image",
          description:
            "图像创作：用已配置的Qwen Image生成配图、插画、海报、产品图；也可对本工具之前生成的图片做图生图变体。用户说画一张、帮我配图、再来一版、沿用这张构图时加载。包含工具参数、图片ID复用、强度选择和结果呈现流程。",
          whenToUse:
            "用户要求新图片、Qwen Image、本地生图，或基于本工具上次结果生成另一版时。无需用户说技能名或工具名。",
          content,
          source: "图像",
          path,
          invocation: { modelInvocable: true, userInvocable: true },
        }),
      "图像 skill",
    );
  });
  for (const route of [
    "state",
    "progress",
    "jobs",
    "image",
    "action",
    "check",
    "attachment",
  ])
    ctx.effect(
      () =>
        ctx.webServer.register({
          kind: "exact",
          path: `${API}/${route}`,
          handler: async (req, res) => {
            const json = (status: number, value: unknown) => {
              res.writeHead(status, {
                "content-type": "application/json",
                "cache-control": "no-store",
              });
              res.end(JSON.stringify(value));
            };
            try {
              if (route === "attachment" && req.method === "POST") {
                const data = await body(req);
                const stored = await ctx.attachments.readImage(data.attachment);
                res.writeHead(200, {
                  "content-type": stored.ref.mediaType,
                  "cache-control": "private, max-age=86400",
                });
                res.end(stored.data);
                return;
              }
              const dir = worker.directory();
              if (route === "progress" && req.method === "POST") {
                const data = await body(req);
                return json(
                  200,
                  await invocationProgress(
                    dir,
                    data.call_id ?? "",
                    data.prompt ?? "",
                    Number(data.since ?? 0),
                    data.session_id ?? "",
                  ),
                );
              }
              if (route === "state" && req.method === "GET") {
                await worker.sync();
                const [jobs, health] = await Promise.all([
                  readJobs(dir),
                  worker.health(),
                ]);
                // Old interrupted jobs remain visible and retryable even while service is stopped.
                for (const job of jobs)
                  if (
                    active(job) &&
                    job.worker_pid &&
                    (job.source === "remote" || health.status === "offline")
                  ) {
                    try {
                      process.kill(job.worker_pid, 0);
                    } catch {
                      job.status = "failed";
                      job.error = "服务已停止，任务未完成，请重试";
                    }
                  }
                return json(200, {
                  apiVersion: 4,
                  jobs,
                  health:
                    worker.mode() === "remote"
                      ? { status: "remote", busy: worker.remote.size > 0 }
                      : health,
                  directory: dir,
                  idleMinutes: current().localMfluxIdleMinutes ?? 10,
                  mode: worker.mode(),
                  configured:
                    worker.mode() === "remote"
                      ? Boolean(current().remoteBaseURL)
                      : Boolean(current().pythonPath && current().modelPath),
                });
              }
              if (route === "check" && req.method === "POST")
                return json(200, await worker.check());
              if (route === "jobs" && req.method === "POST")
                return json(
                  202,
                  await worker.post("/v1/jobs", await body(req), true),
                );
              if (route === "action" && req.method === "POST") {
                const data = await body(req);
                if (data.action === "unload")
                  return json(200, await worker.post("/v1/unload", {}));
                if (data.action === "cancel") {
                  if (!validId(data.id ?? "")) throw Error("任务ID无效");
                  return json(
                    200,
                    await worker.post("/v1/cancel", { id: data.id }),
                  );
                }
                if (data.action === "purge" && data.confirm !== true)
                  throw Error("永久删除需要明确确认");
                return json(
                  200,
                  await batchAction(
                    dir,
                    data.ids ?? [data.id],
                    data.action as GalleryAction,
                    data.value,
                  ),
                );
              }
              if (route === "image" && req.method === "GET") {
                const url = new URL(req.url ?? "", "http://localhost"),
                  id = url.searchParams.get("id") ?? "";
                if (!validId(id)) throw Error("图片ID无效");
                let path = await imagePath(dir, id);
                if (url.searchParams.get("reference") === "1") {
                  const expected = join(dirname(path), "reference.png");
                  path = await realpath(expected);
                  if (path !== expected) throw Error("参考图片路径无效");
                }
                const image = await readFile(path);
                res.writeHead(200, {
                  "content-type": "image/png",
                  "cache-control": "private, max-age=86400",
                  ...(url.searchParams.has("download")
                    ? {
                        "content-disposition": `attachment; filename="qwen-${id.slice(0, 8)}.png"`,
                      }
                    : {}),
                });
                res.end(image);
                return;
              }
              json(405, { error: "不支持的请求" });
            } catch (error) {
              if (!res.headersSent)
                json(500, {
                  error: error instanceof Error ? error.message : String(error),
                });
            }
          },
        }),
      "qwen-studio: " + route,
    );
}
