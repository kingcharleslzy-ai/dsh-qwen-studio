import { RemoteQueue } from "./remote.js";
import type { Config } from "./config.js";
import type { Health } from "./shared.js";
import { RemoteLifecycle } from "./remote-lifecycle.js";
import { type RemoteCapabilities } from "./remote-protocol.js";
export interface ReferenceEditing {
    supported: boolean;
    reason?: string;
    mflux_version?: string;
    verification?: string;
}
export declare class Worker {
    private config;
    readonly remote: RemoteQueue;
    transportConfig(): Config;
    mode(): "local" | "remote";
    private starting;
    private editProbe?;
    referenceEditing(): Promise<ReferenceEditing>;
    private modeGate;
    private serialized;
    switchConnection(mode: "local" | "remote", persist: () => Promise<void>): Promise<void>;
    private settingsKey;
    readonly lifecycle: RemoteLifecycle;
    constructor(config: () => Config);
    managedSSH(): boolean;
    capabilities(): Promise<RemoteCapabilities | null>;
    private configureRemote;
    private unloadRemote;
    dispose(): Promise<void>;
    directory(): string;
    sync(): Promise<void>;
    health(): Promise<Health>;
    ensure(): Promise<void>;
    private start;
    check(): Promise<{
        ok: boolean;
        message: string;
        models?: never;
        python?: never;
        model?: never;
    } | {
        ok: boolean;
        message: string;
        models: string[];
        python?: never;
        model?: never;
    } | {
        ok: boolean;
        message: string;
        python: string;
        model: string;
        models?: never;
    }>;
    private transfers;
    private maintenance;
    private retired;
    withActivity<T>(fn: () => Promise<T>): Promise<T>;
    withMaintenance<T>(fn: () => Promise<T>): Promise<T>;
    post(path: string, data: unknown, start?: boolean): Promise<any>;
    private submit;
}
