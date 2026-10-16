import { test, expect } from "vitest";
import {
  parseResult,
  resultDefinition,
  RESULT_KIND,
} from "../src/client/conversation-result.js";
const id = "c03f728b271f421d83b73a8f5c61ac18";
const attachment = {
  attachmentId: "sha256:test",
  mediaType: "image/jpeg",
  width: 512,
  height: 512,
  bytes: 20,
};
test("promotes completed images outside the collapsible tool process", () => {
  const event = {
    type: "tool/result",
    seq: 42,
    data: {
      meta: { kind: "qwen-studio", id, prompt: "A blue cup", attachment },
    },
  };
  const state = parseResult(event);
  expect(state).toMatchObject({
    id,
    seq: 42,
    prompt: "A blue cup",
    attachment,
  });
  expect(
    resultDefinition.buildViewNode({ state, key: "test", id: "result:42" }),
  ).toMatchObject({
    kind: RESULT_KIND,
    anchorSeq: 42,
    location: { kind: "session" },
    visibility: "visible",
    data: state,
  });
});
test("recovers previous image results but does not claim unrelated image tools", () => {
  const event = {
    type: "tool/result",
    seq: 4,
    data: {
      message: {
        content: [
          { type: "text", text: `Qwen Studio任务${id}已完成。` },
          { type: "image", attachment },
        ],
      },
    },
  };
  expect(parseResult(event)).toMatchObject({ id, attachment });
  expect(
    parseResult({
      ...event,
      data: { message: { content: [{ type: "image", attachment }] } },
    }),
  ).toBeUndefined();
  expect(parseResult({ ...event, type: "tool/call" })).toBeUndefined();
});
