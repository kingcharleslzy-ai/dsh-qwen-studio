export declare const REPO = "kingcharleslzy-ai/dsh-qwen-studio";
export declare const PACKAGE = "dsh-qwen-studio";
export interface UpdatePreferences {
    autoCheck: boolean;
    autoInstall: boolean;
    intervalHours: number;
}
export interface UpdateState {
    checkedAt?: string;
    availableVersion?: string;
    hasUpdate?: boolean;
    error?: string;
    deferred?: string;
    pendingVersion?: string;
    restartRequired?: boolean;
    backupId?: string;
}
export interface Release {
    version: string;
    url: string;
    sha256: string;
}
export declare const defaults: UpdatePreferences;
export declare function validatePreferences(value: unknown): UpdatePreferences;
export declare function newer(a: string, b: string): boolean;
export declare function latestRelease(fetcher?: typeof fetch): Promise<Release>;
/** Validate archive entries before extraction, rejecting links and runtime data. */
export declare function inspectPackage(archive: Buffer, expectedVersion: string): Map<string, Buffer<ArrayBufferLike>>;
export declare function installedPaths(packageRoot?: string): {
    packageRoot: string;
    profile: string;
    state: string;
};
export declare function cliCommand(): {
    command: string;
    args: string[];
};
export declare class PackageInstaller {
    private run;
    readonly paths: ReturnType<typeof installedPaths>;
    constructor(packageRoot?: string, run?: (command: string, args: string[], env?: Record<string, string>) => Promise<string | void>);
    private invoke;
    backups(): Promise<{
        version?: string;
        id: string;
    }[]>;
    private locked;
    install(release: Release, fetcher?: typeof fetch): Promise<{
        backupId: string;
        pendingVersion: string;
        restartRequired: boolean;
    }>;
    private installUnlocked;
    rollback(id: string): Promise<{
        pendingVersion: string;
        restartRequired: boolean;
        backupId: string;
    }>;
    private rollbackUnlocked;
}
export declare class UpdateController {
    readonly root: string;
    readonly runningVersion: string;
    private guard;
    private installer;
    private latest;
    private state;
    private prefs;
    private timer;
    private inflight;
    private stopped;
    private cachedRelease;
    constructor(root: string, runningVersion: string, guard: <T>(fn: () => Promise<T>) => Promise<T>, installer: Pick<PackageInstaller, 'install' | 'backups' | 'rollback'>, latest?: typeof latestRelease);
    init(): Promise<{
        runningVersion: string;
        checkedAt?: string;
        availableVersion?: string;
        hasUpdate?: boolean;
        error?: string;
        deferred?: string;
        pendingVersion?: string;
        restartRequired?: boolean;
        backupId?: string;
        preferences: {
            autoCheck: boolean;
            autoInstall: boolean;
            intervalHours: number;
        };
    }>;
    snapshot(): {
        runningVersion: string;
        checkedAt?: string;
        availableVersion?: string;
        hasUpdate?: boolean;
        error?: string;
        deferred?: string;
        pendingVersion?: string;
        restartRequired?: boolean;
        backupId?: string;
        preferences: {
            autoCheck: boolean;
            autoInstall: boolean;
            intervalHours: number;
        };
    };
    private record;
    private schedule;
    stop(): void;
    preferences(patch: Partial<UpdatePreferences>): Promise<{
        runningVersion: string;
        checkedAt?: string;
        availableVersion?: string;
        hasUpdate?: boolean;
        error?: string;
        deferred?: string;
        pendingVersion?: string;
        restartRequired?: boolean;
        backupId?: string;
        preferences: {
            autoCheck: boolean;
            autoInstall: boolean;
            intervalHours: number;
        };
    }>;
    check(automatic?: boolean): Promise<unknown>;
    private installRelease;
    install(): Promise<unknown>;
    backups(): Promise<{
        version?: string;
        id: string;
    }[]>;
    rollback(id: string): Promise<unknown>;
}
