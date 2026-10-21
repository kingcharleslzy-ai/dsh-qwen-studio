"""Use ComfyUI's native LoRA loader, but fail when an adapter loads no patches."""
import logging
import nodes

class DSHQwenLoraLoader(nodes.LoraLoaderModelOnly):
    def load_lora_model_only(self, model, lora_name, strength_model):
        before = sum(len(p) for p in model.patches.values())
        result = super().load_lora_model_only(model, lora_name, strength_model)
        added = sum(len(p) for p in result[0].patches.values()) - before
        if strength_model != 0 and added <= 0:
            raise ValueError('LoRA did not match any base-model layers; select a Qwen Image 2.1 adapter')
        logging.info('DSH LoRA: %s, strength=%s, loaded patches=%s', lora_name, strength_model, added)
        return result

NODE_CLASS_MAPPINGS = {'DSHQwenLoraLoader': DSHQwenLoraLoader}
