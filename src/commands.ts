import spawn from "cross-spawn";

/** Execute argv without shell interpolation; cross-spawn handles Windows batch shims. */
export function runCommand(command: string, args: string[], env?: Record<string, string>): Promise<string> {
  if ([command, ...args].some(value => /[\0\r\n]/.test(value)))
    return Promise.reject(Error("命令或路径包含不允许的换行/空字符"));
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env }, windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"], timeout: 180000,
    });
    const stdout: Buffer[] = [], stderr: Buffer[] = [];
    let size = 0, overflow = false;
    const collect = (chunks: Buffer[], chunk: Buffer) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) { overflow = true; child.kill(); }
      else chunks.push(chunk);
    };
    child.stdout!.on("data", chunk => collect(stdout, chunk));
    child.stderr!.on("data", chunk => collect(stderr, chunk));
    child.once("error", error => reject(Object.assign(Error(`无法启动 ${command}：${error.message}；请检查可执行文件路径/PATH`), { cause: error, code: (error as NodeJS.ErrnoException).code })));
    child.once("close", (code, signal) => {
      if (overflow) return reject(Error("安装器输出超过 2 MiB 限制"));
      if (code !== 0) return reject(Object.assign(Error(`${command} 执行失败（${signal || code}）：${Buffer.concat(stderr).toString("utf8").trim()}`), { code, signal }));
      resolve(Buffer.concat(stdout).toString("utf8"));
    });
  });
}
