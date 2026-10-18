import type { Config } from "../config.js";
type Op = {
    op: "set" | "unset";
    path: string[];
    value?: unknown;
};
export interface Scope {
    getSnapshot(): {
        value?: Config;
        user?: unknown;
        base?: unknown;
        revision?: number;
        writable?: boolean;
    };
    subscribe(fn: () => void): () => void;
    set(key: string, value: unknown): Promise<boolean | void>;
    mutate(ops: Op[], revision?: number): Promise<boolean>;
}
export declare function Settings({ scope }: {
    scope?: Scope;
}): import("react").JSX.Element;
export {};
