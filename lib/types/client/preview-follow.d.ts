import { type Job } from "../shared.js";
export declare function previewCandidate(jobs: Job[], selected: string, dismissed: ReadonlySet<string>, seen: ReadonlySet<string>, since?: number): Job | undefined;
