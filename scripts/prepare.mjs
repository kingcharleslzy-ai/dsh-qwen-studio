// Release and market bundles are precompiled. Source checkouts build explicitly.
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
if (!existsSync('lib/index.js') || !existsSync('lib/client.js') || !existsSync('lib/maintenance.js'))
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run','build'], {stdio:'inherit'});
