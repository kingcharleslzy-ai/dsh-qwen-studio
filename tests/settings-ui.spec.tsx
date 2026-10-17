import { test, expect, vi } from "vitest";
import React from "react";
import { create, act } from "react-test-renderer";
import { Settings } from "../src/client/settings.js";
import { resolveConfig } from "../src/resolved-config.js";
import { PresetBar } from "../src/client/preset-bar.js";
import { draftDefaults } from "../src/client/creation-draft.js";
const flush = () => new Promise((r) => setTimeout(r, 190));
test("remote mode keeps the shared idle control visible and saves it without replacing credentials or other settings", async () => {
  environment();
  const value = { connectionMode: "remote" as const, remoteSshHost: "test-gpu", remoteBaseURL: "http://127.0.0.1:19488/v1", localMfluxIdleMinutes: 10 };
  const mutations: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ effective: resolveConfig(value), health: { status: "remote", loaded: false } }) })));
  const scope: any = { getSnapshot: () => ({ value, user: value, revision: 9 }), subscribe: () => () => {}, mutate: async (ops: any[]) => { mutations.push(ops); return true; } };
  let tree: any;
  try {
    await act(async () => { tree = create(<Settings scope={scope} />); await flush(); });
    const input = tree.root.findAllByType("input").find((n: any) => n.props["aria-label"] === "空闲卸载时间");
    expect(input.props.value).toBe(10);
    await act(async () => { input.props.onChange({ target: { value: "7" } }); await flush(); });
    await act(async () => { await tree.root.findAllByType("button").find((n: any) => n.children.join("") === "保存设置").props.onClick(); });
    expect(mutations).toEqual([[{ op: "set", path: ["localMfluxIdleMinutes"], value: 7 }]]);
  } finally { await act(async () => tree?.unmount()); vi.unstubAllGlobals(); }
});
function environment() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", {
    localStorage: storage,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
  });
}
test("configuration form displays resolved inherited paths, saves only edited fields atomically and restores inheritance", async () => {
  environment();
  let value: any = { connectionMode: "local", localMfluxIdleMinutes: 10 },
    user: any = {},
    revision = 1;
  const listeners = new Set<() => void>(),
    mutations: any[] = [];
  const scope = {
    getSnapshot: () => ({ value, user, base: {}, revision, writable: true }),
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set: vi.fn(),
    mutate: async (ops: any[], expected?: number) => {
      expect(expected).toBe(revision);
      mutations.push(ops);
      for (const op of ops) {
        if (op.op === "unset") {
          delete value[op.path[0]];
          delete user[op.path[0]];
        } else {
          value = { ...value, [op.path[0]]: op.value };
          user = { ...user, [op.path[0]]: op.value };
        }
      }
      revision++;
      listeners.forEach((fn) => fn());
      return true;
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: any) => {
      const raw = JSON.parse(init?.body ?? "{}");
      return {
        ok: true,
        json: async () => ({
          effective: resolveConfig(
            { ...value, ...raw.config },
            {},
            "/home/test",
          ),
          health: { status: "offline" },
        }),
      };
    }),
  );

  let tree: any;
  try {
    await act(async () => {
      tree = create(<Settings scope={scope} />);
      await flush();
    });
    const root = tree.root,
      field = (name: string) =>
        root
          .findAllByType("input")
          .find((x: any) => x.props["aria-label"] === name);
    expect(field("LoRA 文件夹").props.value).toBe(
      "/home/test/.dsh/qwen-studio/loras",
    );
    await act(async () => {
      field("空闲卸载时间").props.onChange({ target: { value: "12" } });
      await flush();
    });
    const save = () =>
      root
        .findAllByType("button")
        .find((x: any) => x.children.join("") === "保存设置");
    await act(async () => {
      await save().props.onClick();
    });
    expect(mutations).toEqual([
      [{ op: "set", path: ["localMfluxIdleMinutes"], value: 12 }],
    ]);
    expect(user.loraDirectory).toBeUndefined();
    expect(scope.set).not.toHaveBeenCalled();
    await act(async () => {
      field("LoRA 文件夹").props.onChange({ target: { value: "/custom" } });
      await flush();
    });
    await act(async () => {
      await save().props.onClick();
    });
    const reset = root
      .findAllByType("button")
      .find((x: any) => x.props["aria-label"] === "恢复 loraDirectory 默认");
    await act(async () => {
      reset.props.onClick();
      await flush();
    });
    await act(async () => {
      await save().props.onClick();
    });
    expect(mutations.at(-1)).toEqual([
      { op: "unset", path: ["loraDirectory"] },
    ]);
    expect(user.loraDirectory).toBeUndefined();
  } finally {
    await act(async () => tree?.unmount());
    vi.unstubAllGlobals();
  }
});
test("loading a preset replaces advanced parameters while preserving the current prompt and marks later edits as modified", async () => {
  environment();
  let store: any = {
    schemaVersion: 1,
    revision: 1,
    defaultId: "a",
    items: [{ id: "a", name: "静物" }],
  };
  const updates: any[] = [];
  const loaded = { ...draftDefaults, steps: 20, negativePrompt: "blur" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: any) => ({
      ok: true,
      json: async () =>
        init?.method === "POST" ? { draft: loaded, issues: [] } : store,
    })),
  );
  let tree: any;
  try {
    await act(async () => {
      tree = create(
        <PresetBar
          draft={{ ...draftDefaults, prompt: "Keep this description" }}
          update={(v) => updates.push(v)}
          onError={(e) => {
            if (e) throw Error(e);
          }}
        />,
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    const select = tree.root.findAllByType("select")[0];
    await act(async () => {
      await select.props.onChange({ target: { value: "a" } });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(updates[0].steps).toBe(20);
    expect(updates[0]).not.toHaveProperty("prompt");
    await act(async () => {
      tree.update(
        <PresetBar
          draft={{ ...loaded, prompt: "Keep this description", steps: 21 }}
          update={(v) => updates.push(v)}
          onError={() => {}}
        />,
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain("已修改");
    const reload = tree.root.findAllByType("button").find(
      (x: any) => x.children.join("") === "重新加载",
    );
    await act(async () => { await reload.props.onClick(); });
    expect(updates.at(-1).steps).toBe(20);
    expect(updates.at(-1)).not.toHaveProperty("prompt");
  } finally {
    await act(async () => tree?.unmount());
    vi.unstubAllGlobals();
  }
});
