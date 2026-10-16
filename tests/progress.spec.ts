import { test, expect } from "vitest";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordInvocation, invocationProgress } from "../src/invocations.js";
import { atomicJSON } from "../src/storage.js";
import {
  progressDefinition,
  parseProgress,
} from "../src/client/conversation-progress.js";
import { previewCandidate } from "../src/client/preview-follow.js";
import type { Job } from "../src/shared.js";
const job = (id: string, status = "running") =>
  ({
    id,
    status,
    prompt: "Blue cup",
    width: 512,
    height: 512,
    steps: 20,
    step: 3,
    seed: 1,
    started_at: 1,
  }) as Job;
test("conversation receipt follows its exact job through progress and completion without resubmitting", async () => {
  const dir = await mkdtemp(join(tmpdir(), "qwen-progress-")),
    id = "b".repeat(32);
  try {
    expect(await invocationProgress(dir, "call-test", "Blue cup")).toEqual({
      status: "waiting",
    });
    await recordInvocation(dir, "call-test", "Blue cup", id);
    expect(await invocationProgress(dir, "call-test", "Blue cup")).toEqual({
      status: "submitting",
    });
    await mkdir(join(dir, "images", id), { recursive: true });
    await atomicJSON(join(dir, "images", id, "job.json"), job(id));
    expect(
      await invocationProgress(dir, "call-test", "Blue cup"),
    ).toMatchObject({ job: { id, step: 3, status: "running" } });
    expect(await invocationProgress(dir, "other-call", "Blue cup")).toEqual({
      status: "waiting",
    });
    expect(await invocationProgress(dir, "call-test", "Other prompt")).toEqual({
      status: "waiting",
    });
    expect(
      await invocationProgress(
        dir,
        "call-test",
        "Blue cup",
        Date.now() + 10000,
      ),
    ).toEqual({ status: "waiting" });
    await atomicJSON(join(dir, "images", id, "job.json"), job(id, "complete"));
    expect(
      await invocationProgress(dir, "call-test", "Blue cup"),
    ).toMatchObject({ job: { status: "complete" } });
    await recordInvocation(
      dir,
      "same-call",
      "Blue cup",
      id,
      undefined,
      "session-A",
    );
    expect(
      await invocationProgress(dir, "same-call", "Blue cup", 0, "session-A"),
    ).toMatchObject({ job: { id } });
    expect(
      await invocationProgress(dir, "same-call", "Blue cup", 0, "session-B"),
    ).toEqual({ status: "waiting" });
    await recordInvocation(
      dir,
      "failed-call",
      "Blue cup",
      "c".repeat(32),
      "Startup failed",
    );
    expect(
      await invocationProgress(dir, "failed-call", "Blue cup"),
    ).toMatchObject({ status: "failed", error: "Startup failed" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("progress node starts only for image calls and retires on paired result", () => {
  const event = {
    type: "tool/call",
    seq: 4,
    time: 500,
    data: {
      name: "qwen_generate_image",
      callId: "call-one",
      arguments: JSON.stringify({ prompt: "Blue cup" }),
    },
  };
  const state = parseProgress(event)!;
  expect(state).toMatchObject({
    callId: "call-one",
    prompt: "Blue cup",
    since: 500,
  });
  expect(
    parseProgress({ ...event, data: { ...event.data, name: "other_tool" } }),
  ).toBeUndefined();
  expect(
    parseProgress({ ...event, data: { ...event.data, arguments: "{" } }),
  ).toBeUndefined();
  expect(
    progressDefinition.buildViewNode({ state, key: "p", id: "call-one" }),
  ).toMatchObject({ anchorSeq: 4, visibility: "visible" });
  const result = {
    type: "tool/result",
    seq: 5,
    data: { message: { toolCallId: "call-one" } },
  };
  expect(progressDefinition.match(result)).toEqual({
    id: "call-one",
    role: "update",
  });
  const ended = progressDefinition.update({ state }, { event: result });
  expect(
    progressDefinition.buildViewNode({
      state: ended,
      key: "p",
      id: "call-one",
    }),
  ).toBeNull();
});
test("creation follows new running jobs but honors clear and historical selection", () => {
  const a = job("a"),
    b = job("b");
  expect(previewCandidate([a], "", new Set(), new Set())?.id).toBe("a");
  expect(previewCandidate([b, a], "a", new Set(), new Set())).toBeUndefined();
  expect(previewCandidate([a], "", new Set(["a"]), new Set())).toBeUndefined();
  expect(
    previewCandidate([a], "old", new Set(), new Set(["a"])),
  ).toBeUndefined();
  expect(
    previewCandidate([job("c", "complete")], "", new Set(), new Set()),
  ).toBeUndefined();
});
