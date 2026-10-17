import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { setTimeout as wait } from "node:timers/promises";
import type { Config } from "./config.js";

export function sshOptions(config: Config) {
  const host = config.remoteSshHost?.trim();
  if (!host) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.@-]{0,252}$/.test(host))
    throw Error("SSH 主机请填写已有的 SSH 别名或 user@host，不包含命令或选项");
  const url = new URL(config.remoteBaseURL || "");
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password || url.search || url.hash)
    throw Error("按需 SSH 的接口地址须为 http://127.0.0.1:本机端口/v1");
  const remotePort = config.remoteSshPort ?? 19488;
  if (!Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535)
    throw Error("远程网关端口应为1–65535");
  return { host, port: Number(url.port), remotePort };
}
const probe = (port: number) => new Promise<boolean>((resolve) => {
  const socket = createConnection({ host: "127.0.0.1", port });
  const done = (value: boolean) => { socket.destroy(); resolve(value); };
  socket.setTimeout(400); socket.once("connect", () => done(true));
  socket.once("error", () => done(false)); socket.once("timeout", () => done(false));
});
export interface Tunnel {
  connected: boolean;
  connect(config: Config): Promise<void>;
  disconnect(): Promise<void>;
}
export class SshTunnel implements Tunnel {
  private child: ChildProcess | undefined;
  private exitHandler = () => { this.child?.kill(); };
  constructor() { process.once("exit", this.exitHandler); }
  get connected() { return Boolean(this.child && this.child.exitCode === null && !this.child.killed); }
  async connect(config: Config) {
    if (this.connected) return;
    const target = sshOptions(config);
    if (!target) throw Error("未配置按需 SSH");
    if (await probe(target.port)) throw Error("SSH 本机端口已被其他进程占用；请先停用旧常驻隧道或换端口");
    const child = spawn("ssh", ["-N", "-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ExitOnForwardFailure=yes", "-o", "ConnectTimeout=12", "-o", "ControlMaster=no", "-o", "ControlPath=none", "-o", "ControlPersist=no", "-o", "ServerAliveInterval=20", "-o", "ServerAliveCountMax=3", "-L", `127.0.0.1:${target.port}:127.0.0.1:${target.remotePort}`, target.host], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    this.child = child;
    let error = "";
    child.stderr?.on("data", (chunk) => { error = (error + String(chunk)).slice(-2000); });
    child.once("error", (e) => { error = e.message; });
    try {
      for (let i = 0; i < 160; i++) {
        if (child.exitCode !== null || child.killed || (error && !child.pid))
          throw Error("SSH 连接失败：" + (error.trim() || "进程已退出"));
        if (await probe(target.port)) return;
        await wait(100);
      }
      throw Error("SSH 连接超时；请检查已保存的主机密钥、SSH 别名和服务器状态");
    } catch (e) { await this.disconnect(); throw e; }
  }
  async disconnect() {
    const child = this.child;
    this.child = undefined;
    if (!child || child.exitCode !== null) return;
    child.kill("SIGTERM");
    for (let i = 0; child.exitCode === null && i < 25; i++) await wait(40);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  dispose() { process.removeListener("exit", this.exitHandler); }
}

export interface LifecycleIO {
  configure(config: Config, seconds: number): Promise<void>;
  unload(config: Config): Promise<void>;
}
/** A lease covers admission, upload, queueing, sampling and saving, not just POST. */
export class RemoteLifecycle {
  private gate: Promise<unknown> = Promise.resolve();
  private active = 0;
  private last = 0;
  private config?: Config;
  private appliedSeconds = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private sweeping = false;
  private disposed = false;
  error = "";
  constructor(private current: () => Config, readonly tunnel: Tunnel, private io: LifecycleIO, private now = Date.now) {}
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.gate.then(fn); this.gate = result.catch(() => {}); return result;
  }
  get connected() { return this.tunnel.connected; }
  get remaining() { return this.active ? undefined : Math.max(0, this.seconds() - (this.now() - this.last) / 1000); }
  private seconds() { return Math.round((this.current().localMfluxIdleMinutes ?? 10) * 60); }
  private async configure() {
    const seconds = this.seconds();
    if (seconds < 6 || seconds > 86400 || !Number.isFinite(seconds)) throw Error("空闲时间应为0.1–1440分钟");
    if (seconds !== this.appliedSeconds) {
      await this.io.configure(this.config!, seconds); this.appliedSeconds = seconds;
    }
  }
  acquire(config: Config) {
    return this.serial(async () => {
      if (this.disposed) throw Error("插件正在退出，请重新提交任务");
      const key = (c: Config) => JSON.stringify([sshOptions(c), c.remoteBaseURL, c.remoteApiKey]);
      if (this.config && key(config) !== key(this.config)) {
        if (this.active) throw Error("已有远程任务，请结束后再切换 SSH 连接设置");
        await this.close();
      }
      if (!this.tunnel.connected && this.active) throw Error("SSH 已断线，等待原任务恢复后再提交");
      if (!this.tunnel.connected) this.appliedSeconds = 0;
      await this.tunnel.connect(config);
      this.config = { ...config };
      try { await this.configure(); } catch (e) { if (!this.active) await this.tunnel.disconnect(); this.appliedSeconds = 0; throw e; }
      this.active++; this.error = "";
      if (!this.timer) { this.timer = setInterval(() => {
        if (this.sweeping) return;
        this.sweeping = true;
        void this.sweep().catch(() => {}).finally(() => { this.sweeping = false; });
      }, 1000); this.timer.unref(); }
      let released = false;
      return () => { if (!released) { released = true; this.active--; this.last = this.now(); } };
    });
  }
  private async close() {
    if (this.tunnel.connected) {
      // Any failure/busy response leaves the connection alive for retry.
      await this.io.unload(this.config!);
      await this.tunnel.disconnect();
    }
    this.appliedSeconds = 0;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  sweep() {
    return this.serial(async () => {
      if (!this.tunnel.connected) return;
      try {
        await this.configure();
        if (this.active) return;
        if (this.remaining === 0) await this.close();
        this.error = "";
      } catch (e) { this.error = e instanceof Error ? e.message : String(e); throw e; }
    });
  }
  unload() { return this.serial(async () => { if (this.active) throw Error("远程仍有任务，暂不卸载"); await this.close(); }); }
  reconnect(config: Config) {
    return this.serial(async () => {
      if (this.disposed || !this.active || this.tunnel.connected) return;
      await this.tunnel.connect(config); this.appliedSeconds = 0; await this.configure();
    });
  }
  async dispose() {
    this.disposed = true;
    if (this.timer) clearInterval(this.timer);
    try {
      await this.serial(async () => {
        try { if (!this.active && this.tunnel.connected) await this.io.unload(this.config!); }
        finally { await this.tunnel.disconnect(); }
      });
    } finally { if (this.tunnel instanceof SshTunnel) this.tunnel.dispose(); }
  }
}
