import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PAGES } from '../astro-site/src/lib/render-page.mjs';

const out=path.resolve(process.env.RWG_ASTRO_OUT_DIR||'.work/astro-site/public');
const origin='https://www.retrowebgames.it';
const indexable=PAGES.filter(page=>page.indexable);
const urls=[];
const lastModified=page=>{
  try{return execFileSync('git',['log','-1','--format=%cs','--',page.source],{encoding:'utf8'}).trim()||new Date().toISOString().slice(0,10);}
  catch{return new Date().toISOString().slice(0,10);}
};
for(const page of indexable){
  const suffix=page.route?`/${page.route}/`:'/';
  const it=`${origin}${suffix}`,en=`${origin}/en${suffix}`,lastmod=lastModified(page);
  for(const loc of [it,en]) urls.push(`  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <xhtml:link rel="alternate" hreflang="it" href="${it}" />\n    <xhtml:link rel="alternate" hreflang="en" href="${en}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${it}" />\n  </url>`);
}
const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(out,'sitemap.xml'),xml);
for(const generated of ['sitemap-0.xml','sitemap-index.xml'])fs.rmSync(path.join(out,generated),{force:true});
console.log(`Astro site sitemap finalized: ${urls.length} localized canonical URLs`);
