export declare function recordInvocation(dir: string, callId: string, prompt: string, id: string, error?: string, sessionId?: string): Promise<void>;
export declare function invocationProgress(dir: string, callId: string, prompt: string, since?: number, sessionId?: string): Promise<{
    status: string;
    job?: never;
    error?: never;
} | {
    status: string;
    job: import("./shared.js").Job;
    error?: never;
} | {
    status: string;
    error: string;
    job?: never;
}>;
