import { useState } from "react";
import type { Resource } from "../resources.js";
import { imageURL } from "./api.js";
export function ResourcePicker({
  resources,
  kind,
  label,
  selected,
  onChoose,
  disabled = false,
}: {
  resources: Resource[];
  kind: "lora" | "source" | "control" | "mask";
  label: string;
  selected: string[];
  onChoose(resource: Resource): void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false);
  const items = resources.filter(
    (r) =>
      (kind === "lora" ? r.kind === "lora" : r.kind !== "lora") &&
      r.name.toLowerCase().includes(query.toLowerCase()),
  );
  const origin = {
    imported: "已导入",
    default: "默认文件夹",
    custom: "自定义文件夹",
    gallery: "图库作品",
  };
  return (
    <details
      className="q2-resource-picker"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>{label} · 从资源库选择</summary>
      {open && (
        <>
          <input
            aria-label={`搜索${label}`}
            placeholder="搜索文件名称"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="q2-resource-list" aria-label={`${label}可选资源`}>
            {items.map((r) => (
              <button
                type="button"
                disabled={disabled}
                aria-pressed={selected.includes(r.path ?? r.id)}
                key={r.id}
                onClick={() => onChoose(r)}
              >
                {r.kind !== "lora" && (
                  <img src={imageURL(r.id)} alt="" loading="lazy" />
                )}
                <span>
                  <strong>{r.name}</strong>
                  <small>
                    {origin[r.origin]} · {(r.bytes / 1024 / 1024).toFixed(1)} MB
                  </small>
                </span>
                <span>
                  {selected.includes(r.path ?? r.id) ? "已选" : "选择"}
                </span>
              </button>
            ))}
            {!items.length && (
              <p className="q2-muted">没有可用资源。可导入文件后刷新。</p>
            )}
          </div>
        </>
      )}
    </details>
  );
}
