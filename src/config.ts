import z from "@deepseek-ai/schemastery";
export interface Config {
  localMfluxDirectory?: string;
  localMfluxIdleMinutes?: number;
  connectionMode?: "local" | "remote";
  pythonPath?: string;
  modelPath?: string;
  hfHome?: string;
  remoteBaseURL?: string;
  remoteModel?: string;
  remoteApiKey?: string;
}
export const Config = z.object({
  localMfluxDirectory: z.string().default("").volatile(),
  localMfluxIdleMinutes: z.number().default(10).volatile(),
  connectionMode: z.union(["local", "remote"]).default("local").volatile(),
  pythonPath: z.string().default("").volatile(),
  modelPath: z.string().default("").volatile(),
  hfHome: z.string().default("").volatile(),
  remoteBaseURL: z.string().default("").volatile(),
  remoteModel: z.string().default("qwen-image").volatile(),
  remoteApiKey: z.string().default("").role("secret").volatile(),
});
