import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowLeft,
  Image,
  Star,
  Download,
  X,
  RotateCcw,
  Archive,
  Trash2,
  SlidersHorizontal,
  Check,
  Plus,
  Search,
  LoaderCircle,
} from "lucide-react";
import { active, statusLabel, type Job, type Snapshot } from "../shared.js";
import { request, imageURL, download, lastSnapshot, cache, pollSnapshot, APIError } from "./api.js";
import { CreationPreview } from "./creation-preview.js";
import { defaultDraft } from "./preset-bar.js";
import { AdvancedSettings } from "./advanced-settings.js";
import { ParameterHelp, STEPS_HELP, SEED_HELP } from "./parameter-help.js";
import {
  usePrivacyGallery,
  defaultGallery,
  galleryMatches,
} from "./gallery-preferences.js";
import { previewCandidate } from "./preview-follow.js";
import { STYLE } from "./style.js";
const DRAFT = "qwen-studio-draft-v1",
  RECEIPT = "qwen-studio-submission-v1";
type Draft = import("./creation-draft.js").CreationDraft;
import {
  draftDefaults as defaults,
  generationPayload,
  reuseDraft,
} from "./creation-draft.js";
function readDraft(): Draft {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(DRAFT) ?? "{}") };
  } catch {
    return defaults;
  }
}
let submitting: Promise<unknown> | undefined;
function dispatch(payload: unknown) {
  if (!submitting)
    submitting = request("jobs", payload)
      .then((v) => {
        localStorage.removeItem(RECEIPT);
        return v;
      })
      .finally(() => {
        submitting = undefined;
      });
  return submitting;
}
export function Studio() {
  const privacy = usePrivacyGallery();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const closeAdvanced = useCallback(() => setAdvancedOpen(false), []);
  const [draft, setDraft] = useState<Draft>(readDraft),
    [snapshot, setSnapshot] = useState<Snapshot | undefined>(lastSnapshot),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(Boolean(submitting)),
    [view, setViewState] = useState(
      () => localStorage.getItem("qwen-studio-view") || "create",
    );
  const enabledLoraCount = draft.loras.filter(
    (l) => l.enabled !== false,
  ).length;
  const setView = (value: string) => {
    if (value === "gallery") {
      setFilter(defaultGallery(privacy));
      setSelection(new Set());
    }
    localStorage.setItem("qwen-studio-view", value);
    setViewState(value);
  };
  const [selectedId, setSelectedId] = useState(
    () => localStorage.getItem("qwen-studio-selected") || "",
  );
  const [historyIds, setHistoryIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("qwen-studio-history") || "[]");
    } catch {
      return [];
    }
  });
  const chooseResult = (id: string) => {
    setSelectedId(id);
    localStorage.setItem("qwen-studio-selected", id);
  };
  const remember = (id: string) => {
    chooseResult(id);
    setHistoryIds((old) => {
      const next = [id, ...old.filter((v) => v !== id)].slice(0, 16);
      localStorage.setItem("qwen-studio-history", JSON.stringify(next));
      return next;
    });
  };
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState(() => defaultGallery(privacy)),
    [selection, setSelection] = useState<Set<string>>(new Set()),
    [selecting, setSelecting] = useState(false),
    [detailId, setDetailId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
      action: string;
      ids: string[];
    } | null>(null),
    [retry, setRetry] = useState(Boolean(localStorage.getItem(RECEIPT))),
    [notice, setNotice] = useState(""),
    [connectionError, setConnectionError] = useState("");
  useEffect(() => {
    setFilter(defaultGallery(privacy));
    setSelection(new Set());
    setDetailId(null);
  }, [privacy]);
  const dismissed = useRef<Set<string>>(
    new Set(
      (() => {
        try {
          return JSON.parse(
            localStorage.getItem("qwen-studio-dismissed") || "[]",
          ) as string[];
        } catch {
          return [];
        }
      })(),
    ),
  );
  const seenActive = useRef(new Set<string>());
  const previewCursor = useRef(
    Number(localStorage.getItem("qwen-studio-preview-cursor")) ||
      Date.now() / 1000,
  );
  useEffect(() => {
    const jobs = snapshot?.jobs ?? [];
    const candidate = previewCandidate(
      jobs,
      selectedId,
      dismissed.current,
      seenActive.current,
      previewCursor.current,
    );
    for (const job of jobs) seenActive.current.add(job.id);
    if (snapshot) {
      previewCursor.current = jobs.reduce(
        (cursor, job) =>
          Number.isFinite(job.started_at)
            ? Math.max(cursor, job.started_at)
            : cursor,
        previewCursor.current,
      );
      localStorage.setItem(
        "qwen-studio-preview-cursor",
        String(previewCursor.current),
      );
    }
    if (candidate) remember(candidate.id);
  }, [snapshot]);
  const clearPreview = () => {
    for (const job of snapshot?.jobs ?? []) dismissed.current.add(job.id);
    localStorage.setItem(
      "qwen-studio-dismissed",
      JSON.stringify([...dismissed.current].slice(-128)),
    );
    chooseResult("");
    setHistoryIds([]);
    localStorage.removeItem("qwen-studio-history");
    update({
      sourceId: "",
      sourceName: "",
      additionalSourceIds: [],
      additionalSourceNames: [],
      maskId: "",
      maskName: "",
      maskEnabled: false,
      maskSourceId: "",
      maskSourceName: "",
    });
    setNotice("已清除预览，图库原图和后台任务均保留");
  };
  const closeRef = useRef<HTMLButtonElement>(null);
  const update = (patch: Partial<Draft>) =>
    setDraft((old) => {
      const missingResources = { ...old.missingResources };
      for (const key of ["sourceId", "controlId", "maskId", "maskSourceId"])
        if (Object.prototype.hasOwnProperty.call(patch, key))
          delete missingResources[key];
      if (Object.prototype.hasOwnProperty.call(patch, "additionalSourceIds"))
        delete missingResources.sourceExtra;
      const value = { ...old, missingResources, ...patch };
      localStorage.setItem(DRAFT, JSON.stringify(value));
      return value;
    });
  useEffect(() => {
    if (localStorage.getItem(DRAFT)) return;
    let alive = true;
    void defaultDraft()
      .then(({ prompt: _, ...values }) => {
        if (alive && !localStorage.getItem(DRAFT)) update(values);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true,
      pending = false;
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const s = await pollSnapshot(lastSnapshot);
        cache(s);
        if (alive) {
          setSnapshot(s);
          setRetry(Boolean(localStorage.getItem(RECEIPT)));
          setConnectionError("");
        }
      } catch (e) {
        if (alive) setConnectionError(e instanceof APIError ? e.message : "连接中断，后台任务仍保留。正在重试…");
      } finally {
        pending = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!detailId && !confirm) return;
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirm(null);
        setDetailId(null);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [detailId, confirm]);
  async function refresh() {
    const s = await pollSnapshot(lastSnapshot);
    cache(s);
    setSnapshot(s);
  }
  async function submit(reuseReceipt = false) {
    setError("");
    setBusy(true);
    try {
      const saved = reuseReceipt ? localStorage.getItem(RECEIPT) : null;
      const payload = saved
        ? JSON.parse(saved)
        : generationPayload(
            draft,
            snapshot?.mode === "remote" && !snapshot?.remoteAdvanced,
            crypto.randomUUID().replaceAll("-", ""),
          );
      if (
        (enabledLoraCount || draft.controlEnabled || draft.maskEnabled) &&
        (snapshot?.apiVersion ?? 0) < 5
      )
        throw Error("请先重新打开 DSH，加载高级创作服务");
      localStorage.setItem(RECEIPT, JSON.stringify(payload));
      setRetry(true);
      remember(payload.id);
      await dispatch(payload);
      setRetry(false);
      await refresh();
      setNotice("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setRetry(Boolean(localStorage.getItem(RECEIPT)));
    }
  }
  async function action(name: string, ids: string[], value?: boolean) {
    setError("");
    setBusy(true);
    try {
      await request("action", {
        action: name,
        ids,
        id: ids[0],
        value,
        confirm: name === "purge",
      });
      await refresh();
      setSelection(new Set());
      setConfirm(null);
      if (["delete", "restore", "purge"].includes(name)) setDetailId(null);
      setNotice(
        (
          {
            delete: "已移到回收站，可在筛选中恢复",
            restore: "已从回收站恢复",
            purge: "已永久删除",
            archived: value ? "已归档" : "已取消归档",
            favorite: value ? "已收藏" : "已取消收藏",
          } as Record<string, string>
        )[name] ?? "已完成",
      );
      if (draft.sourceId && (snapshot?.apiVersion ?? 0) < 4)
        throw Error("请先重新打开DSH，加载支持图生图的新插件服务");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const jobs = snapshot?.jobs ?? [],
    running = jobs.filter((j) => active(j) && !j.deleted),
    health = snapshot?.health;
  const visible = jobs.filter((job) =>
    galleryMatches(job, filter, privacy, query),
  );
  const detail = jobs.find((j) => j.id === detailId),
    mode = snapshot?.mode ?? "local",
    remote = mode === "remote",
    referenceId = draft.maskEnabled
      ? draft.maskSourceId || draft.sourceId
      : draft.sourceId,
    referenceName = draft.maskEnabled
      ? draft.maskSourceName || draft.sourceName
      : draft.sourceName;
  const status = !snapshot
    ? "连接中"
    : remote
      ? health?.busy ? "远程正在创作" : health?.loaded ? "远程模型已就绪" : health?.ssh_status === "disconnected" ? "远程待调用 · SSH 未连接" : "远程按需启动"
      : health?.busy
        ? "正在创作"
        : health?.loaded
          ? "模型已就绪"
          : "按需启动";
  const toggle = (id: string) =>
    setSelection((old) => {
      const next = new Set(old);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const reuse = (job: Job, asReference = false) => {
    update(reuseDraft(job, asReference));
    remember(job.id);
    setDetailId(null);
    setView("create");
  };
  const save = async (id: string) => {
    try {
      await download(id);
    } catch (e) {
      setError(String(e));
    }
  };
  const ids = [...selection],
    allSelected =
      visible.length > 0 && visible.every((j) => selection.has(j.id));
  return (
    <section className="q2 q2-studio" aria-label="图像">
      <style>{STYLE}</style>
      <header className="q2-brand">
        <h2>图像</h2>
        <nav className="q2-nav" aria-label="工作室视图">
          <button
            aria-pressed={view === "gallery"}
            onClick={() => setView("gallery")}
          >
            图库
          </button>
          <button
            aria-pressed={view === "create"}
            onClick={() => setView("create")}
          >
            创作
          </button>
          {health?.loaded && !health.busy && (!remote || snapshot?.remoteAdvanced) && (
            <button
              className="q2-unload"
              onClick={() => void action("unload", [])}
            >
              释放内存
            </button>
          )}
        </nav>
        <div className="q2-status">
          <i className={running.length ? "working" : ""} />
          {status}
        </div>
      </header>
      {health?.connection_error && <div role="status" className="q2-alert">{health.connection_error}。模型卸载未确认，SSH 连接已保留并会重试。</div>}
      {connectionError && (
        <div role="status" className="q2-alert">
          {connectionError}
        </div>
      )}
      {error && (
        <div role="alert" className="q2-alert">
          {error}
          <button aria-label="关闭提示" onClick={() => setError("")}>
            <X size={13} />
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="q2-notice">
          {notice}
          <button aria-label="关闭操作提示" onClick={() => setNotice("")}>
            <X size={12} />
          </button>
        </div>
      )}
      {view === "create" ? (
        <div className="q2-create">
          <CreationPreview
            job={jobs.find((j) => j.id === selectedId && !j.deleted)}
            history={historyIds
              .map((id) => jobs.find((j) => j.id === id && !j.deleted))
              .filter((j): j is Job => Boolean(j))}
            remote={remote && !snapshot?.remoteAdvanced}
            clear={clearPreview}
            favorite={(job) => void action("favorite", [job.id], !job.favorite)}
            select={chooseResult}
            reuse={reuse}
            reference={(j) => reuse(j, true)}
            save={(id) => void save(id)}
            cancel={(id) => void action("cancel", [id])}
          />
          <div className="q2-editor">
            <div className="q2-editor-scroll">
              <label className="q2-prompt-label">
                画面描述
                <textarea
                  aria-label="画面描述"
                  value={draft.prompt}
                  placeholder="一座山间小屋，晨雾与松林，柔和的胶片光影…"
                  onChange={(e) => update({ prompt: e.target.value })}
                  onKeyDown={(e) => {
                    if (
                      (e.metaKey || e.ctrlKey) &&
                      e.key === "Enter" &&
                      !busy &&
                      !retry
                    ) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                />
              </label>
              {referenceId && (
                <div className="q2-reference" aria-label="参考图设置">
                  <div className="q2-reference-head">
                    <img src={imageURL(referenceId)} alt="参考图" />
                    <div>
                      <span>{referenceName || "参考图"}</span>
                      <small>
                        {draft.maskEnabled
                          ? "局部重绘的原图 · 蒙版黑色区域保留"
                          : "以这张图的构图与色彩为起点"}
                      </small>
                    </div>
                    <button
                      aria-label="移除参考图"
                      onClick={() =>
                        update({
                          sourceId: "",
                          sourceName: "",
                          additionalSourceIds: [],
                          additionalSourceNames: [],
                          maskId: "",
                          maskEnabled: false,
                          maskSourceId: "",
                          maskSourceName: "",
                        })
                      }
                    >
                      <X />
                    </button>
                  </div>
                  {!draft.maskEnabled && (
                    <>
                      <label>
                        变化幅度{" "}
                        <span>{Math.round(draft.changeStrength * 100)}%</span>
                        <input
                          aria-label="变化幅度"
                          type="range"
                          min="5"
                          max="95"
                          step="5"
                          value={draft.changeStrength * 100}
                          onChange={(e) =>
                            update({
                              changeStrength: Number(e.target.value) / 100,
                            })
                          }
                        />
                      </label>
                      <small>
                        越低越接近原图，越高变化越多。请描述目标画面；此模式不保证精准局部编辑。
                      </small>
                    </>
                  )}
                </div>
              )}
              <div className="q2-options">
                <div className="q2-option-label">画面比例</div>
                <div className="q2-presets" aria-label="画面比例">
                  {[
                    ["1024x1024", "1:1"],
                    ["1344x768", "16:9"],
                    ["768x1344", "9:16"],
                    ["1216x832", "3:2"],
                  ].map(([size, label]) => (
                    <button
                      aria-pressed={
                        draft.size === size ||
                        (label === "1:1" && draft.size === "512x512")
                      }
                      onClick={() => update({ size: size! })}
                      key={size}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <section className="q2-advanced" aria-label="生成参数">
                  <div className="q2-parameter-heading">
                    <span>生成参数</span>
                    <button
                      className="q2-advanced-link"
                      onClick={() => setAdvancedOpen(true)}
                    >
                      <SlidersHorizontal />
                      高级设置
                    </button>
                  </div>
                  <div className="q2-param-grid">
                    <label>
                      尺寸
                      <select
                        aria-label="画面尺寸"
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
                          <option value={s} key={s}>
                            {s.replace("x", " × ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="q2-field-title">
                        步数
                        <ParameterHelp name="步数" text={STEPS_HELP} />
                      </span>
                      <input
                        aria-label="生成步数"
                        type="number"
                        min="1"
                        max="60"
                        value={draft.steps}
                        onChange={(e) =>
                          update({ steps: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      <span className="q2-field-title">
                        种子
                        <ParameterHelp name="种子" text={SEED_HELP} />
                      </span>
                      <input
                        aria-label="随机种子"
                        inputMode="numeric"
                        placeholder="随机"
                        value={draft.seed}
                        onChange={(e) => update({ seed: e.target.value })}
                      />
                    </label>
                  </div>
                </section>
              </div>
            </div>
            <div className="q2-submit">
              {running.some((j) => j.id !== selectedId) && (
                <div className="q2-live-tasks" aria-label="后台生图任务">
                  {running
                    .filter((j) => j.id !== selectedId)
                    .map((j) => (
                      <button key={j.id} onClick={() => remember(j.id)}>
                        {statusLabel(j.status)} · {j.step ?? 0}/
                        {j.sampling_steps ?? j.steps} 步
                      </button>
                    ))}
                </div>
              )}
              {(enabledLoraCount > 0 ||
                draft.controlEnabled ||
                draft.maskEnabled) && (
                <button
                  className="q2-advanced-summary"
                  onClick={() => setAdvancedOpen(true)}
                >
                  <SlidersHorizontal />
                  {[
                    enabledLoraCount ? `LoRA ${enabledLoraCount}` : "",
                    draft.controlEnabled ? "结构控制" : "",
                    draft.maskEnabled ? "局部重绘" : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </button>
              )}
              <p>
                {remote
                  ? "由你配置的远程 Qwen 服务生成"
                  : "本机 Qwen Image · MLX"}{" "}
                · {privacy ? "默认存入隐私图库" : "自动保存"}
              </p>
              {retry && (
                <div className="q2-retry">
                  <button disabled={busy} onClick={() => void submit(true)}>
                    确认上次提交 / 重试
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      localStorage.removeItem(RECEIPT);
                      setRetry(false);
                      setError(
                        "已清除提交收据，请先检查图库是否已有任务，避免重复生成。",
                      );
                    }}
                  >
                    放弃重试
                  </button>
                </div>
              )}
              <button
                className="q2-primary"
                disabled={
                  busy ||
                  retry ||
                  !snapshot ||
                  !draft.prompt.trim() ||
                  running.length >= 4
                }
                onClick={() => void submit()}
              >
                {busy ? (
                  <LoaderCircle size={17} className="q2-spin" />
                ) : (
                  <ArrowUp size={17} />
                )}
                {draft.sourceId ? "生成变体" : "生成图片"} <small>⌘ ↵</small>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="q2-toolbar">
            <label className="q2-search">
              <Search size={14} />
              <input
                aria-label="搜索图片"
                placeholder="搜索画面…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelection(new Set());
                }}
              />
            </label>
            <select
              aria-label="图库筛选"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setSelection(new Set());
              }}
            >
              {!privacy && <option value="all">全部作品</option>}
              <option value="favorites">收藏</option>
              {privacy && <option value="private">隐私图库</option>}
              <option value="archived">已归档</option>
              <option value="trash">回收站</option>
            </select>
            <button
              aria-pressed={selecting}
              onClick={() => {
                setSelecting(!selecting);
                setSelection(new Set());
              }}
            >
              {selecting ? "完成" : "选择"}
            </button>
          </div>
          {privacy && filter === "private" && (
            <p className="q2-gallery-hint">
              未收藏的作品只在这里显示。点击星标后，会移入收藏图库。
            </p>
          )}
          {selecting && (
            <div className="q2-batch" role="toolbar" aria-label="批量操作">
              <button
                onClick={() =>
                  setSelection(
                    allSelected ? new Set() : new Set(visible.map((j) => j.id)),
                  )
                }
              >
                <Check size={13} />
                {allSelected ? "取消全选" : "全选当前结果"}
              </button>
              <span>已选 {ids.length}</span>
              {filter === "trash" ? (
                <>
                  <button
                    disabled={!ids.length || busy}
                    onClick={() => void action("restore", ids)}
                  >
                    恢复
                  </button>
                  <button
                    className="q2-danger"
                    disabled={!ids.length || busy}
                    onClick={() => setConfirm({ action: "purge", ids })}
                  >
                    彻底删除
                  </button>
                </>
              ) : (
                <>
                  <button
                    disabled={!ids.length || busy}
                    onClick={() =>
                      void action("favorite", ids, filter !== "favorites")
                    }
                  >
                    <Star />
                    {filter === "favorites" ? "取消收藏" : "收藏"}
                  </button>
                  <button
                    disabled={!ids.length || busy}
                    onClick={() =>
                      void action("archived", ids, filter !== "archived")
                    }
                  >
                    {filter === "archived" ? "取消归档" : "归档"}
                  </button>
                  <button
                    className="q2-danger"
                    disabled={!ids.length || busy}
                    onClick={() => setConfirm({ action: "delete", ids })}
                  >
                    删除
                  </button>
                </>
              )}
            </div>
          )}
          {running.length > 0 && (
            <div className="q2-running">
              <LoaderCircle size={14} className="q2-spin" />
              <span>{running.length} 个任务正在创作</span>
              <small>离开也会继续</small>
            </div>
          )}
          <div className="q2-gallery-scroll">
            <div className="q2-masonry">
              {visible.map((job) => (
                <article
                  className={`q2-card ${selection.has(job.id) ? "selected" : ""}`}
                  key={job.id}
                >
                  <button
                    className="q2-thumb"
                    aria-label={
                      selecting
                        ? `选择图片：${job.prompt}`
                        : `查看图片：${job.prompt}`
                    }
                    aria-pressed={selecting ? selection.has(job.id) : undefined}
                    onClick={() =>
                      selecting ? toggle(job.id) : setDetailId(job.id)
                    }
                  >
                    {job.status === "complete" ? (
                      <img
                        src={imageURL(job.id)}
                        alt={job.prompt}
                        loading="lazy"
                        width={job.width}
                        height={job.height}
                      />
                    ) : (
                      <div className="q2-task">
                        <Image size={24} />
                        <strong>{statusLabel(job.status)}</strong>
                        {active(job) && (
                          <div
                            className={`q2-progress ${job.source === "remote" && !job.progress_supported ? "q2-indeterminate" : ""}`}
                          >
                            <i
                              style={
                                job.source === "remote" && !job.progress_supported
                                  ? undefined
                                  : {
                                      width: `${Math.min(100, Math.max(3, ((job.step ?? 0) / (job.sampling_steps ?? job.steps)) * 100))}%`,
                                    }
                              }
                            />
                          </div>
                        )}
                        <span>
                          {job.source === "remote" && !job.progress_supported && active(job)
                            ? "远程服务处理中"
                            : job.status === "running"
                              ? `${job.step ?? 0} / ${job.sampling_steps ?? job.steps} 步`
                              : (job.error ?? "任务已记录")}
                        </span>
                      </div>
                    )}
                    {selecting && (
                      <span className="q2-check">
                        {selection.has(job.id) && <Check size={13} />}
                      </span>
                    )}
                    {job.archived && (
                      <span className="q2-archived">已归档</span>
                    )}
                  </button>
                  <div className="q2-caption">
                    <span title={job.prompt}>{job.prompt}</span>
                    <button
                      aria-label={job.favorite ? "取消收藏" : "收藏图片"}
                      aria-pressed={Boolean(job.favorite)}
                      onClick={() =>
                        void action("favorite", [job.id], !job.favorite)
                      }
                    >
                      <Star
                        size={13}
                        fill={job.favorite ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!visible.length && (
              <div className="q2-empty">
                <Image size={28} />
                <h3>
                  {filter === "trash"
                    ? "回收站是空的"
                    : query
                      ? "没有找到这幅画面"
                      : filter === "favorites"
                        ? "还没有收藏"
                        : filter === "private"
                          ? "隐私图库是空的"
                          : "留一点空间给想象"}
                </h3>
                <p>
                  {filter === "trash"
                    ? "删除的图片可以在这里恢复。"
                    : filter === "favorites"
                      ? "点击作品的星标，即可在这里查看。"
                      : privacy
                        ? "新生成的作品默认进入隐私图库，收藏后移入普通图库。"
                        : "从一句描述开始，作品会自动出现在这里。"}
                </p>
                {filter !== "trash" && (
                  <button onClick={() => setView("create")}>
                    <Plus size={14} />
                    创作第一张
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {advancedOpen && (
        <AdvancedSettings
          draft={draft}
          update={update}
          nativeEdit={Boolean(snapshot?.referenceEditSupported)}
          remote={remote && !snapshot?.remoteAdvanced}
          ready={(snapshot?.apiVersion ?? 0) >= 6}
          close={closeAdvanced}
        />
      )}
      {detail && (
        <div
          className="q2-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="图片详情"
        >
          <div className="q2-detail">
            <header>
              <button
                ref={closeRef}
                aria-label="关闭详情"
                onClick={() => setDetailId(null)}
              >
                <ArrowLeft size={17} />
              </button>
              <span>
                {detail.deleted
                  ? "回收站"
                  : detail.archived
                    ? "已归档"
                    : "作品详情"}
              </span>
              <button
                aria-label="下载原图"
                disabled={detail.status !== "complete"}
                onClick={() => void save(detail.id)}
              >
                <Download size={17} />
              </button>
            </header>
            <div className="q2-detail-scroll">
              {detail.status === "complete" ? (
                <img
                  className="q2-original"
                  src={imageURL(detail.id)}
                  alt={detail.prompt}
                />
              ) : (
                <div className="q2-task">
                  <strong>{statusLabel(detail.status)}</strong>
                  <span>
                    {detail.error ??
                      `${detail.step ?? 0}/${detail.sampling_steps ?? detail.steps}`}
                  </span>
                </div>
              )}
              <div className="q2-detail-copy">
                <span className="q2-eyebrow">PROMPT</span>
                <p>{detail.prompt}</p>
                <div className="q2-metadata">
                  <span>
                    {detail.width} × {detail.height}
                  </span>
                  <span>{detail.steps} 步</span>
                  <span>种子 {detail.seed}</span>
                </div>
              </div>
            </div>
            <footer>
              {active(detail) ? (
                <button onClick={() => void action("cancel", [detail.id])}>
                  取消任务
                </button>
              ) : detail.deleted ? (
                <>
                  <button onClick={() => void action("restore", [detail.id])}>
                    <RotateCcw size={14} />
                    恢复
                  </button>
                  <button
                    className="q2-danger"
                    onClick={() =>
                      setConfirm({ action: "purge", ids: [detail.id] })
                    }
                  >
                    彻底删除
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => reuse(detail)}>
                    <RotateCcw size={14} />
                    复用参数
                  </button>
                  {detail.status === "complete" && (!remote || snapshot?.remoteAdvanced) && (
                    <button onClick={() => reuse(detail, true)}>
                      用作参考
                    </button>
                  )}
                  <button
                    aria-label={detail.archived ? "取消归档" : "归档图片"}
                    onClick={() =>
                      void action("archived", [detail.id], !detail.archived)
                    }
                  >
                    <Archive size={15} />
                  </button>
                  <button
                    className="q2-danger"
                    aria-label="删除图片"
                    onClick={() =>
                      setConfirm({ action: "delete", ids: [detail.id] })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </footer>
          </div>
        </div>
      )}
      {confirm && (
        <div
          className="q2-confirm-backdrop"
          role="alertdialog"
          aria-modal="true"
          aria-label="确认删除"
        >
          <div className="q2-confirm">
            <Trash2 size={23} />
            <h3>
              {confirm.action === "purge" ? "永久删除" : "删除"}{" "}
              {confirm.ids.length} 张图片？
            </h3>
            <p>
              {confirm.action === "purge"
                ? "原图和任务文件将永久删除，此操作无法撤销。"
                : "图片将移到回收站，可以从图库筛选中恢复。已归档的图片也可以删除。"}
            </p>
            <div className="q2-actions">
              <button ref={closeRef} onClick={() => setConfirm(null)}>
                取消
              </button>
              <button
                className="q2-danger-fill"
                disabled={busy}
                onClick={() => void action(confirm.action, confirm.ids)}
              >
                {confirm.action === "purge" ? "永久删除" : "移到回收站"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
