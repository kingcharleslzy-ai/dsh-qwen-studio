export const API = "/api/qwen-studio";
export interface Job {
  negative_prompt?: string;
  guidance?: number;
  guidance_auto_raised?: boolean;
  scheduler?: "linear" | "flow_match_euler_discrete" | "seedvr2_euler";
  source_image_id?: string;
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
  runtime?: { pythonPath: string; modelPath: string; hfHome: string };
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
  remoteAdvanced?: boolean;
  jobs: Job[];
  health: Health;
  directory: string;
  idleMinutes: number;
  mode: "local" | "remote";
  configured: boolean;
}
export const active = (job: Job) =>
  ["queued", "uploading", "loading", "running", "saving", "cancelling"].includes(job.status);
export const statusLabel = (s: string) =>
  ({
    queued: "排队中",
    uploading: "同步资源",
    loading: "加载模型",
    running: "生成中",
    saving: "保存图片",
    complete: "已完成",
    failed: "失败",
    cancelling: "正在取消",
    cancelled: "已取消",
  })[s] ?? s;
