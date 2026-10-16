<div align="center">

# 图像 · Qwen Studio

### 把本地 Qwen Image，变成 DSH 里随手可用的创作工作区。

**写下画面，直接生成。选好原图，继续修改。**

A local Qwen Image workspace for **DeepSeek Harness** — powered by **MLX / MFLUX**.

[![Release](https://img.shields.io/github/v/release/kingcharleslzy-ai/dsh-qwen-studio?label=Download)](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest)
[![CI](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/actions/workflows/ci.yml)
[![Apple Silicon](https://img.shields.io/badge/Local-Apple_Silicon-222222?logo=apple)](#本地-mac)
[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

[下载安装](#安装) · [本机配置](docs/SETUP.md) · [更新记录](CHANGELOG.md) · [实测范围](docs/VERIFICATION.md) · [English](#english)

</div>

## 从第一张图，到满意的那一版

本地生图往往分散在终端、推理服务、输出文件夹和聊天窗口里。**图像**把这些环节放回 DSH：描述画面、选择参考、调整效果、查看进度，再收藏值得留下的作品。

面向 **Qwen Image 2.1**，提供两种入口：

- **直接创作**：打开左侧「图像」，输入描述即可生成。LoRA、控制图和蒙版都能在高级设置里直接选择本机文件。
- **会话创作**：对模型说「帮我画一张」。插件提供技能和工具，会话发起的任务在对话与创作页同步显示阶段、步数和完成图片。

应用里叫 **图像**，安装包叫 `dsh-qwen-studio`。项目独立维护、独立发版，**无需安装旧 `dsh-image-gen` 插件**。当前版本：**2.5.0**。

![在 DSH 创作页完成局部重绘并查看原位结果](docs/media/creation.png)

## 你来决定画什么，工作区负责把流程接好

| 想做的事 | 在这里怎么做 |
| --- | --- |
| 画一张配图、海报或产品图 | 直接在创作页写描述；也可以从会话发起 |
| 保留一张图的感觉，继续尝试 | 用作参考、调整变化幅度、对比原图、复用参数 |
| 给模型叠加风格与细节 | 本机选择 LoRA，逐个开关、调整权重，最多叠加 8 个 |
| 让构图和姿态更可控 | 选择线稿、姿态、深度或边缘控制图，调整 ControlNet 强度 |
| 只改画面的一部分 | 选择原图和蒙版：白色重画，黑色保留 |
| 生成中切去做别的事 | 任务保存在后台，切页继续；回来查看进度与结果 |
| 取回已经生成的图 | 查询原任务，直接返回同一图片，不重新生成 |
| 留下好作品，收起试稿 | 默认进入隐私图库；收藏后出现在普通图库 |
| 避免模型一直占内存 | 调用时启动，空闲后按设置释放；也可手动释放 |
| 使用自己的远程 GPU | 接入自部署的 OpenAI 兼容 Images 服务，沿用创作与图库流程 |

## 高级功能，也可以直接点选

在 **图像 → 创作 → 高级设置** 中：

**LoRA：选文件，调权重。** 支持多文件选择、单独启停、移除和参数复用。导入按文件内容去重；变更组合时重新加载模型，避免上次烘焙的 LoRA 残留到下次普通生成。

**ControlNet：用图片表达结构。** 本机选择控制图并调强度。需要已准备好的 Qwen Image 2.1 Union 权重；这里选择的是控制图片，不是控制模型文件。

**局部重绘：先定保留区，再改画面。** 选择原图和蒙版，可与 LoRA、结构控制组合。黑色区域从输出尺寸下的原图复制；保持源图尺寸时保留原始像素。

<details>
<summary>查看高级设置：LoRA、结构控制与局部重绘</summary>

![高级设置中的本机文件选择与效果组合](docs/media/advanced.png)

</details>

已选文件关联与参数自动保存在草稿里。返回创作后直接生成，结果原位显示。**图片输入独立保存在资源库，不会把蒙版和控制图塞进作品图库。**

> 本机选中的文件仅复制到本机资源库，原文件不变。PNG / JPEG / WebP 单张不超过 64MB，最长边 8192 像素且不超过 3200 万像素；LoRA 单文件不超过 2GB。灰色蒙版按亮度中点划分黑白，透明区域按保留区处理。移除草稿关联不会删除文件原件。

## 为 DSH 的使用方式设计

- **跟随宿主外观**：字体、字号、主题色和基础控件沿用 DSH，参数区可滚动，生成按钮保持可用。
- **创作不被打断**：生成后留在原页；完成结果、最近版本、参考图对比与下载都在预览区。
- **清空工作台，保留作品**：清除预览不会删除图库原件或取消后台任务。
- **进度来自真实任务**：本地显示排队、加载、采样、保存及步数；远程显示处理状态。没有伪造百分比或半成品实时预览。
- **图库能整理**：搜索、收藏、全选、批量归档、回收站、恢复与确认后永久删除。
- **模型能发现工具**：内置 `qwen-image` 技能，简介与执行说明使用同一来源。实际生图优先走插件队列；仅写提示词时不自动生图，失败时不静默改跑独立脚本。

## 先试稿，再收藏

默认流程是：**生成 → 隐私图库；收藏 → 普通图库**。

普通图库默认显示收藏；隐私图库、归档和回收站从右上角菜单进入。可以在设置中关闭隐私图库，恢复浏览全部作品。

**隐私图库只控制图库分类。对话里的生成进度、新图片和历史图片始终正常显示。** 它不是加密、密码锁或访问控制。图库删除也不会清理 DSH 独立保存的对话附件。

## 安装

从 [Releases](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest) 下载编译好的安装包，再运行：

```sh
dsh plugin --profile desktop add /absolute/path/dsh-qwen-studio-2.5.0.tgz
```

macOS 没有全局 `dsh` 命令时，可使用桌面版内置 CLI：

```sh
sh "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" \
  plugin --profile desktop add /absolute/path/dsh-qwen-studio-2.5.0.tgz
```

正常退出并重新打开 DSH，进入插件设置配置「图像」。发布包已包含编译好的前后端、技能、worker 与环境安装脚本；**模型权重需要自行准备**。

已有 `dsh-qwen-studio` 可原位升级，保留原数据目录和配置。不要靠修改安装目录或运行目录维持补丁；源码、安装包和更新记录均由本仓库管理。

### 本地 Mac

需要 **Apple Silicon + Python 3.12 + MFLUX 0.22.0**，以及完整的 Qwen Image 2.1 模型和共享组件。内存需求取决于权重精度、分辨率与附加模型。

```sh
sh scripts/setup-local.sh "$HOME/.local/share/qwen-studio/venv"
```

在插件设置中选择 Python 环境、模型目录、可选 Hugging Face 缓存目录、图库目录及空闲释放时间。路径支持手动输入和本机选择器。高级创作中导入的 LoRA 无需手动搬进配置文件夹。

详见 [安装与连接](docs/SETUP.md)，模型结构参考 [MFLUX Qwen Image 2.1 文档](https://github.com/mflux-community/mflux/blob/main/src/mflux/models/qwen21/README.md)。插件不自动下载大模型。

### 自部署远程服务

填写 `/v1` 基地址、模型名和可选 API Key。服务需支持 `GET /models`、`POST /images/generations`，接收尺寸、种子与采样步数，返回 PNG 格式的 `data[0].b64_json`。

当前远程适配器提供文生图与图库管理；**本机文件、参考变体、LoRA、ControlNet、蒙版及高级采样参数仅接入本地模式**。不支持的组合明确报错，避免参数被忽略后仍继续生成。ComfyUI 原生地址需要另行提供协议适配，不能直接当作 Images 接口使用。

## 会话调用

无需手动复制技能目录，启用插件即可注册：

| 入口 | 作用 |
| --- | --- |
| `qwen-image` 技能 | 何时生图、如何迭代、怎样恢复任务，以及工具能力边界 |
| `qwen_generate_image` | 提交持久任务，管理本地启动，返回图片附件与任务 ID |
| `qwen_image_status` | 只读查询已接受的任务；完成后取回同一图片，不重新生成 |

直接说：

> 画一张清晨山间小屋的横版插画，柔和光线，不要文字。
>
> 沿用刚才那张图的构图，再做一版水彩风格。
>
> 把刚才生成的图再显示一次，不要重新生成。

工具支持基础采样、强度式图生图、负向 / CFG / 调度器、LoRA、ControlNet 和蒙版。会话工具使用已存在的图片资源 ID；本机新文件从创作页导入，不能把文件路径当作 ID。

已在 DSH / DeepSeek-V41-Flash 实测自动加载技能与工具调用。其他模型是否正确选用仍取决于其工具能力、会话上下文和 DSH 权限。独立 CLI 任务不经过插件队列，不自动获得本插件的会话进度卡片。

## 验证过什么

完整证据范围见 [VERIFICATION](docs/VERIFICATION.md)：自动测试覆盖文件导入、任务持久化与去重、图片输入快照、参数组合、LoRA 隔离、蒙版保留、图库分流、会话进度和结果恢复。

2.5.0 已通过 32 项工具/界面测试和 20 项 worker 测试，并在原生 DSH 中选择 159MB LoRA、控制图、原图和蒙版完成组合生图；关闭效果后普通生成未携带旧参数。

已有本机推理验收包括普通生图、合成零增量 LoRA、ControlNet、蒙版及组合任务；原生 DSH 验收涵盖自然语言触发、切页进度、图片卡片与只读取回。第三方权重的兼容性与画质需按实际模型验证，不能由接口可用推断。

远程协议使用模拟服务回归，尚未覆盖所有远程 GPU 部署。CI 不下载模型、不运行真实 GPU 推理。

## 开发与贡献

Node.js `^22.19.0 || >=24`；worker 测试需要 Python 3.12 和 Pillow 11–12。

```sh
git clone https://github.com/kingcharleslzy-ai/dsh-qwen-studio.git
cd dsh-qwen-studio
npm ci
npm run check
npm run check:package
```

前端与宿主接口在 `src/`，推理队列与输入处理在 `backend/`，技能在 `skills/qwen-image/`。CI 构建安装包，Release 附带 `.tgz` 和 SHA-256。模型、个人配置、生成作品与运行日志不进入仓库或安装包。

欢迎用 [Issues](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/issues) 反馈可复现问题。提交环境版本、操作步骤与错误信息即可；分享图片、日志前请先移除个人内容。

## English

**Qwen Studio is a local-first Qwen Image 2.1 workspace for DeepSeek Harness.** Create directly without a chat model, or let a tool-capable model generate images inside a conversation.

- **Native file picking:** select LoRAs, control images, sources and masks from your computer.
- **LoRA / ControlNet / inpainting:** compose effects in the advanced creation panel; toggle LoRAs and adjust weights.
- **Persistent jobs:** keep working while pages change, with real sampling progress and recoverable results.
- **On-demand MLX / MFLUX:** start local inference when needed and release it after a configurable idle period.
- **Private drafts, curated favorites:** new images enter the private gallery; starred works appear in the main gallery. Conversation images remain visible. This is organization, not encryption.
- **Self-hosted option:** use an OpenAI-compatible Images API for remote text-to-image generation. Advanced image inputs remain local-only in this adapter.

Download a compiled `.tgz` from [Releases](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest), install with `dsh plugin --profile desktop add`, restart DSH and configure **图像**. Local inference requires Apple Silicon, Python 3.12, MFLUX 0.22.0 and separately prepared Qwen Image 2.1 weights. See [setup](docs/SETUP.md) and [verification](docs/VERIFICATION.md) for requirements and tested limits.

## 致谢与许可证

源于 [shanliuling/dsh-image-gen](https://github.com/shanliuling/dsh-image-gen) 的 DSH 生图集成，现以独立的 Qwen 创作工作区维护。保留原始署名，并按 [Apache-2.0](LICENSE) 发布，来源说明见 [NOTICE](NOTICE)。

推理依赖 [MFLUX](https://github.com/mflux-community/mflux) / MLX 与 Qwen 模型，分别遵循各自许可证。本项目不是 Qwen、MFLUX 或 DeepSeek 官方插件。
