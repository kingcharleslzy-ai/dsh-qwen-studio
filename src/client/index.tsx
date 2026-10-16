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
import { Settings, type Scope } from "./settings.js";
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
