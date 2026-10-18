import type { Config } from "./config.js";
export interface RemoteCapabilities {
    protocol: "dsh-qwen";
    version: 1;
    features: string[];
    schedulers: string[];
    verification?: "on_generation";
}
export declare const requiredFeatures: string[];
export declare function responseJSON(response: Response): Promise<Record<string, any>>;
export declare function advancedParameters(data: Record<string, any>, capabilities: RemoteCapabilities): Record<string, any>;
export declare function runExtended({ base, headers, dir, config, job, signal, patch, accepted, reconnect }: {
    base: string;
    headers: Record<string, string>;
    dir: string;
    config: Config;
    job: Record<string, any>;
    signal: AbortSignal;
    patch(value: object): Promise<void>;
    accepted(): void;
    reconnect?: (() => Promise<void>) | undefined;
}): Promise<Buffer<ArrayBuffer>>;
