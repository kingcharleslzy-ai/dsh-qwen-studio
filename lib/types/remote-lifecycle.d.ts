import type { Config } from "./config.js";
export declare function sshOptions(config: Config): {
    host: string;
    port: number;
    remotePort: number;
} | null;
export interface Tunnel {
    connected: boolean;
    connect(config: Config): Promise<void>;
    disconnect(): Promise<void>;
}
export declare class SshTunnel implements Tunnel {
    private child;
    private exitHandler;
    constructor();
    get connected(): boolean;
    connect(config: Config): Promise<void>;
    disconnect(): Promise<void>;
    dispose(): void;
}
export interface LifecycleIO {
    configure(config: Config, seconds: number): Promise<void>;
    unload(config: Config): Promise<void>;
}
/** A lease covers admission, upload, queueing, sampling and saving, not just POST. */
export declare class RemoteLifecycle {
    private current;
    readonly tunnel: Tunnel;
    private io;
    private now;
    private gate;
    private active;
    private last;
    private config?;
    private appliedSeconds;
    private timer;
    private sweeping;
    private disposed;
    error: string;
    constructor(current: () => Config, tunnel: Tunnel, io: LifecycleIO, now?: () => number);
    private serial;
    get connected(): boolean;
    get remaining(): number | undefined;
    private seconds;
    private configure;
    acquire(config: Config): Promise<() => void>;
    private close;
    sweep(): Promise<void>;
    unload(): Promise<void>;
    reconnect(config: Config): Promise<void>;
    dispose(): Promise<void>;
}
