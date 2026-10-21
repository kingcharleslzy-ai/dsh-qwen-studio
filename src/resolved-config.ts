import { homedir } from "node:os";
import { resolve, join } from "node:path";
import type { Config } from "./config.js";
export function resolveConfig(
  raw: Config,
  env: NodeJS.ProcessEnv = process.env,
  home = homedir(),
) {
  const path = (value: string) =>
    resolve(/^~[\\/]/.test(value) ? join(home, value.slice(2)) : value);
  const directory = path(
    raw.localMfluxDirectory || join(home, ".dsh/qwen-studio"),
  );
  const minutes = raw.localMfluxIdleMinutes ?? 10;
  if (!Number.isFinite(minutes) || minutes < 0.1 || minutes > 1440)
    throw Error("空闲时间应为0.1–1440分钟");
  const hfHome = path(
    raw.hfHome ||
      env.HF_HOME ||
      join(env.XDG_CACHE_HOME || join(home, ".cache"), "huggingface"),
  );
  return {
    localMfluxDirectory: directory,
    localMfluxIdleMinutes: minutes,
    connectionMode: raw.connectionMode ?? "local",
    pythonPath: path(raw.pythonPath || join(directory, process.platform === "win32" ? "venv/Scripts/python.exe" : "venv/bin/python")),
    modelPath: path(raw.modelPath || join(directory, "models/qwen-image-2.1")),
    hfHome,
    loraDirectory: path(raw.loraDirectory || join(directory, "loras")),
    remoteBaseURL: raw.remoteBaseURL || "",
    remoteModel: raw.remoteModel || "qwen-image",
    remoteApiKeyConfigured: Boolean(raw.remoteApiKey),
    remoteSshHost: raw.remoteSshHost || "",
    remoteSshPort: raw.remoteSshPort ?? 19488,
    hfHomeSource: raw.hfHome
      ? "configured"
      : env.HF_HOME || env.XDG_CACHE_HOME
        ? "environment"
        : "default",
  };
}
export type EffectiveConfig = ReturnType<typeof resolveConfig>;
export const loraRoots = (config: EffectiveConfig) => [
  ...new Set([
    join(config.localMfluxDirectory, "assets/loras"),
    join(config.localMfluxDirectory, "loras"),
    config.loraDirectory,
  ]),
];
