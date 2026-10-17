import { useEffect, useRef, useState } from "react";
import type { Config } from "../config.js";
import type { EffectiveConfig } from "../resolved-config.js";
import type { Health } from "../shared.js";
import { STYLE } from "./style.js";
import { ParameterHelp } from "./parameter-help.js";
import { PathField } from "./path-field.js";
import { request } from "./api.js";
import { usePrivacyGallery, setPrivacyEnabled } from "./gallery-preferences.js";
type Op = { op: "set" | "unset"; path: string[]; value?: unknown };
export interface Scope {
  getSnapshot(): {
    value?: Config;
    user?: unknown;
    base?: unknown;
    revision?: number;
    writable?: boolean;
  };
  subscribe(fn: () => void): () => void;
  set(key: string, value: unknown): Promise<boolean | void>;
  mutate(ops: Op[], revision?: number): Promise<boolean>;
}
const rawDefaults: Config = {
  localMfluxDirectory: "",
  localMfluxIdleMinutes: 10,
  connectionMode: "local",
  pythonPath: "",
  modelPath: "",
  hfHome: "",
  loraDirectory: "",
  remoteBaseURL: "",
  remoteModel: "qwen-image",
  remoteApiKey: "",
  remoteSshHost: "",
  remoteSshPort: 19488,
};
export function Settings({ scope }: { scope?: Scope }) {
  const privacy = usePrivacyGallery(),
    [snapshot, setSnapshot] = useState(() => scope?.getSnapshot()),
    [value, setValue] = useState<Config>(
      () => scope?.getSnapshot().value ?? {},
    ),
    [dirty, setDirty] = useState<
      Partial<Record<keyof Config, "set" | "unset">>
    >({}),
    [effective, setEffective] = useState<EffectiveConfig>(),
    [health, setHealth] = useState<Health>(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const editingRevision = useRef<number | undefined>(undefined);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(
    () =>
      scope?.subscribe(() => {
        const next = scope.getSnapshot();
        setSnapshot(next);
        setValue((old) => ({
          ...next.value,
          ...Object.fromEntries(
            Object.keys(dirtyRef.current).map((k) => [
              k,
              old[k as keyof Config],
            ]),
          ),
        }));
      }),
    [scope],
  );
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      const { remoteApiKey: _, ...config } = value;
      request<{ effective: EffectiveConfig; health: Health }>("settings", {
        config,
      })
        .then((r) => {
          if (alive) {
            setEffective(r.effective);
            setHealth(r.health);
          }
        })
        .catch((e) => {
          if (alive) setMessage(e.message);
        });
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [value]);
  const change = (key: keyof Config, v: unknown) => {
    if (!Object.keys(dirtyRef.current).length)
      editingRevision.current = snapshot?.revision;
    setValue((old) => ({ ...old, [key]: v }));
    setDirty((old) => ({ ...old, [key]: "set" }));
  };
  const reset = (key: keyof Config) => {
    if (!Object.keys(dirtyRef.current).length)
      editingRevision.current = snapshot?.revision;
    const base = snapshot?.base as Config | undefined;
    setValue((old) => ({ ...old, [key]: base?.[key] ?? rawDefaults[key] }));
    setDirty((old) => ({ ...old, [key]: "unset" }));
  };
  function source(key: keyof Config) {
    if (dirty[key] === "set") return "未保存";
    const inherited =
      dirty[key] === "unset" ||
      !Object.prototype.hasOwnProperty.call(snapshot?.user ?? {}, key);
    if (key === "remoteApiKey")
      return dirty[key] === "unset"
        ? "未配置"
        : effective?.remoteApiKeyConfigured
          ? "已配置"
          : "未配置";
    if (key === "remoteBaseURL" && !value[key]) return "未配置";
    if (
      key === "hfHome" &&
      !value[key] &&
      effective?.hfHomeSource === "environment"
    )
      return "环境变量";
    return inherited || value[key] === "" ? "默认" : "已设置";
  }
  const hint = (key: keyof Config) => (
    <div className="q2-config-origin">
      <span>{source(key)}</span>
      <button
        type="button"
        disabled={busy}
        aria-label={`恢复 ${key} 默认`}
        onClick={() => reset(key)}
      >
        恢复默认
      </button>
    </div>
  );
  async function save(check = false) {
    if (!scope) return setMessage("设置接口尚未加载，请重新打开 DSH");
    setBusy(true);
    setMessage("");
    try {
      await request("settings", { config: value });
      const ops = Object.entries(dirty).map(([key, action]) => ({
        op: action!,
        path: [key],
        ...(action === "set" ? { value: value[key as keyof Config] } : {}),
      }));
      if (ops.length && !(await scope.mutate(ops, editingRevision.current)))
        throw Error("设置未保存，可能已被其他页面修改；请刷新核对");
      setDirty({});
      editingRevision.current = undefined;
      setSnapshot(scope.getSnapshot());
      setValue(scope.getSnapshot().value ?? {});
      const r = check ? await request<{ message: string }>("check", {}) : null;
      setMessage(
        r?.message ?? "设置已保存；已启动模型的路径设置在下次启动生效",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="q2 q2-settings">
      <style>{STYLE}</style>
      <fieldset disabled={busy} className="q2-settings-fields">
        <header className="q2-brand">
          <h2>图像</h2>
        </header>
        <p className="q2-muted">
          显示解析后的实际配置。默认值随数据目录和运行环境变化，保存不会将未修改的默认值固定下来。
        </p>
        <section className="q2-privacy-setting">
          <div>
            <h3>隐私图库</h3>
            <p>仅控制图库分类，对话中的图片和进度始终可见。</p>
          </div>
          <button
            role="switch"
            aria-label="启用隐私图库"
            aria-checked={privacy}
            className="q2-switch"
            onClick={() => {
              setPrivacyEnabled(!privacy);
            }}
          />
        </section>
        <label>
          运行位置
          <select
            aria-label="运行位置"
            value={value.connectionMode ?? "local"}
            onChange={(e) => change("connectionMode", e.target.value)}
          >
            <option value="local">本地 Mac</option>
            <option value="remote">远程服务器</option>
          </select>
          {hint("connectionMode")}
        </label>
        <div>
          <div className="q2-field-title">
            <label htmlFor="qwen-idle-minutes">空闲后释放模型（分钟）</label>
            <ParameterHelp name="空闲卸载时间" text="本地与配套 Qwen 网关共用此时间，从最后一个任务结束开始计时。上传、排队和生成时不会断开；按需 SSH 在确认远程模型卸载后断开。普通 Images API 不支持卸载控制。" />
          </div>
          <input id="qwen-idle-minutes" aria-label="空闲卸载时间" type="number" min=".1" max="1440" step=".1" value={value.localMfluxIdleMinutes ?? effective?.localMfluxIdleMinutes ?? 10} onChange={(e) => change("localMfluxIdleMinutes", Number(e.target.value))} />
          {hint("localMfluxIdleMinutes")}
        </div>
        <div>
          <PathField
            label="图库与任务目录"
            name="图库与任务目录"
            value={
              dirty.localMfluxDirectory === "set"
                ? (value.localMfluxDirectory ?? "")
                : (effective?.localMfluxDirectory ?? "")
            }
            placeholder="正在解析默认目录…"
            onChange={(v) => change("localMfluxDirectory", v)}
            onError={setMessage}
          />
          {hint("localMfluxDirectory")}
        </div>
        {value.connectionMode !== "remote" ? (
          <>
            {(
              [
                ["pythonPath", "Python 可执行文件", "Python路径", "python"],
                [
                  "modelPath",
                  "Qwen Image 2.1 MLX 模型目录",
                  "模型目录",
                  "directory",
                ],
                ["hfHome", "Hugging Face 缓存目录", "缓存目录", "directory"],
                ["loraDirectory", "LoRA 文件夹", "LoRA 文件夹", "directory"],
              ] as const
            ).map(([key, label, name, kind]) => (
              <div key={key}>
                <PathField
                  label={label}
                  name={name}
                  kind={kind}
                  value={
                    dirty[key] === "set"
                      ? (value[key] ?? "")
                      : (effective?.[key] ?? "")
                  }
                  placeholder="正在解析实际路径…"
                  onChange={(v) => change(key, v)}
                  onError={setMessage}
                />
                {hint(key)}
              </div>
            ))}
            {health?.runtime && (
              <details>
                <summary>当前运行配置 · 已保存路径在下次启动生效</summary>
                <dl>
                  {(["pythonPath", "modelPath", "hfHome"] as const).map(
                    (key) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>
                          {health.runtime![key] || "由运行环境确定"}
                          {effective?.[key] !== health.runtime![key]
                            ? " · 与已保存值不同"
                            : ""}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </details>
            )}
            <p className="q2-muted">
              可选 LoRA 会合并托管资源、图库下的 loras
              和自定义文件夹。在高级设置中可直接选择已导入资源。
            </p>
          </>
        ) : (
          <>
            <label>
              接口地址
              <input
                aria-label="远程接口地址"
                value={value.remoteBaseURL ?? ""}
                placeholder="https://你的服务器/v1"
                onChange={(e) => change("remoteBaseURL", e.target.value)}
              />
              {hint("remoteBaseURL")}
            </label>
            <label>
              模型名称
              <input
                aria-label="远程模型名称"
                value={
                  value.remoteModel || effective?.remoteModel || "qwen-image"
                }
                onChange={(e) => change("remoteModel", e.target.value)}
              />
              {hint("remoteModel")}
            </label>
            <label>
              API Key
              <input
                aria-label="远程API Key"
                type="password"
                autoComplete="off"
                value={
                  dirty.remoteApiKey === "set" ? (value.remoteApiKey ?? "") : ""
                }
                placeholder={
                  effective?.remoteApiKeyConfigured
                    ? "已配置，输入新值替换"
                    : "未配置，服务无需鉴权时可留空"
                }
                onChange={(e) => change("remoteApiKey", e.target.value)}
              />
              {hint("remoteApiKey")}
            </label>
            <label>
              按需 SSH 主机
              <input aria-label="按需 SSH 主机" value={value.remoteSshHost ?? ""} placeholder="留空直接连接；例如 4090d" onChange={(e) => change("remoteSshHost", e.target.value)} />
              {hint("remoteSshHost")}
            </label>
            {value.remoteSshHost?.trim() && <label>
              服务器网关端口
              <input aria-label="服务器网关端口" type="number" min="1" max="65535" value={value.remoteSshPort ?? 19488} onChange={(e) => change("remoteSshPort", Number(e.target.value))} />
              {hint("remoteSshPort")}
            </label>}
            <ParameterHelp name="按需 SSH" text="SSH 复用本机已配置的密钥和主机别名；首次信任主机请先在终端完成。留空时直接访问接口。填入后只有提交生图才连接，浏览图库、预设和检查配置都不建立隧道。接口地址须为 http://127.0.0.1:本机端口/v1。" />
            <p className="q2-muted">
              使用自部署 OpenAI 兼容 Images
              API。使用配套 Qwen 网关可同步 LoRA、控制图、蒙版与采样进度；普通 Images API 仍仅支持基础文生图。
            </p>
          </>
        )}
        <div className="q2-actions">
          <button
            className="q2-primary"
            disabled={busy || !effective}
            onClick={() => void save()}
          >
            保存设置
          </button>
          <button disabled={busy || !effective} onClick={() => void save(true)}>
            保存并检查连接
          </button>
          <button
            disabled={busy || !Object.keys(dirty).length}
            onClick={() => {
              setDirty({});
              editingRevision.current = undefined;
              setSnapshot(scope?.getSnapshot());
              setValue(scope?.getSnapshot().value ?? {});
              setMessage("已放弃未保存修改，重新读取当前设置");
            }}
          >
            放弃修改并重新读取
          </button>
        </div>
        <p role="status" className="q2-message">
          {message}
        </p>
      </fieldset>
    </section>
  );
}
