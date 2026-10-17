import { test, expect, vi } from "vitest";
import { RemoteLifecycle, sshOptions, type Tunnel } from "../src/remote-lifecycle.js";
import { Worker } from "../src/worker.js";
import type { Config } from "../src/config.js";
function fixture() {
  let now = 1000;
  const config: Config = { connectionMode: "remote", remoteBaseURL: "http://127.0.0.1:19488/v1", remoteSshHost: "test-gpu", localMfluxIdleMinutes: .1 };
  const events: string[] = [];
  const tunnel: Tunnel = { connected: false, connect: vi.fn(async () => { tunnel.connected = true; events.push("connect"); }), disconnect: vi.fn(async () => { tunnel.connected = false; events.push("disconnect"); }) };
  const io = { configure: vi.fn(async (_c: Config, seconds: number) => { events.push(`configure:${seconds}`); }), unload: vi.fn(async () => { events.push("unload-confirmed"); }) };
  const life = new RemoteLifecycle(() => config, tunnel, io, () => now);
  return { config, events, tunnel, io, life, advance: (ms: number) => { now += ms; } };
}
test("no SSH or HTTP for passive health, capabilities and configuration checks", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const w = new Worker(() => ({ connectionMode: "remote", remoteBaseURL: "http://127.0.0.1:19488/v1", remoteSshHost: "test-gpu" }));
  try {
    expect(await w.health()).toMatchObject({ loaded: false, ssh_status: "disconnected" });
    expect(await w.capabilities()).toMatchObject({ verification: "on_generation" });
    expect(await w.check()).toMatchObject({ ok: true });
    expect(w.lifecycle.connected).toBe(false); expect(fetch).not.toHaveBeenCalled();
  } finally { await w.dispose(); vi.unstubAllGlobals(); }
});
test("all queued leases protect upload and generation; idle starts after the last save", async () => {
  const f = fixture();
  try {
    expect(f.events).toEqual([]);
    const a = await f.life.acquire(f.config), b = await f.life.acquire(f.config);
    f.advance(100000); await f.life.sweep(); expect(f.io.unload).not.toHaveBeenCalled();
    a(); a(); f.advance(100000); await f.life.sweep(); expect(f.io.unload).not.toHaveBeenCalled();
    b(); f.advance(5999); await f.life.sweep(); expect(f.tunnel.connected).toBe(true);
    f.advance(1); await f.life.sweep();
    expect(f.events).toEqual(["connect", "configure:6", "connect", "unload-confirmed", "disconnect"]);
  } finally { await f.life.dispose(); }
});
test("unload failure or busy server keeps SSH alive; retry disconnects only after confirmation", async () => {
  const f = fixture();
  try {
    const release = await f.life.acquire(f.config); release(); f.advance(7000);
    f.io.unload.mockRejectedValueOnce(Error("busy"));
    await expect(f.life.sweep()).rejects.toThrow("busy");
    expect(f.tunnel.connected).toBe(true); expect(f.events).not.toContain("disconnect");
    await f.life.sweep(); expect(f.events.slice(-2)).toEqual(["unload-confirmed", "disconnect"]);
  } finally { await f.life.dispose(); }
});
test("editing the idle setting syncs to server without extending last task's idle deadline", async () => {
  const f = fixture();
  try {
    const release = await f.life.acquire(f.config); release(); f.advance(7000);
    f.config.localMfluxIdleMinutes = .2; await f.life.sweep();
    expect(f.events).toContain("configure:12"); expect(f.life.remaining).toBe(5);
    f.advance(5000); await f.life.sweep(); expect(f.tunnel.connected).toBe(false);
  } finally { await f.life.dispose(); }
});
test("a new request arriving during unload waits for confirmed shutdown then reconnects", async () => {
  const f = fixture();
  try {
    const release = await f.life.acquire(f.config); release(); f.advance(7000);
    let allow!: () => void;
    f.io.unload.mockImplementationOnce(async () => { await new Promise<void>(r => { allow = r; }); f.events.push("unload-confirmed"); });
    const closing = f.life.sweep(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const opening = f.life.acquire(f.config); allow(); await closing; const next = await opening;
    expect(f.events.slice(-4)).toEqual(["unload-confirmed", "disconnect", "connect", "configure:6"]); next();
  } finally { await f.life.dispose(); }
});
test("failed settings sync for a second job never cuts an already running job's connection", async () => {
  const f = fixture();
  try {
    const release = await f.life.acquire(f.config);
    f.config.localMfluxIdleMinutes = .2; f.io.configure.mockRejectedValueOnce(Error("network"));
    await expect(f.life.acquire(f.config)).rejects.toThrow("network");
    expect(f.tunnel.connected).toBe(true); expect(f.events).not.toContain("disconnect"); release();
  } finally { await f.life.dispose(); }
});
test("reconnection is limited to an active task, and reuses the existing task rather than creating one", async () => {
  const f = fixture();
  try {
    await f.life.reconnect(f.config); expect(f.events).toEqual([]);
    const release = await f.life.acquire(f.config); f.tunnel.connected = false;
    await f.life.reconnect(f.config); expect(f.tunnel.connected).toBe(true);
    expect(f.events.filter(x => x === "configure:6")).toHaveLength(2); release();
  } finally { await f.life.dispose(); }
});
test("SSH arguments reject options and restrict forwarding to the configured loopback gateway", () => {
  const c = { remoteSshHost: "test-gpu", remoteBaseURL: "http://127.0.0.1:19488/v1" };
  expect(sshOptions(c)).toMatchObject({ host: "test-gpu", port: 19488, remotePort: 19488 });
  for (const extra of [{ remoteSshHost: "-oProxyCommand=x" }, { remoteSshHost: "gpu;touch x" }, { remoteBaseURL: "http://example.org:19488/v1" }, { remoteSshPort: 0 }])
    expect(() => sshOptions({ ...c, ...extra })).toThrow();
});
