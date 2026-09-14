import {mkdirSync,writeFileSync} from 'node:fs';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
export default defineConfig({plugins:[vinext(),{name:'portfolio-client-audit',generateBundle(_options,bundle){if(process.env.PORTFOLIO_AUDIT==='1'&&this.environment.name==='client'){mkdirSync('work',{recursive:true});writeFileSync('work/client-modules.json',JSON.stringify(Object.values(bundle).filter(c=>c.type==='chunk').map(c=>({file:c.fileName,modules:Object.keys(c.modules).map(id=>id.replace(process.cwd()+'/', ''))})),null,2));}}}],css:{postcss:{plugins:[tailwindcss()]}},server:{watch:{useFsEvents:false,usePolling:true}}});
