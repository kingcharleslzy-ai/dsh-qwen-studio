import { type Job } from "../shared.js";
export declare function CreationPreview({ job, history, remote, select, reuse, reference, save, cancel, clear, favorite, }: {
    job: Job | undefined;
    history: Job[];
    remote: boolean;
    select: (id: string) => void;
    reuse: (job: Job) => void;
    reference: (job: Job) => void;
    save: (id: string) => void;
    cancel: (id: string) => void;
    clear: () => void;
    favorite: (job: Job) => void;
}): import("react").JSX.Element;
