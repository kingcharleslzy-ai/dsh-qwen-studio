import z from "@deepseek-ai/schemastery";
export interface Config {
    localMfluxDirectory?: string;
    localMfluxIdleMinutes?: number;
    connectionMode?: "local" | "remote";
    pythonPath?: string;
    modelPath?: string;
    hfHome?: string;
    loraDirectory?: string;
    remoteBaseURL?: string;
    remoteModel?: string;
    remoteApiKey?: string;
    remoteSshHost?: string;
    remoteSshPort?: number;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    localMfluxDirectory: z<string, string, "volatile-defined">;
    localMfluxIdleMinutes: z<number, number, "volatile-defined">;
    connectionMode: z<"local" | "remote", "local" | "remote", "volatile-defined">;
    pythonPath: z<string, string, "volatile-defined">;
    modelPath: z<string, string, "volatile-defined">;
    hfHome: z<string, string, "volatile-defined">;
    loraDirectory: z<string, string, "volatile-defined">;
    remoteBaseURL: z<string, string, "volatile-defined">;
    remoteModel: z<string, string, "volatile-defined">;
    remoteApiKey: z<string, string, "volatile-defined">;
    remoteSshHost: z<string, string, "volatile-defined">;
    remoteSshPort: z<number, number, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    localMfluxDirectory: z<string, string, "volatile-defined">;
    localMfluxIdleMinutes: z<number, number, "volatile-defined">;
    connectionMode: z<"local" | "remote", "local" | "remote", "volatile-defined">;
    pythonPath: z<string, string, "volatile-defined">;
    modelPath: z<string, string, "volatile-defined">;
    hfHome: z<string, string, "volatile-defined">;
    loraDirectory: z<string, string, "volatile-defined">;
    remoteBaseURL: z<string, string, "volatile-defined">;
    remoteModel: z<string, string, "volatile-defined">;
    remoteApiKey: z<string, string, "volatile-defined">;
    remoteSshHost: z<string, string, "volatile-defined">;
    remoteSshPort: z<number, number, "volatile-defined">;
}>>, "plain">;
