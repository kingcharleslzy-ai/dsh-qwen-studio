export declare const PROGRESS_KIND = "qwen-studio-image-progress";
interface Event {
    type: string;
    seq: number;
    time?: number;
    data: Record<string, any>;
}
interface Progress {
    callId: string;
    prompt: string;
    seq: number;
    since: number;
    ended?: boolean;
}
export declare function parseProgress(event: Event): Progress | undefined;
export declare const progressDefinition: {
    kind: string;
    target: string;
    match(event: Event): {
        id: string;
        role: string;
    } | null;
    start(_context: unknown, match: {
        event: Event;
    }): Progress | undefined;
    update(context: {
        state?: Progress;
    }, match: {
        event: Event;
    }): Progress | undefined;
    buildViewNode(context: {
        state?: Progress;
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
        data: Progress;
    } | null;
};
export declare function ConversationProgress({ node, sessionId, }: {
    node: {
        data: Progress;
    };
    sessionId?: string;
}): import("react").JSX.Element;
export {};
