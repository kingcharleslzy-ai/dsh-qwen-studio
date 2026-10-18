#!/bin/sh
set -eu
if [ "$(uname -s)" != Darwin ] || [ "$(uname -m)" != arm64 ]; then
  echo '本地MFLUX需要Apple Silicon Mac。其他系统请连接远程Qwen服务。' >&2
  exit 1
fi
QWEN_STUDIO_ENV_DIR=${1:-"$HOME/.local/share/qwen-studio/venv"}
QWEN_STUDIO_PYTHON=${QWEN_STUDIO_PYTHON:-python3.12}
if ! command -v "$QWEN_STUDIO_PYTHON" >/dev/null 2>&1; then
  echo '请先安装Python3.12，或设置QWEN_STUDIO_PYTHON为它的绝对路径。' >&2
  exit 1
fi
"$QWEN_STUDIO_PYTHON" -m venv "$QWEN_STUDIO_ENV_DIR"
"$QWEN_STUDIO_ENV_DIR/bin/python" -m pip install 'mflux==0.22.0'
echo '环境已安装。请在DSH → 插件 → dsh-qwen-studio中填写：'
printf 'Python路径：%s/bin/python\n' "$QWEN_STUDIO_ENV_DIR"
echo '模型目录：已下载的Qwen Image2.1 MLX模型文件夹（包含model_index.json或模型配置）。'
echo 'Hugging Face缓存：若模型依赖共享组件，填入已下载组件所在的HF_HOME。'
echo '本脚本不下载模型，不启动常驻服务。'
