import type { IncomingMessage } from "node:http";
export type AssetKind = "source" | "control" | "mask" | "lora";
export interface InputAsset {
    id: string;
    name: string;
    kind: AssetKind;
    bytes: number;
    width?: number;
    height?: number;
    path?: string;
}
export declare function inputImagePath(dir: string, id: string): Promise<string | undefined>;
export declare function validateLora(path: string, bytes: number): Promise<void>;
/** Own selected bytes. Never trust a client-provided local filesystem path. */
export declare function importAsset(dir: string, python: string, kind: string, name: string, input: AsyncIterable<Uint8Array>, signal?: AbortSignal): Promise<InputAsset>;
export declare function receiveAsset(req: IncomingMessage, dir: string, python: string): Promise<InputAsset>;
