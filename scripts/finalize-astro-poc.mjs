import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.env.RWG_ASTRO_OUT_DIR || '.work/astro-poc/public');
const sitemap = path.join(out, 'sitemap-0.xml');
if (!fs.existsSync(sitemap)) throw new Error(`Missing generated sitemap: ${sitemap}`);
let xml = fs.readFileSync(sitemap, 'utf8');
for (const route of ['/', '/games/block-drop/']) {
  const it = `https://www.retrowebgames.it${route}`;
  const marker = `<xhtml:link rel="alternate" hreflang="it-IT" href="${it}"/>`;
  const xDefault = `<xhtml:link rel="alternate" hreflang="x-default" href="${it}"/>`;
  xml = xml.split(marker).join(`${marker}${xDefault}`);
}
fs.writeFileSync(sitemap, xml);
console.log('Astro pilot sitemap finalized with x-default alternates');
