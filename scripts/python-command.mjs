import { execFileSync } from 'node:child_process';
export function pythonCommand() {
  const candidates = process.env.QWEN_TEST_PYTHON ? [process.env.QWEN_TEST_PYTHON] : process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
  for (const candidate of candidates) {
    try { return execFileSync(candidate, ['-c', 'import sys; assert sys.version_info >= (3,10); print(sys.executable)'], {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000}).trim(); } catch {}
  }
  throw Error('Python 3.10+ is required for source tests; set QWEN_TEST_PYTHON to its executable and install Pillow, numpy, aiohttp.');
}
