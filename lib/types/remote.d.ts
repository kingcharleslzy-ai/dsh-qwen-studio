import type { Config } from "./config.js";
import { type RemoteCapabilities } from "./remote-protocol.js";
export declare function remoteURL(config: Config): string;
export declare function headers(config: Config): {
    authorization?: string;
    "content-type": string;
};
export declare class RemoteQueue {
    private disposed;
    private admission;
    private tail;
    private pending;
    private configs;
    private capabilityCache;
    capabilities(config: Config): Promise<RemoteCapabilities | null>;
    submit(dir: string, config: Config, data: Record<string, unknown>, settled?: () => void, reconnect?: () => Promise<void>): Promise<any>;
    private admit;
    private run;
    cancel(id: string): {
        ok: boolean;
    };
    get size(): number;
    dispose(): Promise<void>;
}
