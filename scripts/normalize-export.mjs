// Vinext beta.5 exports flat .html files; Pages needs a file at each directory URL.
import {mkdir,copyFile,access,writeFile} from 'node:fs/promises';
const root=new URL('../dist/client/',import.meta.url);
const origin='https://wesper-dev.github.io';
const paths=['','projects/','hackathons/','skills/','projects/droit-de-retard/','projects/diary/','projects/croix-rouge/'];
const routes=paths.flatMap(p=>['/'+p,'/fr/'+p]);
for(const route of routes){
 const relative=route.slice(1);
 const source=new URL(relative?relative.slice(0,-1)+'.html':'index.html',root);
 await access(source);
 if(relative){await mkdir(new URL(relative,root),{recursive:true});await copyFile(source,new URL(relative+'index.html',root));}
}
await copyFile(new URL('missing.html',root),new URL('404.html',root));
await writeFile(new URL('.nojekyll',root),'');
await writeFile(new URL('robots.txt',root),process.env.SITE_PUBLIC==='1'?`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n');
const entries=routes.map(route=>{const path=route.startsWith('/fr/')?route.slice(4):route.slice(1);return `<url><loc>${origin}${route}</loc><xhtml:link rel="alternate" hreflang="en" href="${origin}/${path}"/><xhtml:link rel="alternate" hreflang="fr" href="${origin}/fr/${path}"/><xhtml:link rel="alternate" hreflang="x-default" href="${origin}/${path}"/></url>`;});
await writeFile(new URL('sitemap.xml',root),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'+entries.join('\n')+'\n</urlset>\n');
console.log(`Static export: ${routes.length} directory routes, bilingual 404, robots and sitemap (${process.env.SITE_PUBLIC==='1'?'public':'preview'}).`);
