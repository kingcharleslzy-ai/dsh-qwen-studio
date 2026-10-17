"""Qwen Image 2.1 graphs built exclusively from native ComfyUI nodes plus a checked LoRA loader."""
import math
import os
import re

SCHEDULERS = ('linear', 'flow_match_euler_discrete', 'seedvr2_euler')
FEATURES = ('lora', 'controlnet', 'mask', 'img2img', 'negative_prompt', 'guidance', 'progress', 'cancel')

def normalize(data):
    allowed = {'id', 'model', 'prompt', 'width', 'height', 'steps', 'seed', 'source_sha', 'mask_sha', 'control_sha',
               'change_strength', 'controlnet_strength', 'loras', 'negative_prompt', 'guidance', 'scheduler'}
    if set(data) - allowed: raise ValueError('Unknown generation fields: '+', '.join(sorted(set(data)-allowed)))
    p = {**data}
    if not re.fullmatch('[a-f0-9]{32}', str(p.get('id', ''))): raise ValueError('Invalid job id')
    if p.get('model', 'qwen-image-2.1-int8') not in ('qwen-image-2.1-int8', 'qwen-image'): raise ValueError('Unknown model')
    if not isinstance(p.get('prompt'), str) or not p['prompt'].strip() or len(p['prompt']) > 16000: raise ValueError('Prompt required, maximum 16000 characters')
    for k, default, lo, hi in [('width',1024,512,2048),('height',1024,512,2048),('steps',40,1,60),('seed',0,0,2**32-1)]:
        p.setdefault(k, default)
        if type(p[k]) is not int or not lo <= p[k] <= hi: raise ValueError('Invalid '+k)
    if p['width'] % 16 or p['height'] % 16: raise ValueError('Dimensions must be multiples of 16')
    p.setdefault('negative_prompt','');p.setdefault('guidance',1.0);p.setdefault('scheduler','linear')
    if not isinstance(p['negative_prompt'],str) or len(p['negative_prompt'])>8000: raise ValueError('Invalid negative prompt')
    if p['scheduler'] not in SCHEDULERS: raise ValueError('Unsupported scheduler')
    def number(k, default, lo, hi):
        p.setdefault(k,default)
        if type(p[k]) not in (int,float) or not math.isfinite(p[k]) or not lo<=p[k]<=hi: raise ValueError('Invalid '+k)
    number('guidance',1.0,1,10)
    for k in ('source_sha','mask_sha','control_sha'):
        if k in p and not re.fullmatch('[a-f0-9]{64}',str(p[k])): raise ValueError('Invalid '+k)
    if p.get('mask_sha') and not p.get('source_sha'): raise ValueError('Mask requires source image')
    if 'change_strength' in p and (not p.get('source_sha') or p.get('mask_sha')): raise ValueError('change_strength requires an unmasked source')
    if p.get('control_sha') and p.get('source_sha') and not p.get('mask_sha'): raise ValueError('Control plus source requires mask')
    if 'controlnet_strength' in p and not p.get('control_sha'): raise ValueError('Control strength requires control image')
    if p.get('control_sha'): number('controlnet_strength',1.0,0,1)
    if p.get('source_sha') and not p.get('mask_sha'): number('change_strength',.45,.05,.95)
    if (p.get('control_sha') or p.get('mask_sha')) and p['scheduler']!='linear': raise ValueError('ControlNet and masks require linear scheduler')
    p.setdefault('loras',[])
    if not isinstance(p['loras'],list) or len(p['loras'])>8: raise ValueError('At most 8 LoRAs')
    for item in p['loras']:
        if not isinstance(item,dict) or set(item)!={'sha','scale'} or not re.fullmatch('[a-f0-9]{64}',str(item['sha'])): raise ValueError('Invalid LoRA reference')
        if type(item['scale']) not in (int,float) or not math.isfinite(item['scale']) or not 0<=item['scale']<=2: raise ValueError('Invalid LoRA strength')
    if p['negative_prompt'].strip() and p['guidance']<=1:
        p['guidance']=2.5;p['guidance_auto_raised']=True
    return p

def sigmas(p):
    n=p['steps']
    if n==1: values=[1.0,0.0]
    elif p['scheduler']=='seedvr2_euler': values=[1-i/n for i in range(n+1)]
    else:
        if p['scheduler']=='linear':
            raw=[1-i*(1-1/n)/(n-1) for i in range(n)]
            mu=(.9-.5)/(8192-256)*(p['width']*p['height']/256-256)+.5
        else:
            raw=[1-i*.999/(n-1) for i in range(n)];mu=1.0
        shifted=[math.exp(mu)/(math.exp(mu)+(1/t-1)) for t in raw]
        scale=(1-shifted[-1])/.98
        values=[1-(1-v)/scale for v in shifted]+[0.0]
    if p.get('source_sha') and not p.get('mask_sha'):
        values=values[-max(1,math.ceil(n*p['change_strength']))-1:]
    return values

def graph(p):
    g={
      '1':{'class_type':'UNETLoader','inputs':{'unet_name':'qwen_image_2.1_int8_convrot.safetensors','weight_dtype':'default'}},
      '2':{'class_type':'CLIPLoader','inputs':{'clip_name':'qwen3vl_8b_int8_convrot.safetensors','type':'qwen_image','device':'default'}},
      '3':{'class_type':'VAELoader','inputs':{'vae_name':'qwen_image_2.1_vae_bf16.safetensors'}},
      '4':{'class_type':'TextEncodeQwenImage21','inputs':{'clip':['2',0],'prompt':p['prompt'],'negative_prompt':p['negative_prompt'],'resolution':1024}},
      '5':{'class_type':'EmptyLatentImage','inputs':{'width':p['width'],'height':p['height'],'batch_size':1}},
    }
    model=['1',0]
    for i,lora in enumerate(p['loras']):
        key=str(100+i)
        g[key]={'class_type':'DSHQwenLoraLoader','inputs':{'model':model,'lora_name':os.path.join('dsh',lora['sha']+'.safetensors'),'strength_model':lora['scale']}}
        model=[key,0]
    if p.get('source_sha'):
        g['10']={'class_type':'LoadImage','inputs':{'image':os.path.join('dsh',p['source_sha']+'.png')}}
        g['11']={'class_type':'ImageScale','inputs':{'image':['10',0],'upscale_method':'lanczos','width':p['width'],'height':p['height'],'crop':'disabled'}}
    if p.get('control_sha'):
        g['12']={'class_type':'LoadImage','inputs':{'image':os.path.join('dsh',p['control_sha']+'.png')}}
    if p.get('mask_sha'):
        g['13']={'class_type':'LoadImageMask','inputs':{'image':os.path.join('dsh',p['mask_sha']+'.png'),'channel':'red'}}
    if p.get('control_sha') or p.get('mask_sha'):
        g['14']={'class_type':'ModelPatchLoader','inputs':{'name':'qwen_image_2.1_fun_controlnet_union_int8_convrot.safetensors'}}
        inputs={'model':model,'model_patch':['14',0],'vae':['3',0],'strength':p.get('controlnet_strength',1.0)}
        if p.get('control_sha'):inputs['image']=['12',0]
        if p.get('mask_sha'):inputs.update(inpaint_image=['11',0],mask=['13',0])
        g['15']={'class_type':'ZImageFunControlnet','inputs':inputs};model=['15',0]
    g['6']={'class_type':'QwenImage21Cache','inputs':{'model':model,'device':'auto','dtype':'default'}}
    latent=['5',0]
    if p.get('source_sha') and not p.get('mask_sha'):
        g['16']={'class_type':'VAEEncode','inputs':{'pixels':['11',0],'vae':['3',0]}};latent=['16',0]
    cfg=p['guidance'] if (p['negative_prompt'].strip() or p.get('control_sha') or p.get('mask_sha')) else 1.0
    g['20']={'class_type':'CFGGuider','inputs':{'model':['6',0],'positive':['4',0],'negative':['4',1],'cfg':cfg}}
    g['21']={'class_type':'RandomNoise','inputs':{'noise_seed':p['seed']}}
    g['22']={'class_type':'KSamplerSelect','inputs':{'sampler_name':'euler'}}
    g['23']={'class_type':'ManualSigmas','inputs':{'sigmas':', '.join(format(v,'.10g') for v in sigmas(p))}}
    g['7']={'class_type':'SamplerCustomAdvanced','inputs':{'noise':['21',0],'guider':['20',0],'sampler':['22',0],'sigmas':['23',0],'latent_image':latent}}
    g['8']={'class_type':'VAEDecode','inputs':{'samples':['7',0],'vae':['3',0]}}
    g['9']={'class_type':'SaveImage','inputs':{'images':['8',0],'filename_prefix':'dsh/'+p['id']}}
    return g
