import { test, expect, vi, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
const network = vi.hoisted(() => ({ port: 0, dns: vi.fn(), calls: [] as string[], doh: "93.184.216.34" }));
vi.mock("node:dns/promises", () => ({ lookup: network.dns }));
vi.mock("node:http", async () => {
  const real = await vi.importActual<typeof import("node:http")>("node:http");
  return { ...real, request: (url: URL, options: any, cb: any) => {
    network.calls.push(url.href);
    options.lookup(url.hostname, { all: true }, (error: unknown, addresses: { address: string }[]) => {
      expect(error).toBeNull();
      expect(addresses).toHaveLength(1);
      expect(addresses[0]!.address).toBe("93.184.216.34");
    });
    // Real streamed HTTP on a fixture server; production URL validation and redirect logic stay active.
    return real.request(`http://127.0.0.1:${network.port}${url.pathname}`, { ...options, lookup: undefined }, cb);
  } };
});
vi.mock("node:https", async () => {
  const real = await vi.importActual<typeof import("node:http")>("node:http");
  return { request: (url: URL, options: any, cb: any) => real.request(`http://127.0.0.1:${network.port}${url.pathname}`, { ...options, lookup: undefined }, cb) };
});
import { importImage, isPublicImageAddress } from "../src/image-import.js";
import { imagePath, readJobs } from "../src/storage.js";
import { readFile } from "node:fs/promises";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
let server: Server | undefined;
afterEach(async () => { if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; } });
async function fixture() {
  network.calls = [];
  network.dns.mockReset().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  server = createServer((req, res) => {
    if (req.url === "/resolve") { res.setHeader("content-type", "application/dns-json"); res.end(JSON.stringify({ Status: 0, Answer: [{ type: 1, data: network.doh }] })); }
    else if (req.url === "/redirect") { res.writeHead(302, { location: "/photo.png" }); res.end(); }
    else if (req.url === "/private") { res.writeHead(302, { location: "http://127.0.0.1/secret" }); res.end(); }
    else if (req.url === "/loop") { res.writeHead(302, { location: "/loop" }); res.end(); }
    else if (req.url === "/html") { res.writeHead(200, { "content-type": "text/html" }); res.end("<html>page</html>"); }
    else if (req.url === "/huge") { res.writeHead(200, { "content-type": "image/png", "content-length": 65 * 1024 * 1024 }); res.end(); }
    else if (req.url === "/missing") { res.writeHead(404); res.end(); }
    else if (req.url === "/slow") { res.writeHead(200, { "content-type": "image/png" }); res.write(png.subarray(0, 4)); }
    else { res.writeHead(200, { "content-type": "image/png" }); res.write(png.subarray(0, 10)); res.end(png.subarray(10)); }
  });
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  network.port = (server.address() as any).port;
  const directory = await mkdtemp(join(tmpdir(), "qwen-agent-import-"));
  return { directory, options: { directory, python: process.env.QWEN_TEST_PYTHON || "python3", readAttachment: vi.fn(async () => ({ data: png })) } };
}
test("public images stream through redirects into reusable resources, not gallery jobs", async () => {
  const f = await fixture();
  try {
    const asset = await importImage({ url: "http://images.example/redirect", name: "山景参考" }, f.options);
    expect(asset).toMatchObject({ kind: "source", name: "山景参考", width: 1, height: 1 });
    expect(asset.id).toMatch(/^[a-f0-9]{32}$/);
    expect(await readFile(await imagePath(f.directory, asset.id))).toBeInstanceOf(Buffer);
    expect(await readJobs(f.directory)).toEqual([]);
    expect(network.calls).toEqual(["http://images.example/redirect", "http://images.example/photo.png"]);
    expect(network.dns).toHaveBeenCalledTimes(2);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});
test("URL errors fail before accepting an asset, including private redirects and mixed DNS", async () => {
  const f = await fixture();
  try {
    for (const [path, message] of [["private", "公网"], ["loop", "重定向"], ["html", "直链"], ["huge", "64MiB"], ["missing", "404"]])
      await expect(importImage({ url: `http://images.example/${path}` }, f.options)).rejects.toThrow(message);
    const before = network.calls.length;
    network.dns.mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }]);
    await expect(importImage({ url: "http://images.example/photo.png" }, f.options)).rejects.toThrow("公网");
    await expect(importImage({ url: "file:///tmp/a.png" }, f.options)).rejects.toThrow("HTTP/HTTPS");
    await expect(importImage({ url: "http://user:secret@images.example/a.png" }, f.options)).rejects.toThrow("用户名密码");
    expect(network.calls).toHaveLength(before);
    expect(await readdir(f.directory)).toEqual([]);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});
test("downloads observe cancellation and clean partial input files", async () => {
  const f = await fixture(), controller = new AbortController();
  try {
    const pending = importImage({ url: "http://images.example/slow" }, { ...f.options, signal: controller.signal });
    setTimeout(() => controller.abort(), 100);
    await expect(pending).rejects.toThrow();
    expect(await readdir(join(f.directory, "assets/.incoming"))).toEqual([]);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});
test("local files and verified conversation attachments use the same image normalization", async () => {
  const f = await fixture(), original = join(f.directory, "original.png");
  try {
    await writeFile(original, png);
    const local = await importImage({ path: original, kind: "control" }, f.options);
    expect(local).toMatchObject({ name: "original.png", kind: "control", width: 1 });
    expect(await readFile(original)).toEqual(png);
    const attachment = { attachmentId: "real-ref", mediaType: "image/png", bytes: png.length, width: 1, height: 1, name: "mask.png" } as any;
    const mask = await importImage({ attachment, kind: "mask" }, f.options);
    expect(mask).toMatchObject({ name: "mask.png", kind: "mask", width: 1 });
    expect(f.options.readAttachment).toHaveBeenCalledWith(attachment, expect.any(AbortSignal));
    await expect(importImage({ path: original, url: "http://images.example/a.png" }, f.options)).rejects.toThrow("其中一项");
    await expect(importImage({ path: "relative.png" }, f.options)).rejects.toThrow("绝对路径");
    await expect(importImage({ path: f.directory }, f.options)).rejects.toThrow("普通图片");
    await expect(importImage({ attachment: { attachmentId: "fake" } as any }, f.options)).rejects.toThrow("真实");
    expect(network.calls).toEqual([]);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});
test("address checks cover loopback, Tailscale, mapped IPv6 and public addresses", () => {
  for (const address of ["localhost", "127.0.0.1", "10.0.0.2", "100.100.100.100", "169.254.169.254", "172.16.2.3", "192.168.1.1", "::1", "::ffff:127.0.0.1", "fd7a:115c:a1e0::1", "fe80::1"])
    expect(isPublicImageAddress(address), address).toBe(false);
  for (const address of ["93.184.216.34", "2606:4700:4700::1111"]) expect(isPublicImageAddress(address)).toBe(true);
});
test("Fake-IP proxy DNS is checked with HTTPS DNS without accepting private destinations", async () => {
  const f = await fixture();
  try {
    network.dns.mockResolvedValue([{ address: "198.18.0.170", family: 4 }]);
    network.doh = "93.184.216.34";
    expect(await importImage({ url: "http://images.example/photo.png" }, f.options)).toMatchObject({ width: 1 });
    network.doh = "10.0.0.1";
    const before = network.calls.length;
    await expect(importImage({ url: "http://images.example/private" }, f.options)).rejects.toThrow("公网");
    expect(network.calls).toHaveLength(before);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});
