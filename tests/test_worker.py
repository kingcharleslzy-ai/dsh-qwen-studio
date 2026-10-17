import importlib.util, json, tempfile, threading, time, unittest, types, sys
from unittest.mock import patch
from pathlib import Path
spec=importlib.util.spec_from_file_location('worker',Path(__file__).parents[1]/'backend/server.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
class Tests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.root=Path(self.temp.name)
        self.release=threading.Event();self.started=threading.Event();self.calls=[]
        def runner(job,output,progress,cancel):
            self.calls.append(job['id']);self.started.set();progress('running',1)
            self.release.wait(2)
            progress('saving',job['steps']);output.write_bytes(b'PNG')
            return {}
        self.q=w.JobQueue(self.root,runner)
    def tearDown(self):self.release.set();self.q.pool.shutdown();self.temp.cleanup()
    def payload(self,id='a'*32):return dict(id=id,prompt='teapot',width=512,height=512,steps=12,seed=None)
    def finished(self):
        for _ in range(300):
            if not self.q.pending:return
            time.sleep(.01)
        self.fail('queue stuck')
    def test_receipt_is_durable_and_idempotent(self):
        job=self.q.submit(self.payload()); self.started.wait(1)
        again=self.q.submit(self.payload()); self.assertEqual(job['seed'],again['seed'])
        persisted=json.loads((self.root/'images'/job['id']/'job.json').read_text());self.assertEqual(persisted['id'],job['id'])
        self.release.set();self.finished();self.assertEqual(len(self.calls),1)
        self.assertEqual(self.q.jobs[job['id']]['status'],'complete')
    def test_disconnect_does_not_own_job_and_reopen_restores(self):
        job=self.q.submit(self.payload());self.release.set();self.finished()
        reopened=w.JobQueue(self.root,lambda *a:None)
        self.assertEqual(reopened.jobs[job['id']]['status'],'complete');self.assertTrue((self.root/'images'/job['id']/'image.png').exists());reopened.pool.shutdown()
    def test_cancel_only_target_job(self):
        one=self.q.submit(self.payload());self.started.wait(1)
        two=self.q.submit(self.payload('b'*32));self.q.cancel(two['id']);self.release.set();self.finished()
        self.assertEqual(self.q.jobs[one['id']]['status'],'complete');self.assertEqual(self.q.jobs[two['id']]['status'],'cancelled')
    def test_running_cancel(self):
        job=self.q.submit(self.payload());self.started.wait(1);self.q.cancel(job['id']);self.release.set();self.finished()
        self.assertEqual(self.q.jobs[job['id']]['status'],'cancelled')
    def test_busy_cannot_unload_and_capacity(self):
        self.q.submit(self.payload());self.started.wait(1)
        for c in 'bcd':self.q.submit(self.payload(c*32))
        with self.assertRaises(RuntimeError):self.q.submit(self.payload('e'*32))
        self.assertFalse(self.q.stop_if_idle());self.release.set();self.finished();self.assertTrue(self.q.stop_if_idle())
    def test_interrupted_record_becomes_failed(self):
        path=self.root/'images'/('c'*32)/'job.json';w.atomic_json(path,dict(id='c'*32,status='running'))
        other=w.JobQueue(self.root,lambda *a:None);self.assertEqual(other.jobs['c'*32]['status'],'failed');other.pool.shutdown()
    def test_same_id_different_request_rejected(self):
        self.q.submit(self.payload());data=self.payload();data['prompt']='different'
        with self.assertRaises(ValueError):self.q.submit(data)
    def test_invalid_input(self):
        for changes in [dict(width=1),dict(width=513),dict(seed=-1),dict(steps=0),dict(prompt=''),dict(id='../escape'),dict(source_image_id='../escape'),dict(change_strength=.5),dict(source_image_id='c'*32,change_strength=float('nan')),dict(source_image_id='c'*32,change_strength=1)]:
            with self.assertRaises(ValueError):self.q.submit({**self.payload(),**changes})
    def test_optional_sampling_parameters_are_validated_and_recorded(self):
        default=w.validate(self.payload())
        self.assertEqual((default['negative_prompt'], default['guidance'], default['scheduler']), (None, 1.0, 'linear'))
        params=w.validate({**self.payload(), 'negative_prompt':' blur '})
        self.assertEqual(params['negative_prompt'], 'blur')
        self.assertEqual(params['guidance'], 2.5)
        self.assertTrue(params['guidance_auto_raised'])
        explicit=w.validate({**self.payload(), 'negative_prompt':'blur', 'guidance':3, 'scheduler':'flow_match_euler_discrete'})
        self.assertEqual(explicit['guidance'],3)
        self.assertNotIn('guidance_auto_raised',explicit)
        for changes in [dict(negative_prompt=[]),dict(negative_prompt='x'*8001),dict(guidance=True),dict(guidance=float('nan')),dict(guidance=11),dict(scheduler='unknown')]:
            with self.assertRaises(ValueError):w.validate({**self.payload(),**changes})

    def test_reference_input_is_owned_before_admission(self):
        source=self.root/'images'/('c'*32);source.mkdir(parents=True)
        pixels=b'\x89PNG\r\n\x1a\nfixture'
        (source/'image.png').write_bytes(pixels)
        w.atomic_json(source/'job.json',dict(id='c'*32,status='complete'))
        request={**self.payload(), 'source_image_id':'c'*32,'change_strength':.25}
        job=self.q.submit(request)
        self.assertEqual(job['sampling_steps'],3)
        (source/'image.png').unlink()
        self.assertEqual((self.root/'images'/job['id']/'reference.png').read_bytes(),pixels)
        self.assertEqual(self.q.submit(request)['id'],job['id'])
        with self.assertRaises(ValueError): self.q.submit({**request,'change_strength':.5})

    def test_native_edit_keeps_full_schedule_and_uses_image_text_api(self):
        source=self.root/'assets/images'/('c'*32);source.mkdir(parents=True)
        (source/'image.png').write_bytes(b'\x89PNG\r\n\x1a\nfixture')
        w.atomic_json(source/'asset.json',dict(id='c'*32,kind='source'))
        params={**self.payload(), 'source_image_id':'c'*32, 'reference_mode':'edit'}
        job=self.q.submit(params)
        self.assertEqual(job['sampling_steps'],12)
        self.assertNotIn('change_strength',job)
        args=w.generation_args(job,self.root)
        self.assertEqual(args['image_paths'],[str(self.root/'reference.png')])
        self.assertEqual(args['strength'],1.0)
        self.assertTrue(args['use_kv_cache']);self.assertFalse(args['use_step_cache'])
        self.assertNotIn('image_path',args);self.assertNotIn('image_strength',args)
        self.assertNotEqual(w.engine_key(job),w.engine_key(self.payload()))
        self.assertEqual(self.q.submit(params)['id'],job['id'])
        for changes in [dict(reference_mode='unknown'),dict(source_image_id=None),dict(change_strength=.45),dict(mask_image_id='b'*32),dict(controlnet_image_id='b'*32),dict(scheduler='seedvr2_euler'),dict(width=528)]:
            with self.assertRaises(ValueError):w.validate({**params,**changes})

    def test_native_edit_cfg_and_engine_are_separate_from_variations(self):
        params=w.validate({**self.payload(), 'source_image_id':'c'*32,'reference_mode':'edit','guidance':2})
        self.assertEqual(w.generation_args(params,self.root)['negative_prompt'],'')
        fake=types.ModuleType('mflux.models.qwen21.variants.edit.qwen_image_21_edit')
        calls=[]
        fake.QwenImage21Edit=lambda **kwargs: calls.append(kwargs) or 'edit-engine'
        config=types.ModuleType('mflux.models.common.resolution.config_resolution');config.ConfigResolution=object()
        with patch.dict(sys.modules,{fake.__name__:fake,config.__name__:config}):
            self.assertEqual(w.load_engine(params),'edit-engine')
        self.assertEqual(len(calls),1)
        self.assertIn('model_path',calls[0])

    def test_native_edit_probe_checks_vision_weights_without_constructing_model(self):
        import struct
        fake=types.ModuleType('mflux.models.qwen21.variants.edit.qwen_image_21_edit')
        class Edit:
            def __init__(self,*a,**kw):raise AssertionError('probe constructed a model')
            def generate_image(self,image_paths=None,strength=1,use_kv_cache=True,use_step_cache=False):pass
        fake.QwenImage21Edit=Edit
        for component in ('text_encoder','transformer','vae','processor'):
            (self.root/component).mkdir();(self.root/component/'config.json').write_text('{}')
        with patch.dict(sys.modules,{fake.__name__:fake}),patch('importlib.metadata.version',return_value='0.22.0'):
            self.assertFalse(w.reference_edit_support(self.root)['supported'])
            header=json.dumps({'model.visual.patch_embed.proj.weight':{}}).encode()
            (self.root/'text_encoder/model.safetensors').write_bytes(struct.pack('<Q',len(header))+header)
            self.assertTrue(w.reference_edit_support(self.root)['supported'])
    def test_reference_cannot_escape_gallery(self):
        source=self.root/'images'/('c'*32);source.mkdir(parents=True)
        outside=self.root/'private.png';outside.write_bytes(b'\x89PNG\r\n\x1a\nsecret')
        (source/'image.png').symlink_to(outside)
        w.atomic_json(source/'job.json',dict(id='c'*32,status='complete'))
        with self.assertRaises(ValueError):self.q.submit({**self.payload(),'source_image_id':'c'*32})
    def test_advanced_parameters_are_not_silently_dropped(self):
        changes = dict(lora_paths=['/models/style.safetensors'], lora_scales=[.7], controlnet_image_id='c'*32, controlnet_strength=.8)
        params = w.validate({**self.payload(), **changes})
        for key, value in changes.items(): self.assertEqual(params[key], value)
        mask = w.validate({**self.payload(), 'source_image_id':'b'*32, 'mask_image_id':'c'*32})
        self.assertNotIn('change_strength',mask)
        args = w.generation_args(mask, self.root)
        self.assertEqual(args['mask_image'],str(self.root/'mask.png'))
        self.assertNotIn('scheduler',args);self.assertNotIn('image_strength',args)
        for changes in [dict(lora_paths=[]),dict(lora_paths=['relative.safetensors']),dict(lora_paths=['/model.pt']),dict(lora_paths=['/a.safetensors'],lora_scales=[float('nan')]),dict(lora_scales=[1]),dict(controlnet_strength=.8),dict(controlnet_image_id='c'*32,controlnet_strength=True),dict(mask_image_id='c'*32),dict(source_image_id='c'*32,controlnet_image_id='b'*32),dict(controlnet_image_id='c'*32,scheduler='seedvr2_euler'),dict(source_image_id='b'*32,mask_image_id='c'*32,change_strength=.5)]:
            with self.assertRaises(ValueError): w.validate({**self.payload(), **changes})

    def test_control_and_mask_inputs_are_snapshotted_before_receipt(self):
        for c in 'bcd':
            source=self.root/'images'/(c*32);source.mkdir(parents=True)
            (source/'image.png').write_bytes(b'\x89PNG\r\n\x1a\n'+c.encode())
            w.atomic_json(source/'job.json',dict(id=c*32,status='complete'))
        params={**self.payload(), 'source_image_id':'b'*32, 'mask_image_id':'c'*32, 'controlnet_image_id':'d'*32}
        job=self.q.submit(params)
        for c,name in [('b','reference'),('c','mask'),('d','control')]:
            (self.root/'images'/(c*32)/'image.png').unlink()
            self.assertEqual((self.root/'images'/job['id']/(name+'.png')).read_bytes(),b'\x89PNG\r\n\x1a\n'+c.encode())
        self.assertEqual(job['sampling_steps'],job['steps'])

    def test_lora_directory_and_cache_identity(self):
        lora=self.root/'loras'/'style.safetensors';lora.parent.mkdir();lora.write_bytes(b'fixture')
        params={**self.payload(),'lora_paths':[str(lora)],'lora_scales':[.8]}
        job=self.q.submit(params)
        self.assertEqual(job['lora_scales'],[.8])
        base=w.engine_key(self.payload());adapted=w.engine_key(job)
        self.assertNotEqual(base,adapted)
        lora.write_bytes(b'changed')
        self.assertNotEqual(adapted,w.engine_key(job))
        outside=self.root/'outside.safetensors';outside.write_bytes(b'fixture')
        with self.assertRaises(ValueError):self.q.submit({**self.payload('f'*32),'lora_paths':[str(outside)]})
        link=lora.parent/'escaped.safetensors';link.symlink_to(outside)
        with self.assertRaises(ValueError):self.q.submit({**self.payload('f'*32),'lora_paths':[str(link)]})

    def test_mask_black_pixels_are_source_and_white_are_generated(self):
        from PIL import Image
        Image.new('RGB',(4,4),(10,20,30)).save(self.root/'reference.png')
        mask=Image.new('L',(4,4),0);mask.putpixel((1,1),255);mask.save(self.root/'mask.png')
        result=self.root/'generated.png';Image.new('RGB',(4,4),(200,100,50)).save(result)
        w.preserve_unmasked(result,self.root)
        with Image.open(result) as image:
            for y in range(4):
                for x in range(4):self.assertEqual(image.getpixel((x,y)),(200,100,50) if (x,y)==(1,1) else (10,20,30))

    def test_engine_switch_reloads_instead_of_leaking_baked_lora(self):
        loads=[]
        class Callbacks:
            def __init__(self):self.in_loop=[]
            def register(self,callback):self.in_loop.append(callback)
        class Generated:
            def save(self,path,**kwargs):Path(path).write_bytes(b'PNG')
        class Engine:
            def __init__(self):self.callbacks=Callbacks()
            def generate_image(self,**kwargs):return Generated()
        def loader(job):loads.append(w.engine_key(job));return Engine()
        mx=types.ModuleType('mlx.core');mx.clear_cache=lambda:None;mx.get_peak_memory=lambda:0
        old_engine,old_key,old_queue=w.QWEN,w.ENGINE_KEY,w.QUEUE
        lora=self.root/'style.safetensors';lora.write_bytes(b'fixture')
        base=w.validate(self.payload());base['seed']=1
        adapted={**base,'lora_paths':[str(lora)],'lora_scales':[.8]}
        try:
            w.QWEN=None;w.ENGINE_KEY=None;w.QUEUE=None
            with patch.dict(sys.modules,{'mlx':types.ModuleType('mlx'),'mlx.core':mx}),patch.object(w,'load_engine',loader):
                for job in [base,base,adapted,adapted,base]:
                    w.generate(job,self.root/'out.png',lambda *args:None,threading.Event())
            self.assertEqual(len(loads),3)
            self.assertEqual(loads[0],loads[2]);self.assertNotEqual(loads[0],loads[1])
        finally:w.QWEN,w.ENGINE_KEY,w.QUEUE=old_engine,old_key,old_queue

if __name__=='__main__':unittest.main()
