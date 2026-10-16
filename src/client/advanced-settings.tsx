import { useEffect, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, X } from "lucide-react";
import { ParameterHelp, STEPS_HELP, SEED_HELP } from "./parameter-help.js";
import { AssetUpload } from "./asset-upload.js";
import { PresetBar, defaultDraft } from "./preset-bar.js";
import { ResourcePicker } from "./resource-picker.js";
import { request } from "./api.js";
import type { ResourceCatalog } from "../resources.js";
import { imageURL } from "./api.js";
import { draftDefaults, type CreationDraft } from "./creation-draft.js";
function SelectedImage({
  id,
  name,
  remove,
}: {
  id: string;
  name: string;
  remove(): void;
}) {
  return (
    <div className="q2-selected-image">
      <img src={imageURL(id)} alt={name} />
      <span title={name}>{name}</span>
      <button aria-label={`移除${name}`} onClick={remove}>
        <X />
      </button>
    </div>
  );
}
export function AdvancedSettings({
  draft,
  update,
  remote,
  ready,
  close,
}: {
  draft: CreationDraft;
  update(value: Partial<CreationDraft>): void;
  remote: boolean;
  ready: boolean;
  close(): void;
}) {
  const root = useRef<HTMLDivElement>(null),
    current = useRef(draft);
  current.current = draft;
  const [error, setError] = useState("");
  const disabled = remote || !ready;
  const [catalog, setCatalog] = useState<ResourceCatalog>({
    items: [],
    warnings: [],
  });
  const refreshResources = () =>
    request<ResourceCatalog>("resources")
      .then(setCatalog)
      .catch((e) => setError(e.message));
  useEffect(() => {
    let alive = true;
    if (ready)
      request<ResourceCatalog>("resources")
        .then((v) => {
          if (alive) setCatalog(v);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [ready]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key === "Tab") {
        const nodes = [
          ...(root.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled):not([hidden]),select:not(:disabled),textarea:not(:disabled),summary",
          ) ?? []),
        ].filter((n) => n.getClientRects().length);
        const first = nodes[0],
          last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [close]);
  const importedImage = (values: Partial<CreationDraft>) => {
    update(values);
    void refreshResources();
  };
  const sourceId = draft.maskSourceId || draft.sourceId;
  return (
    <div
      ref={root}
      className="q2-overlay q2-detail"
      role="dialog"
      aria-modal="true"
      aria-label="高级生成设置"
    >
      <header>
        <button aria-label="返回创作" onClick={close}>
          <ArrowLeft />
          返回创作
        </button>
        <strong>高级设置</strong>
        <span className="q2-muted">自动保存到草稿</span>
      </header>
      <div className="q2-advanced-page q2-effects-page">
        {ready && (
          <PresetBar draft={draft} update={update} onError={setError} />
        )}
        {error && (
          <div className="q2-effect-error" role="alert">
            {error}
            <button aria-label="关闭高级设置提示" onClick={() => setError("")}>
              <X />
            </button>
          </div>
        )}
        {remote ? (
          <p role="status" className="q2-effect-note">
            LoRA、结构控制和局部重绘仅支持本地模式。已选文件会保留，切回本地后可继续使用。
          </p>
        ) : (
          !ready && (
            <p role="status" className="q2-effect-note">
              请重新打开 DSH，加载本机文件导入接口。
            </p>
          )
        )}
        <p className="q2-muted">
          选中文件会复制到本机资源库，原文件不变；关闭或移除只会改变当前草稿。
        </p>
        <div className="q2-resource-toolbar">
          <span className="q2-muted">
            资源清单合并导入资源、默认文件夹和自定义目录
          </span>
          <button onClick={() => void refreshResources()} disabled={!ready}>
            刷新资源清单
          </button>
        </div>
        {catalog.warnings.length > 0 && (
          <p role="status" className="q2-effect-note">
            {catalog.warnings.join("；")}
          </p>
        )}
        <div className="q2-effects-grid">
          <section className="q2-effect-section">
            <div className="q2-effect-heading">
              <div>
                <h3>模型风格</h3>
                <p>添加 LoRA，为当前模型叠加风格或细节。</p>
              </div>
              <span className="q2-effect-tag">LoRA</span>
            </div>
            <AssetUpload
              kind="lora"
              label="添加 LoRA 文件"
              disabled={disabled}
              maxFiles={8 - draft.loras.length}
              onError={setError}
              onAssets={(assets) => {
                const items = [...current.current.loras];
                for (const asset of assets)
                  if (asset.path && !items.some((l) => l.path === asset.path))
                    items.push({
                      path: asset.path,
                      name: asset.name,
                      scale: 0.8,
                    });
                update({ loras: items.slice(0, 8) });
                void refreshResources();
              }}
            />
            <ResourcePicker
              resources={catalog.items}
              kind="lora"
              label="LoRA"
              disabled={disabled}
              selected={draft.loras.map((l) => l.path)}
              onChoose={(r) => {
                const exists = draft.loras.some((l) => l.path === r.path);
                if (exists)
                  update({
                    loras: draft.loras.filter((l) => l.path !== r.path),
                  });
                else if (draft.loras.length >= 8) setError("最多8个 LoRA");
                else
                  update({
                    loras: [
                      ...draft.loras,
                      {
                        path: r.path!,
                        name: r.name,
                        scale: 0.8,
                        enabled: true,
                      },
                    ],
                  });
              }}
            />
            {!draft.loras.length && (
              <div className="q2-effect-empty">
                选择与 Qwen Image 2.1 兼容的 .safetensors 文件
                <br />
                <small>支持多个文件，最多 8 个；每个文件不超过 2GB。</small>
              </div>
            )}
            <div className="q2-lora-list">
              {draft.loras.map((lora, i) => (
                <div className="q2-lora-item" key={lora.path}>
                  <label className="q2-inline-check">
                    <input
                      type="checkbox"
                      aria-label={`启用 LoRA ${lora.name}`}
                      checked={lora.enabled !== false}
                      disabled={disabled}
                      onChange={(e) =>
                        update({
                          loras: draft.loras.map((l, j) =>
                            j === i ? { ...l, enabled: e.target.checked } : l,
                          ),
                        })
                      }
                    />
                    <span title={lora.name}>
                      {lora.name}
                      {lora.missing ? " · 资源失效" : ""}
                    </span>
                  </label>
                  <label className="q2-lora-weight">
                    权重
                    <input
                      aria-label={`LoRA 权重 ${lora.name}`}
                      type="number"
                      min="0"
                      max="2"
                      step="0.05"
                      disabled={disabled || lora.enabled === false}
                      value={lora.scale}
                      onChange={(e) =>
                        update({
                          loras: draft.loras.map((l, j) =>
                            j === i
                              ? { ...l, scale: Number(e.target.value) }
                              : l,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    aria-label={`移除 LoRA ${lora.name}`}
                    onClick={() =>
                      update({ loras: draft.loras.filter((_, j) => j !== i) })
                    }
                  >
                    <X />
                  </button>
                </div>
              ))}
            </div>
            <small>
              权重越大通常影响越强，具体范围以 LoRA
              作者说明为准。取消勾选可暂时停用；移除不会删除原文件。
            </small>
          </section>
          <section className="q2-effect-section">
            <div className="q2-effect-heading">
              <div>
                <h3>结构控制</h3>
                <p>用线稿、姿态、深度或边缘图约束构图。</p>
              </div>
              <label className="q2-inline-check">
                <input
                  type="checkbox"
                  aria-label="启用结构控制"
                  disabled={disabled}
                  checked={draft.controlEnabled}
                  onChange={(e) => update({ controlEnabled: e.target.checked })}
                />
                启用
              </label>
            </div>
            <AssetUpload
              kind="control"
              label={draft.controlId ? "更换控制图" : "选择控制图"}
              disabled={disabled}
              onError={setError}
              onAssets={([a]) =>
                a &&
                importedImage({
                  controlId: a.id,
                  controlName: a.name,
                  controlEnabled: true,
                })
              }
            />
            <ResourcePicker
              resources={catalog.items}
              kind="control"
              label="控制图"
              disabled={disabled}
              selected={[draft.controlId]}
              onChoose={(r) =>
                update({
                  controlId: r.id,
                  controlName: r.name,
                  controlEnabled: true,
                })
              }
            />
            {draft.controlId && (
              <SelectedImage
                id={draft.controlId}
                name={draft.controlName || "控制图"}
                remove={() =>
                  update({
                    controlId: "",
                    controlName: "",
                    controlEnabled: false,
                  })
                }
              />
            )}
            <label>
              控制强度 · {Math.round(draft.controlStrength * 100)}%
              <input
                aria-label="结构控制强度"
                type="range"
                min="0"
                max="1"
                step="0.05"
                disabled={disabled || !draft.controlEnabled}
                value={draft.controlStrength}
                onChange={(e) =>
                  update({ controlStrength: Number(e.target.value) })
                }
              />
              <small>0 为关闭控制，100% 约束最强。画面内容仍由描述决定。</small>
            </label>
            <p className="q2-muted">
              这里选择的是控制图片，不是模型权重；本机模型目录需已配置 Union
              ControlNet。
            </p>
          </section>
          <section className="q2-effect-section q2-mask-section">
            <div className="q2-effect-heading">
              <div>
                <h3>局部重绘</h3>
                <p>选择原图与蒙版，只重画指定区域。</p>
              </div>
              <label className="q2-inline-check">
                <input
                  type="checkbox"
                  aria-label="启用局部重绘"
                  disabled={disabled}
                  checked={draft.maskEnabled}
                  onChange={(e) => update({ maskEnabled: e.target.checked })}
                />
                启用
              </label>
            </div>
            <div className="q2-mask-inputs">
              <div>
                <span className="q2-option-label">原图</span>
                <AssetUpload
                  kind="source"
                  label={sourceId ? "更换重绘原图" : "选择重绘原图"}
                  disabled={disabled}
                  onError={setError}
                  onAssets={([a]) =>
                    a && importedImage({ maskSourceId: a.id, maskSourceName: a.name })
                  }
                />
                <ResourcePicker
                  resources={catalog.items}
                  kind="source"
                  label="重绘原图"
                  disabled={disabled}
                  selected={[sourceId]}
                  onChoose={(r) =>
                    update({ maskSourceId: r.id, maskSourceName: r.name })
                  }
                />
                {sourceId && (
                  <SelectedImage
                    id={sourceId}
                    name={
                      draft.maskSourceName || draft.sourceName || "参考原图"
                    }
                    remove={() =>
                      update({
                        maskSourceId: "",
                        maskSourceName: "",
                        sourceId: "",
                        sourceName: "",
                      })
                    }
                  />
                )}
              </div>
              <div>
                <span className="q2-option-label">蒙版</span>
                <AssetUpload
                  kind="mask"
                  label={draft.maskId ? "更换蒙版" : "选择蒙版"}
                  disabled={disabled}
                  onError={setError}
                  onAssets={([a]) =>
                    a &&
                    importedImage({
                      maskId: a.id,
                      maskName: a.name,
                      maskEnabled: true,
                    })
                  }
                />
                <ResourcePicker
                  resources={catalog.items}
                  kind="mask"
                  label="蒙版"
                  disabled={disabled}
                  selected={[draft.maskId]}
                  onChoose={(r) =>
                    update({
                      maskId: r.id,
                      maskName: r.name,
                      maskEnabled: true,
                    })
                  }
                />
                {draft.maskId && (
                  <SelectedImage
                    id={draft.maskId}
                    name={draft.maskName || "蒙版"}
                    remove={() =>
                      update({ maskId: "", maskName: "", maskEnabled: false })
                    }
                  />
                )}
              </div>
            </div>
            <div className="q2-mask-legend">
              <span>
                <i className="white" />
                白色：重新生成
              </span>
              <span>
                <i className="black" />
                黑色：保留原图
              </span>
            </div>
            <small>
              灰色按亮度中点划为黑或白，不作渐变蒙版。原图与蒙版会按输出尺寸缩放；保持原尺寸才能保留黑色区域的原始像素。局部重绘不使用「变化幅度」。
            </small>
            {draft.maskEnabled && (!sourceId || !draft.maskId) && (
              <p className="q2-effect-note">请选齐原图和蒙版后再生成。</p>
            )}
            {draft.controlEnabled && draft.sourceId && !draft.maskEnabled && (
              <p className="q2-effect-note">
                已有参考原图；与结构控制组合使用时，需要开启局部重绘并选择蒙版。只按控制图生图时请移除参考图。
              </p>
            )}
          </section>
        </div>
        <section
          className="q2-effect-section q2-text-controls"
          aria-label="文本控制与采样"
        >
          <h3>文本控制与采样</h3>
          <label>
            负向提示词
            <textarea
              aria-label="负向提示词"
              rows={3}
              maxLength={8000}
              disabled={remote}
              placeholder="描述希望避免的内容，留空时不启用负向词"
              value={draft.negativePrompt}
              onChange={(e) => update({ negativePrompt: e.target.value })}
            />
          </label>
          <div className="q2-advanced-fields">
            <label>
              CFG 引导强度 ·{" "}
              {draft.negativePrompt.trim() && draft.guidance <= 1
                ? "实际 2.5（自动）"
                : draft.guidance}
              <input
                aria-label="CFG 引导强度"
                type="number"
                min="1"
                max="10"
                step=".1"
                disabled={remote}
                value={draft.guidance}
                onChange={(e) => update({ guidance: Number(e.target.value) })}
              />
            </label>
            <label>
              调度器
              <select
                aria-label="调度器"
                disabled={remote}
                value={draft.scheduler}
                onChange={(e) =>
                  update({
                    scheduler: e.target.value as CreationDraft["scheduler"],
                  })
                }
              >
                <option value="linear">linear · 默认</option>
                <option
                  value="flow_match_euler_discrete"
                  disabled={draft.controlEnabled || draft.maskEnabled}
                >
                  flow_match_euler_discrete
                </option>
                <option
                  value="seedvr2_euler"
                  disabled={draft.controlEnabled || draft.maskEnabled}
                >
                  seedvr2_euler
                </option>
              </select>
            </label>
          </div>
          <p className="q2-muted">
            {draft.controlEnabled || draft.maskEnabled
              ? "结构控制与蒙版仅支持 linear；CFG 大于 1 时，负向词即使为空也参与无条件分支。"
              : "普通文生图中，CFG 仅在负向词非空且强度大于 1 时生效；它不是通用画质旋钮。"}
            {draft.negativePrompt.trim() && draft.guidance <= 1
              ? " 已填写负向词，提交时会将 CFG 从 1 自动提升到 2.5。"
              : ""}
          </p>
          {(draft.controlEnabled || draft.maskEnabled) &&
            draft.scheduler !== "linear" && (
              <p role="alert">当前调度器不兼容，请手动切回 linear 再生成。</p>
            )}
        </section>
        <details className="q2-base-settings">
          <summary>采样、尺寸与参考变体</summary>
          <div className="q2-advanced-fields">
            <label>
              <span className="q2-field-title">
                步数
                <ParameterHelp name="高级步数" text={STEPS_HELP} />
              </span>
              <input
                aria-label="高级生成步数"
                type="number"
                min="1"
                max="60"
                value={draft.steps}
                onChange={(e) => update({ steps: Number(e.target.value) })}
              />
            </label>
            <label>
              <span className="q2-field-title">
                种子
                <ParameterHelp name="高级种子" text={SEED_HELP} />
              </span>
              <input
                aria-label="高级随机种子"
                inputMode="numeric"
                placeholder="留空为随机"
                value={draft.seed}
                onChange={(e) => update({ seed: e.target.value })}
              />
            </label>
            <label>
              输出尺寸
              <select
                aria-label="高级画面尺寸"
                value={draft.size}
                onChange={(e) => update({ size: e.target.value })}
              >
                {[
                  "1024x1024",
                  "1344x768",
                  "768x1344",
                  "1216x832",
                  "832x1216",
                  "512x512",
                ].map((size) => (
                  <option key={size} value={size}>
                    {size.replace("x", " × ")}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <AssetUpload
                kind="source"
                label="选择参考图"
                disabled={disabled}
                onError={setError}
                onAssets={([a]) =>
                  a && importedImage({ sourceId: a.id, sourceName: a.name })
                }
              />
              <ResourcePicker
                resources={catalog.items}
                kind="source"
                label="参考图"
                disabled={disabled}
                selected={[draft.sourceId]}
                onChoose={(r) => update({ sourceId: r.id, sourceName: r.name })}
              />
              {draft.sourceId && (
                <SelectedImage
                  id={draft.sourceId}
                  name={draft.sourceName || "参考图"}
                  remove={() => update({ sourceId: "", sourceName: "" })}
                />
              )}
            </div>
            {!draft.maskEnabled && draft.sourceId && (
              <label>
                参考图变化幅度 · {Math.round(draft.changeStrength * 100)}%
                <input
                  aria-label="高级变化幅度"
                  type="range"
                  min="0.05"
                  max="0.95"
                  step="0.05"
                  value={draft.changeStrength}
                  onChange={(e) =>
                    update({ changeStrength: Number(e.target.value) })
                  }
                />
              </label>
            )}
          </div>
        </details>
        <footer>
          <button
            onClick={() =>
              void defaultDraft()
                .then(({ prompt: _, ...values }) => update(values))
                .catch((e) => setError(e.message))
            }
          >
            <RotateCcw />
            恢复默认参数
          </button>
          <small>加载默认预设或内置参数，保留画面描述。文件原件不变。</small>
          <button className="q2-primary" onClick={close}>
            完成设置
          </button>
        </footer>
      </div>
    </div>
  );
}
