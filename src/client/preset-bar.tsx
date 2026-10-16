import { useEffect, useRef, useState } from "react";
import type { PresetStore } from "../presets.js";
import { draftDefaults, type CreationDraft } from "./creation-draft.js";
import { request } from "./api.js";
const KEY = "qwen-studio-active-preset";
export function draftSignature(draft: CreationDraft) {
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(draftDefaults)
        .filter((k) => k !== "prompt")
        .map((k) => [
          k,
          k === "loras"
            ? draft.loras.map(({ missing: _, ...l }) => ({
                ...l,
                enabled: l.enabled !== false,
              }))
            : draft[k as keyof CreationDraft],
        ]),
    ),
  );
}
export async function defaultDraft(): Promise<Partial<CreationDraft>> {
  const store = await request<PresetStore>("presets");
  if (!store.defaultId) return { ...draftDefaults, missingResources: {} };
  const result = await request<{ draft: CreationDraft; issues: string[] }>(
    "presets",
    { action: "load", id: store.defaultId },
  );
  return result.draft;
}
export function PresetBar({
  draft,
  update,
  onError,
}: {
  draft: CreationDraft;
  update(value: Partial<CreationDraft>): void;
  onError(message: string): void;
}) {
  const [store, setStore] = useState<PresetStore>(),
    [active, setActive] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem(KEY) || "{}") as {
          id?: string;
          signature?: string;
        };
      } catch {
        return {} as { id?: string; signature?: string };
      }
    }),
    [name, setName] = useState("我的预设"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [confirm, setConfirm] = useState(false),
    [undo, setUndo] = useState(false),
    [copy, setCopy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    request<PresetStore>("presets")
      .then((s) => {
        if (alive) setStore(s);
      })
      .catch((e) => onError(e.message));
    return () => {
      alive = false;
    };
  }, []);
  const selected = store?.items.find((p) => p.id === active.id),
    modified = Boolean(selected && active.signature !== draftSignature(draft));
  const remember = (id: string, values: CreationDraft) => {
    const v = { id, signature: draftSignature(values) };
    setActive(v);
    localStorage.setItem(KEY, JSON.stringify(v));
  };
  async function load(id: string) {
    setBusy(true);
    onError("");
    try {
      const result = await request<{ draft: CreationDraft; issues: string[] }>(
        "presets",
        { action: "load", id },
      );
      const { prompt: _, ...values } = result.draft;
      update(values);
      remember(id, result.draft);
      setNotice(
        result.issues.length
          ? result.issues.join("；")
          : "已加载，画面描述保持不变",
      );
      setCopy(false);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function mutate(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    onError("");
    try {
      const next = await request<PresetStore>("presets", {
        action,
        revision: store?.revision,
        id: selected?.id,
        ...extra,
      });
      setStore(next);
      setNotice("预设已保存到本机");
      setUndo(action === "delete");
      setConfirm(false);
      if (action === "save") {
        const p =
          next.items.find((p) => p.id === selected?.id && extra.id !== null) ||
          next.items.at(-1);
        if (p) remember(p.id, draft);
        setCopy(false);
      }
      if (action === "delete") {
        setActive({});
        localStorage.removeItem(KEY);
      }
    } catch (e) {
      onError((e as Error).message);
      try {
        setStore(await request<PresetStore>("presets"));
      } catch {}
    } finally {
      setBusy(false);
    }
  }
  async function save(asNew = false) {
    const { prompt: _, missingResources: __, ...values } = draft;
    await mutate("save", {
      name: asNew || !selected ? name : selected.name,
      values,
      id: asNew ? null : (selected?.id ?? null),
    });
  }
  async function exportJSON() {
    setBusy(true);
    try {
      const data = await request("presets", {
        action: "export",
        ...(selected ? { id: selected.id } : {}),
      });
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "qwen-presets.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="q2-preset-library" aria-label="整套创作预设">
      <div className="q2-preset-row">
        <label>
          预设
          <select
            aria-label="选择创作预设"
            value={selected?.id ?? ""}
            disabled={busy || !store}
            onChange={(e) => {
              if (e.target.value) void load(e.target.value);
              else {
                setActive({});
                localStorage.removeItem(KEY);
              }
            }}
          >
            <option value="">自定义参数</option>
            {store?.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.id === store.defaultId ? " · 默认" : ""}
              </option>
            ))}
          </select>
        </label>
        <span className="q2-muted">
          {modified ? "已修改" : selected ? "已加载" : "按当前参数创作"}
        </span>
        {selected && (
          <button disabled={busy} onClick={() => void load(selected.id)}>
            重新加载
          </button>
        )}
        <button
          disabled={busy || !store}
          onClick={() => {
            if (selected) void save();
            else {
              setCopy(true);
              setName("我的预设");
            }
          }}
        >
          保存预设
        </button>
        <button
          disabled={busy || !store}
          onClick={() => {
            setCopy(true);
            setName(selected ? selected.name + " 副本" : "我的预设");
          }}
        >
          另存为
        </button>
        <details>
          <summary>管理</summary>
          <div className="q2-preset-manage">
            <label>
              预设名称
              <input
                aria-label="预设新名称"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button
              disabled={!selected || busy}
              onClick={() => void mutate("rename", { name })}
            >
              重命名
            </button>
            <button
              disabled={!selected || busy}
              onClick={() =>
                void mutate("default", {
                  id: store?.defaultId === selected?.id ? null : selected?.id,
                })
              }
            >
              {store?.defaultId === selected?.id ? "取消默认" : "设为默认"}
            </button>
            <button
              disabled={!selected || busy}
              onClick={() => setConfirm(true)}
            >
              删除预设
            </button>
            <button disabled={busy || !store} onClick={() => void exportJSON()}>
              {selected ? "导出当前" : "导出全部"} JSON
            </button>
            <button
              disabled={busy || !store}
              onClick={() => input.current?.click()}
            >
              导入 JSON
            </button>
            {undo && (
              <button disabled={busy} onClick={() => void mutate("restore")}>
                撤销删除
              </button>
            )}
          </div>
        </details>
      </div>
      {copy && (
        <div className="q2-preset-row">
          <label>
            新预设名称
            <input
              aria-label="新预设名称"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            disabled={busy || !name.trim()}
            onClick={() => void save(true)}
          >
            保存新预设
          </button>
          <button onClick={() => setCopy(false)}>取消另存</button>
        </div>
      )}
      {confirm && (
        <div className="q2-preset-row" role="alert">
          <span>删除「{selected?.name}」？不会删除图片或权重。</span>
          <button disabled={busy} onClick={() => void mutate("delete")}>
            确认删除预设
          </button>
          <button onClick={() => setConfirm(false)}>保留预设</button>
        </div>
      )}
      {notice && (
        <p role="status" className="q2-muted">
          {notice}
        </p>
      )}
      {draft.missingResources &&
        Object.keys(draft.missingResources).length > 0 && (
          <div className="q2-effect-note" role="alert">
            失效图片：{Object.values(draft.missingResources).join("、")}
            。请重新选择；或
            <button
              onClick={() =>
                update({
                  sourceId: "",
                  maskSourceId: "",
                  maskId: "",
                  controlId: "",
                  controlEnabled: false,
                  maskEnabled: false,
                  missingResources: {},
                })
              }
            >
              移除失效图片引用
            </button>
          </div>
        )}
      <input
        hidden
        type="file"
        accept=".json,application/json"
        ref={input}
        aria-label="导入预设 JSON 文件"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 1024 * 1024) {
            onError("预设文件不能超过1MB");
            return;
          }
          void f
            .text()
            .then((text) => mutate("import", { document: JSON.parse(text) }))
            .catch((error) => onError(error.message));
        }}
      />
    </section>
  );
}
