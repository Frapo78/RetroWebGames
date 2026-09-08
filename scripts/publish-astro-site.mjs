import fs from 'node:fs';
import path from 'node:path';
import { PAGES } from '../astro-site/src/lib/render-page.mjs';

const root=process.cwd(),out=path.join(root,'.work/astro-site/public'),target=path.join(root,'public');
if(!fs.existsSync(path.join(out,'en','index.html')))throw new Error('Missing complete Astro output; run build:site first');
for(const page of PAGES){
  const rel=page.route?`${page.route}/index.html`:'index.html';
  const from=path.join(out,rel),to=path.join(target,rel);
  fs.mkdirSync(path.dirname(to),{recursive:true});
  fs.copyFileSync(from,to);
}
fs.rmSync(path.join(target,'en'),{recursive:true,force:true});
fs.cpSync(path.join(out,'en'),path.join(target,'en'),{recursive:true});
fs.copyFileSync(path.join(out,'sitemap.xml'),path.join(target,'sitemap.xml'));
console.log('Published 24 Astro HTML routes and localized sitemap into public/');
