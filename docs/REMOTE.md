# Qwen 远程高级网关

2.7.0 的配套网关让 DSH 的创作页和会话共用远程文生图、LoRA、结构控制、蒙版重绘、强度式参考变体及真实采样进度。普通 OpenAI Images API 仍作为基础文生图接口兼容；只有完成能力握手的 Qwen 网关才启用高级参数，不会静默忽略效果。

## 服务器准备

使用独立的 ComfyUI 运行目录和 Python 环境，避免与视频生成抢显存。Windows NVIDIA 已实测；网关也包含 POSIX 启停分支，但不能据此声称 Linux 已完成推理验收。

目录约定：

```text
<root>/
  ComfyUI/
  venv/                         # Windows: Scripts/python.exe；POSIX: bin/python
  qwen_gateway.py
  qwen_workflow.py
  gateway-config.json           # 私有，不要提交仓库
```

1. 安装支持原生 Qwen Image 2.1 的 ComfyUI 及其 requirements。本版验收提交为 `e087d8f6cb7c6cdb11b59dc7c9bf17c79f8d877d`（ComfyUI 0.41.0）。网关依赖 `aiohttp`、`Pillow`，已包含在 ComfyUI 依赖中。
2. 从本包 `backend/` 复制 `qwen_gateway.py`、`qwen_workflow.py` 到 root。把 `backend/comfy_nodes/dsh_qwen` 复制到 `ComfyUI/custom_nodes/dsh_qwen`。这是调用 ComfyUI 原生 LoRA 加载器的薄封装，仅增加“没有加载任何匹配层就报错”的检查。
3. 从 [Comfy 官方模型仓库](https://huggingface.co/Comfy-Org/Qwen-Image-2.1) 获取这些文件，按同名分类目录放入 `ComfyUI/models/`：

```text
diffusion_models/qwen_image_2.1_int8_convrot.safetensors
text_encoders/qwen3vl_8b_int8_convrot.safetensors
vae/qwen_image_2.1_vae_bf16.safetensors
model_patches/qwen_image_2.1_fun_controlnet_union_int8_convrot.safetensors
```

4. 创建私有配置，例如 `{"api_key":"<自己生成的随机密钥>","idle_seconds":300}`。已有配置直接保留；不要覆盖密钥。保护该文件的访问权限。
5. 使用该 venv 的 Python 运行 `qwen_gateway.py`。默认 root 是脚本所在目录，也可通过 `QWEN_REMOTE_ROOT` 指定。网关监听 `127.0.0.1:19488`；收到请求才启动自己的 ComfyUI（`127.0.0.1:19489`），闲置后关闭其进程树。不会关闭其他推理服务。
6. 在插件设置选择远程，接口地址填 `http://127.0.0.1:19488/v1`，模型 `qwen-image-2.1-int8`，填写密钥。在「按需 SSH 主机」填已配置的 SSH 别名（例如 `gpu-server`），服务器网关端口填 `19488`。首次信任服务器主机密钥和配置公钥登录须先在终端完成，插件不会自动接受陌生主机密钥或索要密码。服务器的轻量网关可由 Task Scheduler / systemd 待命；SSH 隧道由插件按需管理，不再需要 Mac 登录时常驻的隧道。已有常驻转发须先停用，否则同一端口会冲突，插件不会杀掉不属于自己的进程。

不要和视频模型并行推理。本网关会在启动时检查常用视频服务端口及显存占用，但这不等于跨所有程序的 GPU 互斥锁。

## 按需连接与统一空闲时间（2.8.0）

「空闲后释放模型（分钟）」位于运行位置下面，本地和远程共用。为保留旧设置，存储字段仍叫 `localMfluxIdleMinutes`，不是两套计时。按需 SSH 仅适用于配套 Qwen 网关；留空 SSH 主机则继续直接连接已有接口。

提交生图时才建立 SSH，先把空闲时长同步给网关，再握手和上传资源；所有待处理任务结束且结果保存后才开始空闲计时。到时请求卸载，确认服务器 `loaded=false`、`busy=false` 后再断开自己创建的隧道。卸载失败或远程仍忙就保留连接重试。用户手动释放内存也按此顺序执行。新任务遇上正在卸载，会等卸载完成再重连。

查看页面、资源、预设、设置、模式查询及「保存并检查连接」均不会创建按需 SSH；离线检查仅验证配置格式，不代表服务器已在线。离线的预期能力带 `verification=on_generation`，实际提交仍必须握手。连接中断时，活跃任务可以重连并查询原任务，不会重交一份任务。

网关把同一时长持久化为独立兜底，Mac 休眠、断网或 DSH 异常退出也能空闲释放显存。状态查询与设置同步不刷新空闲起点。切换执行位置用 `qwen_image_connection`，通过 DSH 的 volatile 设置服务立即生效并持久保存，无需每次重启；生成中禁止切换。该工具不会生成图片或建立 SSH。

## 现有预设无需迁移

预设仍引用 Mac 上资源库的路径、图片 ID 和指纹。用户选文件后首先导入 Mac 资源库；生成任务只同步本次选中的资源。LoRA 与图片使用 SHA256 校验，在远程私有缓存中复用，不需要填 Windows 路径。现有配置、收藏/隐私分类及默认预设不变。

首次同步较大的 LoRA 可能需要等待。此时显示“同步资源”；模型加载阶段和采样阶段分别显示，采样步数来自 ComfyUI WebSocket 事件。图片先保存回原图库，再在创作页和对话里显示。不同计算后端即使同种子也不保证像素相同。

## 参数行为

- LoRA 最多 8 个，每个权重 0–2；无匹配层时报错，不冒充已启用。
- ControlNet 使用 Qwen Image **2.1** Union，控制图需已是线稿、边缘、深度、姿态等图。界面不会从任意照片自动生成姿态图。
- 蒙版白色区域重画、黑色区域保留。服务器会把原图缩放到输出尺寸，并将黑色区域原像素复制回结果；同尺寸时可做像素一致检查。灰度蒙版按 128 阈值转为二值。不要同时传参考变化幅度。
- 原图 + ControlNet 同时使用时需要蒙版。普通参考变体通过 VAE 编码原图与截取噪声表实现，变化幅度越高，采样越充分；不等于精准指令编辑。
- 支持 `linear`、`flow_match_euler_discrete`、`seedvr2_euler`。网关显式生成噪声表，使用 ComfyUI 原生 Euler 采样器；前两者分别按 MFLUX 的 Qwen 分辨率时间偏移/终点规则及 FlowMatch 表计算，SeedVR2 使用均匀表。ControlNet 和蒙版沿用 `linear` 限制。
- 文生图 CFG 只在负向词非空时生效；填写负向词且引导强度为 1 时自动采用 2.5。控制/蒙版分支允许空负向词与 CFG 大于 1。

## 协议和故障处理

相对插件配置的 `/v1` 地址：

- `GET /qwen/capabilities`：版本、features 和 schedulers。读取能力不会启动 GPU。
- `HEAD/PUT /qwen/assets/<sha256>?kind=image|lora`：按内容寻址的流式文件缓存；只接收 PNG / safetensors，不接受远程文件路径。
- `POST /qwen/jobs`：使用客户端任务 ID 幂等提交。
- `GET /qwen/jobs/<id>`：状态、阶段、真实步数；`GET .../image`：完成的 PNG。
- `POST /qwen/jobs/<id>/cancel`：取消自己队列中的任务。正在运行时只中断本部署的专用 ComfyUI。
- `GET /qwen/health`、`POST /qwen/unload`：状态和空闲释放。忙碌时拒绝卸载。
- `POST /qwen/runtime-config`：仅接受 `idle_seconds`（6–86400），保留密钥和其他设置，持久保存；不会刷新空闲计时。

所有接口需要 bearer；重启网关会把未完成任务标记为失败。DSH 宿主重启也不会假称原任务已完成；不要在生成期间重启。取消等待但网络中断时不能保证收到远程取消确认，应查询原任务，不要重复提交。普通 Images 服务不提供上述高级协议，也不会被自动转换为支持高级能力。

调度公式参考 MFLUX（MIT）；ComfyUI 节点和模型接口参考 [ComfyUI](https://github.com/Comfy-Org/ComfyUI)。模型权重遵守各自许可证，不包含在插件安装包中。

## LoRA 路径与种子

工具输入/本机任务记录里保留 Mac 路径，以便复用已有预设。网络任务中没有这个路径，只有 `loras: [{sha, scale}]`。插件读取文件、计算 SHA256，检查远程是否已有该内容，缺失时上传；服务器校验上传内容的 SHA256 并保存为 `<sha>.safetensors`。相同名字不同内容不会混用，相同内容改名仍可复用缓存。删除或移动本机资源会被资源检查发现，应重新选择，不会猜测远程文件名。

MLX 与 PyTorch/CUDA 的同一个 seed 不保证产生相同初始噪声；量化、精度和算子也会改变输出。复现和参数差异测试应固定同一后端、模型/精度及全部输入。跨后端的质量比较依然有意义，应使用多提示词、多种子和一致的输出规格；不能把相同数字种子当成逐像素对照。


## 原生参考编辑（2.10.0）

更新服务器端 qwen_workflow.py 并在网关空闲时重启网关；capabilities.features 应含 reference_edit。客户端选择 reference_mode=edit 会把 source_sha 送入 TextEncodeQwenImage21 的 images.image_1、VAE参考潜变量与空目标潜变量，使用完整采样表，不截断为旧的部分降噪。使用 linear、32倍数尺寸，不传 change_strength、蒙版或控制图。旧的 source_image_id + change_strength 继续执行参考变体，未改已有预设。

原生模式更适合按指令换风格，仍不保证任意位置严格不变；有像素保留要求时使用原来的蒙版流程。目前本机未接入这条编辑分支，客户端会明确拒绝，不自动切后端。

**网关不会在空密钥下启动**：`gateway-config.json` 的 `api_key` 至少 16 位，否则直接报错退出（空密钥等于同机任意进程都能调用）。

