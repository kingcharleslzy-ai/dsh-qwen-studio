# Changelog

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
