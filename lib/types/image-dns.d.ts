/** Fake-IP TUN DNS cannot establish whether a destination is public. Resolve only
 * these synthetic answers over HTTPS, then let the importer validate and pin them.
 * This is per-request DNS, never a change to the machine's proxy/DNS settings. */
export declare function imageAddresses(host: string, signal: AbortSignal): Promise<{
    address: string;
    family: number;
}[]>;
