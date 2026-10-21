/** Execute argv without shell interpolation; cross-spawn handles Windows batch shims. */
export declare function runCommand(command: string, args: string[], env?: Record<string, string>): Promise<string>;
