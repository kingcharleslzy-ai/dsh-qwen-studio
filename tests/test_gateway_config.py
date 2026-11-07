import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

class GatewayConfigTest(unittest.TestCase):
    def test_runtime_selection_after_reinstall(self):
        from unittest.mock import patch
        backend = Path(__file__).parents[1] / 'backend'
        with patch.object(sys, 'path', [str(backend), *sys.path]):
            import qwen_gateway as gateway
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            config = root / 'gateway-config.json'
            original = {'api_key': 'test-only-key-0123456789'}
            legacy = root / 'ComfyUI'
            legacy_python = root / ('venv/Scripts/python.exe' if os.name == 'nt' else 'venv/bin/python')
            custom = root / '新 runtime'
            python = custom / 'env' / legacy_python.name
            for f in (legacy / 'main.py', legacy_python, custom / 'main.py', python):
                f.parent.mkdir(parents=True, exist_ok=True)
                f.touch()
            with patch.object(gateway, 'ROOT', root), patch.object(gateway, 'CONFIG', config):
                config.write_text(json.dumps(original), encoding='utf-8')
                cwd, argv = gateway.Service().comfy_launch()
                self.assertEqual((cwd, argv[0]), (legacy, str(legacy_python)))
                self.assertNotIn('--use-sage-attention', argv)
                settings = dict(original, comfy_root=str(custom), python_executable=str(python),
                                use_sage_attention=True, conserve_memory=True)
                config.write_text(json.dumps(settings), encoding='utf-8')
                cwd, argv = gateway.Service().comfy_launch()
                self.assertEqual((cwd, argv[0]), (custom, str(python)))
                self.assertIn('--use-sage-attention', argv)
                self.assertIn('--cache-none', argv)
                self.assertEqual(argv[argv.index('--input-directory') + 1], str(legacy / 'input'))
                self.assertEqual(argv[argv.index('--output-directory') + 1], str(legacy / 'output'))
                for overrides in ({'comfy_root': str(custom)}, {'python_executable': str(python)},
                                  {'comfy_root': '', 'python_executable': str(python)},
                                  {'comfy_root': str(custom), 'python_executable': str(root / 'gone')},
                                  {'comfy_root': str(root / 'gone'), 'python_executable': str(python)}):
                    with self.subTest(overrides=overrides):
                        config.write_text(json.dumps({**original, **overrides}), encoding='utf-8')
                        with self.assertRaises(ValueError):
                            gateway.Service().comfy_launch()

    def test_powershell_bom_and_unicode_config_are_loaded_without_locale_dependence(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            (root/'gateway-config.json').write_text(json.dumps({'api_key':'test-only-key-0123456789','idle_seconds':6,'note':'中文'},ensure_ascii=False),encoding='utf-8-sig')
            backend=Path(__file__).parents[1]/'backend'
            old=os.environ.get('QWEN_REMOTE_ROOT')
            os.environ['QWEN_REMOTE_ROOT']=str(root)
            sys.path.insert(0,str(backend))
            try:
                spec=importlib.util.spec_from_file_location('config_test_gateway',backend/'qwen_gateway.py')
                module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
                service=module.Service()
                self.assertEqual(service.config['note'],'中文')
                self.assertIsNone(service.process)
                running='a'*32; complete='b'*32; damaged='c'*32
                for ident,status in [(running,'running'),(complete,'complete')]:
                    path=root/'jobs'/ident/'job.json';path.parent.mkdir(parents=True)
                    path.write_text(json.dumps({'id':ident,'status':status}),encoding='utf-8-sig')
                path=root/'jobs'/damaged/'job.json';path.parent.mkdir(parents=True);path.write_text('{broken',encoding='utf-8')
                with self.assertLogs(level='WARNING'):
                    recovered=module.Service()
                self.assertEqual(recovered.jobs[running]['status'],'failed')
                self.assertIn('restarted',recovered.jobs[running]['error'])
                self.assertEqual(recovered.jobs[complete]['status'],'complete')
                self.assertNotIn(damaged,recovered.jobs)
                self.assertEqual(path.read_text(encoding='utf-8'),'{broken')
            finally:
                sys.path.remove(str(backend))
                if old is None:os.environ.pop('QWEN_REMOTE_ROOT',None)
                else:os.environ['QWEN_REMOTE_ROOT']=old
