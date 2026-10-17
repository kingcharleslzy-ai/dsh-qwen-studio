import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";

const fakePool = new BlockList();
fakePool.addSubnet("198.18.0.0", 15, "ipv4");

/** Fake-IP TUN DNS cannot establish whether a destination is public. Resolve only
 * these synthetic answers over HTTPS, then let the importer validate and pin them.
 * This is per-request DNS, never a change to the machine's proxy/DNS settings. */
export async function imageAddresses(host: string, signal: AbortSignal) {
  const literal = isIP(host);
  if (literal) return [{ address: host, family: literal }];
  const system = await lookup(host, { all: true, verbatim: true });
  if (!system.length || !system.every(a => isIP(a.address) === 4 && fakePool.check(a.address, "ipv4"))) return system;
  for (const endpoint of ["https://dns.alidns.com/resolve", "https://cloudflare-dns.com/dns-query"]) {
    signal.throwIfAborted();
    try {
      const url = new URL(endpoint);
      url.searchParams.set("name", host); url.searchParams.set("type", "A");
      const body = await new Promise<string>((accept, reject) => {
        const req = request(url, { agent: false, signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), headers: { Accept: "application/dns-json" } }, res => {
          if (res.statusCode !== 200) { res.destroy(); reject(Error("DNS response status")); return; }
          let body = "";
          res.on("data", chunk => { body += chunk; if (body.length > 65536) res.destroy(Error("DNS response too large")); });
          res.on("error", reject); res.on("end", () => accept(body));
        });
        req.on("error", reject); req.end();
      });
      const data = JSON.parse(body) as { Status?: number; Answer?: { type: number; data: string }[] };
      if (data.Status !== 0) throw Error("DNS query failed");
      const answers = (data.Answer ?? []).filter(a => a.type === 1 && isIP(a.data) === 4).map(a => ({ address: a.data, family: 4 }));
      if (!answers.length) throw Error("DNS query returned no IPv4 address");
      return answers;
    } catch { signal.throwIfAborted(); }
  }
  throw Error("当前 DNS 返回代理虚拟地址，真实公网地址核验失败；请换用可访问的图片链接或本机文件");
}
