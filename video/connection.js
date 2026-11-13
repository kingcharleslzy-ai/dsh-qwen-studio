import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, win32 } from 'node:path';

export const dataHome = process.env.DSH_HOME || join(homedir(), '.dsh');

export async function connection() {
  const file = process.env.DSH_H3_CONFIG || join(dataHome, 'h3-video', 'connection.json');
  let config;
  try {
    config = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw Error('请先在 DSH 数据目录的 h3-video/connection.json 配置 Windows GPU 工作台，详见插件 README。');
    throw error;
  }
  const { transport, python, sshHost, worker } = config;
  if (!worker?.studioDir || !python || !win32.isAbsolute(python))
    throw Error('需要配置 GPU 主机上的 Python 绝对路径和 worker.studioDir。');
  if (transport === 'local' && process.platform === 'win32')
    return { cmd: python, argv: ['-X', 'utf8', '-'], worker };
  // Windows OpenSSH invokes its default shell on the remote command. Limit the
  // interpolated executable to a plain drive path before quoting it for cmd.
  if (transport !== 'ssh' || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/u.test(sshHost || '') ||
      !/^[A-Za-z]:[\\/][\p{L}\p{N} _.()\\/-]+\.exe$/iu.test(python))
    throw Error('请检查连接方式、SSH 主机别名与 Windows Python 路径。');
  const command = 'cmd.exe /d /s /c ""' + win32.normalize(python) + '" -X utf8 -"';
  const argv = ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o',
    'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', sshHost, command];
  return { cmd: 'ssh', sshHost, argv, worker };
}
