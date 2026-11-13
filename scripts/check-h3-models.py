"""Check a bundled H3 graph against a running local ComfyUI without loading weights."""
import argparse
import json
from pathlib import Path
from urllib.request import ProxyHandler, build_opener

ROOT = Path(__file__).resolve().parents[1] / "video" / "workflows"
LOADERS = {"UNETLoader": "unet_name", "VAELoader": "vae_name",
           "LoraLoaderModelOnly": "lora_name", "CLIPLoader": "clip_name"}


def problems(graph, inventory):
    missing = set()
    for node in graph.values():
        kind = node["class_type"]
        if kind not in inventory:
            missing.add(f"node: {kind}")
            continue
        field = LOADERS.get(kind)
        if field:
            spec = inventory[kind]["input"]["required"][field]
            values = spec[0] if isinstance(spec[0], list) else spec[1].get("options", [])
            expected = node["inputs"][field]
            if expected not in values:
                missing.add(f"{kind}.{field}: {expected}")
    return sorted(missing)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8188)
    parser.add_argument("--workflow", choices=sorted(p.stem for p in ROOT.glob("*.json")))
    args = parser.parse_args()
    url = f"http://127.0.0.1:{args.port}/object_info"
    with build_opener(ProxyHandler({})).open(url, timeout=30) as response:
        inventory = json.load(response)
    failed = False
    for file in sorted(ROOT.glob("*.json")):
        if args.workflow and file.stem != args.workflow:
            continue
        issues = problems(json.loads(file.read_text(encoding="utf-8")), inventory)
        failed |= bool(issues)
        print(file.stem, " / ".join(issues) if issues else "OK")
    raise SystemExit(int(failed))
