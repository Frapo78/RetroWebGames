import fs from 'node:fs';
import path from 'node:path';
import { PAGES } from '../astro-site/src/lib/render-page.mjs';

const root=process.cwd(),out=path.join(root,'.work/astro-site/public'),target=path.join(root,'public');
const localized=['en','es'];
if(localized.some(locale=>!fs.existsSync(path.join(out,locale,'index.html'))))throw new Error('Missing complete Astro output; run build:site first');
for(const page of PAGES){
  const rel=page.route?`${page.route}/index.html`:'index.html';
  const from=path.join(out,rel),to=path.join(target,rel);
  fs.mkdirSync(path.dirname(to),{recursive:true});
  fs.copyFileSync(from,to);
}
for(const locale of localized){
  fs.rmSync(path.join(target,locale),{recursive:true,force:true});
  fs.cpSync(path.join(out,locale),path.join(target,locale),{recursive:true});
}
fs.copyFileSync(path.join(out,'sitemap.xml'),path.join(target,'sitemap.xml'));
console.log(`Published ${PAGES.length*(localized.length+1)} Astro HTML routes and localized sitemap into public/`);
