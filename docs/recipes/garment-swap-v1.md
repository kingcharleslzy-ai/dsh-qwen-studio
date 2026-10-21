# 多图编辑操作示例

使用两张普通参考图，例如人物日常穿搭照片与一件外套商品图。先通过 qwen_image_import 导入并取得真实 ID，再检查网关能力包含 multi_image。

- reference_mode: edit；source_image_ids: [人物ID, 外套ID]，顺序明确。
- scheduler: linear；尺寸为 32 的倍数；示例 832×1216、40 步。
- 提示词示例：保持 <image1> 的人物和场景，把外套替换成 <image2> 的蓝色夹克；保留夹克的颜色和口袋结构。
- 不同时传 source_image_id、change_strength、mask_image_id 或 controlnet_image_id。
- seed 只控制可复现条件，不代表年龄、风格或质量；不同种子应逐张检查。

创作页：选主参考图 → 选择“按指令编辑” → 添加附加参考 → 提交。可保存为预设；缺失资源应重新选择。参考可能互相影响，中心裁切可能损失边缘；不保证人物身份或细节完全保持。此示例是操作说明，不是成功率或速度基准。
