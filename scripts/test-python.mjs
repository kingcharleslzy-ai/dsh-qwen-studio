import { execFileSync } from 'node:child_process';
import { pythonCommand } from './python-command.mjs';
execFileSync(pythonCommand(), ['-m','unittest','discover','-s','tests','-p','test_*.py'], {stdio:'inherit', env:{...process.env,PYTHONUTF8:'1'}});
