import type { ImageAttachmentRef } from "@deepseek-ai/dsh-attachment";
import { type IncomingMessage } from "node:http";
import { type InputAsset } from "./assets.js";
export declare function isPublicImageAddress(address: string): boolean;
/** Validate every hop and pin DNS to the checked address; never forward cookies or auth. */
export declare function openPublicImage(input: string, signal: AbortSignal): Promise<{
    response: IncomingMessage;
    name: string;
}>;
export interface ImageImportArgs {
    kind?: string;
    name?: string;
    url?: string;
    path?: string;
    attachment?: ImageAttachmentRef;
}
interface ImportOptions {
    directory: string;
    python: string;
    signal?: AbortSignal;
    readAttachment: (ref: ImageAttachmentRef, signal: AbortSignal) => Promise<{
        data: Uint8Array;
    }>;
}
/** Import into the same managed library as the file picker, without starting inference/SSH. */
export declare function importImage(args: ImageImportArgs, options: ImportOptions): Promise<InputAsset>;
export {};
