import { type Job } from "./shared.js";
export declare const validId: (id: string) => boolean;
export declare function atomicJSON(path: string, value: unknown): Promise<void>;
export declare function restoreGalleryFlags(dir: string): Promise<{
    ok: boolean;
}>;
/** Read only the accepted task; unrelated gallery records cannot delay or break progress. */
export declare function readJob(dir: string, id: string): Promise<Job | undefined>;
/** Incremental gallery index. Terminal records are read once, then only on change.
 * Recursive watches catch external worker writes; periodic reconciliation covers
 * dropped/unsupported watch events. Active tasks are always read afresh. */
export declare class GalleryIndex {
    readonly dir: string;
    private jobs;
    private dirty;
    private watchers;
    private rescan;
    private refreshed;
    private foldersKey;
    private serial;
    readonly metrics: {
        recordReads: number;
        scans: number;
    };
    constructor(dir: string);
    invalidate(): void;
    close(): void;
    read(): Promise<Job[]>;
}
export declare function invalidateGallery(dir: string): void;
export declare function closeGalleryIndexes(): void;
export declare function readJobs(dir: string): Promise<Job[]>;
export type GalleryAction = "favorite" | "archived" | "delete" | "restore" | "purge";
export declare function batchAction(dir: string, ids: string[], action: GalleryAction, value?: boolean): Promise<unknown>;
export declare function setFlag(dir: string, id: string, field: "favorite" | "archived", value: boolean): Promise<unknown>;
export declare function imagePath(dir: string, id: string): Promise<string>;
