import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
// npm provides its JS entry in lifecycle scripts. Standalone checks also find standard Node installs.
export function runNpm(args, options = {}) {
  const base = dirname(process.execPath);
  const entry = [process.env.npm_execpath, join(base, 'node_modules/npm/bin/npm-cli.js'), join(base, '../lib/node_modules/npm/bin/npm-cli.js')].find(p => p && existsSync(p));
  if (!entry) throw Error('找不到 npm 的 JS 入口；请使用 npm run 执行此源码开发命令，或安装含 npm 的 Node.js。预编译插件不需要 npm。');
  return execFileSync(process.execPath, [entry, ...args], options);
}
