#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const origin='https://www.retrowebgames.it';
const defaultImage=origin+'/assets/social/retrowebgames-cover.jpg';
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

for(const rel of pages){
  const html=read(rel);
  const canonical=html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i)?.[1]||'';
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
    const local=decodeURIComponent(new URL(ogImage).pathname).replace(/^\//,'');
    must(fs.existsSync(path.join(root,local)),rel+': referenced social image missing: '+local);
  }
}
must(attr(read('index.html'),'og:image')===defaultImage,'Home must retain the global RetroWebGames social cover');

const hud=read('game-hud.js');
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

if(failures.length){console.error('\nRetroWebGames social-sharing validation FAILED ('+failures.length+')\n');for(const failure of failures)console.error('  ✗ '+failure);console.error('');process.exit(1);}
console.log('RetroWebGames social-sharing validation OK');
console.log('  ✓ '+pages.length+' pages expose static Open Graph + Twitter large-image metadata');
console.log('  ✓ every referenced social image exists under assets/social/');
console.log('  ✓ '+gamePages.length+' game intros inherit icon-only WhatsApp/Facebook/X/Telegram/LinkedIn sharing');
console.log('  ✓ home uses the global fallback; game pages may later use dedicated covers');
