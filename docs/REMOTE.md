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
6. 从 DSH 所在电脑建立私有 SSH 转发，例如 `ssh -N -L 127.0.0.1:19488:127.0.0.1:19488 <服务器别名>`。在插件设置选择远程，地址填 `http://127.0.0.1:19488/v1`，模型 `qwen-image-2.1-int8`，填写该密钥并检查连接。持久启动可由自己的 launchd / Task Scheduler / systemd 管理；不需要公开端口。

不要和视频模型并行推理。本网关会在启动时检查常用视频服务端口及显存占用，但这不等于跨所有程序的 GPU 互斥锁。

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

所有接口需要 bearer；重启网关会把未完成任务标记为失败。DSH 宿主重启也不会假称原任务已完成；不要在生成期间重启。取消等待但网络中断时不能保证收到远程取消确认，应查询原任务，不要重复提交。普通 Images 服务不提供上述高级协议，也不会被自动转换为支持高级能力。

调度公式参考 MFLUX（MIT）；ComfyUI 节点和模型接口参考 [ComfyUI](https://github.com/Comfy-Org/ComfyUI)。模型权重遵守各自许可证，不包含在插件安装包中。
