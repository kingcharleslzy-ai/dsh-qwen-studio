import { type Snapshot } from "../shared.js";
export declare class APIError extends Error {
    status: number;
    constructor(message: string, status: number);
}
export declare function request<T>(path: string, data?: unknown): Promise<T>;
export declare const imageURL: (id: string) => string;
export declare function download(id: string): Promise<void>;
export declare let lastSnapshot: Snapshot | undefined;
export declare function cache(snapshot: Snapshot): void;
/** Unchanged gallery responses contain only health/capabilities and a revision. */
export declare function pollSnapshot(previous?: Snapshot): Promise<Snapshot>;
