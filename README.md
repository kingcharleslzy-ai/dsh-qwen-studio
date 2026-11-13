<div align="center">

![DSH-Spicy · Image, Video and Film](docs/media/hero.svg)

# DSH-Spicy

**完美适配 purge 的 nsfw content creation 插件**

在 DeepSeek Harness 里用 **Qwen Image 2.1** 画图、改图，用 **MiniMax H3** 把参考图拍成有声镜头，再由 Agent 逐镜审片、剪辑并交付完整 MP4。

[![Release](https://img.shields.io/github/v/release/kingcharleslzy-ai/dsh-qwen-studio)](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest) [![CI](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/actions/workflows/ci.yml)

[下载插件](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest) · [Agent 安装手册](AGENTS.md) · [模型部署技能](skills/studio-model-setup/SKILL.md) · [English](README.en.md)

</div>

## 安装

DSH **0.2.2-rc.1 或更新版本**。在「插件 → 发现 → 索引源」添加 [本项目市场索引](https://kingcharleslzy-ai.github.io/dsh-qwen-studio/index.json)，选择 **DSH-Spicy**（安装包 `dsh-qwen-studio`）。也可以从 Release 下载 [预编译 TGZ](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest/download/dsh-qwen-studio.tgz)，与 [SHA256SUMS.txt](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest/download/SHA256SUMS.txt) 中同名文件核对，再从实际 profile 安装。桌面版可用插件管理器，CLI 示例：

```sh
dsh plugin --profile desktop add /absolute/path/to/dsh-qwen-studio.tgz
```

**从旧版升级**：原图像包直接升级。已有独立视频或长片插件时，等任务结束，停用旧的 `dsh-h3-video`、`dsh-h3-film-local` 两个 bundle，再重新加载创作插件。图库、预设、视频、角色卡和未完成工程沿用原位置。兼容过渡与回退见 [迁移说明](AGENTS.md#旧插件迁移与回退)。

## 打开「DSH-Spicy」，或直接在对话里说

| 要做什么 | 可以这样说 | 交付结果 |
| --- | --- | --- |
| 画图、局部重绘或参考编辑 | 把这只蓝色陶杯改成水彩，保留把手和构图。 | 图像附件、图库记录、任务 ID |
| 拍一个单镜 | 用刚画的杯子做参考，拍 5 秒热气升起的镜头，保留环境声。 | H3 质量档 MP4、对话播放器 |
| 制作完整影片 | 做一支 60 秒的陶艺短片，人物跨镜一致，配中文旁白。 | 角色卡、分镜工程、逐镜审片、剪辑母版 |

图像页支持 LoRA、ControlNet、蒙版、预设、检索和批量任务；视频页支持 480p / 768p、Turbo / 质量档、1–9 张参考图、收藏、归档和本地播放。参考图用质量档，单镜可请求 1–15 秒。长片由对话 Agent 推进，先审代表镜，完成的母版会进入视频库。

![隔离 DSH 实例中的 H3 视频创作页](docs/media/h3-workspace.png)

## 按设备选择模型

| 运行位置 | 配置内容 | 从这里开始 |
| --- | --- | --- |
| Apple Silicon Mac 本机 | MFLUX、完整 Qwen checkpoint | [本机图像部署](docs/SETUP.md) |
| 本机或远程 NVIDIA | Qwen ComfyUI、专用网关、按需 SSH | [图像服务器部署](docs/REMOTE.md) |
| Windows NVIDIA，本机或 SSH | MiniMax H3、对应权重、ComfyUI、工作流核对 | [视频模型部署](docs/H3-SETUP.md) |
| macOS 剪辑端 + Windows GPU | FFmpeg、工程目录、系统旁白、角色库 | [长片剪辑与旁白](docs/H3-SETUP.md#长片剪辑与旁白) |

插件随包提供工作流、桥接和技能。权重、算力、连接和作品由安装者自行管理。可以只配置要用的功能。

## 给安装插件的 Agent

> 请先读仓库根目录 AGENTS.md，检查我当前的 DSH profile 和已有模型。按 studio-model-setup 配置我选择的后端，告诉我哪些检查已通过，再用我指定的素材完成一次创作。

| 自动注册的技能 | 何时使用 |
| --- | --- |
| [studio-model-setup](skills/studio-model-setup/SKILL.md) | 安装、升级、模型与连接诊断 |
| [studio-creation](skills/studio-creation/SKILL.md) | 选择创作流程，将 Qwen 附件交给 H3 |
| [qwen-image](skills/qwen-image/SKILL.md) | 图像、编辑、资源、预设、批量与任务恢复 |
| [h3-video](skills/h3-video/SKILL.md) | 单镜生成、查询与取片 |
| [h3-long-film](skills/h3-long-film/SKILL.md) | 角色、分镜、重做、旁白、审片和交付 |

## 实际图像示例

| 参考照片 | Qwen 原生参考编辑 |
| --- | --- |
| <img src="docs/media/reference-cup.png" width="275" alt="蓝色陶杯参考照片"> | <img src="docs/media/mlx-native-edit.png" width="275" alt="保留杯形的水彩输出"> |

示例来自此前 Qwen 图像版的本机 MLX 实测。原图与编辑图的署名和 CC BY-SA 条款见 [素材说明](docs/media/CREDITS.md)。[图像操作与参数](docs/SETUP.md) · [单镜与视频库](docs/VIDEO.md) · [历史验证记录](docs/VERIFICATION.md) · [更新记录](CHANGELOG.md)。

开发环境使用 Node 22.19+ 或 24+、Python 3.12。执行 `npm ci --ignore-scripts`、`npm run check`、`npm run check:privacy`、`npm run check:package`。第三方组件归属见 [NOTICE](NOTICE)，模型许可见各模型卡。
