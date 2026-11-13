import { useEffect, useState } from "react";
import { VideoPage, installVideoPlayers } from "dsh-qwen-studio/video-client";
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
import { Settings, type Scope } from "./settings.js";
export const inject = ["slots", "connection", "remote"];
export function apply(ctx: Context) {
  ctx.inject([], async (owner) => {
    const legacy = await request<{video: boolean}>("legacy");
    if (!legacy.video) installVideoPlayers(owner);
  });
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
        label: "DSH-Spicy",
      },
      StudioIcon,
    ),
  );
}
function StudioIcon({ size = 16 }: { size?: number }) {
  return <Images size={size} aria-hidden="true" />;
}
function StudioPage() {
  const [mode, setMode] = useState(() => localStorage.getItem("qwen-studio-medium") === "video" ? "video" : "image");
  return <div style={{height: "100%", display: "flex", flexDirection: "column", minHeight: 0}}>
    <nav aria-label="创作类型" style={{display: "flex", gap: 6, padding: "max(8px,var(--dsh-frame-top-clearance,0px)) 16px 8px", borderBottom: "1px solid color-mix(in srgb,currentColor 15%,transparent)"}}>
      {([["image", "图像"], ["video", "视频"]] as const).map(([id, label]) =>
        <button key={id} aria-pressed={mode === id} onClick={() => { setMode(id); localStorage.setItem("qwen-studio-medium", id); }}
          style={{cursor: "pointer", borderRadius: 5, padding: "4px 14px", color: mode === id ? "Canvas" : "inherit", background: mode === id ? "CanvasText" : "transparent", border: "1px solid color-mix(in srgb,currentColor 25%,transparent)"}}>{label}</button>)}
    </nav>
    <div style={{flex: 1, minHeight: 0}}>{mode === "image" ? <Studio /> : <VideoPage />}</div>
  </div>;
}
