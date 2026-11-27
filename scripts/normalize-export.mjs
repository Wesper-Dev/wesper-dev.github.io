// Vinext beta.5 exports flat .html files; Pages needs a file at each directory URL.
// Usage: node scripts/normalize-export.mjs [--dist <dir>]. Routes come from content/routes.json only.
// Everything is validated before the first write: an invalid manifest or a missing page leaves --dist untouched.
import {mkdir,copyFile,access,writeFile,readFile,rm,stat,constants} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

function fail(lines){for(const line of [].concat(lines))console.error(line);process.exit(1);}

// Canonical origin: scheme and lowercase host only (no port, path, trailing slash, user or IPv6 literal).
// check-export.py applies the same expression (ORIGIN_RE).
const ORIGIN_RE=/^https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*$/;

// Same rules as manifest_errors() in check-export.py.
function validateManifest(data){
 if(typeof data!=='object'||data===null||Array.isArray(data))return ['content/routes.json must be a JSON object with origin and paths'];
 const found=[];
 const extra=Object.keys(data).filter(k=>k!=='origin'&&k!=='paths').sort();
 if(extra.length)found.push('content/routes.json has unknown keys: '+extra.join(', '));
 const {origin,paths}=data;
 if(typeof origin!=='string'||!origin)found.push('content/routes.json: origin is missing or not a non-empty string');
 else if(!ORIGIN_RE.test(origin))found.push('content/routes.json: origin must be a scheme and a lowercase host, without port, path or trailing slash, got '+JSON.stringify(origin));
 if(!Array.isArray(paths)){found.push('content/routes.json: paths must be an array of strings');return found;}
 const seen=new Set();
 paths.forEach((p,i)=>{
  const label=`content/routes.json: paths[${i}] ${JSON.stringify(p)}`;
  if(typeof p!=='string'){found.push(label+' is not a string');return;}
  if(seen.has(p))found.push(label+' is listed twice');
  seen.add(p);
  if(p==='')return;
  if(!p.endsWith('/'))found.push(label+' must end with a slash');
  if(p.startsWith('/'))found.push(label+' must not start with a slash');
  const segments=p.replace(/\/$/,'').split('/');
  if(segments.some(s=>s===''||s==='.'||s==='..'))found.push(label+' has an empty or dot segment');
  if(segments[0]==='fr')found.push(label+' must not start with fr/ (French routes are derived)');
  if(!/^[a-z0-9/-]+$/.test(p))found.push(label+' may only contain lowercase letters, digits, hyphens and slashes');
 });
 if(!seen.has(''))found.push('content/routes.json: paths must contain the home page ""');
 return found;
}

const argv=process.argv.slice(2);
const distAt=argv.indexOf('--dist');
if(distAt>=0&&!argv[distAt+1])fail('--dist needs a directory');
const root=distAt>=0?pathToFileURL(resolve(argv[distAt+1])+'/'):new URL('../dist/client/',import.meta.url);

let manifest;
try{manifest=JSON.parse(await readFile(new URL('../content/routes.json',import.meta.url),'utf8'));}
catch(error){fail('content/routes.json is unreadable or not valid JSON: '+(error instanceof Error?error.message:String(error)));}
const invalid=validateManifest(manifest);
if(invalid.length)fail(invalid);
const {origin,paths}=manifest;
const routes=paths.flatMap(p=>['/'+p,'/fr/'+p]);

try{if(!(await stat(root)).isDirectory())fail('export directory is not a directory (--dist): '+root.pathname);}
catch{fail('export directory not found (--dist): '+root.pathname);}

// Every source must be a readable regular file before anything is written.
const flatOf=route=>{const relative=route.slice(1);return relative?relative.slice(0,-1)+'.html':'index.html';};
const problems=[];
for(const name of [...routes.map(flatOf),'missing.html']){
 const source=new URL(name,root);
 try{
  if(!(await stat(source)).isFile()){problems.push(name+' is not a regular file');continue;}
  await access(source,constants.R_OK);
 }catch(error){problems.push(name+(error?.code==='ENOENT'?' is missing':' is unreadable ('+(error?.code??'error')+')'));}
}
if(problems.length)fail(['Static export incomplete, flat page sources:',...problems.map(p=>' - '+p)]);

for(const route of routes){
 const relative=route.slice(1);
 if(!relative)continue;
 await mkdir(new URL(relative,root),{recursive:true});
 await copyFile(new URL(flatOf(route),root),new URL(relative+'index.html',root));
}
await copyFile(new URL('missing.html',root),new URL('404.html',root));
await writeFile(new URL('.nojekyll',root),'');
// The public export ships no build manifest: .vite/manifest.json names the source files of the site (audit Fable F11).
// The preview keeps it for inspection.
if(process.env.SITE_PUBLIC==='1')await rm(new URL('.vite/',root),{recursive:true,force:true});
await writeFile(new URL('robots.txt',root),process.env.SITE_PUBLIC==='1'?`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n');
const entries=routes.map(route=>{const path=route.startsWith('/fr/')?route.slice(4):route.slice(1);return `<url><loc>${origin}${route}</loc><xhtml:link rel="alternate" hreflang="en" href="${origin}/${path}"/><xhtml:link rel="alternate" hreflang="fr" href="${origin}/fr/${path}"/><xhtml:link rel="alternate" hreflang="x-default" href="${origin}/${path}"/></url>`;});
await writeFile(new URL('sitemap.xml',root),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'+entries.join('\n')+'\n</urlset>\n');
console.log(`Static export: ${routes.length} directory routes, bilingual 404, robots and sitemap (${process.env.SITE_PUBLIC==='1'?'public':'preview'}).`);
