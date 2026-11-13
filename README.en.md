# DSH-Spicy

## Send this to your DSH agent

Open a DeepSeek Harness chat with a configured chat model and send this line:

```text
Install DSH-Spicy and help me generate an image and a video on this computer. https://github.com/kingcharleslzy-ai/DSH-Spicy
```

In the Windows test, the agent used the repository link to find the guide, verify and install the release, and load the deployment skill. Review the host’s installation and folder access prompts. Check the image and playable video returned by your agent to verify both local models. The base weights total about 57 GB, plus space for the runtime and cache. [Windows walkthrough](docs/WINDOWS-LOCAL.md)

![DSH-Spicy — Image, Video and Film](docs/media/hero.svg)

**An NSFW content creation plugin for purge.**

Create NSFW images, clips with sound and multi-shot films on your own hardware. Design a fictional adult character in Qwen Image 2.1, refine the wardrobe or lighting with masked edits, and reuse the portrait as a MiniMax H3 shot reference. For a longer film, your DSH agent can build character cards, storyboard scenes, revise individual shots and cut the final MP4. The **创作** sidebar entry opens both image and video workspaces. [中文](README.md)

## Install the compiled plugin

Use DSH 0.2.2-rc.1 or later. Add the [native market index](https://kingcharleslzy-ai.github.io/DSH-Spicy/index.json) under Plugins → Discover → Index sources. Install `dsh-qwen-studio`. Alternatively, download the TGZ and checksum list from the [latest release](https://github.com/kingcharleslzy-ai/DSH-Spicy/releases/latest), verify the matching checksum, and run `dsh plugin --profile desktop add /absolute/path/to/dsh-qwen-studio.tgz` for that profile.

For version 3.0.1 or earlier, upgrade in place once using the new index or release TGZ. The earlier built-in updater checks the old repository address. Version 3.0.2 uses the renamed repository. If a standalone H3 video or film bundle is selected, let active calls finish, disable those two bundles, then reload the combined plugin. Keep your data home, models, connection settings, project directory, character library and attachments. During transition the selected standalone bundles continue to own their tools. [Agent installation and migration](AGENTS.md)

Windows NVIDIA users can deploy both models on the DSH machine. The Windows walkthrough includes model downloads, loopback configuration and checks for the first image and video. [Windows setup and tested results (Chinese)](docs/WINDOWS-LOCAL.md)

## Choose a backend

| Task | Runtime | Setup |
| --- | --- | --- |
| Qwen images, native editing, LoRA and masks | Apple Silicon, Python 3.12, MFLUX and a full checkpoint | [Local image setup](docs/SETUP.md) |
| Self-hosted Qwen images | NVIDIA server or same-machine gateway, ComfyUI, direct connection or SSH | [GPU gateway](docs/REMOTE.md) |
| H3 clips with sound | Windows NVIDIA and ComfyUI on the DSH machine or over SSH | [Video weights, node check and connection](docs/H3-SETUP.md) |
| Multi-shot film with narration | POSIX editing host, FFmpeg, Python and writable project storage. The bundled speech backend uses macOS system voices. | [Film setup](docs/H3-SETUP.md) |

The plugin ships code and workflows. Obtain the models for your selected backend under their respective licenses.

## Work with the agent

- **“Paint a blue ceramic cup in watercolor.”** The image tool returns a gallery job and an image attachment. Use the attachment ID as the reference for a quality-mode video.
- **“Make that cup steam for five seconds, with room ambience.”** The H3 tool takes the ordered references and requested duration, then returns a job ID and playable MP4. Resume unfinished shots by ID.
- **“Make a one-minute pottery film with the same potter throughout.”** The agent creates character cards and a timed shot list, reviews real clips, revises rejected shots, renders the master and can record a final audiovisual review against the file hash.

Five skills register with DSH: [model setup](skills/studio-model-setup/SKILL.md), [creative routing](skills/studio-creation/SKILL.md), [image tools](skills/qwen-image/SKILL.md), [H3 single shots](skills/h3-video/SKILL.md), and [multi-shot filmmaking](skills/h3-long-film/SKILL.md). [Release history](CHANGELOG.md) · [Third-party notices](NOTICE).
