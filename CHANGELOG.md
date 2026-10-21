# Changelog

## 未发布 / Unreleased — 2026-10-21

- Fix auto-update install on Windows: `cliCommand()` returns `dsh.cmd`, and `execFile` cannot launch `.cmd` without a shell (Node throws `EINVAL`), so the update path now routes through `cmd.exe /d /s /c`. macOS keeps the direct `execFile` call.
- Rewrite the setup guide with a hardware self-check table (Apple Silicon unified memory, NVIDIA VRAM, disk), per-OS install commands including the `.cmd` caveat, the Windows/Linux gateway path, first-image acceptance and a troubleshooting table.

## 2.18.3 — 2026-10-19

- Shift the documented default to text-to-image exploration: reference edit is for a named person, garment, scene or local change, not the default path. Multi-reference stays person + garment/object only.
- Record the 6-prompt text-to-image baseline: 6/6 usable, no watermarks, 10.9–11.5 s warm versus about 20 s for reference edit.

## 2.18.2 — 2026-10-19

- Lay the multi-reference section across the full advanced-settings grid so the picker and selected-image strip are not cramped into one column.

## 2.18.1 — 2026-10-19

- Report `multi_image` in the synthetic capabilities used by managed-SSH status/preset reads, matching the real gateway handshake.

## 2.18.0 — 2026-10-19

- Add the multi-reference picker to advanced creation settings: in native edit mode, the first source is the person and up to seven additional sources can be attached as garment/object references; the section is hidden outside edit mode and cleared when mask or ControlNet is enabled.
- Persist multi-reference selections in presets with per-slot resource fingerprints (`sourceExtra:0…6`), clear local ids on export, and remap by fingerprint on import/load. Old single-reference presets remain valid.
- Tests cover multi-image payloads, preset roundtrips and picker visibility.

## 2.17.4 — 2026-10-18

- Allow ControlNet plus a source image without a mask, so pose skeletons can guide a variation while identity comes from the source. Mask-based inpainting remains unchanged.

## 2.17.3 — 2026-10-18

- Document and surface Qwen-Image-Edit negative-prompt guidance: official recommendation is empty/whitespace; long lists fight the reference and trigger CFG 2.5, roughly doubling sampling time. Same seed measured 14.9 s without negative vs 27.2 s with a long list.

## 2.17.2 — 2026-10-18

- Fix reference-image geometry: `ImageScale` now center-crops to the target aspect instead of stretching non-matching references, which caused horizontally widened bodies in edit jobs.
- Document that two full-person references pollute face and body type; use a person plus garment/object reference, and use ControlNet or text for pose instead of a second person.

## 2.17.1 — 2026-10-18

- Fix multi-image edit validation: the legacy single-reference check rejected `source_image_ids` before the multi-image branch ran. Both paths now validate in the intended order.

## 2.17.0 — 2026-10-18

- Add native Qwen-Image 2.1 multi-image editing: `source_image_ids` accepts 2–8 imported references with `reference_mode=edit`; the gateway uploads each asset, builds one `LoadImage`+`ImageScale` per slot, and wires `TextEncodeQwenImage21` inputs `images.image_1..N`. Prompt references are `<image1>`, `<image2>`, ….
- Multi-image is remote-gateway only in this release; local MFLUX rejects it explicitly instead of silently dropping references. Presets and the creation canvas still use the single-reference fields.
- Gateway advertises `multi_image`; older gateways keep working for single-image jobs, while a multi-image request fails with an explicit “update gateway” error rather than falling back to one image.
- Tests: multi-image graph wiring and remote upload/protocol validation; existing single-image paths unchanged.

## 2.16.0 — 2026-10-18

- Add `qwen_image_reroll`: score completed images and resubmit only those carrying requested QA flags (default heavy-grain / texture-overload), preserving prompt, size, steps, guidance, reference mode, LoRA, ControlNet and mask while advancing the seed. Originals stay for comparison; the tool never deletes or retries unflagged jobs.
- Share the local scoring implementation between `qwen_image_score` and reroll so both use the same thresholds and metrics; cap reroll batches at 20 ids and keep submission asynchronous.
- Keep scoring and reroll local: no model load, no SSH, no gallery mutation beyond normal task records.

## 2.15.0 — 2026-10-18

- Add `qwen_image_score` for objective local QA metrics on 1–30 completed images: edge/detail strength, high-frequency grain, saturation, brightness, skin ratio, highlight/shadow clipping, with provisional heavy-grain / texture-overload flags.
- Report only: the tool is a diagnostic, not a pass/fail gate; optional `write=true` stores `qa.json` beside the image without touching pixels, gallery flags or job records. Thresholds require human ground-truth calibration.
- Bundle `backend/score_image.py` (Pillow + numpy, same configured Python as image import) and keep scoring fully local: no model load, no SSH, no upload.

## 2.14.0 — 2026-10-18

- Add `qwen_image_batch` for 1–10 independent jobs in one call: shared validation, real task ids, per-index failures, and automatic waves within the backend's 4-job admission cap. It returns ids without waiting for pixels; never retries accepted jobs.
- Add `qwen_image_import_many` for 1–20 host image files and content-addressed reuse: identical normalized bytes with the same kind return the existing resource id (`deduped: true`); per-path failures do not stop the batch.
- Add `qwen_image_export` for copy-only handoff of completed jobs (`<id>/image.png`, `<id>/job.json`, `manifest.json`) with no overwrite and no gallery mutation.
- Keep all existing tools, presets, gallery formats and job records unchanged; the new surface is additive and read-only except explicit submission/import.

## 2.13.0 — 2026-10-18

- Add `qwen_image_jobs` for batch task lookup (up to 200 ids), active-queue snapshots and status counts without starting inference.
- Add `qwen_image_cancel` for targeted cancellation of up to 50 queued/running tasks; finished or unknown ids are reported per item and never fail the batch. Remote cancellation follows the existing pending-request ownership rules.
- Add `qwen_image_gallery` read-only search over prompts, seed, status, favorite/archive flags, source image id and start time, returning lineage fields without touching `gallery.json` or exposing pixels.
- Keep every existing tool contract and gallery file format unchanged; new tools are additive and read-only except explicit cancellation.

## 2.12.0 — 2026-10-18

- Add independent automatic update checks (on by default, every 6 hours) and automatic installation (off by default), manual checks/install, SHA256 verification, package backups and rollback. Active uploads/queues/generation defer installation; never restart DSH automatically.
- Protect favorite/archive metadata: validate records, stop on corruption or unexpected loss, preserve a pre-write backup, and expose explicit recovery while retaining damaged evidence and image originals.
- Replace repeated full gallery reads with an incremental index, active-job refresh and periodic reconciliation. Revision/delta snapshots send only changed records during progress polling.
- Publish precompiled immutable market snapshots, a native format-1 index, stable-name tarball and checksums. Expand agent onboarding, deployment, presets, update and recovery instructions; replace personal deployment naming with generic examples and enforce privacy scans.
- Existing settings, presets, model paths, images and remote deployments are retained; remote server scripts and model dependencies are not silently upgraded.

## 2.11.0 — 2026-10-17

- Enable native Qwen 2.1 reference editing on Apple Silicon through MFLUX QwenImage21Edit. Reuse the configured complete vision-capable checkpoint, image resources and LoRA channel; preserve existing variation/preset semantics.
- Inspect local API and vision tensors without loading the model or downloading weights; share backend-specific reference-edit availability between creation settings, agent resources and loaded presets. Explain missing components before startup without backend fallback.
- Keep full denoising, prefix KV reuse and disabled step skipping/Turbo. Reload the model when switching native editing, standard generation or controlled inpainting. Upgrade only known idle workers to protocol v8.
- Refresh the repository landing page with a concrete native-edit example, bilingual quick start, supported-backend matrix and discoverable feature terms.

## 2.10.0 — 2026-10-17

- Add explicit native reference editing to the updated Qwen remote gateway, creation settings, agent tools and shared presets. Use Qwen 2.1 image+text conditioning and a full sampling schedule for instruction/style edits; keep all legacy variation preset semantics unchanged.
- Enforce native-edit capability checks and incompatible-setting errors. Current local MLX and older gateways fail clearly instead of silently degrading or switching backends.
- Include the 2.9 image-import improvements below. Update skill routing to choose native editing for requested style/semantic changes and avoid repeated near-identical retries.
- Verify native DSH agent selection, real 40-step remote editing, synchronized chat/creation progress and completed images, and resource-mode controls while preserving existing configuration, presets and original gallery files.

## 2.9.0 — 2026-10-17

- Add `qwen_image_import` for public image URLs, host-local image files and verified conversation image attachments. Return managed IDs for img2img, ControlNet, masks and shared presets without manual gallery imports, model startup or SSH.
- Reuse streamed size limits, image normalization and atomic resource storage. Bound downloads, check every redirect, pin validated DNS, reject private-network destinations and clean aborted partial imports. Handle Fake-IP DNS with per-request HTTPS resolution without changing proxy/DNS settings.
- Document the search → direct image URL → import → plugin generation workflow in tool schemas and the bundled skill. Keep live progress, conversation image attachments and gallery synchronization on the existing durable queue.
- Distinguish legacy partial-noise variations from native Qwen 2.1 reference editing. The updated remote gateway conditions on both image and text and samples the full schedule; expose explicit edit mode in advanced settings, agent tools and presets. Preserve old preset semantics, reject unsupported local/old-gateway requests instead of silently degrading.
- Preserve connection configuration, presets, gallery works and panel drafts. Imported reference inputs remain separate from generated artwork.

## 2.8.0 — 2026-10-17

- Add plugin-owned on-demand SSH forwarding: passive gallery/resource/preset/config reads do not connect. Keep leases through upload, queueing, sampling and saving; confirm remote model shutdown before closing only the owned SSH process.
- Show the shared idle timeout near the top of settings in both local and remote modes, persist it to the Qwen gateway for independent crash/sleep cleanup, and retain the original configuration field for compatibility.
- Add `qwen_image_connection` for revision-checked live local/remote switching and idle-time edits through DSH's settings service; prevent switching during active jobs without touching credentials, presets or images.
- Document content-addressed LoRA transfer and backend-specific seed reproducibility. No change to model weights, quantization, sampler or quality parameters.

## 2.7.0 — 2026-10-17

- Add a private ComfyUI Qwen 2.1 gateway with native Union control/inpainting and checked LoRA loading, content-addressed streaming assets and an idempotent task protocol.
- Enable remote advanced creation and unchanged preset references in both panel and agent tools after capability negotiation; retain ordinary OpenAI Images compatibility.
- Synchronize real sampling steps, transfer/loading phases, cancellation, saved PNGs and reference comparisons with chat and the gallery. Add remote memory release without touching other GPU services.
- Preserve existing configuration, preset IDs/defaults and gallery data; extend skill instructions with remote capability discovery, automatic resource sync and supported schedulers.

## 2.6.0 — 2026-10-16

- Show resolved connection values and their inheritance source; save edited settings atomically without pinning defaults. Keep secrets masked and report running worker paths separately.
- Add a reusable resource catalog covering imported inputs, default/custom LoRA folders and gallery images, without starting inference.
- Add full creation presets with rename, default, delete/undo and portable JSON import/export. Match references by streamed SHA-256; report missing resources instead of silently dropping effects.
- Add negative prompt, CFG and scheduler controls with backend-specific capability validation and full parameter reuse.
- Simplify advanced settings into aligned sections with contextual help, explicit preset reload and refreshed imported-resource lists.
- Expose resource discovery and shared preset management as agent tools; document configuration-only intent, full settings replacement, revision conflicts and the generate/load/save workflow.
- Use worker v7 for aligned LoRA roots and runtime configuration reporting. Preserve existing settings, image files and job records.

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
