# 工具分工与边界（2.16.0）

14 个工具不是越多越好，而是按「提交 / 查询 / 资源 / 图库 / 质量 / 连接」分组。
先读这张表，再决定调用哪个，避免重复提交或把只读工具当提交工具。

## 提交

| 工具 | 何时用 | 关键边界 |
|---|---|---|
| `qwen_generate_image` | 单张、要立即拿到附件；`source_image_ids` 多图仅远程 | 多图第二张用服装/物品，不要放第二个人；超时先查 status |
| `qwen_image_batch` | 1–10 张独立任务、先拿 ID | 异步；自动按 4 个准入位分波；不等待出图 |
| `qwen_image_reroll` | 已完成图命中 QA 标记后重投 | 同参数 seed+1；原图保留；未命中不重试 |

## 查询

| 工具 | 何时用 | 与相邻工具的区别 |
|---|---|---|
| `qwen_image_status` | 单个 ID，要取回图片附件 | 返回附件；不要用它批量查 |
| `qwen_image_jobs` | 1–200 个 ID 的状态/队列/计数 | 只返回元数据，不返回附件 |
| `qwen_image_gallery` | 按提示词/种子/收藏/时间检索历史任务 | 只读；返回血缘字段；不是资源清单 |
| `qwen_image_cancel` | 取消排队/生成中的任务 | 不删图；已结束任务返回错误而非副作用 |

## 资源与预设

| 工具 | 何时用 | 边界 |
|---|---|---|
| `qwen_image_import` | URL / 本机文件 / 对话附件 → 资源 ID | 单张；不生成 |
| `qwen_image_import_many` | 1–20 个本机文件批量导入 | 同内容同 kind 复用 ID |
| `qwen_image_resources` | 查 LoRA、已导入图片、原生编辑能力 | 不是图库检索；不返回像素 |
| `qwen_image_presets` | 保存/加载/导入导出整套参数 | 只存参数与资源指纹，不存 prompt 正文 |

## 图库与交付

| 工具 | 何时用 | 边界 |
|---|---|---|
| `qwen_image_export` | 把完成任务复制给外部图库/工具 | 只复制；目标存在时拒绝覆盖 |
| `qwen_image_score` | 客观指标诊断（grain/edge/skin） | 不是 pass/fail 门禁；语义失败抓不到 |

## 连接

| 工具 | 何时用 |
|---|---|
| `qwen_image_connection` | 实时切本机/远程、改统一空闲时间；不触发生成 |

## 常见组合

- 新场景/新姿势先探索：`qwen_generate_image` 文生图 → 选一张 → 再决定是否用参考图
- 一次性出多张对比：`qwen_image_batch` → `qwen_image_jobs` → `qwen_image_score`
- 纹理翻车重抽：`qwen_image_score` → `qwen_image_reroll` → `qwen_image_jobs`
- 参考包入库：finder `ref_pack` → `qwen_image_import_many` → 生成
- 完成任务交付：`qwen_image_export` → finder `library ingest --copy` + tag

## 明确不做的事

- 不在 `qwen_image_jobs` 里返回图片附件（会把一次查询变成几十张图）。
- 不把 `qwen_image_score` 当自动门禁；语义质量要人工/VLM 标注。
- 不用 `qwen_image_batch` 等待出图；等待会占住会话，轮询 `jobs` 更稳。
