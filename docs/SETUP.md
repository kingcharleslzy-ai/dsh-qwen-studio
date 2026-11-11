# 图像插件：安装、硬件自查与连接

插件包 `dsh-qwen-studio`（当前 **2.19.0**）。模型权重和推理环境**不包含**在插件包里，需要单独准备。

Agent 照这份文档做，就能把「用户机器够不够 → 装 → 连 → 出第一张图」走完；每一步都给了可执行命令和判读标准。

## 0. 先判断这台机器能不能跑

Qwen Image 2.1 有量化版本，最低门槛比 bf16 低很多。按这张表选档位，再决定要不要下权重：

| 环境 | 最低（量化） | 舒适 | 说明 |
| --- | --- | --- | --- |
| Apple Silicon Mac | MFLUX + 对应 MLX 权重 | 本次实机为 128 GB Apple Silicon | 16/24/32 GB 设备未做本版实测，不承诺低内存原生编辑；按模型实际峰值预留系统内存 |
| Windows + NVIDIA | 本包仅验证 24 GB RTX 4090 D 的指定 int8 safetensors | 24 GB | GGUF 不适用于当前工作流；10–12 GB 和 Linux GPU 未验收 |
| bf16 全量 | 另行核算权重、编码器和推理峰值 | 本版未验收 | 不能仅凭权重精度承诺最高画质或固定内存门槛 |
| Intel Mac / 无独显 | — | — | 只装插件看界面，推理交给局域网 GPU 机器 |

磁盘空间应覆盖全部权重、依赖、缓存和输出；下载前按实际文件大小核算。系统及推理中间张量都需要额外内存，不能只用权重文件大小推算能否运行。

自查命令：

```sh
# macOS
sysctl -n hw.memsize | awk '{printf "统一内存 %.0f GB\n", $1/1073741824}'
df -h / | tail -1

# Windows（PowerShell）
(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB
nvidia-smi --query-gpu=name,memory.total --format=csv
```

若找不到 `nvidia-smi`，先确认 NVIDIA 驱动与程序路径；这不能单独证明机器没有 GPU。硬件门槛表不是所有设备的实测保证。

## 1. 安装插件

三种入口，任选其一；装完**手动退出并重开 DSH**，再在插件设置里启用「图像」。

**A. 插件市场**（最省事）：DSH → 插件 → 自定义插件市场 → 发现 → 添加索引
`https://kingcharleslzy-ai.github.io/dsh-qwen-studio/index.json`，选 2.19.0 安装。

**B. 安装包（推荐给 Agent 执行）**：从 [Releases](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest) 下载 `dsh-qwen-studio-2.19.0.tgz`，然后：

```sh
# macOS / Linux（全局有 dsh 时）
dsh plugin --profile desktop add /绝对路径/dsh-qwen-studio-2.19.0.tgz

# macOS 没有全局 dsh：用桌面版内置 CLI
sh "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" \
  plugin --profile desktop add /绝对路径/dsh-qwen-studio-2.19.0.tgz
```

```powershell
# Windows PowerShell 可以直接调用 dsh.cmd；含空格的完整路径需使用 & 运算符
dsh.cmd plugin --profile desktop add "C:\绝对路径\dsh-qwen-studio-2.19.0.tgz"
# 没有 PATH 入口时，替换为桌面安装目录下的实际文件：
# & "C:\实际安装目录\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "C:\绝对路径\dsh-qwen-studio-2.19.0.tgz"
```

**C. 源码**：仅开发用，链接安装不会被自动更新覆盖。

安装前校验：将以下输出与同一 Release 的 SHA256SUMS.txt 中对应文件一行逐字核对，不匹配就停止。

```sh
shasum -a 256 dsh-qwen-studio-2.19.0.tgz   # macOS
certutil -hashfile dsh-qwen-studio-2.19.0.tgz SHA256   # Windows
```

## 2. Apple Silicon 本机（MLX）

1. 装 Python 3.12（`brew install python@3.12` 或 python.org 安装包），然后跑随包脚本：

   ```sh
   cd ~/.dsh/profiles/desktop/node_modules/dsh-qwen-studio
   sh scripts/setup-local.sh ~/qwen-studio-venv
   ```

   脚本只创建虚拟环境并安装 **MFLUX 0.22.0**，不下载模型。

2. 准备完整 Qwen Image 2.1 MLX 权重（含视觉编码器与 `processor`），参考
   [MFLUX 官方说明](https://github.com/mflux-community/mflux/blob/main/src/mflux/models/qwen21/README.md)。
   模型目录必须包含 `model_index.json` 或等价配置文件；**只下一个 safetensors 不算完整模型**。

3. 在 DSH 插件设置选「本地 Mac」，填三个路径：
   - Python：选虚拟环境**文件夹**（脚本会追加 `bin/python`，避免符号链接解析到系统解释器）；
   - 模型目录：第 2 步的权重目录；
   - 图库数据目录：默认 `~/.dsh/qwen-studio` 即可。

4. 点「保存并检查连接」。首次生图才会真正加载权重，之后按「空闲后释放」自动卸载。

## 2a. 远程模式客户端依赖（Mac 和 Windows 都需要）

即使推理在服务器，图片导入和客观评分也在运行 DSH 的电脑上执行。安装 Python 3.10+（开发测试推荐 3.12），在已安装包目录运行：

```powershell
# Windows PowerShell；若系统使用 py 启动器，可把 python 替换为 py -3
python scripts/setup-image-python.py
```

```sh
# macOS 客户端（不用本机 MLX 时）
python3 scripts/setup-image-python.py
```

脚本创建当前账户 `~/.dsh/qwen-studio/venv`，仅安装 Pillow 11–12、numpy 1.26–2.x，不下载模型、不改 DSH 设置。已有 MLX/ComfyUI 环境不要用这个脚本升级；可用 `--directory` 指向另一个新目录。把脚本最后打印的 Python 路径填到插件设置。Windows 默认是 `venv\Scripts\python.exe`，Mac 是 `venv/bin/python`。选择虚拟环境文件夹时界面自动追加对应平台后缀。

依赖自查：使用所选 Python 执行 `-c "import PIL,numpy; print(PIL.__version__,numpy.__version__)"`。纯文生图不一定触发这些依赖，不能据此认定导入已经可用。

## 3. Windows / Linux + NVIDIA（远程网关）

最短路径（详细步骤与模型文件名见 [REMOTE.md](REMOTE.md)）：

```powershell
# 1) 建目录
New-Item -ItemType Directory -Force C:\qwen | Out-Null
# 2) 复制网关脚本与自定义节点（从已安装的插件包里）
Copy-Item "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-qwen-studio\backend\qwen_gateway.py" C:\qwen\
Copy-Item "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-qwen-studio\backend\qwen_workflow.py" C:\qwen\
Copy-Item -Recurse "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-qwen-studio\backend\comfy_nodes\dsh_qwen" C:\qwen\ComfyUI\custom_nodes\
# 3) 虚拟环境（ComfyUI 依赖装在同一个环境里）
python -m venv C:\qwen\venv
C:\qwen\venv\Scripts\pip.exe install -r C:\qwen\ComfyUI\requirements.txt
# 4) 私有配置：密钥 + 空闲时间
'{"api_key":"<随机长串>","idle_seconds":300}' | Set-Content -Encoding UTF8 C:\qwen\gateway-config.json
# 5) 启动网关（监听 127.0.0.1:19488，用时才拉起 ComfyUI）
C:\qwen\venv\Scripts\python.exe C:\qwen\qwen_gateway.py
```

模型文件按 REMOTE.md 的四行清单放进 `C:\qwen\ComfyUI\models\` 对应子目录。网关首次任务启动 ComfyUI 前会检查常用视频端口和显存占用（不是轻量网关启动时），显存占用超过 6000 MiB 会拒绝启动；占用就先释放，不要硬启。

然后在插件设置选「远程服务器」：

| 字段 | 值 |
| --- | --- |
| 接口地址 | `http://127.0.0.1:19488/v1` |
| 模型名 | `qwen-image-2.1-int8` |
| 密钥 | `gateway-config.json` 里的 `api_key` |
| 按需 SSH 主机 | 可选，填 `~/.ssh/config` 里的别名（如 `gpu-server`），端口 19488 |

Windows 的 SSH 客户端可使用 Windows OpenSSH Client 或 Git for Windows。插件会自动查找常见安装路径；非标准路径用 `DSH_QWEN_SSH` 指定 ssh.exe，需在启动 DSH 的环境中设置。

SSH 首次信任主机密钥、配置公钥登录，都要先在终端手工完成——插件不会自动接受陌生主机密钥，也不会索要密码。

## 4. 连接与第一张图

1. 保存配置 → 点「保存并检查连接」。直连远程检查服务；按需 SSH 离线时只验证配置，不建立隧道，实际生成才握手。本机先检查 Python 与模型目录；
2. 左侧「图像 → 创作」，输入「一只坐在窗台上的橘猫，下午光」，尺寸 1024×1024，步数 20；
3. 判读：
   - **进度条有真实步数** → 后端通了；
   - 卡在 0% 且无日志 → 看 §5；
   - 从创作页生成应在图库出现图片；从会话工具生成才同时有会话图片卡片。分别验收两个入口。

会话里也可以直接说「画一张…」；Agent 会调用 `qwen_generate_image`。

## 5. 排错

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `model_index.json` 缺失 / 加载即失败 | 模型不完整（只下了单文件） | 按官方说明下完整目录 |
| 本机连接检查失败 | Python 选成了系统解释器 | 重选虚拟环境**文件夹**，确认 `<venv>/bin/python` 存在 |
| 远程 401 | 密钥为空或与 `gateway-config.json` 不一致 | 两边对齐，重启网关 |
| 远程连不上 / 端口占用 | 19488/19489/8188/8189 被占 | `lsof -i :19488` / `netstat -ano | findstr 19488` |
| 网关报显存不足 | 已有推理占用 GPU | 先停掉视频/其他模型进程 |
| SSH 连接被拒 | 首次 known_hosts 未确认 | 终端先 `ssh gpu-server` 手工确认一次 |
| 任务 30 分钟超时 | 远程排队或步数过高 | 先查询原任务和远程状态；确认已停止后再决定重试 |
| 出图但会话没有卡片 | 模型没调用工具，只是文字描述 | 明确说「用图像插件生成」，或直接在创作页出图 |

## 6. 升级与回滚

- 默认每 6 小时检查更新，自动安装默认关闭；生图时延后安装，安装前备份；
- 更新不会覆盖模型、图库、预设和远程配置，也不自动重启 DSH；
- 回滚：维护页「回滚」按备份恢复插件本体，数据目录不动。

## 7. 让其他文字模型调用

插件启用后注册 `qwen_generate_image` 工具与 `skills/qwen-image/SKILL.md` 技能。是否触发取决于模型能力、提示词与权限设置；左侧「图像」直接创作始终可用。
