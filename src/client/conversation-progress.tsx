import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { active, statusLabel, type Job } from "../shared.js";
import { request, imageURL, APIError } from "./api.js";
import { STYLE } from "./style.js";
export const PROGRESS_KIND = "qwen-studio-image-progress";
interface Event {
  type: string;
  seq: number;
  time?: number;
  data: Record<string, any>;
}
interface Progress {
  callId: string;
  prompt: string;
  seq: number;
  since: number;
  ended?: boolean;
}
export function parseProgress(event: Event): Progress | undefined {
  if (
    event.type !== "tool/call" ||
    event.data.name !== "qwen_generate_image" ||
    typeof event.data.callId !== "string"
  )
    return;
  try {
    const args =
      typeof event.data.arguments === "string"
        ? JSON.parse(event.data.arguments)
        : event.data.arguments;
    if (typeof args?.prompt !== "string" || !args.prompt.trim()) return;
    return {
      callId: event.data.callId,
      prompt: args.prompt,
      seq: event.seq,
      since: event.time ?? 0,
    };
  } catch {
    return;
  }
}
export const progressDefinition = {
  kind: PROGRESS_KIND,
  target: "chat",
  match(event: Event) {
    const call = parseProgress(event);
    if (call) return { id: call.callId, role: "start" };
    const callId =
      event.type === "tool/result" ? event.data.message?.toolCallId : undefined;
    return typeof callId === "string" ? { id: callId, role: "update" } : null;
  },
  start(_context: unknown, match: { event: Event }) {
    return parseProgress(match.event);
  },
  update(context: { state?: Progress }, match: { event: Event }) {
    return match.event.type === "tool/result" && context.state
      ? { ...context.state, ended: true }
      : context.state;
  },
  buildViewNode(context: { state?: Progress; key: string; id: string }) {
    if (!context.state) return null;
    return {
      key: context.key,
      kind: PROGRESS_KIND,
      id: context.id,
      target: "chat",
      anchorSeq: context.state.seq,
      location: { kind: "session" },
      visibility: context.state.ended ? "hidden" : "visible",
      data: context.state,
    };
  },
};
interface State {
  status: string;
  job?: Job;
  error?: string;
}
export function ConversationProgress({
  node,
  sessionId = "",
}: {
  node: { data: Progress };
  sessionId?: string;
}) {
  const { callId, prompt, since } = node.data;
  const [state, setState] = useState<State>({ status: "waiting" });
  const [disconnected, setDisconnected] = useState(false);
  useEffect(() => {
    let alive = true,
      pending = false,
      finished = false;
    const poll = async () => {
      if (pending || finished) return;
      pending = true;
      try {
        const next = await request<State>("progress", {
          call_id: callId,
          prompt,
          since,
          session_id: sessionId,
        });
        if (alive) {
          setState(next);
          setDisconnected(false);
        }
        finished =
          next.status === "failed" || Boolean(next.job && !active(next.job));
      } catch (error) {
        if (alive && error instanceof APIError && error.status === 404) {
          setState({
            status: "failed",
            error: "请正常退出并重新打开 DSH，加载本版生图进度接口。",
          });
          finished = true;
        } else if (alive) setDisconnected(true);
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
  }, [callId, prompt, since, sessionId]);
  const job = state.job,
    total = job?.sampling_steps ?? job?.steps ?? 1;
  return (
    <section className="q2 q2-chat-progress" aria-label="图像生成进度">
      <style>{STYLE}</style>
      <div>
        <LoaderCircle className={job && !active(job) ? "" : "q2-spin"} />
        <strong>图像</strong>
        <span role="status">
          {disconnected
            ? "连接中断，正在重连…"
            : job
              ? statusLabel(job.status)
              : state.status === "failed"
                ? "提交失败"
                : "正在提交任务…"}
        </span>
      </div>
      {job && active(job) && (
        <>
          <progress
            max={total}
            value={
              job.source === "remote" ||
              ["queued", "loading"].includes(job.status)
                ? undefined
                : (job.step ?? 0)
            }
          />
          <small>
            {job.source === "remote"
              ? "远程服务处理中，暂不提供逐步进度"
              : `${job.step ?? 0} / ${total} 步`}
          </small>
        </>
      )}
      {job?.status === "complete" && (
        <img src={imageURL(job.id)} alt={prompt} />
      )}
      {(state.error || job?.error) && (
        <small>{state.error ?? job?.error}</small>
      )}
      <small>进度同步到左侧「图像」，切换页面不会取消任务。</small>
    </section>
  );
}
