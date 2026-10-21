import { type CreationDraft } from "./creation-draft.js";
export declare function AdvancedSettings({ draft, update, remote, nativeEdit, ready, close, }: {
    draft: CreationDraft;
    update(value: Partial<CreationDraft>): void;
    remote: boolean;
    nativeEdit?: boolean;
    ready: boolean;
    close(): void;
}): import("react").JSX.Element;
