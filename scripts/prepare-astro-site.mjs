import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const source=path.join(root,'public');
const target=path.join(root,'.work/astro-site-static');
if(!fs.existsSync(path.join(source,'index.html')))throw new Error('Run from the RWG repository root');
fs.rmSync(target,{recursive:true,force:true});
fs.mkdirSync(target,{recursive:true});
fs.cpSync(source,target,{recursive:true,filter(entry){
  const relative=path.relative(source,entry).split(path.sep).join('/');
  if(relative==='en'||relative.startsWith('en/'))return false;
  if(relative==='index.html'||relative==='avatar/index.html'||/^games\/[^/]+\/index\.html$/.test(relative))return false;
  if(relative==='sitemap.xml'||relative==='sitemap-index.xml'||/^sitemap-\d+\.xml$/.test(relative))return false;
  return true;
}});
console.log(`Astro site assets prepared in ${path.relative(root,target)}`);
