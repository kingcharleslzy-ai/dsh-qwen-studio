import type { Health } from "./shared.js";
/** Release only a known idle worker; never interrupt another session's generation. */
export async function upgradeIdleWorker(
  health: Health,
  unload: () => Promise<unknown>,
  readHealth: () => Promise<Health>,
  pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
): Promise<Health> {
  if (health.status !== "ok" || health.closing || health.version === 6)
    return health;
  if (health.busy)
    throw Error(
      "旧版生图服务正在完成其他任务，请完成后再提交；不会中断现有任务",
    );
  if (![4, 5].includes(health.version ?? 0))
    throw Error("生图服务版本未知，请在空闲时手动释放模型后重试");
  await unload();
  for (let n = 0; n < 40; n++) {
    await pause(100);
    const next = await readHealth();
    if (
      next.status === "offline" ||
      (next.status === "ok" && next.version === 6 && !next.closing)
    )
      return next;
  }
  throw Error("旧生图服务正在退出，请稍后重试；未提交新任务");
}
