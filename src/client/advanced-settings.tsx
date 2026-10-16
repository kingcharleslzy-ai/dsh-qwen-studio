import { useEffect, useRef } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { ParameterHelp, STEPS_HELP, SEED_HELP } from "./parameter-help.js";
interface Parameters {
  size: string;
  steps: number;
  seed: string;
  sourceId: string;
  changeStrength: number;
}
export function AdvancedSettings({
  draft,
  update,
  remote,
  close,
}: {
  draft: Parameters;
  update: (value: Partial<Parameters>) => void;
  remote: boolean;
  close: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
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
            "button:not(:disabled),input:not(:disabled),select:not(:disabled)",
          ) ?? []),
        ];
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
          返回
        </button>
        <strong>高级生成设置</strong>
        <span />
      </header>
      <div className="q2-advanced-page">
        <p className="q2-muted">
          修改会自动保存在当前创作草稿中，下次生成时使用。
        </p>
        <section>
          <h3>采样与复现</h3>
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
          </div>
          <button onClick={() => update({ seed: "" })}>使用随机种子</button>
        </section>
        <section>
          <h3>输出尺寸</h3>
          <label>
            分辨率
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
              ].map((s) => (
                <option key={s} value={s}>
                  {s.replace("x", " × ")}
                </option>
              ))}
            </select>
          </label>
          <p className="q2-muted">
            更大尺寸通常需要更多内存与时间。512 × 512 可用于快速试稿。
          </p>
        </section>
        <section>
          <h3>参考图变化</h3>
          {!remote && draft.sourceId ? (
            <label>
              变化幅度 · {Math.round(draft.changeStrength * 100)}%
              <input
                aria-label="高级变化幅度"
                type="range"
                min="5"
                max="95"
                step="5"
                value={draft.changeStrength * 100}
                onChange={(e) =>
                  update({ changeStrength: Number(e.target.value) / 100 })
                }
              />
              <small>
                越低越接近原图，越高变化越多。此模式不保证精准局部编辑。
              </small>
            </label>
          ) : (
            <p className="q2-muted">
              {remote
                ? "当前远程接口未提供参考图变体能力。"
                : "在结果预览中选择「用作参考」后，可在这里调整变化幅度。"}
            </p>
          )}
        </section>
        <footer>
          <button
            onClick={() =>
              update({
                size: "1024x1024",
                steps: 40,
                seed: "",
                changeStrength: 0.45,
              })
            }
          >
            <RotateCcw />
            恢复默认参数
          </button>
          <small>保留画面描述和参考图。</small>
        </footer>
      </div>
    </div>
  );
}
