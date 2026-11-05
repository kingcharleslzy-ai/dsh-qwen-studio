import type { Context } from "@deepseek-ai/cordis";
import type { Worker } from "./worker.js";
/** Recovery never starts inference, submits a new task, or changes gallery flags. */
export declare function registerStatusTool(ctx: Context, worker: Worker): void;
