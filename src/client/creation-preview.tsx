import { useEffect, useState } from "react";
import {
  Image,
  Download,
  RotateCcw,
  LoaderCircle,
  X,
  Star,
} from "lucide-react";
import { active, statusLabel, type Job } from "../shared.js";
import { imageURL } from "./api.js";

export function CreationPreview({
  job,
  history,
  remote,
  select,
  reuse,
  reference,
  save,
  cancel,
  clear,
  favorite,
}: {
  job: Job | undefined;
  history: Job[];
  remote: boolean;
  select: (id: string) => void;
  reuse: (job: Job) => void;
  reference: (job: Job) => void;
  save: (id: string) => void;
  cancel: (id: string) => void;
  clear: () => void;
  favorite: (job: Job) => void;
}) {
  const [before, setBefore] = useState(false);
  useEffect(() => setBefore(false), [job?.id]);
  const total = job?.sampling_steps ?? job?.steps ?? 1;
  return (
    <section className="q2-preview" aria-label="创作结果">
      <header>
        <span>结果预览</span>
        <small>
          {job
            ? active(job)
              ? "任务已保存 · 切换页面仍会继续"
              : statusLabel(job.status)
            : "生成结果会显示在这里"}
        </small>
        {(job || history.length > 0) && (
          <button
            className="q2-clear-preview"
            onClick={clear}
            title="清空当前预览和缩略图，不删除图库作品，也不取消后台任务"
          >
            <X />
            清除预览
          </button>
        )}
      </header>
      <div className="q2-preview-stage" aria-live="polite">
        {job?.status === "complete" ? (
          <img
            src={imageURL(job.id) + (before ? "&reference=1" : "")}
            alt={before ? "本次生成使用的参考原图" : job.prompt}
          />
        ) : job && active(job) ? (
          <div className="q2-preview-empty">
            <LoaderCircle className="q2-spin" />
            <p>{statusLabel(job.status)}</p>
            <span>
              {job.source === "remote" && !job.progress_supported
                ? "远程服务正在处理"
                : `${job.phase ? job.phase + " · " : ""}${job.step ?? 0} / ${total} 步`}
            </span>
            <progress
              max={total}
              value={job.source === "remote" && !job.progress_supported ? undefined : (job.step ?? 0)}
            />
            <button onClick={() => cancel(job.id)}>取消任务</button>
          </div>
        ) : job ? (
          <div className="q2-preview-empty">
            <p>{statusLabel(job.status)}</p>
            <small>{job.error ?? "可以复用参数后重新生成"}</small>
            <button onClick={() => reuse(job)}>复用参数</button>
          </div>
        ) : (
          <div className="q2-preview-empty">
            <Image />
            <p>先描述画面，再生成</p>
            <small>完成后可在这里调整参数、用作参考，继续创作。</small>
          </div>
        )}
      </div>
      {job?.status === "complete" && (
        <div className="q2-result-actions">
          <button
            aria-pressed={Boolean(job.favorite)}
            onClick={() => favorite(job)}
          >
            <Star fill={job.favorite ? "currentColor" : "none"} />
            {job.favorite ? "已收藏" : "收藏"}
          </button>
          {job.source_image_id && (
            <button aria-pressed={before} onClick={() => setBefore(!before)}>
              {before ? "查看结果" : "对比原图"}
            </button>
          )}
          {!remote && <button onClick={() => reference(job)}>用作参考</button>}
          <button onClick={() => reuse(job)}>
            <RotateCcw />
            复用参数
          </button>
          <button onClick={() => save(job.id)}>
            <Download />
            下载
          </button>
        </div>
      )}
      {history.length > 0 && (
        <div className="q2-history" aria-label="最近创作记录">
          {history.map((item) => (
            <button
              key={item.id}
              aria-label={`查看创作记录：${item.prompt}`}
              aria-pressed={item.id === job?.id}
              onClick={() => select(item.id)}
            >
              {item.status === "complete" ? (
                <img src={imageURL(item.id)} alt="" />
              ) : (
                <span>{statusLabel(item.status)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
