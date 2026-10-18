# Qwen Studio：Agent 安装、配置和维护指南

包名 `dsh-qwen-studio`；DSH 中的入口名称是「图像」。这是插件，不是模型下载器，也不是独立的生图 App。

## 先确认环境，保留已有数据

1. 确认 DSH 版本、profile 和 DSH_HOME。2.12.0 声明支持 `>=0.2.1-rc.1 <0.2.2-0`；新宿主版本须重新测试，不能直接放宽兼容范围。
2. 先读 profile 的 package.json 和 Qwen 已有设置，只报告必要的非敏感字段。不要打印 API Key、SSH 配置密钥或整份用户配置。
3. 已安装用户：保留 localMfluxDirectory、Python/模型/HF 缓存路径、连接模式、SSH、空闲时间。保留图库的 state、images、trash、assets、loras；不要用示例覆盖它们。预设不需要迁移。
4. 新用户：请根据实际设备选择 Apple Silicon MLX 或用户自己的 NVIDIA 服务器。本项目不提供公共 GPU、预配置服务器地址、个人主机别名或通用密钥。不存在能直接照抄的作者部署。

## 安装：使用预编译包或预编译市场版本

- 推荐在 DSH 自定义插件市场添加 `https://kingcharleslzy-ai.github.io/dsh-qwen-studio/index.json`；共享市场 `https://kingcharleslzy-ai.github.io/dsh-purge/index.json` 也收录本插件。
- 市场启用方法：插件 → 实验性插件 → 自定义插件市场 → 发现 → 添加索引源。市场安装前仍由 DSH 显示确认。索引使用固定提交的预编译快照，不在用户电脑上构建前端。
- 手动下载：从 Releases 取 `dsh-qwen-studio-<版本>.tgz` 和 `SHA256SUMS.txt`，核对该文件对应的一行 SHA256。校验文件还列出了固定下载名的同内容安装包，不能因没有下载另一个别名文件就忽略真正的校验失败。
- 安装命令：`dsh plugin --profile <实际profile> add <安装包绝对路径>`。macOS 没有全局 dsh 时，使用 `/bin/sh "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile <实际profile> add <安装包绝对路径>`。
- 预编译 tgz 安装不需要全局 npm、tsc 或 Git；市场使用 Git 来源，因此需有可用的 Git（没有时用 tgz）。模型权重另行准备。源码开发才需要 Node.js 和 `npm ci --ignore-scripts && npm run check`。
- 安装后由用户在合适时手动退出并重新打开 DSH。不要自动重启或强行刷新其正在运行的会话。

## 本机 Mac：完整模型与 Python 环境

见 [docs/SETUP.md](docs/SETUP.md)。本机需要 Apple Silicon、Python 3.12、MFLUX 0.22.0 和完整 Qwen Image 2.1 MLX checkpoint。`scripts/setup-local.sh` 只创建虚拟环境/安装 MFLUX，不下载模型、不启动常驻服务。

| 设置 | 新用户如何填写 |
| --- | --- |
| localMfluxDirectory | 自己选定的图库与任务目录；空白使用当前账户的 `~/.dsh/qwen-studio` |
| pythonPath | 含 MFLUX 的 venv 的 Python；空白解析为 `<图库>/venv/bin/python` |
| modelPath | 已准备好的完整 MLX 模型目录；空白解析为 `<图库>/models/qwen-image-2.1` |
| hfHome | 共享组件缓存；留空按环境变量/当前账户默认缓存解析 |
| loraDirectory | 可选自定义 LoRA 文件夹；同时合并托管资源和 `<图库>/loras` |
| localMfluxIdleMinutes | 统一空闲卸载时间，默认 10 分钟；仅空闲时卸载 |

设置页显示实际生效值和来源。脚本默认创建的 venv 目录与图库的默认 Python 路径不一定相同：安装后务必填写脚本打印的 Python 路径，不要误以为安装脚本已自动配置 DSH。原生编辑需要 checkpoint 的视觉组件和 QwenImage21Edit API，单个权重文件或纯文生图导出不够。

## 远程 NVIDIA：先部署，再填写自己的连接信息

按 [docs/REMOTE.md](docs/REMOTE.md) 部署配套 ComfyUI、网关及指定模型。普通 OpenAI Images API 只具备基础文生图；ComfyUI 的 8188 地址不能直接当作 `/v1` 网关。

- 直连：填用户自己的 `https://<自己的网关>/v1`、模型名及服务要求的密钥。网关默认只监听 loopback；对外部署需要用户配置鉴权、TLS 或私有网络转发。
- 按需 SSH：先在本机建立可信任、公钥可登录的 SSH 别名，例如 `my-qwen-server`。插件填这个别名、远程网关端口和本机转发 URL，例如 `http://127.0.0.1:19488/v1`。该地址只是自己电脑的 loopback，不是作者服务器地址。
- SSH 仅在提交生图时建立；浏览图库、资源和预设不建立隧道。任务结束后按统一空闲时间卸载模型，确认后断开。
- 不要改系统代理、Tailscale 或防火墙来安装插件；连接故障先查 URL、模型名、网关健康、SSH 密钥信任及端口冲突。
- 插件更新只更新 DSH 插件。远程 Python 网关、ComfyUI、自定义节点、Python 库和模型权重需要独立部署/升级；先等所有任务结束，再备份服务器脚本进行替换。不能宣称升级插件就更新了服务器。

## 在会话里工作：优先使用官方注册工具

启用后自动注册 `qwen-image` 技能，无需复制技能目录。工作流的完整参数说明见 [skills/qwen-image/SKILL.md](skills/qwen-image/SKILL.md)。

1. `qwen_image_connection`：读取运行位置和空闲时间；用户要求时实时切换。生成中不切换，不擅自跨后端重试。
2. `qwen_image_resources`：查询真实 LoRA、输入图片和 `reference_edit.supported`。不要猜路径/资源 ID。
3. `qwen_image_import`：将公开图片直链、本机文件或真实附件导入，得到 source/control/mask ID。搜索参考图时使用会话自己的搜索工具，再导入直链；不要求用户手动打开图库。
4. `qwen_image_presets`：list/load 读当前预设及 revision；修改时先 load，合并用户所需字段，再 save 完整配置并传 revision。只配置/保存时不生成。加载不自动覆盖创作页草稿。
5. `qwen_generate_image`：明确要求生图时提交；本机/远程、面板/会话走同一持久任务队列。返回真实 ID 和图片附件。
6. `qwen_image_status`：超时或切页后按 ID 查询原任务，不重复提交，不绕去执行独立推理脚本。

原生编辑为 `reference_mode=edit`，先确认能力，仅 linear、32 倍数尺寸，不与 ControlNet/蒙版混用。参考变体为 variation + change_strength。负向词需要对应 guidance；无负向时 guidance 在基础分支不是质量旋钮。LoRA 权重、控制强度、源图、蒙版、采样参数均可进入整套预设；不能将密钥或连接信息存成分享预设。隐私图库只改变图库筛选，对话图片/进度照常显示，并非加密或访问控制。

## 更新、备份、回滚

设置中「插件更新」：自动检查默认开，6 小时一次，启动后约 30 秒首次检查；自动安装默认关。两个开关独立：关闭自动检查后不触发周期自动安装，手动检查只检查。

开启自动安装后：验证正式版、SHA256 和当前 DSH 兼容范围 → 确认无上传/排队/生成 → 备份旧插件 → 调用原生 DSH 包管理器 → 标记待手动重启。忙碌时约 1 分钟后再尝试；没有自动重启命令。安装失败尝试恢复旧包。安装只处理插件包，模型、图库、预设及服务配置不在升级载荷中。

状态位于 `<profile>/qwen-studio-updates/`：preferences.json、status.json、backups/<ID>/previous.tgz、manifest.json。备份可能含旧版本代码，保留在本机，不上传。不会自动清理用户备份。

无界面可用时，在**已安装包**目录运行 `node bin/qwen-studio-maintain.mjs status|check|install|backups`；回滚用 `node bin/qwen-studio-maintain.mjs rollback <真实备份ID>`。CLI 也检查未结束任务。`DSH_QWEN_CLI` 可指定本机 DSH CLI 可执行文件；macOS 自动寻找标准桌面版入口。Linux 需要 PATH 上有 dsh；其他平台应先确认可执行 CLI，不宣称所有平台都已实测。

## 收藏记录损坏与性能

收藏/归档保存在 `<图库>/state/gallery.json`。写入前将原有有效标记保存到 gallery.json.bak。损坏、权限错误或主文件意外消失时停止写入并提示，不按空记录覆盖。用户可在插件设置 → 收藏记录恢复中恢复上次标记，损坏文件另存为 gallery.damaged-*.json；图片不动。若备份也损坏，停止操作，保留两份文件并由用户选其他备份恢复。

图库通过目录监听、活动任务刷新和最长 30 秒对账维持增量索引；健康与进度轮询使用版本/增量响应，不重复发送全部历史图片。切换页面和会话不会取消任务。

## 开发、测试、发布

`npm run check`、`npm run check:privacy`、`npm run check:package`。隐私检查只允许标准网络校验范围/测试保留地址，不允许个人目录、私有部署 IP 或令牌。使用 `QWEN_PRIVATE_MARKERS` 环境变量做本机额外扫描，绝不把真实标记写进源码或日志。提交前检查 git diff；CI 不加载模型、不开 SSH、不运行 GPU 推理。

发布 vX.Y.Z tag 后，流水线生成预编译包、SHA256、固定名别名、独立不可变 bundle-vX.Y.Z 提交，并发布市场索引。市场不指向需要现场编译的 main。人工 GPU 验收和用户设置校验只能在本机进行，公开记录必须脱敏。请报告测试的实际边界，不以自动测试替代真实 DSH/GPU 验收。
