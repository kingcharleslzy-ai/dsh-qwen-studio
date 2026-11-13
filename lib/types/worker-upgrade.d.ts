import type { Health } from "./shared.js";
/** Release only a known idle worker; never interrupt another session's generation. */
export declare function upgradeIdleWorker(health: Health, unload: () => Promise<unknown>, readHealth: () => Promise<Health>, pause?: (ms: number) => Promise<void>): Promise<Health>;
