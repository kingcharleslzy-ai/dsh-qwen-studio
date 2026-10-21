import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pythonCommand } from './python-command.mjs';
const require=createRequire(import.meta.url), python=pythonCommand();
const result=spawnSync(process.execPath,[join(dirname(require.resolve('vitest/package.json')),'vitest.mjs'),'run',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,QWEN_TEST_PYTHON:python,PYTHONUTF8:'1'}});
if(result.error)throw result.error;
process.exitCode=result.status??1;
