import type { Context } from "@deepseek-ai/cordis";
import { type GenerationArgs } from "./generation-request.js";
import type { Job } from "./shared.js";
import type { Worker } from "./worker.js";
/** Rebuild the original request from a completed job, advancing the seed by one. */
export declare function jobToGenerationArgs(job: Job, stride?: number): GenerationArgs;
export declare function registerRerollTool(ctx: Context, worker: Worker): void;
