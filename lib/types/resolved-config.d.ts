import type { Config } from "./config.js";
export declare function resolveConfig(raw: Config, env?: NodeJS.ProcessEnv, home?: string): {
    localMfluxDirectory: string;
    localMfluxIdleMinutes: number;
    connectionMode: "local" | "remote";
    pythonPath: string;
    modelPath: string;
    hfHome: string;
    loraDirectory: string;
    remoteBaseURL: string;
    remoteModel: string;
    remoteApiKeyConfigured: boolean;
    remoteSshHost: string;
    remoteSshPort: number;
    hfHomeSource: string;
};
export type EffectiveConfig = ReturnType<typeof resolveConfig>;
export declare const loraRoots: (config: EffectiveConfig) => string[];
