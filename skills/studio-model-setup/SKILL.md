---
name: studio-model-setup
description: Install and migrate DSH-Spicy in DSH, provision Qwen Image 2.1 and MiniMax H3 on a local machine or remote GPU, and configure the film editor and character library.
whenToUse: 安装或升级创作插件、准备图像或视频模型、配置 GPU 或 SSH、长片环境、排查模型缺失及首次运行时使用。
---

# 根据实际设备部署

先确定运行 DSH 的机器和 profile、推理机器的操作系统/GPU、要启用图像、视频还是长片，以及是否有现成模型目录。检查磁盘和现有安装，按需要部署。包内文档路径均以安装包根目录为基准。该技能位于根目录下的 skills/studio-model-setup；安装前可从 GitHub 同名文件和根目录 AGENTS.md 阅读。

1. **安装与迁移**。DSH 至少 0.2.2-rc.1。用宿主 plugin_manager 的 list_bundles 查包名；安装项目市场的编译版本，或校验 Release TGZ 后使用当前 profile 的包管理器。桌面版优先使用其插件管理页。若之前同时启用 dsh-h3-video 或 dsh-h3-film-local，等待进行中的调用结束，分别停用这两个独立 bundle，启用新版 dsh-qwen-studio 并重新加载。保留旧连接、模型、角色库、工程和附件供续作。失败时可重新启用原包并回退 Qwen 的版本。详细顺序在 AGENTS.md。
2. **Mac 本机图像**。Apple Silicon 用 Python 3.12 执行 scripts/setup-local.sh，设置脚本打印的解释器。按 docs/SETUP.md 准备 MFLUX 可读的完整 Qwen Image 2.1 checkpoint 和需要的共享组件，检查 processor、视觉编码器和权重分片，再配置模型路径。用 qwen_image_connection status 和 qwen_image_resources 读取真实状态。
3. **本机或远程 NVIDIA 图像**。按 docs/REMOTE.md 安装专用 ComfyUI、三个基础权重及所需可选权重；复制网关、工作流和自定义节点，用自己的私有配置启动网关。DSH 图像选远程模式，即使 GPU 在同机；同机用回环 /v1 地址。异机使用已配公钥的 SSH 别名或用户部署的受保护网关。读取能力接口，再确认当前后端支持所需编辑模式。
4. **本机或远程视频 GPU**。按 docs/H3-SETUP.md 在 Windows NVIDIA 主机准备 ComfyUI 和工作流要求的权重，用随包 scripts/check-h3-models.py 对实际 /object_info 核对节点和文件名。DSH 与 GPU 同在 Windows 时 transport=local，异机时 transport=ssh。两种模式都使用 GPU 主机的 Python 和 studioDir 的绝对路径。H3 直接使用自己的 ComfyUI；Qwen 的 /v1 地址只用于图像。缺少 Turbo LoRA 或 Ref2VA 时只报告相应档位，不覆盖其他可用档位。
5. **长片**。在执行剪辑的 DSH 机器配置 Python、Pillow、PyYAML、FFmpeg/ffprobe 和可写工程目录。内置桥接使用 POSIX 文件锁，macOS 支持系统旁白。沿用旧工程时保持 project_root、data_home 与素材卷；新装使用包内桥接，film.json 示例及依赖自查见 docs/H3-SETUP.md。h3_character_list 可检查桥接，h3_film_status 可按已知 ID 检查原工程。
6. **验收**。区分工具已注册、模型文件已识别、实际成功生成。用户要求出样时先交付一张完成图或一个最短可用样镜，再做目标档位；返回真实任务 ID 和附件。排查按「profile → 连接 → 权重/节点 → 任务」逐层定位。共享 GPU 时串行提交，不通过另一个后端重复生成。保留私有配置，只报告所需且已脱敏的状态。

日常使用读 studio-creation、qwen-image、h3-video 或 h3-long-film。已部署环境只调整本次所需设置。
