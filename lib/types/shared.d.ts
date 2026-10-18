export declare const API = "/api/qwen-studio";
export interface Job {
    negative_prompt?: string;
    guidance?: number;
    guidance_auto_raised?: boolean;
    scheduler?: "linear" | "flow_match_euler_discrete" | "seedvr2_euler";
    source_image_id?: string;
    reference_mode?: "variation" | "edit";
    controlnet_image_id?: string;
    controlnet_strength?: number;
    mask_image_id?: string;
    lora_paths?: string[];
    lora_scales?: number[];
    lora_names?: string[];
    change_strength?: number;
    sampling_steps?: number;
    progress_supported?: boolean;
    phase?: string;
    source?: "local" | "remote";
    deleted?: boolean;
    worker_pid?: number;
    id: string;
    prompt: string;
    status: string;
    width: number;
    height: number;
    steps: number;
    step?: number;
    seed: number;
    started_at: number;
    elapsed_seconds?: number;
    error?: string;
    favorite?: boolean;
    archived?: boolean;
}
export interface Health {
    ssh_status?: "connected" | "disconnected";
    connection_error?: string;
    runtime?: {
        pythonPath: string;
        modelPath: string;
        hfHome: string;
    };
    status: string;
    version?: number;
    busy?: boolean;
    loaded?: boolean;
    phase?: string;
    current_id?: string;
    idle_remaining_seconds?: number;
    closing?: boolean;
}
export interface Snapshot {
    apiVersion?: number;
    jobsRevision?: string;
    remoteAdvanced?: boolean;
    referenceEditSupported?: boolean;
    jobs: Job[];
    health: Health;
    directory: string;
    idleMinutes: number;
    mode: "local" | "remote";
    configured: boolean;
}
export declare const active: (job: Job) => boolean;
export declare const statusLabel: (s: string) => string;
