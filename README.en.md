<div align="center">

![Qwen Studio — Qwen Image 2.1 for DeepSeek Harness](docs/media/hero.svg)

# Qwen Studio

**Generate and edit with Qwen Image 2.1 inside DeepSeek Harness.**

Apple Silicon **MLX / MFLUX**, or a **self-hosted NVIDIA CUDA / ComfyUI** gateway.

[![Release](https://img.shields.io/github/v/release/kingcharleslzy-ai/dsh-qwen-studio?label=Download)](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest)
[![CI](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/actions/workflows/ci.yml)

[Download](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest) · [中文](README.md) · [Local setup](docs/SETUP.md) · [Remote GPU](docs/REMOTE.md) · [Verification](docs/VERIFICATION.md)

</div>

## Installation and agent onboarding

Start with [AGENTS.md](AGENTS.md), the detailed agent runbook for installation, existing-data preservation, local MLX setup, your own NVIDIA gateway, resources, presets, recovery and updates. The generation workflow is in [SKILL.md](skills/qwen-image/SKILL.md).

**Bring your own model and server.** No personal deployment addresses, private IPs, model paths or API keys are included. Add the [native DSH market index](https://kingcharleslzy-ai.github.io/dsh-qwen-studio/index.json) or use the [shared market](https://kingcharleslzy-ai.github.io/dsh-purge/index.json). Market snapshots are precompiled and pinned to immutable commits.

From 2.12.0, automatic checks default to every 6 hours; automatic installation defaults off. Installation defers while tasks are active, verifies SHA256 and creates a rollback package. DSH never restarts automatically. Models, gallery contents, presets and remote services are outside the plugin update payload.

## A reference in. A new direction out.

| Reference photograph | Native MLX reference edit |
| :---: | :---: |
| <img src="docs/media/reference-cup.png" width="360" alt="Blue handmade pottery cup reference photograph" /> | <img src="docs/media/mlx-native-edit.png" width="360" alt="Watercolor transformation retaining the blue cup shape and handle" /> |

Actual plugin output: Qwen Image 2.1, MFLUX 0.22.0, 512×512, 20 full sampling steps. No retouching. Source: Wildfeuer / Wikimedia Commons, CC BY-SA 3.0; [image attribution and adaptation license](docs/media/CREDITS.md). A single test is not a success-rate or quality guarantee.

## Direct creation and agent tools, in one workspace

- **Create without a chat model.** Open **图像** in DSH's left sidebar. Write a prompt, pick a reference, generate and iterate in place.
- **Let an agent do it.** The bundled skill guides a tool-capable model through search → image import → generation. Chat and the creation page share real progress and completed images.
- **Native instruction editing.** Both supported local MFLUX and the bundled remote gateway condition on image and text. Existing strength-based variations remain available with unchanged preset semantics.
- **Advanced controls.** Select LoRAs, ControlNet inputs and masks with native file pickers or reusable resource lists. Configure negative prompts, CFG and supported schedulers.
- **Complete presets.** Save, reload, rename, set a default, import or export JSON. The panel and agent use the same resource and preset stores.
- **Persistent jobs.** Switching pages does not cancel generation. Retrieve an existing result without generating again.
- **On-demand resources.** Local inference starts when needed. Plugin-owned remote SSH starts on generation and disconnects after confirmed model unloading. One configurable idle timeout.
- **Curated gallery.** New results enter the private gallery; favorites appear in the main gallery. Search, batch archive and recoverable trash are included. “Private” is organization, not encryption; chat images remain visible.

![DSH creation workspace](docs/media/creation.png)

This is a **DeepSeek Harness plugin**, not a standalone app. Package: `dsh-qwen-studio`, version **2.11.0**. Independently maintained; no dependency on the old `dsh-image-gen` package.

## Quick start

1. Download the compiled `.tgz` from [Releases](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/releases/latest).
2. Install, then quit and reopen DSH:

```sh
dsh plugin --profile desktop add /absolute/path/dsh-qwen-studio-2.12.0.tgz
```

On macOS without a global CLI:

```sh
sh "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" \
  plugin --profile desktop add /absolute/path/dsh-qwen-studio-2.12.0.tgz
```

3. Configure **图像** in plugin settings. Choose local Apple Silicon or your own remote gateway, then open the creation page or ask the agent to generate.

**Local:** Apple Silicon, Python 3.12, MFLUX 0.22.0 and separately prepared Qwen Image 2.1 weights. Native editing needs a complete checkpoint with the vision encoder and processor; text-only exports are insufficient. Memory requirements depend on weights, resolution and extra components. [Setup guide](docs/SETUP.md).

**Remote:** deploy the bundled Qwen gateway with your ComfyUI installation and model files. Configure its `/v1` address, model, optional key and SSH alias. Ordinary OpenAI-compatible Images APIs support basic text-to-image only; do not enter a raw ComfyUI address as an Images endpoint. Windows / RTX 4090 D is GPU-tested; Linux lifecycle code is not yet GPU-qualified. [Remote guide](docs/REMOTE.md).

Weights are not distributed or automatically downloaded. In-place upgrades preserve your configured data directory, existing presets and gallery originals.

## Choose the reference mode

| Mode | Intended use | Parameters |
| --- | --- | --- |
| Variation | Small changes while retaining the source | `source_image_id` + `change_strength` |
| Native edit | Instruction edits, style transfer, recoloring | `source_image_id` + `reference_mode="edit"` |

Select **参考图用法 → 按指令编辑 · Qwen 原生** after choosing a reference. Agents check `qwen_image_resources.reference_edit.supported` on the current backend first. Missing APIs or vision weights are reported before model startup; there is no silent backend fallback.

Native editing currently requires `linear`, dimensions divisible by 32, and one reference. It cannot be combined with masks or ControlNet in this plugin. The LoRA channel is shared, but adapter edit quality depends on its training. Local editing uses prefix KV reuse, full denoising, no step skipping, no Turbo, no automatic prompt rewrite and no hidden retries. Fixed seeds do not imply identical pixels across backends.

## Tools an agent can discover

| Tool | Purpose |
| --- | --- |
| `qwen_image_import` | Public image URL, host-local path or real conversation attachment → managed image ID |
| `qwen_image_resources` | List actual image inputs / LoRAs and current native-edit availability |
| `qwen_image_presets` | Configure, save, load and share complete parameter sets |
| `qwen_generate_image` | Submit to the durable queue; return an image attachment and task ID |
| `qwen_image_status` | Check real progress or recover the same completed result |
| `qwen_image_connection` | Switch local/remote live and update the shared idle timeout |

The bundled [qwen-image skill](skills/qwen-image/SKILL.md) is registered automatically. Configuration-only and prompt-writing requests do not generate. Accepted tasks are queried before any retry; the agent should not bypass the plugin with standalone scripts. Search uses tools already available in the conversation, not a search engine bundled here.

Imported PNG/JPEG/WebP inputs stay separate from generated gallery works. URLs are checked on each redirect and pinned to validated public addresses. Remote assets transfer by content hash, not guessed server filenames. Fake-IP compatibility is scoped to import requests and does not alter system proxy or DNS settings.

## Verification, contribution and licenses

Version 2.11.0 passed 65 tool/UI tests and 31 backend tests. Native DSH selected local reference editing and completed all 40 steps with synchronized chat/creation results; all 355 pre-existing configuration, preset and gallery files retained their hashes. See [verification](docs/VERIFICATION.md) for automated checks, real GPU tests and native DSH acceptance. CI does not run GPU inference. Tool selection has been tested with DSH / DeepSeek-V41-Flash; other models depend on their tool support, context and DSH permissions.

```sh
git clone https://github.com/kingcharleslzy-ai/dsh-qwen-studio.git
cd dsh-qwen-studio
npm ci
npm run check
npm run check:package
```

Node.js `^22.19.0 || >=24`; worker tests require Python 3.12 and Pillow 11–12. [Report an issue](https://github.com/kingcharleslzy-ai/dsh-qwen-studio/issues) with versions, reproduction steps and errors after removing private data.

Originated from [shanliuling/dsh-image-gen](https://github.com/shanliuling/dsh-image-gen)'s DSH integration and now maintained independently. Code: [Apache-2.0](LICENSE), original attribution in [NOTICE](NOTICE). Documentation images have [separate credits/licenses](docs/media/CREDITS.md). Model weights and inference dependencies retain their own licenses. Not an official Qwen, MFLUX or DeepSeek plugin.

2.12.0 acceptance: 77 TypeScript/UI tests and 31 worker tests, native DSH update controls, a real 40-step chat generation synchronized to the creation panel, page switching, favorite/private-gallery routing and the shared market card. Native package installation and rollback were exercised in isolated profiles. See [verification](docs/VERIFICATION.md) for scope and limits.
