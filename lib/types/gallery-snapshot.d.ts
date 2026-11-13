import type { Job } from './shared.js';
/** Bounded revision history supports multiple tabs without sending the full library per step. */
export declare class GallerySnapshots {
    private versions;
    project(jobs: Job[], prior: string | null): {
        jobsRevision: string;
        jobs?: never;
        jobChanges?: never;
        removedJobIds?: never;
    } | {
        jobsRevision: string;
        jobs: Job[];
        jobChanges?: never;
        removedJobIds?: never;
    } | {
        jobsRevision: string;
        jobChanges: Job[];
        removedJobIds: string[];
        jobs?: never;
    };
}
