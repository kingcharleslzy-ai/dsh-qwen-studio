# Windows 真机验收（交给 Codex / 其他 agent）

本仓库在 macOS 上开发，Windows 侧只有静态审查和逻辑单测，没有真机证据。
这份文件是给 **Windows 机器上的 agent** 的任务书：把下面那段直接粘给它即可。

## 一段话前因后果（贴给 agent）

```text
任务：在真实 Windows 11 + NVIDIA 上把 dsh-qwen-studio（DSH 生图插件）跑一遍，找出所有在
Windows 上会坏、会误导用户、或与文档不符的地方，写成可复现的清单。

背景
- 本地路径：C:\path\to\dsh-qwen-image（GitHub: kingcharleslzy-ai/dsh-qwen-studio，分支 main）
- 这是 DeepSeek Harness（DSH）的插件。本机 MLX 只在 macOS，Windows 走"自己的 GPU 网关"
  （backend/qwen_gateway.py + ComfyUI）。
- 开发机是 macOS：Windows 侧只有静态审查和逻辑单测，没有真机证据。这就是找你的原因。
- 已知一个可疑点：src/updates.ts 的 cliCommand() 在 win32 返回 dsh.cmd，而调用方是
  promisify(execFile)；Node 不能直接执行 .cmd。最近改成经 cmd.exe /d /s /c 转发，
  但没有真机验证。这只是起点，不是任务范围。

请自己决定查什么
安装、更新、卸载与回滚、路径与引号、编码、进程生命周期、显存检测、SSH 隧道、
错误提示是否可执行、文档与实现是否一致——按你认为的高风险顺序来，不用覆盖全部。

输出
1. 一张表：问题 / 严重度 / 证据（文件:行、命令、输出片段）/ 复现步骤；
2. 文档与实际不符的地方单独一节；
3. 你没能验证的点也列出来（别把"没测"写成"没问题"）。

边界
- 不碰用户的 prompt-inject.md、profile 权限、其他插件配置；
- 不自动重启 DSH，需要重启就写"请用户手动操作"；
- 不为了测试通过去关证书校验、跳 SHA256、改全局 npm 源或 shell 设置；
- 仓库里可能有一批不是你的未提交改动（src/client/*、backend/*、AGENTS.md），
  先 git status 看清，不要提交或回滚它们；
- 只报告，不改代码、不发版。
```

## 环境准备（Windows）

```powershell
# 1) 克隆与依赖
git clone https://github.com/kingcharleslzy-ai/dsh-qwen-studio.git C:\work\dsh-qwen-image
cd C:\work\dsh-qwen-image
npm ci
npm run build

# 2) 插件安装（tgz 走 dsh.cmd，直接 dsh 会 EINVAL）
npm pack
dsh.cmd plugin --profile desktop add .\dsh-qwen-studio-2.18.3.tgz

# 3) 网关侧（推理机器）
python -m venv C:\qwen\venv
C:\qwen\venv\Scripts\pip.exe install -r C:\qwen\ComfyUI\requirements.txt
C:\qwen\venv\Scripts\python.exe C:\qwen\qwen_gateway.py
```

模型文件与网关配置见 [REMOTE.md](REMOTE.md)；`gateway-config.json` 的 `api_key` 现在**必须 ≥16 位**，
空密钥网关会直接拒绝启动。

## 判定标准

| 项 | 通过 |
| --- | --- |
| 自动更新安装 | 走 `cmd.exe /d /s /c dsh.cmd …`，tgz 真的装上，版本号变化，无 EINVAL |
| 网关启停 | `taskkill /T /F` 清完整进程树，`tasklist` 无孤儿 python |
| 显存检测 | `nvidia-smi` 输出可解析；占用 >6 GB 时报错而不是硬启 |
| SSH 隧道 | 首次 known_hosts 需人工确认；断开后隧道清理干净 |
| 文档 | SETUP / REMOTE 的 Windows 步骤照抄能跑通 |

未覆盖到的项目在报告里写"未验证"，不要写成"无问题"。
