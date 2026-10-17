import importlib.util, math, pathlib, unittest
p=pathlib.Path(__file__).parents[1]/'backend/qwen_workflow.py'
spec=importlib.util.spec_from_file_location('qwen_workflow',p);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class RemoteWorkflowTest(unittest.TestCase):
    def base(self,**kw):return module.normalize(dict(id='a'*32,prompt='a blue teapot',width=512,height=512,steps=20,seed=42)|kw)
    def test_shared_presets_have_real_scheduler_tables(self):
        tables=[]
        for name in module.SCHEDULERS:
            table=module.sigmas(self.base(scheduler=name));tables.append(table)
            self.assertEqual(len(table),21);self.assertAlmostEqual(table[0],1);self.assertEqual(table[-1],0)
            self.assertTrue(all(math.isfinite(x) for x in table));self.assertTrue(all(a>=b for a,b in zip(table,table[1:])))
        self.assertNotEqual(tables[0],tables[1]);self.assertNotEqual(tables[1],tables[2])
    def test_mask_and_lora_are_both_connected_to_the_sampler(self):
        p=self.base(source_sha='b'*64,mask_sha='c'*64,control_sha='d'*64,loras=[dict(sha='e'*64,scale=.7)],negative_prompt='blur')
        g=module.graph(p)
        self.assertEqual(g['100']['class_type'],'DSHQwenLoraLoader');self.assertEqual(g['15']['inputs']['model'],['100',0])
        self.assertEqual(g['15']['inputs']['inpaint_image'],['11',0]);self.assertEqual(g['15']['inputs']['mask'],['13',0])
        self.assertEqual(g['6']['inputs']['model'],['15',0]);self.assertEqual(g['20']['inputs']['cfg'],2.5)
    def test_invalid_combinations_fail_instead_of_silently_downgrading(self):
        for args in [dict(mask_sha='b'*64),dict(control_sha='b'*64,source_sha='c'*64),dict(source_sha='../private'),dict(control_sha='b'*64,scheduler='seedvr2_euler'),dict(loras=[dict(sha='b'*64,scale=float('nan'))])]:
            with self.subTest(args=args),self.assertRaises(ValueError):self.base(**args)
    def test_reference_strength_changes_actual_step_count(self):
        weak=module.sigmas(self.base(source_sha='b'*64,change_strength=.1));strong=module.sigmas(self.base(source_sha='b'*64,change_strength=.9))
        self.assertEqual(len(weak)-1,2);self.assertEqual(len(strong)-1,18)
    def test_native_edit_conditions_on_image_and_text_with_full_schedule(self):
        p=self.base(source_sha='b'*64,reference_mode='edit')
        g=module.graph(p)
        self.assertEqual(g['4']['inputs']['images.image_1'],['11',0])
        self.assertEqual(g['4']['inputs']['vae'],['3',0])
        self.assertEqual(g['7']['inputs']['latent_image'],['4',2])
        self.assertEqual(len(module.sigmas(p))-1,p['steps'])
        self.assertNotIn('16',g)
        legacy=self.base(source_sha='b'*64,change_strength=.45)
        self.assertEqual(module.graph(legacy)['7']['inputs']['latent_image'],['16',0])
        self.assertEqual(len(module.sigmas(legacy))-1,9)
    def test_native_edit_rejects_incompatible_legacy_knobs(self):
        for args in [dict(reference_mode='edit'),dict(reference_mode='unknown'),dict(source_sha='b'*64,reference_mode='edit',change_strength=.45),dict(source_sha='b'*64,reference_mode='edit',mask_sha='c'*64),dict(source_sha='b'*64,reference_mode='edit',width=528)]:
            with self.subTest(args=args),self.assertRaises(ValueError): self.base(**args)
    def test_cfg_without_negative_does_not_become_quality_knob(self):
        g=module.graph(self.base(guidance=5));self.assertEqual(g['20']['inputs']['cfg'],1)
if __name__=='__main__':unittest.main()
