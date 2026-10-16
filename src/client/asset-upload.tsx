import { useEffect, useRef, useState } from "react";
import { Upload, LoaderCircle, X } from "lucide-react";
import { API } from "../shared.js";
import type { AssetKind, InputAsset } from "../assets.js";
export async function uploadAsset(
  file: File,
  kind: AssetKind,
  signal: AbortSignal,
): Promise<InputAsset> {
  const response = await fetch(
    `${API}/assets-upload?kind=${kind}&name=${encodeURIComponent(file.name)}`,
    {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: file,
      signal,
    },
  );
  let value: any;
  try {
    value = await response.json();
  } catch {
    throw Error(
      response.status === 404
        ? "请重新打开 DSH，加载本机文件导入接口"
        : `文件导入失败 (${response.status})`,
    );
  }
  if (!response.ok)
    throw Error(value.error ?? `文件导入失败 (${response.status})`);
  return value;
}
export function AssetUpload({
  kind,
  label,
  disabled = false,
  maxFiles = 1,
  onAssets,
  onError,
}: {
  kind: AssetKind;
  label: string;
  disabled?: boolean;
  maxFiles?: number;
  onAssets(assets: InputAsset[]): void;
  onError(message: string): void;
}) {
  const input = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController>();
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  useEffect(() => () => controller.current?.abort(), []);
  async function selected(files: File[]) {
    if (!files.length) return;
    if (files.length > maxFiles) {
      onError(`最多还可添加 ${maxFiles} 个文件`);
      return;
    }
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    onError("");
    try {
      const assets: InputAsset[] = [];
      for (const [i, file] of files.entries()) {
        if (file.size > (kind === "lora" ? 2 * 1024 ** 3 : 64 * 1024 ** 2))
          throw Error(
            kind === "lora" ? "LoRA 文件不能超过2GB" : "图片不能超过64MB",
          );
        setProgress(`正在导入 ${i + 1}/${files.length} · ${file.name}`);
        assets.push(await uploadAsset(file, kind, current.signal));
      }
      if (!current.signal.aborted) onAssets(assets);
    } catch (error) {
      if (!current.signal.aborted)
        onError(error instanceof Error ? error.message : String(error));
    } finally {
      if (!current.signal.aborted) {
        setBusy(false);
        setProgress("");
      }
    }
  }
  return (
    <div className="q2-file-upload">
      <input
        ref={input}
        type="file"
        hidden
        tabIndex={-1}
        aria-label={label + "文件"}
        accept={
          kind === "lora"
            ? ".safetensors"
            : ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        }
        multiple={kind === "lora" && maxFiles > 1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void selected(files);
        }}
      />
      <button
        type="button"
        disabled={disabled || busy || maxFiles < 1}
        onClick={() => input.current?.click()}
      >
        {busy ? <LoaderCircle className="q2-spin" /> : <Upload />}
        {busy ? "正在导入…" : label}
      </button>
      {busy && (
        <>
          <span role="status" className="q2-file-progress">
            {progress}
          </span>
          <button
            aria-label="取消文件导入"
            onClick={() => {
              controller.current?.abort();
              setBusy(false);
              setProgress("");
            }}
          >
            <X />
            取消
          </button>
        </>
      )}
    </div>
  );
}
