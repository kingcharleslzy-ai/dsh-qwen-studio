# 图像 for DSH

**把 Qwen Image 变成 DeepSeek Harness 里的完整创作工作区。**

直接写描述生成图片，也能在会话里说「帮我画一张」。从第一张图到参考变体、收藏整理，进度和作品都留在 DSH 中。

[![CI](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[下载最新版](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest) · [安装与配置](docs/SETUP.md) · [更新记录](CHANGELOG.md)

应用中显示为 **图像**，包名为 `dsh-qwen-studio`。项目独立维护、独立发版，安装时不需要 `dsh-image-gen`。当前发布版本 **2.2.0**。

## 为什么做这个插件

本地生图不应该每次都打开终端、启动服务、找输出目录，再把图片拖回对话。我们希望把模型变成随手可用的创作工具，同时把任务执行与页面显示分开。

这个版本围绕 **Qwen Image 2.1** 重做了创作页、图库、任务队列、模型工具和设置。它的重点是完整的使用流程：

| 你想做的事 | 图像的处理方式 |
| --- | --- |
| 不经过文字模型，直接生图 | 左侧「图像 → 创作」直接提交；进度和结果原位显示，会话发起的活动任务也会同步到预览 |
| 在对话里要一张配图 | 注册 `qwen_generate_image` 工具和 `qwen-image` 技能，对话显示阶段、步数与完成图片 |
| 生图时切到其他页面 | 任务独立保存，切页不取消；回来继续查看进度和结果 |
| 不想一直占用 Mac 内存 | 首次调用启动 MFLUX；任务结束后按设定空闲时间退出，也可手动释放 |
| 不想所有试稿直接出现在图库首页 | 隐私图库默认开启，正常图库只显示收藏，未收藏作品从菜单进入 |
| 想沿用一张图继续调整 | 用作参考、调整变化幅度、复用参数；结果与最近版本留在创作页 |
| 想批量整理试稿 | 全选当前筛选结果、批量收藏、归档、移入回收站及恢复 |
| 想用自己的远程 GPU | 配置自部署的 OpenAI 兼容 Images 接口，复用同一套创作与图库 |

## 创作体验

- **原位生成与迭代**：提交后不跳到图库；预览区呈现排队、加载、采样、保存和结果。可对比参考图、下载、收藏、复用参数或生成变体。
- **能清空的工作台**：「清除预览」移除当前结果、最近缩略图和参考关联，图库原件仍保留。
- **跟随 DSH 的界面**：使用宿主字体、内容字号与主题颜色；紧凑导航，参数区独立滚动，生成按钮保持可用。
- **参数有解释**：步数和种子旁提供悬停/键盘说明；提示框通过独立浮层显示，避开预览和滚动容器裁切。高级设置集中放置尺寸、采样与参考图变化参数。
- **任务有记录**：接收回执落盘、重复提交按任务 ID 去重；本地串行推理，最多保留四个活动任务。服务异常中断会标记失败，避免永久假装「生成中」。

## 隐私图库与作品管理

默认打开隐私模式：**生成 → 隐私图库；收藏 → 正常图库**。会话工具生成的作品也遵循同样的图库筛选规则。图库右上角菜单可切换隐私图库、归档和回收站。

插件设置里关闭隐私模式后，会恢复「全部作品」的浏览方式；不会移动图片，也不会改掉已有收藏标记。

> 隐私图库是一种本机展示规则，不提供加密、密码或访问控制，也不会隐藏已经发到 DSH 会话里的图片。

删除先移入插件回收站，可以恢复；永久删除需再次确认。DSH 对话附件由宿主单独保存，图库删除不会同步清理会话附件。

## 安装

到 [Releases](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest) 下载 `dsh-qwen-studio-2.2.0.tgz`，使用 DSH 的插件安装命令：

```sh
dsh plugin --profile desktop add /absolute/path/dsh-qwen-studio-2.2.0.tgz
```

若桌面版没有把 `dsh` 加入 PATH，macOS 可使用内置启动脚本：

```sh
sh "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" \
  plugin --profile desktop add /absolute/path/dsh-qwen-studio-2.2.0.tgz
```

正常退出并重新打开 DSH，在插件设置中配置「图像」，随后从左侧进入。**发布包包含编译好的前后端、技能与本地环境安装脚本；不包含模型权重。**

现有 `dsh-qwen-studio` 本地版可原位升级：包标识、配置字段、图库目录和偏好键保持兼容。请保留原有数据目录。旧 `dsh-image-gen` 是另一个插件，本项目不会自动搬运它的多供应商数据。

### 本地 Mac

需要 Apple Silicon、Python 3.12、MFLUX 和完整的 Qwen Image 2.1 MLX 模型及共享组件。当前适配器按 MFLUX `0.22.0` 验证；统一内存需求随权重精度、分辨率与共享组件变化。

```sh
sh scripts/setup-local.sh "$HOME/.local/share/qwen-studio/venv"
```

在插件设置里选择 Python 虚拟环境、模型目录、可选 Hugging Face 缓存目录和作品保存目录，设置空闲分钟数。路径支持手动输入与 macOS 原生选择器。首次生成按需启动服务，插件不会自动下载大模型。

完整步骤见 [本地与远程配置](docs/SETUP.md)。模型准备参考 [MFLUX Qwen Image 2.1 文档](https://github.com/mflux-community/mflux/blob/main/src/mflux/models/qwen21/README.md)。

### 自部署远程服务

选择「远程服务器」，填写 `/v1` 基地址、模型名与可选 API Key。服务需支持：

- `GET /v1/models`
- `POST /v1/images/generations`
- `data[0].b64_json` 格式的 PNG 响应，以及请求中的尺寸、种子和采样步数

已有 ComfyUI 需要自行提供兼容上述协议的适配服务，不能直接填原生 ComfyUI 地址。本插件只管理远程请求和结果，不负责启动或卸载远程 GPU 服务。

## 会话调用与技能

启用插件后自动注册工具与技能，无需手动复制技能目录。你可以直接说：

> 画一张清晨山间小屋的横版插画，柔和光线，不要文字。
>
> 沿用刚才那张图的构图，再做一版水彩风格。

进度追踪仅针对 `qwen_generate_image` 的插件队列任务；绕过插件运行独立 CLI 的任务需要另行接入，不会自动获得进度卡片。

工具执行时，对话中显示进度卡片：本地提供阶段与真实采样步数，远程显示处理状态。完成后替换为结果图片，不提供逐步的半成品图片预览。

工具返回图片附件和任务 ID，图片以会话卡片显示，收起工具步骤仍可见。技能说明何时调用、怎样组织完整提示词、如何复用任务 ID，以及何时使用参考变体。

| 参数 | 用途 |
| --- | --- |
| `prompt` | 完整目标画面描述，可直接使用中文 |
| `width` / `height` | 512–2048，16 的倍数；默认 1024 × 1024 |
| `steps` / `seed` | 采样步数 1–60；可选固定种子 |
| `source_image_id` / `change_strength` | 以先前生成结果为参考，变化幅度 0.05–0.95，本地模式支持 |
| `negative_prompt` / `guidance` | 本地负向分支；非空负向词需要 guidance > 1，缺省时自动使用 2.5 并记入任务 |
| `scheduler` | 本地采样调度器，默认 `linear` |

负向、CFG 和调度器当前通过工具提供，尚未加入创作页高级设置。guidance 在没有负向词时不作为质量旋钮。技能能帮助模型发现工具；自动选择仍取决于调用模型的工具能力和 DSH 权限设置，直接创作面板可独立使用。

## 当前能力与验证范围

| 能力 | 本地 MFLUX | 远程 Images 接口 |
| --- | --- | --- |
| 文生图、持久记录、图库管理 | 支持 | 支持 |
| 以前次结果为起点的强度式图生图 | 支持 | 尚未接入 |
| 按需启动、空闲退出 | 支持 | 由远程部署管理 |
| 负向提示词、CFG、调度器工具参数 | 支持 | 显式拒绝，避免静默忽略 |
| 任意外部参考附件、精准指令编辑、蒙版局部重绘 | 尚未接入 | 尚未接入 |

- 已在 macOS 的 DSH 桌面端实测本地生图、切页保留任务、参考变体、会话图片、空闲退出和图库交互。
- 远程协议使用模拟服务回归；尚未对所有远程推理后端做真实 GPU 验收。
- 自动测试覆盖任务持久化/去重/取消、图库分流与恢复、远程协议和会话结果展示；CI 不下载模型、不运行 GPU 推理。
- 当前对接常规 Qwen Image 2.1；不同架构、Turbo、LoRA、ControlNet 等独立实验或 MFLUX 自身能力不等于本插件已提供完整入口。

## 开发与发布

要求 Node.js `^22.19.0 || >=24`，Python 3.12+ 用于 worker 单元测试。DSH 运行环境提供宿主服务；开发依赖固定在锁文件中，`.npmrc` 避免自动安装另一整套宿主 peer 依赖。

```sh
git clone https://github.com/kingcharleslzy-ai/dsh-qwen-studio.git
cd dsh-qwen-studio
npm ci
npm run check
npm run check:package
npm pack --ignore-scripts
```

源码位于 `src/`，本地推理队列在 `backend/server.py`，会话技能在 `skills/qwen-image/`。CI 检查后构建安装包；版本标签必须匹配 `package.json`，Release 附带 `.tgz` 与 SHA-256 校验文件。模型、个人配置、生成图片及运行日志均不进入仓库或安装包。

## 开源来源

本项目独立维护，源于 [shanliuling/dsh-image-gen](https://github.com/shanliuling/dsh-image-gen) 的 DSH 生图集成，并以 Apache-2.0 继续发布。创作工作区、Qwen worker、持久队列、隐私图库及会话流程已作大量重构；原始署名保留在 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。

推理使用 [MFLUX](https://github.com/mflux-community/mflux) / MLX 与 Qwen 模型。模型与依赖遵循各自许可证。本项目不是 Qwen、MFLUX 或 DeepSeek 的官方插件。
