import type { ImageAttachmentRef } from "@deepseek-ai/dsh-attachment";
export declare const RESULT_KIND = "qwen-studio-image-result";
interface Event {
    type: string;
    seq: number;
    data: Record<string, any>;
}
interface Result {
    id: string;
    prompt: string;
    attachment: ImageAttachmentRef;
    seq: number;
}
export declare function parseResult(event: Event): Result | undefined;
export declare const resultDefinition: {
    kind: string;
    target: string;
    match(event: Event): {
        id: string;
        role: string;
    } | null;
    start(_context: unknown, match: {
        event: Event;
    }): Result | undefined;
    update(context: {
        state: Result;
    }): Result;
    buildViewNode(context: {
        state?: Result;
        key: string;
        id: string;
    }): {
        key: string;
        kind: string;
        id: string;
        target: string;
        anchorSeq: number;
        location: {
            kind: string;
        };
        visibility: string;
        data: Result;
    } | null;
};
export declare function ConversationImage({ node }: {
    node: {
        data: Result;
    };
}): import("react").JSX.Element;
export {};
