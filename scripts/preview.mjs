// Serve the Pages artifact locally, including the custom 404 and directory redirects.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../dist/client/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.xml':'application/xml','.rsc':'text/x-component'};
const server=createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
  const url=new URL(req.url,'http://127.0.0.1');const path=decodeURIComponent(url.pathname);let file=resolve(root,'.'+path);
  if(!file.startsWith(resolve(root)+sep)&&file!==resolve(root)){res.writeHead(403);return res.end();}
  try{if((await stat(file)).isDirectory()){if(!path.endsWith('/')){res.writeHead(301,{Location:url.pathname+'/'+url.search});return res.end();}file=resolve(file,'index.html');}const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data);}
  catch{const data=await readFile(resolve(root,'404.html'));res.writeHead(404,{'Content-Type':mime['.html']});res.end(req.method==='HEAD'?undefined:data);}
 }catch{res.writeHead(400);res.end();}
});
server.listen(4173,'127.0.0.1',()=>console.log('Static portfolio: http://127.0.0.1:4173/fr/'));
