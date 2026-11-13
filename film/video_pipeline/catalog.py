"""Catalog entries used by the bundled film workflow."""
def pipeline_catalog():
    return {"documentary-montage": {"id": "documentary-montage", "name": "多镜头剪辑", "source_mix": "footage-first", "review_focus": ["连续性", "镜头语义"]}}


def provider_catalog():
    return {"h3-local": {"id": "h3-local", "name": "MiniMax H3", "runtime": "comfyui", "paid": False}}
