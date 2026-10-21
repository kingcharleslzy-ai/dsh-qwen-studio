"""Create a client-only image processing venv; never installs a model or edits DSH settings."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import venv


def main():
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"): sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=Path.home()/'.dsh/qwen-studio/venv', help='new or existing venv directory (not an existing MLX/ComfyUI environment)')
    args = parser.parse_args()
    if sys.version_info < (3, 10):
        parser.error('Python 3.10 or newer is required')
    target = args.directory.expanduser().resolve()
    if target.exists() and any(target.iterdir()) and not (target/'pyvenv.cfg').is_file():
        parser.error('Target is not an empty directory or a Python venv; refusing to modify it')
    if not (target/'pyvenv.cfg').exists():
        venv.EnvBuilder(with_pip=True).create(target)
    python = target/('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    subprocess.run([str(python), '-m', 'pip', 'install', 'Pillow>=11,<13', 'numpy>=1.26,<3'], check=True, env={**os.environ, 'PIP_USER': 'false', 'PYTHONUTF8': '1', 'PYTHONIOENCODING': 'utf-8'})
    subprocess.run([str(python), '-c', 'import PIL,numpy;print("Pillow="+PIL.__version__+" numpy="+numpy.__version__)'], check=True)
    print('Set Qwen Studio Python executable to: '+str(python))
    print('Client image import/scoring only. DSH settings, models and GPU services were not changed.')

if __name__ == '__main__':
    main()
