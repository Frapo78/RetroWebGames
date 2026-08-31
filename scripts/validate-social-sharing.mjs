#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { GAMES, getGameSocial } from './seo-catalog.mjs';

const root=process.cwd();
const origin='https://www.retrowebgames.it';
const defaultImage=origin+'/assets/social/retrowebgames-cover-1280.jpg';
const failures=[];
const must=(condition,message)=>{if(!condition)failures.push(message);};
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const gamePages=fs.readdirSync(path.join(root,'games'),{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(root,'games',e.name,'index.html'))).map(e=>'games/'+e.name+'/index.html').sort();
const standalonePages=fs.readdirSync(root,{withFileTypes:true})
  .filter(e=>e.isDirectory()&&e.name!=='games'&&fs.existsSync(path.join(root,e.name,'index.html')))
  .map(e=>e.name+'/index.html').sort();
const pages=['index.html',...standalonePages,...gamePages];
const attr=(html,key,type='property')=>html.match(new RegExp('<meta\\s+'+type+'=["\\\']'+key+'["\\\']\\s+content=["\\\']([^"\\\']+)["\\\'][^>]*>','i'))?.[1]||'';
const count=(html,key,type='property')=>(html.match(new RegExp('<meta\\s+'+type+'=["\\\']'+key+'["\\\']','gi'))||[]).length;
const jpegSize=buffer=>{
  if(buffer.readUInt16BE(0)!==0xffd8)return null;
  let offset=2;
  while(offset+9<buffer.length){
    if(buffer[offset]!==0xff){offset++;continue;}
    const marker=buffer[offset+1];
    if(marker===0xc0||marker===0xc1||marker===0xc2)return {width:buffer.readUInt16BE(offset+7),height:buffer.readUInt16BE(offset+5)};
    if(marker===0xd8||marker===0xd9){offset+=2;continue;}
    const length=buffer.readUInt16BE(offset+2);
    if(length<2)break;
    offset+=2+length;
  }
  return null;
};
const pngInfo=buffer=>buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?{
  width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20),colorType:buffer[25]
}:null;

for(const rel of pages){
  const html=read(rel);
  const canonical=html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i)?.[1]||'';
  must(Boolean(canonical),rel+': canonical missing');
  const requirements=[
    ['og:type','property'],['og:site_name','property'],['og:title','property'],['og:description','property'],['og:url','property'],
    ['og:image','property'],['og:image:secure_url','property'],['og:image:type','property'],['og:image:width','property'],['og:image:height','property'],['og:image:alt','property'],
    ['twitter:card','name'],['twitter:title','name'],['twitter:description','name'],['twitter:image','name'],['twitter:image:width','name'],['twitter:image:height','name'],['twitter:image:alt','name']
  ];
  for(const [key,type] of requirements){must(count(html,key,type)===1,rel+': expected exactly one '+key);must(Boolean(attr(html,key,type)),rel+': empty '+key);}
  must(attr(html,'og:url')===canonical,rel+': og:url must match canonical');
  must(attr(html,'og:site_name')==='RetroWebGames',rel+': og:site_name mismatch');
  must(attr(html,'twitter:card','name')==='summary_large_image',rel+': twitter card must be summary_large_image');
  must(attr(html,'og:image:type')==='image/jpeg',rel+': social cover must be JPEG');
  const width=Number(attr(html,'og:image:width')),height=Number(attr(html,'og:image:height'));
  must(Number(attr(html,'twitter:image:width','name'))===width&&Number(attr(html,'twitter:image:height','name'))===height,rel+': Twitter image dimensions must match Open Graph');
  must(width>=1200&&height>=627,rel+': social cover dimensions must be at least 1200x627');
  const ogImage=attr(html,'og:image'),secure=attr(html,'og:image:secure_url'),twitterImage=attr(html,'twitter:image','name');
  must(ogImage===secure&&ogImage===twitterImage,rel+': OG and Twitter images must match');
  must(ogImage.startsWith(origin+'/assets/social/'),rel+': social image must use production assets/social URL');
  if(ogImage.startsWith(origin+'/')){
    const local=decodeURIComponent(new URL(ogImage).pathname).replace(/^\//,'');
    must(fs.existsSync(path.join(root,local)),rel+': referenced social image missing: '+local);
  }
}
const home=read('index.html');
must(attr(home,'og:image')===defaultImage,'Home must retain the global RetroWebGames social cover');

must(gamePages.length===GAMES.length,'SEO catalog and discovered game page counts must match');
for(const game of GAMES){
  const rel='games/'+game.slug+'/index.html';
  const html=read(rel);
  const social=getGameSocial(game);
  const coverRel='assets/social/games/'+game.slug+'.jpg';
  const wordmarkRel='assets/brand/games/'+game.slug+'-wordmark.png';
  must(attr(html,'og:image')===social.image,rel+': must use its dedicated social cover');
  must(attr(html,'og:image:secure_url')===social.image,rel+': secure social cover mismatch');
  must(attr(html,'twitter:image','name')===social.image,rel+': Twitter must use the dedicated social cover');
  must(attr(html,'og:image:alt')===social.alt&&attr(html,'twitter:image:alt','name')===social.alt,rel+': game-specific social alt mismatch');
  must(attr(html,'og:image:width')==='1200'&&attr(html,'og:image:height')==='630',rel+': dedicated social cover metadata must be 1200x630');
  must(fs.existsSync(path.join(root,coverRel)),rel+': dedicated social cover missing');
  must(fs.existsSync(path.join(root,wordmarkRel)),rel+': separate raster wordmark missing');
  const introCover='<h1 class="rwg-intro-cover-title"><img src="../../'+coverRel+'" width="1200" height="630" alt="'+game.name+'" decoding="async" fetchpriority="high" /></h1>';
  must(html.includes(introCover),rel+': intro must render its dedicated cover as the semantic game title');
  if(fs.existsSync(path.join(root,coverRel))){
    const size=jpegSize(fs.readFileSync(path.join(root,coverRel)));
    must(size?.width===1200&&size?.height===630,coverRel+': JPEG must be exactly 1200x630');
  }
  if(fs.existsSync(path.join(root,wordmarkRel))){
    const info=pngInfo(fs.readFileSync(path.join(root,wordmarkRel)));
    must(info?.width===1200&&info?.height===300,wordmarkRel+': PNG wordmark must be exactly 1200x300');
    must(info?.colorType===4||info?.colorType===6,wordmarkRel+': PNG wordmark must retain an alpha channel');
  }
}

// Brand wordmark contract: dedicated transparent cover-derived image, never a CSS crop.
const brand=read('brand.css');
const wordmarkRel='assets/brand/retrowebgames-wordmark.png';
must(fs.existsSync(path.join(root,wordmarkRel)),'Transparent RetroWebGames wordmark asset missing');
must(home.includes('<h1 class="hero-wordmark" aria-label="RetroWebGames"><img data-rwg-src="/assets/brand/retrowebgames-wordmark.png" width="1600" height="250" alt="" loading="lazy" decoding="async" /></h1>'),'Home must expose the accessible transparent RetroWebGames wordmark');
must(home.includes('<link rel="stylesheet" href="brand.css" />'),'Home must load the dedicated brand wordmark stylesheet');
must(!home.includes('<h1>RETRO<span>WEBGAMES</span></h1>'),'Legacy font-rendered home wordmark must not return');
must(!brand.includes('background-image:'),'Home wordmark must never crop the social cover as a CSS background');
must(!brand.includes('background-position:')&&!brand.includes('background-size:'),'Home wordmark must not use crop coordinates or cover sizing');
must(brand.includes('object-fit: contain'),'Home wordmark image must use object-fit: contain');
must(brand.includes('height: auto'),'Home wordmark must preserve its intrinsic aspect ratio');
must(brand.includes('overflow: visible'),'Home wordmark container must not clip the transparent image');

const hud=read('game-hud.js');
const hudCss=read('game-hud.css');
const introShare=read('rwg-intro-share.js');
const introShareCss=read('rwg-intro-share.css');
for(const rel of gamePages) must(read(rel).includes('../../game-hud.js'),rel+': shared game-hud.js is required for automatic intro social controls');
must(hud.includes('rwg-intro-share.js')&&hud.includes('rwg-intro-share.css')&&hud.includes('loadIntroShare();'),'game-hud.js must automatically bootstrap shared intro social controls');
must(introShare.includes("['whatsapp', 'facebook', 'x', 'telegram', 'linkedin']"),'Intro sharing must expose exactly the intended five social networks');
for(const network of ['WhatsApp','Facebook','X','Telegram','LinkedIn']) must(introShare.includes('Condividi su '+network),'Intro sharing missing accessible '+network+' action');
must(introShare.includes("link[rel=\"canonical\"]")||introShare.includes("link[rel='canonical']"),'Intro sharing must share the page canonical URL');
must(introShare.includes('hint.after(row)')&&introShare.includes('panel.appendChild(row)'),'Intro sharing must render at the bottom of the game intro panel');
must(introShare.includes("startBtn.addEventListener('click', dismiss")&&introShare.includes("!overlay.classList.contains('visible')"),'Intro sharing must disappear permanently after gameplay starts/resumes');
must(introShareCss.includes('.rwg-intro-share-btn')&&introShareCss.includes('.rwg-intro-share[hidden]'),'Shared intro social icon styling missing');
must(!introShare.includes('<span'),'Intro social controls must remain icon-only with no visible text labels');
must(hudCss.includes('.rwg-intro-cover-title')&&hudCss.includes('aspect-ratio: 1200 / 630')&&hudCss.includes('object-fit: cover'),'Shared responsive intro-cover styling missing');

if(failures.length){console.error('\nRetroWebGames social-sharing validation FAILED ('+failures.length+')\n');for(const failure of failures)console.error('  ✗ '+failure);console.error('');process.exit(1);}
console.log('RetroWebGames social-sharing validation OK');
console.log('  ✓ '+pages.length+' pages expose static Open Graph + Twitter large-image metadata');
console.log('  ✓ every referenced social image exists under assets/social/');
console.log('  ✓ home wordmark uses a transparent cover-derived asset with contain rendering');
console.log('  ✓ '+gamePages.length+' game intros inherit icon-only WhatsApp/Facebook/X/Telegram/LinkedIn sharing');
console.log('  ✓ home uses the global fallback; all '+GAMES.length+' game pages use dedicated 1200x630 covers');
console.log('  ✓ every game owns a separate transparent 1200x300 raster wordmark');
console.log('  ✓ every game intro renders its dedicated cover as an accessible responsive h1');
