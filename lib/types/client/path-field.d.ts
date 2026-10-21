export declare function pythonInDirectory(path: string): string;
export declare function PathField({ label, name, value, placeholder, kind, onChange, onError }: {
    label: string;
    name: string;
    value: string;
    placeholder: string;
    kind?: 'file' | 'directory' | 'python';
    onChange(value: string): void;
    onError(message: string): void;
}): import("react").JSX.Element;
