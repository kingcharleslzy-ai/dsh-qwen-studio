import type { Context } from "@deepseek-ai/cordis";
import { type Job } from "./shared.js";
import type { Worker } from "./worker.js";
export interface GalleryQuery {
    query?: string;
    seed?: number;
    status?: string;
    favorite?: boolean;
    archived?: boolean;
    sourceImageId?: string;
    since?: number;
    until?: number;
    includeDeleted?: boolean;
}
/** Pure filter shared by the gallery tool and tests. `started_at` is in seconds. */
export declare function selectJobs(jobs: Job[], query: GalleryQuery): Job[];
export declare function registerGalleryTools(ctx: Context, worker: Worker): void;
