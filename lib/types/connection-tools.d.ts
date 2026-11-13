import type { Context } from "@deepseek-ai/cordis";
import type { Worker } from "./worker.js";
export interface ConnectionSettings {
    describe(options: {
        redactSecrets: true;
    }): {
        ns: string;
        revision: number;
    }[];
    mutate(ns: string, ops: {
        op: "set";
        path: string[];
        value: unknown;
    }[], revision: number): Promise<void>;
}
export declare function connectionOperation(worker: Worker, settings: ConnectionSettings, args: {
    action?: string;
    mode?: string;
    idle_minutes?: number;
    revision?: number;
}): Promise<{
    mode: "local" | "remote";
    revision: number | undefined;
    idle_minutes: number;
    health: import("./shared.js").Health;
    remote_configured: boolean;
    ssh_managed: boolean;
    restart_required: boolean;
    note: string;
}>;
export declare function registerConnectionTool(ctx: Context, worker: Worker, settings: ConnectionSettings): void;
