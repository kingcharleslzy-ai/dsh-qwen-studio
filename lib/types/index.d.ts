import type { Context } from "@deepseek-ai/cordis";
import { Config } from "./config.js";
export { Config };
export declare const name = "qwen-studio";
export declare const inject: string[];
export declare function apply(ctx: Context, config?: Config): void;
