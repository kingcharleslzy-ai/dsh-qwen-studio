import { useEffect, useState } from "react";
import { Images } from "lucide-react";
import type {} from "@deepseek-ai/dsh-client-ui-slots";
import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
import type {} from "@deepseek-ai/dsh-client-ui-settings-plugins/client";
import type { Config } from "../config.js";
import {
  ConversationProgress,
  progressDefinition,
  PROGRESS_KIND,
} from "./conversation-progress.js";
import { Studio } from "./studio.js";
import { STYLE } from "./style.js";
import {
  ConversationImage,
  resultDefinition,
  RESULT_KIND,
} from "./conversation-result.js";
import { usePrivacyGallery, setPrivacyEnabled } from "./gallery-preferences.js";
import { PathField } from "./path-field.js";
import { request } from "./api.js";
interface Scope {
  getSnapshot(): { value?: Config; writable?: boolean };
  subscribe(fn: () => void): () => void;
  set(key: string, value: unknown): Promise<boolean | void>;
}
export const inject = ["slots", "connection", "remote"];
export function apply(ctx: Context) {
  const forms = ctx.get("configForms") as
      | { get(id: string): Scope }
      | undefined,
    scope = forms?.get("qwen-studio");
  const register = ctx.slots.register.bind(ctx.slots) as (
    options: object,
    component: unknown,
  ) => () => void;
  const mount = ctx.slots.inject.bind(ctx.slots) as (
    key: string,
    create: () => () => void,
  ) => void;
  mount("plugins.bundle.config", () =>
    register(
      {
        name: "plugins.bundle.config",
        key: "dsh-qwen-studio",
        inject: () => ({ scope }),
      },
      Settings,
    ),
  );
  (
    ctx.inject as unknown as (
      services: string[],
      cb: (owner: Context) => void,
    ) => void
  )(["uiConversation"], (owner) => {
    const conversation = owner.get("uiConversation") as {
      events: { register(definition: unknown): () => void };
    };
    owner.effect(
      () => conversation.events.register(progressDefinition),
      "image progress",
    );
    owner.effect(
      () => conversation.events.register(resultDefinition),
      "image result",
    );
    const reg = owner.slots.register.bind(owner.slots) as (
      options: object,
      component: unknown,
    ) => () => void;
    owner.slots.inject("conversation.chat.node", () =>
      reg(
        {
          name: "conversation.chat.node",
          key: PROGRESS_KIND,
          inject: (sessionId: string) => ({ sessionId }),
        },
        ConversationProgress,
      ),
    );
    owner.slots.inject("conversation.chat.node", () =>
      reg(
        {
          name: "conversation.chat.node",
          key: RESULT_KIND,
          inject: () => ({}),
        },
        ConversationImage,
      ),
    );
  });

  mount("main", () =>
    register(
      {
        name: "main",
        key: "qwen-studio",
        inject: () => ({}),
      },
      StudioPage,
    ),
  );
  mount("sidebar.panellist", () =>
    register(
      {
        name: "sidebar.panellist",
        id: "qwen-studio",
        order: 10,
        label: "图像",
      },
      StudioIcon,
    ),
  );
}
function StudioIcon({ size = 16 }: { size?: number }) {
  return <Images size={size} aria-hidden="true" />;
}
function StudioPage() {
  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        boxSizing: "border-box",
        paddingTop: "min(var(--dsh-frame-top-clearance, 0px), 28px)",
      }}
    >
      <Studio />
    </div>
  );
}

function Settings({ scope }: { scope?: Scope }) {
  const privacy = usePrivacyGallery();
  const [value, setValue] = useState<Config>(scope?.getSnapshot().value ?? {}),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(
    () => scope?.subscribe(() => setValue(scope.getSnapshot().value ?? {})),
    [scope],
  );
  const change = (key: keyof Config, v: unknown) =>
    setValue((old) => ({ ...old, [key]: v }));
  async function save(check = false) {
    setBusy(true);
    setMessage("");
    try {
      if (!scope) throw Error("设置接口尚未加载，请正常重启DSH后重试");
      if ((value.localMfluxIdleMinutes ?? 10) < 0.1)
        throw Error("空闲时间至少0.1分钟");
      for (const [key, v] of Object.entries(value))
        if ((await scope.set(key, v)) === false) throw Error("DSH拒绝保存设置");
      const result = check
        ? await request<{ message: string }>("check", {})
        : await request("state");
      setMessage(
        check ? (result as { message: string }).message : "设置已保存",
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
      <header className="q2-brand">
        <div>
          <h2>图像</h2>
        </div>
      </header>
      <p className="q2-muted">
        让 Qwen 在你选择的位置运行。图库和任务记录始终保存在这台电脑。
      </p>
      <section className="q2-privacy-setting" aria-label="图库隐私设置">
        <div>
          <h3>隐私图库</h3>
          <p className="q2-muted">
            仅控制图库分类：新作品默认放入隐私图库，收藏后显示在正常图库。
          </p>
        </div>
        <button
          role="switch"
          aria-label="启用隐私图库"
          aria-checked={privacy}
          className="q2-switch"
          onClick={() => {
            try {
              setPrivacyEnabled(!privacy);
              setMessage("图库显示设置已保存，立即生效");
            } catch {
              setMessage("无法保存图库显示设置，请检查本机存储是否可用");
            }
          }}
        >
          <span />
        </button>
        <small>
          在此设备立即生效。关闭后恢复全部作品。对话里的生成进度、新图片和历史图片始终正常显示。隐私图库不提供文件加密。
        </small>
      </section>
      <div className="q2-segment" aria-label="运行位置">
        <button
          aria-pressed={value.connectionMode !== "remote"}
          onClick={() => change("connectionMode", "local")}
        >
          本地 Mac
        </button>
        <button
          aria-pressed={value.connectionMode === "remote"}
          onClick={() => change("connectionMode", "remote")}
        >
          远程服务器
        </button>
      </div>
      <PathField
        label="图库与任务目录"
        name="图库与任务目录"
        value={value.localMfluxDirectory ?? ""}
        placeholder="留空使用 ~/.dsh/qwen-studio"
        onChange={(v) => change("localMfluxDirectory", v)}
        onError={setMessage}
      />
      {value.connectionMode !== "remote" ? (
        <>
          <PathField
            label="Python 可执行文件"
            name="Python路径"
            kind="python"
            value={value.pythonPath ?? ""}
            placeholder="选择虚拟环境文件夹，或输入 Python 路径"
            onChange={(v) => change("pythonPath", v)}
            onError={setMessage}
          />
          <PathField
            label="Qwen Image 2.1 MLX 模型目录"
            name="模型目录"
            value={value.modelPath ?? ""}
            placeholder="选择完整的模型文件夹"
            onChange={(v) => change("modelPath", v)}
            onError={setMessage}
          />
          <PathField
            label="Hugging Face 缓存目录（可选）"
            name="缓存目录"
            value={value.hfHome ?? ""}
            placeholder="默认使用 Python 环境的缓存"
            onChange={(v) => change("hfHome", v)}
            onError={setMessage}
          />
          <label>
            空闲后释放模型{" "}
            <span className="q2-input-unit">
              <input
                aria-label="空闲卸载时间"
                type="number"
                min="0.1"
                max="1440"
                step="0.1"
                value={value.localMfluxIdleMinutes ?? 10}
                onChange={(e) =>
                  change("localMfluxIdleMinutes", Number(e.target.value))
                }
              />
              <span>分钟</span>
            </span>
          </label>
          <details>
            <summary>第一次在本机安装？</summary>
            <p>
              需要 Apple Silicon Mac、Python 3.12 与 MFLUX 0.22.0。发行包提供
              scripts/setup-local.sh，创建独立环境后，把打印的 Python
              路径和已下载的 MLX
              模型目录填入上方。模型及共享组件需预先下载，插件不自动下载大文件。
            </p>
          </details>
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
          </label>
          <label>
            模型名称
            <input
              aria-label="远程模型名称"
              value={value.remoteModel ?? "qwen-image"}
              onChange={(e) => change("remoteModel", e.target.value)}
            />
          </label>
          <label>
            API Key <small>服务未启用鉴权时可留空</small>
            <input
              aria-label="远程API Key"
              type="password"
              autoComplete="off"
              value={value.remoteApiKey ?? ""}
              onChange={(e) => change("remoteApiKey", e.target.value)}
            />
          </label>
          <p className="q2-muted">
            服务需支持 GET /models 和 POST /images/generations，返回 PNG 格式的
            data[0].b64_json。请求包含 seed 与
            num_inference_steps。连接检查只验证接口可达，不会生图。远程进度由服务决定；停止等待不保证停止服务器计算。本地空闲卸载设置不控制远程服务器。
          </p>
        </>
      )}
      <div className="q2-actions">
        <button
          className="q2-primary"
          disabled={busy}
          onClick={() => void save()}
        >
          保存设置
        </button>
        <button disabled={busy} onClick={() => void save(true)}>
          保存并检查连接
        </button>
      </div>
      <p role="status" className="q2-message">
        {message}
      </p>
      <details>
        <summary>让对话中的模型调用</summary>
        <p>
          插件注册 qwen_generate_image，并附带 qwen-image 技能。你可以说「用
          Qwen
          生成一张图片」。支持工具调用的文字模型会收到工具说明；是否调用仍受该模型能力及DSH授权设置影响。直接创作面板始终不经过文字模型。
        </p>
      </details>
    </section>
  );
}
