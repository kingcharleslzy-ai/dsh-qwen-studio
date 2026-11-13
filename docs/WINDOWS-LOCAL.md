# Windows 从零搭建图像和视频

目标是在同一台 Windows NVIDIA 电脑上，从 DSH 左栏「创作」生成一张 PNG 和一个带音轨的 MP4。模型在这台机器推理。Qwen 的设置项叫「远程服务器」，同机使用回环地址；H3 的连接方式叫 local。下面均在 PowerShell 中操作。路径变量需要换成你选择的位置。

## 1. 确认设备，安装 DSH

运行 `nvidia-smi`、`py -0p`、`Get-PSDrive -PSProvider FileSystem`。记录显卡、驱动、显存、Python 和剩余空间。按实际模型仓库的文件大小计算预算。基础质量档图像和纯文字质量档视频共七个权重，约 57.4 GB，另留环境、缓存、临时文件和输出空间。Turbo、参考图视频和 ControlNet 需要额外权重。

安装 [DeepSeek Harness Desktop](https://github.com/deepseek-ai/deepseek-harness/tree/master/apps/desktop)。在插件市场添加 [DSH-Spicy 索引](https://kingcharleslzy-ai.github.io/DSH-Spicy/index.json)，安装并启用插件。首次进入桌面可选择稍后配置对话模型密钥，先用侧栏完成本机创作。使用 TGZ 时从 [GitHub Release](https://github.com/kingcharleslzy-ai/DSH-Spicy/releases/latest) 下载编译包和校验文件，以 `Get-FileHash -Algorithm SHA256` 核对同名文件。在插件详情确认版本，在侧栏找「创作」。包内文档、网关和工作流位于当前 profile 的 node_modules/dsh-qwen-studio。

## 2. 创建独立的 GPU 环境

准备 Git、64 位 Python（本流程使用 3.12）和 NVIDIA 驱动。先查 [PyTorch 官方选择器](https://pytorch.org/get-started/locally/) 与 [ComfyUI 手动安装](https://docs.comfy.org/installation/manual_install)。根据当前驱动、GPU 与系统选择 CUDA wheel。以下目录同时存放网关、模型和软件。

```powershell
$Root = 'D:\CreativeModels'
$Data = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$Pkg = Join-Path $Data 'profiles\desktop\node_modules\dsh-qwen-studio'
New-Item -ItemType Directory -Force $Root | Out-Null
Set-Location $Root
git clone https://github.com/Comfy-Org/ComfyUI.git ComfyUI
py -3.12 -m venv venv
$Py = Join-Path $Root 'venv\Scripts\python.exe'
```

用上一步选择器的命令安装 torch、torchvision、torchaudio，将命令开头的 pip 改成 `& $Py -m pip`。如果系统的 venv/ensurepip 失败，可在空目录用 `uv venv --seed --python 3.12 gpu-env`，然后令 `$Py` 指向它的 Scripts/python.exe，并用 `uv pip install --python $Py` 安装依赖。

```powershell
& $Py -m pip install -r ComfyUI/requirements.txt psutil huggingface_hub "Pillow>=11,<13"
& $Py -c "import torch; print(torch.__version__,torch.version.cuda,torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
git -C ComfyUI rev-parse HEAD
```

如果 pip 解析或下载缓慢，可用 uv 同步同一 requirements；使用所在地区可访问的 PyPI 镜像时仍核对包名和版本。CUDA 检查应返回 True 和预期显卡名。空环境可以共用一份 ComfyUI 源码和权重，图像与视频分时运行。已有其他服务时先检查队列和端口，避免争用显存。

## 3. 只下载所选工作流用到的文件

在 $Root 下执行。下面用当前环境的 Python 调用 Hugging Face，不依赖系统 PATH。打开两个模型仓库的 Files 页核对精确文件名、许可和版本，可以给下载调用加 revision 固定已核对的提交。下载中断可重试同一命令。

```powershell
& $Py -c "from huggingface_hub import snapshot_download; snapshot_download('Comfy-Org/Qwen-Image-2.1',local_dir='ComfyUI/models',allow_patterns=['diffusion_models/qwen_image_2.1_int8_convrot.safetensors','text_encoders/qwen3vl_8b_int8_convrot.safetensors','vae/qwen_image_2.1_vae_bf16.safetensors'])"
& $Py -c "from huggingface_hub import snapshot_download; snapshot_download('Comfy-Org/MiniMax-H3',local_dir='ComfyUI/models',allow_patterns=['diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors','text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors','vae/minimax_h3_video_vae_int8_convrot.safetensors','vae/minimax_h3_audio_vae_fp32.safetensors'])"
```

[Qwen 文件清单](https://huggingface.co/Comfy-Org/Qwen-Image-2.1/tree/main) · [MiniMax H3 文件清单](https://huggingface.co/Comfy-Org/MiniMax-H3/tree/main)。网络缓慢时可从 [ModelScope 的 Comfy-Org](https://modelscope.cn/organization/Comfy-Org) 找同名仓库。按 Hugging Face 对应 revision 的 LFS SHA-256 和大小逐文件校验。测试发现同名 H3 VAE 可有不同字节数；哈希不符应重新下载该文件。先验收基础质量档。需要图转视频时，按 [H3 权重表](H3-SETUP.md) 追加 Ref2VA；需要 Turbo 时再装对应 LoRA。Agent 应按使用者的目标选择这些文件。

## 4. 设置图像并生成第一张图

复制包内脚本。下例只为新环境创建网关配置。密钥只填在本机 DSH 的密钥字段，保留在用户账户内。

```powershell
Copy-Item "$Pkg/backend/qwen_gateway.py","$Pkg/backend/qwen_workflow.py" $Root
Copy-Item "$Pkg/backend/comfy_nodes/dsh_qwen" "$Root/ComfyUI/custom_nodes" -Recurse
& $Py -c "import json,secrets,sys,pathlib; p=pathlib.Path('gateway-config.json'); f=p.open('x',encoding='utf-8'); json.dump(dict(api_key=secrets.token_urlsafe(32),comfy_root=str(pathlib.Path('ComfyUI').resolve()),python_executable=sys.executable,conserve_memory=True),f); f.close()"
& $Py qwen_gateway.py
```

保留网关窗口。在 DSH 插件设置选「远程服务器」，填 `http://127.0.0.1:19488/v1`、模型 `qwen-image-2.1-int8`、网关配置中的密钥，SSH 主机留空。把「Python 可执行文件」设为上面的 $Py，供图片导入和评分使用。若运行多套部署，可在启动网关的终端通过 QWEN_GATEWAY_PORT 和 QWEN_COMFY_PORT 指定两枚空闲端口，并相应修改 DSH 接口地址。视频使用自选端口时，把同卡视频服务的端口写入私有网关配置 `video_ports` 数组，默认 [8188, 8189]。同卡同时运行多套服务时，先核对每个队列和显存。

保存并检查连接。进入「创作 → 图像」，选择质量档，从 512×512、8 步和简单的静物提示词开始。等待任务完成，打开实际 PNG。仅出现模型名或健康检查成功，还需完成这一步。

## 5. 设置视频并生成第一段 MP4

图像任务完成后，在 DSH 释放图像模型或等待空闲卸载。在新的 PowerShell 窗口中重设 $Root、$Py、$Data 和 $Pkg。创建视频配置目录，并在 **GPU 环境的工作目录** 启动 ComfyUI。下例保存 UTF-8 无 BOM 的 JSON。

```powershell
$H3 = Join-Path $Data 'h3-video'
New-Item -ItemType Directory -Force $H3 | Out-Null
$Connection = Join-Path $H3 'connection.json'
if (Test-Path $Connection) { throw '已有连接。先读取原配置，按需要编辑。' }
$Cfg = @{ transport='local'; python=$Py; worker=@{studioDir=(Join-Path $Root 'ComfyUI'); port=8188} }
[IO.File]::WriteAllText($Connection, ($Cfg | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))
Set-Location "$Root/ComfyUI"
& $Py main.py --listen 127.0.0.1 --port 8188
```

在另一窗口执行 `& $Py "$Pkg/scripts/check-h3-models.py" --port 8188 --workflow H3-Quality-480p-20steps`。收到 OK 后打开「创作 → 视频」，选 **480p · 质量**，无需传参考图。填入主体、动作和环境声，展开高级设置，固定一个种子，选择画幅。首次可用短镜头核实管线，再用 5 秒验证实际质量。完成后在 DSH 播放或下载，检查画幅、时长及音轨。返回图像工作前，手动关闭自己启动的视频服务；由插件调度启动的服务可用「释放显卡」。

## 6. 用实测核对部署

本次在 Windows 11、RTX 4090 D 24 GB 上使用官方桌面 0.2.2-rc.3、独立 DSH_HOME、空白 desktop profile、Python 3.12 和全新 GPU venv。通过桌面自带的 dsh.cmd 安装编译包，Qwen 走同机回环网关，H3 用 local。模型清单使用 Comfy-Org 官方的 SHA-256。

| 实际操作 | 结果 |
| --- | --- |
| 用 DSH 图像任务接口提交 512×512、4 步的纸船图 | 返回 PNG。网关、CUDA 与 DSH 客户端全部在 Windows 上。 |
| 点击 Windows 桌面的「创作 → 视频」 | 默认选中创作。质量档允许调步数；Turbo 的步数栏锁定。 |
| 在页面选竖屏、质量档 4 步、种子 313，请求 1 秒 | DSH 取回 480×864、24 fps、39 帧的 H.264 MP4，含 AAC 音轨。Windows 桌面播放器播放到 1.625 秒结束。 |

Apple Silicon 128 GB 另用干净 DSH profile、新 Python 环境和完整 Qwen 官方 checkpoint 实际生成 512×512 PNG。H3 原生单镜这次在 Windows NVIDIA 验证；长片剪辑、其他显存档位及 Linux 推理需要分别验收。

## 7. 按症状定位

- GPU 返回 False：核对所选 Python、PyTorch wheel、驱动和 GPU 架构，先在同一个解释器运行 CUDA 检查。
- 节点或权重不存在：在该 ComfyUI 的 /object_info 核对工作流节点和加载器返回的文件名；查发布说明、补齐对应档位并重启该服务。
- 显存占满：等待别的任务完成，释放已完成的图像/视频模型，先用较低分辨率与较短镜头验收。
- 网关能连但没有成图：检查 ComfyUI 的启动日志和本次任务错误，确认自定义节点已放入实际运行目录。视频按原任务 ID 查询；返回 MP4 后再判定端到端成功。
