import { type CreationDraft } from "./creation-draft.js";
export declare function draftSignature(draft: CreationDraft): string;
export declare function defaultDraft(): Promise<Partial<CreationDraft>>;
export declare function PresetBar({ draft, update, onError, }: {
    draft: CreationDraft;
    update(value: Partial<CreationDraft>): void;
    onError(message: string): void;
}): import("react").JSX.Element;
