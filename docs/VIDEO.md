# MiniMax H3 视频工作台

在 DeepSeek Harness 左侧「DSH-Spicy → 视频」页面或对话中，用自己的 Windows GPU 工作台生成横屏有声 MP4。内含四套 ComfyUI API 工作流、DSH 技能 `h3-video` 和取片工具。已对接 DSH Desktop 0.2.2-rc.1。

## 使用

- 「用 H3 的 480p Turbo 预览，8 秒，纸船漂过水面，保留水声。」
- 「保持同样的描述和时长，换成 768p 质量档。」
- 视频页面可选择档位、输入单镜时长和种子，并播放或下载成片。

| 档位 | 工具参数 | 采样步数 |
| --- | --- | --- |
| 480p Turbo | turbo480 | 8 |
| 768p Turbo | turbo768 | 8 |
| 480p 质量 | quality480 | 20 |
| 768p 质量 | quality768 | 20 |

`h3_generate_video` 接收 prompt、preset、duration_seconds、seed。默认 480p Turbo、5 秒、随机种子；每镜可请求 1–15 秒。H3 以 24 fps 生成，按 17k+5 向上对齐。8 秒对应 192 帧，10 秒对应 243 帧。短于约 5 秒属于模型训练区间之外。受显存、模型与卸载策略影响，高分辨率长镜头可能运行较久或显存不足。任务仍在队列中时按 ID 调用 `h3_video_status`。任务完成后，插件校验 SHA-256 并将 MP4 保存到 DSH 数据目录的 attachments/videos/h3 中。可用 `h3_release_gpu` 释放插件启动的空闲工作台。

几分钟的视频按镜头制作。先列镜头表，逐条用 Turbo 出样，按需用质量档重做，再剪辑、对齐声音和总时长。配套技能包含这个流程；由随包 h3-long-film 技能和长片工具审片、剪辑与导出。

## 安装与连接

安装合并包并配置运行环境，见 [H3 部署](H3-SETUP.md)。

在运行 DSH 的电脑上创建 `$DSH_HOME/h3-video/connection.json`（默认数据目录为用户主目录下的 `.dsh`）。也可设置 `DSH_H3_CONFIG` 指向自己的配置文件。每次调用读取该配置；升级或重装插件时继续使用这份文件。以下为占位示例，替换成自己的计算机信息。

```json
{
  "transport": "ssh",
  "sshHost": "my-gpu-host",
  "python": "D:/ComfyUI/venv/Scripts/python.exe",
  "worker": {
    "studioDir": "D:/ComfyUI",
    "port": 8188
  }
}
```

- SSH 模式使用客户端已配置的 OpenSSH 别名和密钥，要求 Windows GPU 主机支持无交互 SSH 和 cmd.exe。若 DSH 和 GPU 在同一台 Windows 电脑上，填 `"transport": "local"` 并省略 sshHost。两种模式均需 Windows GPU 工作台的 Python 3.11+ 和 psutil。
- 在指定 studioDir 下运行 ComfyUI，监听回环地址，安装支持 MiniMax H3 的节点及对应加载器。四套工作流中的 UNETLoader、CLIPLoader、VAELoader 和 LoraLoaderModelOnly 标明了所需权重文件名。权重由用户按各自许可获取。可查阅 [MiniMax H3](https://github.com/MiniMax-AI/MiniMax-H3) 和 [ComfyUI H3 节点](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/nodes_minimax_h3.py)。
- worker.outputDir 可指定 ComfyUI 实际输出根目录；插件使用其中的 dsh-h3-video 子目录。worker.stateDir 可指定持久任务目录（默认 studioDir/user/dsh-h3-video）。迁移已有安装时填写原任务目录和输出根目录，以便继续取回旧任务。
- 可选 worker.startupTask 指定本机预先创建的 Windows 计划任务名，用于冷启动；省略时先手动启动 ComfyUI。worker.alternatePort 可指定同工作台的备用监听端口。worker.orchestratorPort 可指定独占 GPU 的外部调度器监听端口。
- 同卡运行 Qwen 网关时可配置 worker.qwenConfig（GPU 机器上的配置文件）、worker.qwenPort 和可选 worker.qwenWorkerPort。只在 GPU 机器内访问网关密钥。

### 人物参考图

视频页可选择 1–9 张 JPEG、PNG 或 WebP，在描述中按顺序用 `<Picture 1>` 等指代人物或物体。对话工具的 `reference_images` 接受 DSH 图片附件 ID。带图默认 480p 质量档，也支持 768p 质量档。服务端需安装 MiniMax H3 Ref2VA 权重；回执记录模式和图片 ID。图片仅发送到当前配置的 ComfyUI。人物和衣着的一致性请逐镜审看。

参考图 API 图来自 [Comfy-Org 官方模板](https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_minimax_h3_r2v.json)，使用质量分支、20 步 Euler 和动态图片槽位。上传复用 [dsh-comfyui v0.5.5](https://github.com/fandc520/dsh-comfyui) 的 MIT 客户端，许可证随包提供。私有纯文字预设可放在 DSH 数据目录的 `h3-video/workflows/`，文件名和随包同名预设一致；包升级后继续优先读取。参考图使用独立的质量图。


### 视频库和对话播放

「DSH-Spicy → 视频」提供「视频库 / 创作」。已取回本机的 H3 单镜与长片母版自动入库，可搜索、命名、收藏、归档及移入回收站。隐私模式默认打开：主页显示收藏，未收藏的作品在「隐私视频库」。关闭隐私模式可以浏览全部普通作品。以上分类只修改本地标记。封面可通过本机 FFmpeg 生成。

对话生成或取回单镜后，把工具回执的 `playback_markdown` 原样贴入回复即可原位播放。视频库和对话共用本地媒体接口，支持拖动进度、全屏和下载。桌面兼容播放按需读取本机文件。

桌面播放器复用本地缓存的 WebM（VP9/Opus）兼容预览。已有对话通过 DSH 的文件交付卡提供 MP4 时，点击「在对话中播放」会通过该会话的文件读取权限导入视频。本地文件也可在视频库选择「导入 MP4」。原片用于下载；播放器与封面缓存保存在本机。对话链接播放器参考 dsh-comfyui 的 MIT inline-media 实现。
