import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

class GatewayConfigTest(unittest.TestCase):
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
