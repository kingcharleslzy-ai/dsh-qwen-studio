import { type EffectiveConfig } from "./resolved-config.js";
export interface Resource {
    id: string;
    kind: "lora" | "source" | "control" | "mask" | "image";
    name: string;
    bytes: number;
    origin: "imported" | "default" | "custom" | "gallery";
    path?: string;
    fingerprint?: string;
}
export interface ResourceCatalog {
    items: Resource[];
    warnings: string[];
}
export declare function fingerprint(path: string): Promise<string>;
export declare function listResources(config: EffectiveConfig): Promise<ResourceCatalog>;
export declare function resourceFingerprint(config: EffectiveConfig, resource: Resource): Promise<string>;
