import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-host-webserver";
import type { IncomingMessage } from "node:http";
import { readFile, realpath, access } from "node:fs/promises";
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
import { API, active } from "./shared.js";
import { receiveAsset } from "./assets.js";
import { resolveConfig } from "./resolved-config.js";
import { listResources } from "./resources.js";
import {
  readPresets,
  mutatePresets,
  loadPreset,
  exportPresets,
} from "./presets.js";
import { bundledImageSkill } from "./skill.js";
import { sshOptions } from "./remote-lifecycle.js";
import { registerConnectionTool, type ConnectionSettings } from "./connection-tools.js";
export { Config };
export const name = "qwen-studio";
export const inject = ["webServer", "tools", "attachments"];
async function body(req: IncomingMessage, limit = 65536) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Error("请求过大");
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
  ctx.effect(() => () => { void worker.dispose().catch(() => {}); }, "qwen-studio SSH lifecycle");
  registerTools(ctx, worker);
  (ctx.inject as unknown as (services: string[], callback: (owner: Context) => void) => void)(["settings"], (owner) => {
    registerConnectionTool(owner, worker, owner.get("settings") as ConnectionSettings);
  });
  (
    ctx.inject as unknown as (
      services: string[],
      callback: (owner: Context) => void,
    ) => void
  )(["skills"], (owner) => {
    const skills = owner.get("skills") as {
      register(skill: object): () => void;
    };
    owner.effect(() => skills.register(bundledImageSkill()), "图像 skill");
  });
  for (const route of [
    "state",
    "progress",
    "jobs",
    "image",
    "action",
    "check",
    "attachment",
    "assets-upload",
    "settings",
    "resources",
    "presets",
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
              if (route === "settings") {
                const data = req.method === "POST" ? await body(req) : {};
                const effective = resolveConfig({
                  ...current(),
                  ...(data.config ?? {}),
                });
                if (effective.connectionMode === "remote") sshOptions(effective);
                return json(200, { effective, health: await worker.health() });
              }
              if (route === "resources" && req.method === "GET")
                return json(200, await listResources(resolveConfig(current())));
              if (route === "presets") {
                const effective = resolveConfig(current());
                if (req.method === "GET")
                  return json(200, await readPresets(dir));
                if (req.method === "POST") {
                  const data = await body(req, 1024 * 1024);
                  if (data.action === "load" || data.action === "export") {
                    const store = await readPresets(dir),
                      preset = store.items.find((p) => p.id === data.id);
                    if (data.action === "export") {
                      if(data.id&&!preset)throw Error('预设不存在');
                      return json(200, exportPresets(store, data.id));
                    }
                    if (!preset) throw Error("预设不存在");
                    return json(200, await loadPreset(effective, preset));
                  }
                  return json(200, await mutatePresets(effective, data));
                }
              }

              if (route === "assets-upload" && req.method === "POST") {
                if (worker.mode() === "remote" && !await worker.capabilities())
                  throw Error("该远程服务不支持高级资源，请使用 Qwen 网关");
                return json(
                  201,
                  await receiveAsset(
                    req,
                    dir,
                    resolveConfig(current()).pythonPath,
                  ),
                );
              }
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
                  apiVersion: 9,
                  remoteAdvanced: worker.mode() === "remote" && Boolean(await worker.capabilities().catch(() => null)),
                  referenceEditSupported: worker.mode() === "remote" && Boolean((await worker.capabilities().catch(() => null))?.features.includes("reference_edit")),
                  jobs,
                  health:
                    worker.mode() === "remote"
                      ? { ...health, busy: Boolean(health.busy || worker.remote.size > 0) }
                      : health,
                  directory: dir,
                  idleMinutes: current().localMfluxIdleMinutes ?? 10,
                  mode: worker.mode(),
                  configured:
                    worker.mode() === "remote"
                      ? Boolean(current().remoteBaseURL)
                      : await Promise.all([
                          access(resolveConfig(current()).pythonPath),
                          access(resolveConfig(current()).modelPath),
                        ])
                          .then(() => true)
                          .catch(() => false),
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
