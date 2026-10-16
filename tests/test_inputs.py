import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image
root = Path(__file__).parents[1]
spec=importlib.util.spec_from_file_location('input_worker',root/'backend/server.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
spec=importlib.util.spec_from_file_location('normalizer',root/'backend/normalize_image.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
class Inputs(unittest.TestCase):
    def test_imported_images_are_snapshotted_but_not_gallery_jobs(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp);ids=dict(source='a'*32,control='b'*32,mask='c'*32)
            for kind,id in ids.items():
                folder=directory/'assets/images'/id;folder.mkdir(parents=True)
                Image.new('RGB',(16,16),'white').save(folder/'image.png')
                (folder/'asset.json').write_text(json.dumps(dict(id=id,kind=kind)))
            q=w.JobQueue(directory,lambda *args:{})
            try:
                job=q.submit(dict(id='d'*32,prompt='A teapot',width=512,height=512,steps=4,source_image_id=ids['source'],controlnet_image_id=ids['control'],mask_image_id=ids['mask']))
                for kind,name in [('source','reference'),('control','control'),('mask','mask')]:
                    (directory/'assets/images'/ids[kind]/'image.png').unlink()
                    self.assertTrue((directory/'images'/job['id']/(name+'.png')).is_file())
                self.assertEqual(set(q.jobs),{job['id']})
            finally:q.pool.shutdown()
    def test_managed_lora_import_works_without_changing_user_lora_setting(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp);lora=directory/'assets/loras/test.safetensors';lora.parent.mkdir(parents=True);lora.write_bytes(b'fixture')
            w.atomic_json(directory/'state/runtime-config.json',dict(lora_directory=str(directory/'custom-loras')))
            q=w.JobQueue(directory,lambda *args:{})
            try:
                job=q.submit(dict(prompt='A teapot',lora_paths=[str(lora)],lora_scales=[.8],lora_names=['chosen-style.safetensors']))
                self.assertEqual(job['lora_names'],['chosen-style.safetensors'])
            finally:q.pool.shutdown()
    def test_transparency_and_mask_threshold_inputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp);source=folder/'transparent.png';Image.new('RGBA',(2,2),(255,255,255,0)).save(source)
            n.normalize(source,folder/'source.png','source');n.normalize(source,folder/'mask.png','mask')
            with Image.open(folder/'source.png') as image:self.assertEqual(image.getpixel((0,0)),(255,255,255))
            with Image.open(folder/'mask.png') as image:self.assertEqual(image.getpixel((0,0)),0)
            # JPEGs normalize to PNG and strip original metadata.
            jpg=folder/'original.jpg';Image.new('RGB',(8,4),'red').save(jpg)
            self.assertEqual(n.normalize(jpg,folder/'normalized.png','source'),dict(width=8,height=4))
            with Image.open(folder/'normalized.png') as image:self.assertEqual(image.format,'PNG')
    def test_input_cannot_escape_managed_folder(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp);outside=directory/'outside.png';Image.new('RGB',(2,2)).save(outside)
            asset=directory/'assets/images'/('a'*32);asset.mkdir(parents=True);(asset/'image.png').symlink_to(outside)
            (asset/'asset.json').write_text(json.dumps(dict(id='a'*32,kind='control')))
            q=w.JobQueue(directory,lambda *args:{})
            try:
                with self.assertRaises(ValueError):q.submit(dict(prompt='A tree',controlnet_image_id='a'*32))
            finally:q.pool.shutdown()
if __name__=='__main__':unittest.main()
