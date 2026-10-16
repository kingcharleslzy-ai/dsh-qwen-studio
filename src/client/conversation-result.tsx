import { useEffect, useState } from "react";
import type { ImageAttachmentRef } from "@deepseek-ai/dsh-attachment";
import { API } from "../shared.js";
export const RESULT_KIND = "qwen-studio-image-result";
interface Event {
  type: string;
  seq: number;
  data: Record<string, any>;
}
interface Result {
  id: string;
  prompt: string;
  attachment: ImageAttachmentRef;
  seq: number;
}
export function parseResult(event: Event): Result | undefined {
  if (event.type !== "tool/result") return;
  const meta = event.data.meta;
  if (
    meta?.kind === "qwen-studio" &&
    typeof meta.id === "string" &&
    meta.attachment?.attachmentId
  )
    return {
      id: meta.id,
      prompt: meta.prompt ?? "生成的图片",
      attachment: meta.attachment,
      seq: event.seq,
    };
  // Recover images created by v2 before presentation metadata was added.
  const content = event.data.message?.content;
  if (!Array.isArray(content)) return;
  const text = content.find(
    (b) =>
      b.type === "text" &&
      /^(Qwen Studio|图像)任务[a-f0-9]{32}已完成/.test(b.text ?? ""),
  )?.text;
  const id = text?.match(/任务([a-f0-9]{32})已完成/)?.[1];
  const attachment = content.find((b) => b.type === "image")?.attachment;
  if (id && attachment?.attachmentId)
    return { id, prompt: "生成的图片", attachment, seq: event.seq };
}
export const resultDefinition = {
  kind: RESULT_KIND,
  target: "chat",
  match(event: Event) {
    return parseResult(event)
      ? { id: `result:${event.seq}`, role: "start" }
      : null;
  },
  start(_context: unknown, match: { event: Event }) {
    return parseResult(match.event);
  },
  update(context: { state: Result }) {
    return context.state;
  },
  buildViewNode(context: { state?: Result; key: string; id: string }) {
    if (!context.state) return null;
    return {
      key: context.key,
      kind: RESULT_KIND,
      id: context.id,
      target: "chat",
      anchorSeq: context.state.seq,
      location: { kind: "session" },
      visibility: "visible",
      data: context.state,
    };
  },
};
export function ConversationImage({ node }: { node: { data: Result } }) {
  const { id, attachment, prompt } = node.data,
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let objectURL = "";
    setUrl("");
    setError("");
    void fetch(API + "/attachment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attachment }),
      signal: controller.signal,
    })
      .then(async (response) => {
        // Desktop hot updates can leave the previous host module loaded until
        // the next app start. Its existing image route can serve the same job.
        if (response.status === 404)
          response = await fetch(API + "/image?id=" + encodeURIComponent(id), {
            signal: controller.signal,
          });
        if (!response.ok) throw Error("无法读取对话图片附件");
        return response.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectURL = URL.createObjectURL(blob);
        setUrl(objectURL);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(String(e));
      });
    return () => {
      controller.abort();
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [id, attachment.attachmentId]);
  return (
    <figure
      style={{ margin: "16px 0", font: "inherit" }}
      aria-label="生成的图片"
    >
      {url ? (
        <>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label="查看生成的图片"
          >
            <img
              src={url}
              alt={prompt}
              width={attachment.width}
              height={attachment.height}
              style={{
                display: "block",
                width: "min(100%, 512px)",
                height: "auto",
                borderRadius: "var(--dsw-radius-md,8px)",
              }}
            />
          </a>
          <figcaption
            style={{
              marginTop: 8,
              color: "var(--dsw-alias-label-secondary)",
              fontSize: ".875em",
            }}
          >
            图片已保存到左侧「图像」图库
          </figcaption>
        </>
      ) : (
        <p role="status">{error || "正在加载图片…"}</p>
      )}
    </figure>
  );
}
