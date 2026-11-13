import {imageType,limit} from './references.js';
import { createReadStream } from 'node:fs';
import {listClips,setMark,poster,compatibleVideo,importVideo} from './library.js';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

export function registerStudio(ctx, { videos, uuid, submitVideo, collect, release }) {
  for (const route of ['gallery','mark','poster','video','preview','import','generate','status','release','reference']) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact', path: '/api/h3-video/' + route,
      async handler(req, res) {
        const json = (code, value) => {
          res.writeHead(code, {'content-type':'application/json', 'cache-control':'no-store'});
          res.end(JSON.stringify(value));
        };
        try {
          if (route === 'gallery' && req.method === 'GET') {
            return json(200,await listClips(videos,uuid));
          }
          if ((route === 'video' || route === 'poster' || route === 'preview') && ['GET','HEAD'].includes(req.method)) {
            const id = new URL(req.url,'http://localhost').searchParams.get('id');
            if (!uuid.test(id || '')) return json(400,{error:'任务 ID 无效'});
            if (route === 'poster') {
              const data=await poster(videos,id);
              res.writeHead(200,{'content-type':'image/jpeg','content-length':data.length,'cache-control':'private, max-age=3600'});
              res.end(req.method==='HEAD'?undefined:data);
              return;
            }
            const path = route==='preview'?await compatibleVideo(videos,id):join(videos,id+'.mp4');
            const {size} = await stat(path);
            const range = req.headers.range;
            let start = 0, end = size-1;
            if (range) {
              const match = /^bytes=(\d*)-(\d*)$/.exec(range);
              if (match && (match[1] || match[2])) {
                if (match[1]) {start=Number(match[1]);end=match[2]?Math.min(end,Number(match[2])):end;}
                else start=Math.max(0,size-Number(match[2]));
              } else start=size;
              if (!Number.isSafeInteger(start) || start>=size || end<start) {
                res.writeHead(416,{'content-range':'bytes */'+size});res.end();return;
              }
            }
            res.writeHead(range ? 206 : 200, {'content-type':route==='preview'?'video/webm':'video/mp4','accept-ranges':'bytes',
              'content-length':end-start+1,...(range ? {'content-range':`bytes ${start}-${end}/${size}`} : {})});
            if(req.method==='HEAD' || !size){res.end();return;}
            await pipeline(createReadStream(path,{start,end}),res);
            return;
          }
          if(route==='import' && req.method==='POST'){
            if(req.headers['sec-fetch-site']==='cross-site')return json(403,{error:'来源无效'});
            if(req.headers['content-type']!=='video/mp4')return json(415,{error:'需要 MP4 文件'});
            return json(200,await importVideo(videos,req));
          }
          if(route === 'reference' && req.method === 'POST') {
            if(req.headers['sec-fetch-site']==='cross-site') return json(403,{error:'来源无效'});
            if(!['image/jpeg','image/png','image/webp'].includes(req.headers['content-type'])) return json(415,{error:'需要 JPEG、PNG 或 WebP'});
            const chunks = []; let size = 0;
            for await (const chunk of req) { size += chunk.length; if(size>limit) return json(413,{error:'图片超过 16 MiB'}); chunks.push(chunk); }
            const data = Buffer.concat(chunks);
            const mediaType = 'image/'+imageType(data);
            const attachment = await ctx.attachments.saveImage({data,mediaType,name:'reference.'+mediaType.slice(6)});
            return json(200,{id:attachment.attachmentId});
          }
          if(req.method !== 'POST' || !['generate','status','release','mark'].includes(route)) return json(405,{error:'请求方法无效'});
          if(req.headers['content-type']?.split(';')[0] !== 'application/json') return json(415,{error:'需要 JSON 请求'});
          if(req.headers['sec-fetch-site']==='cross-site') return json(403,{error:'来源无效'});
          const chunks = []; let count = 0;
          for await (const chunk of req) { count += chunk.length; if(count>65536) return json(413,{error:'描述过长'}); chunks.push(chunk); }
          const data=JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          if(route === 'mark'){await setMark(videos,uuid,data);return json(200,{ok:true});}
          if(route === 'release') return json(200,await release());
          if(!uuid.test(data.id || '')) return json(400,{error:'任务 ID 无效'});
          if(route === 'status') return json(200,await collect(data.id,undefined,0));
          const job=await submitVideo(data,data.id);
          return json(202,{id:job.id,status:job.status || 'queued',frames:job.frames,actual_seconds:job.actual_seconds});
        } catch(e) {
          if(!res.headersSent && !res.destroyed) json(e.code==='ENOENT' ? 404 : 400,{error:e.message});
        }
      },
    }), 'H3 studio ' + route);
  }
}
