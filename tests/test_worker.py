import importlib.util, json, tempfile, threading, time, unittest
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
    def test_reference_cannot_escape_gallery(self):
        source=self.root/'images'/('c'*32);source.mkdir(parents=True)
        outside=self.root/'private.png';outside.write_bytes(b'\x89PNG\r\n\x1a\nsecret')
        (source/'image.png').symlink_to(outside)
        w.atomic_json(source/'job.json',dict(id='c'*32,status='complete'))
        with self.assertRaises(ValueError):self.q.submit({**self.payload(),'source_image_id':'c'*32})
if __name__=='__main__':unittest.main()
