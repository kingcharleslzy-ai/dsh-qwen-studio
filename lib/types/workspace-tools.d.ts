import type { Context } from "@deepseek-ai/cordis";
import type { Worker } from "./worker.js";
import { type CreationDraft } from "./client/creation-draft.js";
export declare function draftFromSettings(p: Record<string, any>): CreationDraft;
export declare function settingsFromDraft(draft: CreationDraft): {
    [k: string]: string | number | string[] | number[] | null | undefined;
};
export declare function workspacePreset(worker: Worker, args: Record<string, any>): Promise<{
    format: string;
    schemaVersion: number;
    items: {
        values: {
            loras: import("./client/creation-draft.js").LoraChoice[];
            steps: number;
            guidance: number;
            scheduler: "linear" | "flow_match_euler_discrete" | "seedvr2_euler";
            seed: string;
            maskSourceId: string;
            sourceId: string;
            maskId: string;
            controlId: string;
            negativePrompt: string;
            size: string;
            sourceName: string;
            referenceMode: "variation" | "edit";
            changeStrength: number;
            controlName: string;
            controlEnabled: boolean;
            controlStrength: number;
            maskName: string;
            maskEnabled: boolean;
            maskSourceName: string;
        };
        resources: {
            [k: string]: {
                kind: import("./resources.js").Resource["kind"];
                name: string;
                bytes: number;
                fingerprint: string;
            };
        };
        id: string;
        name: string;
    }[];
} | {
    id: string;
    name: string;
    revision: number;
    mode: "local" | "remote";
    reference_edit: import("./worker.js").ReferenceEditing;
    remote_capabilities: import("./remote-protocol.js").RemoteCapabilities | null;
    settings: {
        [k: string]: string | number | string[] | number[] | null | undefined;
    } | null;
    issues: string[];
    note: string;
    default_id?: never;
    presets?: never;
} | {
    revision: number;
    default_id: string | null;
    presets: {
        id: string;
        name: string;
    }[];
    note: string;
    id?: never;
    name?: never;
    mode?: never;
    reference_edit?: never;
    remote_capabilities?: never;
    settings?: never;
    issues?: never;
}>;
export declare function registerWorkspaceTools(ctx: Context, worker: Worker): void;
