import {mkdirSync,writeFileSync} from 'node:fs';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { SKILL_LAYOUT } from './content/tree-layout.ts';
import { LIT, SKILL_TEXT } from './content/tree-public.ts';
// Public data of the tree, resolved at build time (audit astra H11): the bundles, Worker included, receive the
// evaluated value of content/tree-layout.ts and content/tree-public.ts, never content/tree.ts with its question ids,
// link conditions and discarded variants. The values are those of the sources when the build starts.
const treePublic=():Plugin=>({name:'tree-public',enforce:'pre',load(id){const file=id.split('?')[0].replace(/\\/g,'/');if(file.endsWith('/content/tree-layout.ts'))return `export const SKILL_LAYOUT=${JSON.stringify(SKILL_LAYOUT)};\n`;if(file.endsWith('/content/tree-public.ts'))return `export const SKILL_TEXT=${JSON.stringify(SKILL_TEXT)};\nexport const LIT=${JSON.stringify(LIT)};\n`;return null;}});
// Compile-time flags of the tree scene (contract D1.3): workshop and diagnostic exist only in the preview build.
const treeFlags={__TREE_ATELIER__:JSON.stringify(process.env.SITE_PUBLIC!=='1'),__TREE_DIAG__:JSON.stringify(process.env.SITE_PUBLIC!=='1')};
export default defineConfig({define:treeFlags,plugins:[treePublic(),vinext(),{name:'portfolio-client-audit',generateBundle(_options,bundle){if(process.env.PORTFOLIO_AUDIT==='1'&&this.environment.name==='client'){mkdirSync('work',{recursive:true});writeFileSync('work/client-modules.json',JSON.stringify(Object.values(bundle).filter(c=>c.type==='chunk').map(c=>({file:c.fileName,modules:Object.keys(c.modules).map(id=>id.replace(process.cwd()+'/', ''))})),null,2));}}}],worker:{plugins:()=>[treePublic()]},css:{postcss:{plugins:[tailwindcss()]}},server:{watch:{useFsEvents:false,usePolling:true}}});
