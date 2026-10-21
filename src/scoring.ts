import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { imagePath } from "./storage.js";

const exec = promisify(execFile);

export interface ImageScore {
  metrics: Record<string, number>;
  flags: string[];
}

export async function scoreImage(directory: string, pythonPath: string, id: string): Promise<ImageScore> {
  const script = resolve(dirname(fileURLToPath(import.meta.url)), "../backend/score_image.py");
  const result = await exec(pythonPath, [script, await imagePath(directory, id)], {
    env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" }, windowsHide: true,
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(result.stdout.trim()) as ImageScore;
}
