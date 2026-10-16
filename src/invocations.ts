import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { atomicJSON, readJob } from "./storage.js";
const key = (callId: string, prompt: string, sessionId: string) =>
  createHash("sha256")
    .update(JSON.stringify([sessionId, callId, prompt]))
    .digest("hex");
export async function recordInvocation(
  dir: string,
  callId: string,
  prompt: string,
  id: string,
  error?: string,
  sessionId = "",
) {
  const folder = join(dir, "state", "tool-calls");
  await mkdir(folder, { recursive: true });
  await atomicJSON(join(folder, key(callId, prompt, sessionId) + ".json"), {
    id,
    startedAt: Date.now(),
    ...(error ? { error } : {}),
  });
}
export async function invocationProgress(
  dir: string,
  callId: string,
  prompt: string,
  since = 0,
  sessionId = "",
) {
  if (
    !callId ||
    callId.length > 1024 ||
    !prompt ||
    prompt.length > 16000 ||
    !Number.isFinite(since)
  )
    throw Error("调用标识无效");
  let receipt: { id: string; startedAt: number; error?: string };
  try {
    receipt = JSON.parse(
      await readFile(
        join(
          dir,
          "state",
          "tool-calls",
          key(callId, prompt, sessionId) + ".json",
        ),
        "utf8",
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { status: "waiting" };
    throw error;
  }
  if (receipt.startedAt < since - 1000) return { status: "waiting" };
  const job = await readJob(dir, receipt.id);
  if (job && !job.deleted) return { status: "accepted", job };
  return receipt.error
    ? { status: "failed", error: receipt.error }
    : { status: "submitting" };
}
