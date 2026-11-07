import type { Job } from "../shared.js";
export declare function privacyEnabled(): boolean;
export declare function setPrivacyEnabled(enabled: boolean): void;
export declare function usePrivacyGallery(): boolean;
export declare function defaultGallery(privacy: boolean): "all" | "favorites";
export declare function galleryMatches(job: Job, filter: string, privacy: boolean, query: string): boolean;
