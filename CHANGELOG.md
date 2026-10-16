# Changelog

## 2.5.0 — 2026-10-16

- Bring LoRA, ControlNet and masked inpainting into the creation page advanced settings, with native file pickers, previews, per-LoRA toggles and weights, and persistent draft selections.
- Import selected bytes into private local assets: normalize PNG/JPEG/WebP without loading MLX, stream LoRA uploads with content deduplication, and keep inputs out of the artwork gallery. No arbitrary local-path reading endpoint.
- Snapshot imported image inputs before task admission; preserve advanced parameters when reusing results. Validate incomplete combinations and remote-mode limits before submission.
- Use worker protocol v6 for imported inputs; gracefully replace known idle older workers without interrupting another session’s active generation.

## 2.4.0 — 2026-10-16

- Unify the DSH skill catalog and instructions from one bundled source. Image requests use the plugin queue; prompt-only requests do not submit jobs, and failures do not silently fall back to independent scripts.
- Add read-only `qwen_image_status` to recover an accepted task and its visible conversation attachment without starting inference or creating another gallery item.
- Read exact task records for conversation polling, tool waits and image lookup instead of scanning every gallery image.
- Follow jobs that finish while the creation page is unmounted; respect cleared previews. Preserve HTTP status when old hosts return non-JSON errors.
- Complete the earlier local 2.3.0 tool-only experiment: validate and dispatch LoRA, ControlNet and mask parameters through the persistent worker, with input snapshots, allowed LoRA directory, model cache isolation and exact preservation of black mask pixels at output size.
- Reject incompatible parameter combinations and unsupported remote advanced requests instead of silently generating a plain image. Advance the local worker protocol to v5 so an old worker cannot acknowledge unsupported parameters.


## 2.2.0 — 2026-10-16

First independently maintained public release as `dsh-qwen-studio` (display name: 图像).

- Direct creation workspace in the left navigation, without a chat-model intermediary.
- In-place progress and results, reference-based variations, parameter recall and removable preview history.
- Persistent local jobs with idempotent receipts, serialized inference, cancellation and interrupted-job reporting.
- On-demand MFLUX worker with configurable idle shutdown and manual unload.
- Privacy gallery enabled by default: unstarred works stay private; starred works appear in the normal gallery.
- Batch favorites/archive/trash/restore and confirmed permanent deletion.
- DSH theme/font integration, compact single-row navigation, independently scrolling editor and visible submit footer.
- Step/seed help and a separate advanced settings page; portal tooltips avoid scroll-container clipping.
- Creation preview follows new active conversation jobs; conversation progress cards track exact invocation receipts and retire on result.
- Model-invocable `qwen_generate_image`, automatically registered `qwen-image` skill and conversation image cards.
- Local negative prompt, true CFG and scheduler tool parameters recovered from the previously applied runtime patch.
- Self-hosted OpenAI-compatible Images adapter; unsupported local-only parameters fail explicitly in remote mode.
- Independent package/repository metadata, reproducible dependency lock, CI, release tarball and package-content checks.

Earlier local builds used `2.1.0-local.3`; the package ID, configuration keys and data format remain compatible.
