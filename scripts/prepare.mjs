// Release and market bundles are precompiled. Source checkouts build explicitly.
import { existsSync } from 'node:fs';
import { runNpm } from './npm-command.mjs';
if (!existsSync('lib/index.js') || !existsSync('lib/client.js') || !existsSync('lib/maintenance.js'))
  runNpm(['run','build'], {stdio:'inherit'});
