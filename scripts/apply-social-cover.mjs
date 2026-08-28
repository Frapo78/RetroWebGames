#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const origin='https://www.retrowebgames.it';
const imageUrl=`${origin}/assets/social/retrowebgames-cover.jpg`;
const imageWidth='600', imageHeight='315';
const imageAlt='RetroWebGames — arcade classics, reimagined for the web';
const descriptions={
  'index.html':'RetroWebGames: giochi arcade gratuiti ispirati ai grandi classici, direttamente nel browser e pensati per smartphone.',
  'games/star-swarm/index.html':'100 livelli coreografati, 10 boss, 8 armi, 20 livelli POWER e wingmen nel space shooter arcade di RetroWebGames.',
  'games/bubble-burst/index.html':'200 configurazioni artistiche, bubble speciali, bombe, Color Wipe e pressione crescente nel bubble shooter di RetroWebGames.',
  'games/block-drop/index.html':'Incastra i blocchi, completa le linee e resisti alla velocità crescente nel falling block puzzle di RetroWebGames.',
  'games/maze-munch/index.html':'Ripulisci il labirinto, evita gli inseguitori e usa i surge nodes nel maze chase arcade di RetroWebGames.',
  'games/neon-rally/index.html':'Difendi la tua linea e controlla angolo e velocità dei rimbalzi nel paddle duel arcade di RetroWebGames.',
  'games/neon-snake/index.html':'Neon Snake: snake arcade mobile-first di RetroWebGames, con combo, shield e ostacoli progressivi.',
  'games/neon-tilt/index.html':'Neon Tilt: gravity maze arcade di RetroWebGames controllato inclinando lo smartphone.',
  'games/solitaire/index.html':'Il classico Klondike con 52 carte, sette colonne, fondazioni, drag, tap e autosalvataggio su RetroWebGames.',
  'games/prism-breaker/index.html':'100 livelli originali, brick speciali, power-up e un boss ogni 10 livelli nel brick breaker di RetroWebGames.'
};

const escapeAttr=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const pageFiles=['index.html',...fs.readdirSync(path.join(root,'games'),{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(root,'games',e.name,'index.html'))).map(e=>`games/${e.name}/index.html`).sort()];

for(const rel of pageFiles){
  const abs=path.join(root,rel); let html=fs.readFileSync(abs,'utf8');
  const title=(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'RetroWebGames').trim();
  const canonical=html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i)?.[1];
  if(!canonical) throw new Error(`${rel}: canonical missing`);
  const description=descriptions[rel]||html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i)?.[1]||`${title}: gioca gratis su RetroWebGames.`;

  html=html.replace(/^\s*<meta\s+(?:property=["']og:[^"']+["']|name=["']twitter:[^"']+["'])[^>]*>\s*\n?/gim,'');
  html=html.replace(/^\s*<meta\s+name=["']description["'][^>]*>\s*\n?/gim,'');

  const block=`  <meta name="description" content="${escapeAttr(description)}" />\n`+
`  <meta property="og:type" content="website" />\n`+
`  <meta property="og:site_name" content="RetroWebGames" />\n`+
`  <meta property="og:title" content="${escapeAttr(title)}" />\n`+
`  <meta property="og:description" content="${escapeAttr(description)}" />\n`+
`  <meta property="og:url" content="${escapeAttr(canonical)}" />\n`+
`  <meta property="og:image" content="${imageUrl}" />\n`+
`  <meta property="og:image:secure_url" content="${imageUrl}" />\n`+
`  <meta property="og:image:type" content="image/jpeg" />\n`+
`  <meta property="og:image:width" content="${imageWidth}" />\n`+
`  <meta property="og:image:height" content="${imageHeight}" />\n`+
`  <meta property="og:image:alt" content="${imageAlt}" />\n`+
`  <meta name="twitter:card" content="summary_large_image" />\n`+
`  <meta name="twitter:title" content="${escapeAttr(title)}" />\n`+
`  <meta name="twitter:description" content="${escapeAttr(description)}" />\n`+
`  <meta name="twitter:image" content="${imageUrl}" />\n`+
`  <meta name="twitter:image:alt" content="${imageAlt}" />\n`;

  html=html.replace(/(\s*<title>)/i,`\n${block}$1`);
  fs.writeFileSync(abs,html);
}

const socialValidator=`#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const origin='https://www.retrowebgames.it';
const defaultImage=origin+'/assets/social/retrowebgames-cover.jpg';
const failures=[];
const must=(condition,message)=>{if(!condition)failures.push(message);};
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const pages=['index.html',...fs.readdirSync(path.join(root,'games'),{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(root,'games',e.name,'index.html'))).map(e=>'games/'+e.name+'/index.html').sort()];
const attr=(html,key,type='property')=>html.match(new RegExp('<meta\\\\s+'+type+'=[\\"\\\']'+key.replace(/[.*+?^\\${}()|[\\]\\\\]/g,'\\\\$&')+'[\\"\\\']\\\\s+content=[\\"\\\']([^\\"\\\']+)[\\"\\\'][^>]*>','i'))?.[1]||'';
const count=(html,key,type='property')=>(html.match(new RegExp('<meta\\\\s+'+type+'=[\\"\\\']'+key.replace(/[.*+?^\\${}()|[\\]\\\\]/g,'\\\\$&')+'[\\"\\\']','gi'))||[]).length;

for(const rel of pages){
  const html=read(rel);
  const canonical=html.match(/<link\\s+rel=[\"']canonical[\"']\\s+href=[\"']([^\"']+)[\"'][^>]*>/i)?.[1]||'';
  must(Boolean(canonical),rel+': canonical missing');
  const requirements=[
    ['og:type','property'],['og:site_name','property'],['og:title','property'],['og:description','property'],['og:url','property'],
    ['og:image','property'],['og:image:secure_url','property'],['og:image:type','property'],['og:image:width','property'],['og:image:height','property'],['og:image:alt','property'],
    ['twitter:card','name'],['twitter:title','name'],['twitter:description','name'],['twitter:image','name'],['twitter:image:alt','name']
  ];
  for(const [key,type] of requirements){must(count(html,key,type)===1,rel+': expected exactly one '+key);must(Boolean(attr(html,key,type)),rel+': empty '+key);}
  must(attr(html,'og:url')===canonical,rel+': og:url must match canonical');
  must(attr(html,'og:site_name')==='RetroWebGames',rel+': og:site_name mismatch');
  must(attr(html,'twitter:card','name')==='summary_large_image',rel+': twitter card must be summary_large_image');
  must(attr(html,'og:image:type')==='image/jpeg',rel+': social cover must be JPEG');
  const width=Number(attr(html,'og:image:width')),height=Number(attr(html,'og:image:height'));
  must(width>=600&&height>=315,rel+': social cover dimensions must be at least 600x315');
  const ogImage=attr(html,'og:image'),secure=attr(html,'og:image:secure_url'),twitterImage=attr(html,'twitter:image','name');
  must(ogImage===secure&&ogImage===twitterImage,rel+': OG and Twitter images must match');
  must(ogImage.startsWith(origin+'/assets/social/'),rel+': social image must use production assets/social URL');
  if(ogImage.startsWith(origin+'/')){
    const local=decodeURIComponent(new URL(ogImage).pathname).replace(/^\\//,'');
    must(fs.existsSync(path.join(root,local)),rel+': referenced social image missing: '+local);
  }
}
must(attr(read('index.html'),'og:image')===defaultImage,'Home must retain the global RetroWebGames social cover');

if(failures.length){console.error('\\nRetroWebGames social-sharing validation FAILED ('+failures.length+')\\n');for(const failure of failures)console.error('  ✗ '+failure);console.error('');process.exit(1);}
console.log('RetroWebGames social-sharing validation OK');
console.log('  ✓ '+pages.length+' pages expose static Open Graph + Twitter large-image metadata');
console.log('  ✓ every referenced social image exists under assets/social/');
console.log('  ✓ home uses the global fallback; game pages may later use dedicated covers');
`;
fs.writeFileSync(path.join(root,'scripts/validate-social-sharing.mjs'),socialValidator);

const docs=`# RetroWebGames — social sharing covers\n\n## Current contract\n\nEvery public RetroWebGames page exposes static Open Graph and Twitter/X metadata in its HTML \`<head>\`. Social crawlers must not depend on JavaScript.\n\nThe current global fallback cover is:\n\n\`assets/social/retrowebgames-cover.jpg\`\n\nProduction URL:\n\n\`https://www.retrowebgames.it/assets/social/retrowebgames-cover.jpg\`\n\nFor now home and every game page use this image. The current committed cover is a 600×315 JPEG (the minimum large-preview 1.91:1 format). New dedicated covers should preferably be 1200×630 JPEGs.\n\n## Future per-game covers\n\nUse the convention:\n\n\`assets/social/games/<slug>.jpg\`\n\nWhen a dedicated cover is created for a game, update only that game page's:\n\n- \`og:image\`\n- \`og:image:secure_url\`\n- \`og:image:width\` / \`og:image:height\`\n- \`og:image:type\` if the format changes\n- \`og:image:alt\`\n- \`twitter:image\`\n- \`twitter:image:alt\`\n\nKeep \`og:url\` equal to the page canonical URL and use absolute HTTPS image URLs.\n\n## Required metadata\n\nEvery page must have exactly one set of: \`og:type\`, \`og:site_name\`, \`og:title\`, \`og:description\`, \`og:url\`, image metadata, and Twitter/X \`summary_large_image\` metadata.\n\nRun:\n\n\`node scripts/validate-social-sharing.mjs\`\n\nor the repository-wide validator:\n\n\`node scripts/validate-contracts.mjs\`\n`;
fs.writeFileSync(path.join(root,'docs/SOCIAL-SHARING.md'),docs);

const agentsPath=path.join(root,'AGENTS.md');
let agents=fs.readFileSync(agentsPath,'utf8');
if(!agents.includes('## Social sharing contract — REQUIRED')){
  agents+=`\n\n## Social sharing contract — REQUIRED\n\nEvery current and future public page must expose static Open Graph + Twitter/X metadata; social crawlers must not rely on JavaScript. The global fallback is \`assets/social/retrowebgames-cover.jpg\`. Future game-specific covers belong under \`assets/social/games/<slug>.jpg\` and may override only that game's image metadata. Keep absolute production HTTPS URLs and \`twitter:card=summary_large_image\`. See \`docs/SOCIAL-SHARING.md\` and run \`node scripts/validate-social-sharing.mjs\`.\n`;
  fs.writeFileSync(agentsPath,agents);
}

const contractsPath=path.join(root,'scripts/validate-contracts.mjs');
let contracts=fs.readFileSync(contractsPath,'utf8');
if(!contracts.includes('scripts/validate-social-sharing.mjs')){
  contracts=contracts.replace("'scripts/validate-prism-breaker.mjs'", "'scripts/validate-prism-breaker.mjs','scripts/validate-social-sharing.mjs'");
  contracts=contracts.replace('Session, Bubble Burst, Solitario and Prism Breaker specialized validators are green','Session, social sharing, Bubble Burst, Solitario and Prism Breaker specialized validators are green');
  fs.writeFileSync(contractsPath,contracts);
}

console.log(`Social metadata applied to ${pageFiles.length} pages.`);
