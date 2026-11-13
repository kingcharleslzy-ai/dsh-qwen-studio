import type { AssetKind, InputAsset } from "../assets.js";
export declare function uploadAsset(file: File, kind: AssetKind, signal: AbortSignal): Promise<InputAsset>;
export declare function AssetUpload({ kind, label, disabled, maxFiles, onAssets, onError, }: {
    kind: AssetKind;
    label: string;
    disabled?: boolean;
    maxFiles?: number;
    onAssets(assets: InputAsset[]): void;
    onError(message: string): void;
}): import("react").JSX.Element;
