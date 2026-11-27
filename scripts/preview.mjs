// Serve the Pages artifact locally, including the custom 404 and directory redirects.
// Usage: node scripts/preview.mjs [--lan] [--port <n>]. Loopback only unless --lan is given.
import {createServer} from 'node:http';
import {networkInterfaces} from 'node:os';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../dist/client/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.xml':'application/xml','.rsc':'text/x-component','.pdf':'application/pdf'};
const server=createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
  const url=new URL(req.url,'http://127.0.0.1');const path=decodeURIComponent(url.pathname);let file=resolve(root,'.'+path);
  if(!file.startsWith(resolve(root)+sep)&&file!==resolve(root)){res.writeHead(403);return res.end();}
  try{if((await stat(file)).isDirectory()){if(!path.endsWith('/')){res.writeHead(301,{Location:url.pathname+'/'+url.search});return res.end();}file=resolve(file,'index.html');}const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data);}
  catch{const data=await readFile(resolve(root,'404.html'));res.writeHead(404,{'Content-Type':mime['.html']});res.end(req.method==='HEAD'?undefined:data);}
 }catch{res.writeHead(400);res.end();}
});
const argv=process.argv.slice(2);
const lan=argv.includes('--lan');
const portAt=argv.indexOf('--port');
const port=portAt>=0?Number(argv[portAt+1]):4173;
if(!Number.isInteger(port)||port<1||port>65535){console.error('--port needs an integer between 1 and 65535');process.exit(2);}
// First non-internal IPv4 address, announced when the preview is opened to the local network.
const lanAddress=()=>Object.values(networkInterfaces()).flat().find(i=>i&&(i.family==='IPv4'||i.family===4)&&!i.internal)?.address;
server.listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{
 const urls=[`http://127.0.0.1:${port}/fr/`];
 if(lan){const address=lanAddress();if(address)urls.push(`http://${address}:${port}/fr/`);else{console.warn('No local network IPv4 address found; listening on all interfaces.');urls.push(`http://0.0.0.0:${port}/fr/`);}}
 console.log('Static portfolio: '+urls.join(' · '));
});
