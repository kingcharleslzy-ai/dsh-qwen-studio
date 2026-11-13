import type { Resource } from "../resources.js";
export declare function ResourcePicker({ resources, kind, label, selected, onChoose, disabled, }: {
    resources: Resource[];
    kind: "lora" | "source" | "control" | "mask";
    label: string;
    selected: string[];
    onChoose(resource: Resource): void;
    disabled?: boolean;
}): import("react").JSX.Element;
