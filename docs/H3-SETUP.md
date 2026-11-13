# MiniMax H3 单镜与多镜头部署

## 在 Windows GPU 机器上准备单镜推理

已部署的 ComfyUI 可以复用。新环境请按 [ComfyUI Windows 安装说明](https://docs.comfy.org/installation/desktop/windows) 或其 [手动安装说明](https://github.com/Comfy-Org/ComfyUI#manual-install-windows-linux) 安装与显卡兼容的驱动、PyTorch 和支持 MiniMax H3 的 ComfyUI。用该环境的 Python 安装 psutil。启动时从含 main.py 的目录运行，供 worker 校验监听进程的工作目录。例如 PowerShell：

```powershell
Set-Location D:/ComfyUI
& D:/ComfyUI/venv/Scripts/python.exe -m pip install psutil
& D:/ComfyUI/venv/Scripts/python.exe main.py --listen 127.0.0.1 --port 8188
```

示例路径要换成自己的安装位置。在这台 GPU 主机按需下载以下权重，放入 ComfyUI 的 models 目录或已配置的同类共享模型目录。下载前按模型卡核对许可、文件大小和剩余空间。

| 用途 | models 下的目录与文件 |
| --- | --- |
| 所有档位，文本编码器 | text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors |
| 所有档位，图像与音频解码 | vae/minimax_h3_video_vae_int8_convrot.safetensors、vae/minimax_h3_audio_vae_fp32.safetensors |
| 纯文字单镜 | diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors |
| 参考图单镜与人物长片 | diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors |
| 纯文字 Turbo 额外需要 | loras/minimax_h3_fl2v_turbo_8step_v1.1_768p_comfyui_bf16.safetensors |

基础模型与 Ref2VA 来自 [Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3/tree/main)。表中 8 步 v1.1 LoRA 来自 [lightx2v/Minimax-h3-Turbo](https://huggingface.co/lightx2v/Minimax-h3-Turbo/tree/main)。例如已安装 Hugging Face CLI 时，以下命令只下载纯文字质量档所需文件。在 ComfyUI 目录执行：

```powershell
hf download Comfy-Org/MiniMax-H3 diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors vae/minimax_h3_video_vae_int8_convrot.safetensors vae/minimax_h3_audio_vae_fp32.safetensors --local-dir models
hf download lightx2v/Minimax-h3-Turbo minimax_h3_fl2v_turbo_8step_v1.1_768p_comfyui_bf16.safetensors --local-dir models/loras
hf download Comfy-Org/MiniMax-H3 diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors --local-dir models
```

第二行用于 Turbo，第三行用于参考图。刷新 ComfyUI 模型清单。在 GPU 主机将随包 scripts/check-h3-models.py 和 video/workflows 保持相同相对结构，执行 `python scripts/check-h3-models.py --port 8188`。只核对质量预览可加 `--workflow H3-Quality-480p-20steps`。OK 表示节点及加载器识别了这些文件；实际显存是否足够要用对应档位生成验证。

## 把 DSH 接到工作台

在 DSH 所在电脑的 `$DSH_HOME/h3-video/connection.json` 保存连接（默认 DSH_HOME 为当前账户的 .dsh）。已有文件优先沿用。SSH 示例：

```json
{
  "transport": "ssh",
  "sshHost": "my-video-gpu",
  "python": "D:/ComfyUI/venv/Scripts/python.exe",
  "worker": {"studioDir": "D:/ComfyUI", "port": 8188}
}
```

在 DSH 机器先验证 `ssh -o BatchMode=yes my-video-gpu hostname`。远端需要 Windows OpenSSH 和 cmd.exe。同机 Windows GPU 把 transport 改为 local，移除 sshHost。worker 可填写已有 outputDir、stateDir、startupTask；留空 startupTask 时手动启动 ComfyUI。选择有空闲显存的 GPU，避免同时跑 Qwen。其余连接字段和视频库见 [视频工具说明](VIDEO.md)。若 DSH 在 Mac/Linux、GPU 在另一台 Windows，上述配置放在 DSH 机器，示例中的 D 盘路径仍指 GPU 机器。

## 长片剪辑与旁白

单镜可由 Windows GPU 生成。内置长片桥接在运行 DSH 的 POSIX 主机执行，使用 Python 3.11+、FFmpeg（含 libx264 和 AAC 编码器）、ffprobe、Pillow、PyYAML。macOS 支持系统 say 旁白；Windows 原生 DSH 的单镜可用，内置长片桥接使用 fcntl，不支持 Windows 原生剪辑。使用 Windows GPU 时可让 Mac 运行 DSH 和长片剪辑。Linux 无旁白路径需要在目标机验收。

在已安装包根目录运行（以下为 macOS / POSIX shell）：

```sh
python3 -m venv "$HOME/.dsh/h3-video/film-venv"
"$HOME/.dsh/h3-video/film-venv/bin/python" -m pip install -r film/requirements.txt
ffmpeg -version
ffprobe -version
```

在 DSH 数据目录的 h3-video/film.json 填入实际绝对路径。JSON 字符串里不会展开 ~ 或环境变量。data_home 指向 DSH 实际数据目录；project_root 是用户选定的可写作品目录。FFmpeg 和 ffprobe 须在 DSH 进程的 PATH 中；可用 path 字段指定剪辑子进程的完整 PATH。

```json
{
  "python": "/absolute/path/to/film-venv/bin/python",
  "project_root": "/absolute/path/to/film-projects",
  "data_home": "/absolute/path/to/dsh-data"
}
```

新装默认使用随包 film/bridge.py。旧配置可沿用 bridge（自定义实现）、voice（已安装系统声音）、volume（实际挂载点）。本地目录无需填写 volume；使用外接盘时应填写，避免掉盘时误建空工程。用 `say -v '?'` 列出系统声音。h3_character_list 是无 GPU 的首次检查。再要求 Agent 创建一个两镜头项目，审代表镜、按原项目 ID 继续、核对母版帧数与播放链接。素材、人物卡、连接和作品只存于用户选择的位置。
