import type { ImageAttachmentRef } from "@deepseek-ai/dsh-attachment";
import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { homedir } from "node:os";
import { imageAddresses } from "./image-dns.js";
import { BlockList, isIP } from "node:net";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { importAsset, type InputAsset } from "./assets.js";

const limit = 64 * 1024 * 1024;
const blocked4 = new BlockList(), blocked6 = new BlockList(), global6 = new BlockList();
global6.addSubnet("2000::", 3, "ipv6");
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const) blocked4.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 96], ["::ffff:0:0", 96], ["64:ff9b::", 96],
  ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 23],
  ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked6.addSubnet(network, prefix, "ipv6");

export function isPublicImageAddress(address: string) {
  const family = isIP(address);
  return family === 4 ? !blocked4.check(address, "ipv4") :
    family === 6 && global6.check(address, "ipv6") && !blocked6.check(address, "ipv6");
}

/** Validate every hop and pin DNS to the checked address; never forward cookies or auth. */
export async function openPublicImage(input: string, signal: AbortSignal): Promise<{ response: IncomingMessage; name: string }> {
  let url: URL;
  try { url = new URL(input); } catch { throw Error("请提供图片的完整 HTTP/HTTPS 地址"); }
  for (let hop = 0; hop <= 5; hop++) {
    signal.throwIfAborted();
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
      throw Error("图片地址仅支持无用户名密码的 HTTP/HTTPS 链接");
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = await imageAddresses(host, signal);
    signal.throwIfAborted();
    if (!addresses.length || addresses.some(({ address }) => !isPublicImageAddress(address)))
      throw Error("网址导入仅支持公网图片；本机文件请使用 path，不能访问本机、内网或 Tailscale 地址");
    const selected = addresses.find(a => a.family === 4) ?? addresses[0]!;
    const response = await new Promise<IncomingMessage>((accept, reject) => {
      const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
        agent: false, signal,
        headers: { Accept: "image/png,image/jpeg,image/webp", "User-Agent": "DSH-Qwen-Studio image-import" },
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [{ address: selected.address, family: selected.family }]);
          else callback(null, selected.address, selected.family);
        },
      }, accept);
      request.on("error", reject);
      request.end();
    });
    if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
      response.destroy();
      if (!response.headers.location || hop === 5) throw Error("图片重定向过多或缺少目标地址");
      url = new URL(response.headers.location, url);
      continue;
    }
    if (response.statusCode !== 200) {
      response.destroy();
      throw Error(`图片下载失败（HTTP ${response.statusCode}）；请选择可公开访问的图片直链`);
    }
    const type = (response.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
    if (type && !["image/png", "image/jpeg", "image/webp", "application/octet-stream", "binary/octet-stream"].includes(type)) {
      response.destroy();
      throw Error("网址未返回 PNG/JPEG/WebP 图片，请从搜索结果取得图片直链，不要传网页地址");
    }
    if (Number(response.headers["content-length"] ?? 0) > limit) {
      response.destroy(); throw Error("图片不能超过64MiB");
    }
    let name = "网络参考图";
    try { name = basename(decodeURIComponent(url.pathname)) || name; } catch {}
    return { response, name };
  }
  throw Error("图片重定向过多");
}

export interface ImageImportArgs {
  kind?: string;
  name?: string;
  url?: string;
  path?: string;
  attachment?: ImageAttachmentRef;
}
interface ImportOptions {
  directory: string;
  python: string;
  signal?: AbortSignal;
  readAttachment: (ref: ImageAttachmentRef, signal: AbortSignal) => Promise<{ data: Uint8Array }>;
}
async function* one(data: Uint8Array) { yield data; }

/** Import into the same managed library as the file picker, without starting inference/SSH. */
export async function importImage(args: ImageImportArgs, options: ImportOptions): Promise<InputAsset> {
  const kind = args.kind ?? "source";
  if (!["source", "control", "mask"].includes(kind)) throw Error("图片用途必须为 source、control 或 mask");
  if ([args.url, args.path, args.attachment].filter(value => value !== undefined).length !== 1)
    throw Error("必须且只能提供 url、path、attachment 其中一项");
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000);
  signal.throwIfAborted();
  const save = (name: string, data: AsyncIterable<Uint8Array>) => importAsset(options.directory, options.python, kind, args.name || name, data, signal);
  if (args.url !== undefined) {
    const { response, name } = await openPublicImage(args.url, signal);
    try { return await save(name, response); } finally { response.destroy(); }
  }
  if (args.path !== undefined) {
    const path = args.path.startsWith("~/") ? join(homedir(), args.path.slice(2)) : args.path;
    if (!isAbsolute(path)) throw Error("本机图片需要绝对路径或 ~/ 路径；不要传服务器路径或 file:// 链接");
    // Nonblocking open also avoids hanging on named pipes masquerading as image files.
    const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
    try {
      const info = await file.stat();
      if (!info.isFile() || !info.size || info.size > limit) throw Error("请选择不超过64MiB的本机普通图片文件");
      const stream = file.createReadStream({ autoClose: false, signal });
      try { return await save(basename(path), stream); } finally { stream.destroy(); }
    } finally { await file.close(); }
  }
  const ref = args.attachment!;
  if (!ref || typeof ref.attachmentId !== "string" || !["image/png", "image/jpeg", "image/webp"].includes(ref.mediaType) ||
      !Number.isInteger(ref.bytes) || ref.bytes < 1 || ref.bytes > limit ||
      !Number.isInteger(ref.width) || ref.width < 1 || !Number.isInteger(ref.height) || ref.height < 1)
    throw Error("请传入对话中真实的 PNG/JPEG/WebP 图片附件引用，不要猜 attachmentId 或把附件 ID 当图库 ID");
  const stored = await options.readAttachment(ref, signal);
  return save(ref.name || "会话参考图", one(stored.data));
}
