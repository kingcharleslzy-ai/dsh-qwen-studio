import { type CreationDraft } from "./client/creation-draft.js";
import { type Resource } from "./resources.js";
import type { EffectiveConfig } from "./resolved-config.js";
type Values = Omit<CreationDraft, "prompt" | "missingResources">;
export interface ResourceRef {
    id?: string;
    kind: Resource["kind"];
    name: string;
    bytes: number;
    fingerprint: string;
}
export interface Preset {
    id: string;
    name: string;
    values: Values;
    resources: Record<string, ResourceRef>;
}
export interface PresetStore {
    schemaVersion: 1;
    revision: number;
    defaultId: string | null;
    items: Preset[];
}
export declare function presetValues(input: unknown): Values;
export declare function capturePreset(config: EffectiveConfig, name: unknown, input: unknown): Promise<Preset>;
export declare function loadPreset(config: EffectiveConfig, preset: Preset): Promise<{
    draft: CreationDraft;
    issues: string[];
}>;
export declare function exportPresets(store: PresetStore, selectedId?: string): {
    format: string;
    schemaVersion: number;
    items: {
        values: Values;
        resources: {
            [k: string]: {
                kind: Resource["kind"];
                name: string;
                bytes: number;
                fingerprint: string;
            };
        };
        id: string;
        name: string;
    }[];
};
export declare function readPresets(dir: string): Promise<PresetStore>;
export declare function mutatePresets(config: EffectiveConfig, data: Record<string, any>): Promise<PresetStore>;
export {};
