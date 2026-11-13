export interface ImageScore {
    metrics: Record<string, number>;
    flags: string[];
}
export declare function scoreImage(directory: string, pythonPath: string, id: string): Promise<ImageScore>;
