import { defineTool } from "@deepseek-ai/dsh-tools";
import type { Context } from "@deepseek-ai/cordis";
import type { Worker } from "./worker.js";
export interface ConnectionSettings {
  describe(options: { redactSecrets: true }): { ns: string; revision: number }[];
  mutate(ns: string, ops: { op: "set"; path: string[]; value: unknown }[], revision: number): Promise<void>;
}
export async function connectionOperation(worker: Worker, settings: ConnectionSettings, args: { action?: string; mode?: string; idle_minutes?: number; revision?: number }) {
  const descriptor = settings.describe({ redactSecrets: true }).find(d => d.ns === "qwen-studio");
  if (!descriptor) throw Error("图像插件的宿主设置尚未加载");
  const action = args.action ?? "status";
  if (action !== "status") {
    if (!Number.isInteger(args.revision)) throw Error("先 status 读取 revision，写入时带回该修订号");
    if (args.revision !== descriptor.revision) throw Error("连接设置已被其他页面修改，请重新 status 核对");
    if (action === "switch") {
      if (args.mode !== "local" && args.mode !== "remote") throw Error("运行位置应为 local 或 remote");
      const mode = args.mode;
      await worker.switchConnection(mode, () => settings.mutate("qwen-studio", [{ op: "set", path: ["connectionMode"], value: mode }], descriptor.revision));
    } else if (action === "set_idle") {
      const n = args.idle_minutes;
      if (typeof n !== "number" || !Number.isFinite(n) || n < .1 || n > 1440) throw Error("空闲时间应为0.1–1440分钟");
      await settings.mutate("qwen-studio", [{ op: "set", path: ["localMfluxIdleMinutes"], value: n }], descriptor.revision);
    } else throw Error("action 应为 status、switch 或 set_idle");
  }
  const config = worker.transportConfig();
  return { mode: worker.mode(), revision: settings.describe({ redactSecrets: true }).find(d => d.ns === "qwen-studio")?.revision, idle_minutes: config.localMfluxIdleMinutes ?? 10,
    health: await worker.health(), remote_configured: Boolean(config.remoteBaseURL), ssh_managed: Boolean(config.remoteSshHost), restart_required: false,
    note: "已配置的本机/远程连接可以实时切换并持久保存，无需重启。只改运行位置或空闲时间，不改图库、预设、模型路径或密钥；不启动模型或 SSH。首次生图时才验证服务器。" };
}
export function registerConnectionTool(ctx: Context, worker: Worker, settings: ConnectionSettings) {
  ctx.tools.register(defineTool({
    name: "qwen_image_connection",
    description: "Read or change the Qwen Image plugin execution location and shared idle timeout LIVE, without restarting DSH or editing configuration files/scripts. Use status first to obtain mode/revision; only on the user's request use switch with mode local/remote, or set_idle with idle_minutes, and pass revision. Reuses already configured paths, API key and SSH alias; preserves all presets/gallery. Busy generation/upload/queue blocks switching. Does not start SSH, load a model, or generate an image. Do not claim connectionMode requires a restart or tell the user to edit files when this tool is available. Never silently switch backends as a fallback.",
    timeoutMs: 120000,
    parameters: {
      action: { type: "string", description: "status (default), switch, or set_idle." },
      mode: { type: "string", description: "switch only: local for this Mac, remote for the already configured server." },
      idle_minutes: { type: "number", description: "set_idle only: 0.1–1440 minutes, shared by local and the Qwen remote gateway." },
      revision: { type: "integer", description: "For writes, use the latest revision returned by status." },
    },
    output: { schema: { type: "object", properties: { result: { type: "string", required: true } }, additionalProperties: false }, render: (_args, value) => [{ type: "text", text: value.result }] },
    async execute(args) { return { result: JSON.stringify(await connectionOperation(worker, settings, args)) }; },
  }));
}
