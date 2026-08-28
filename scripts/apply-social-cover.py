#!/usr/bin/env python3
from pathlib import Path
import html as html_lib
import re

root = Path.cwd()
origin = 'https://www.retrowebgames.it'
image_url = origin + '/assets/social/retrowebgames-cover.jpg'
image_width, image_height = '600', '315'
image_alt = 'RetroWebGames — arcade classics, reimagined for the web'

descriptions = {
    'index.html': 'RetroWebGames: giochi arcade gratuiti ispirati ai grandi classici, direttamente nel browser e pensati per smartphone.',
    'games/star-swarm/index.html': '100 livelli coreografati, 10 boss, 8 armi, 20 livelli POWER e wingmen nel space shooter arcade di RetroWebGames.',
    'games/bubble-burst/index.html': '200 configurazioni artistiche, bubble speciali, bombe, Color Wipe e pressione crescente nel bubble shooter di RetroWebGames.',
    'games/block-drop/index.html': 'Incastra i blocchi, completa le linee e resisti alla velocità crescente nel falling block puzzle di RetroWebGames.',
    'games/maze-munch/index.html': 'Ripulisci il labirinto, evita gli inseguitori e usa i surge nodes nel maze chase arcade di RetroWebGames.',
    'games/neon-rally/index.html': 'Difendi la tua linea e controlla angolo e velocità dei rimbalzi nel paddle duel arcade di RetroWebGames.',
    'games/neon-snake/index.html': 'Neon Snake: snake arcade mobile-first di RetroWebGames, con combo, shield e ostacoli progressivi.',
    'games/neon-tilt/index.html': 'Neon Tilt: gravity maze arcade di RetroWebGames controllato inclinando lo smartphone.',
    'games/solitaire/index.html': 'Il classico Klondike con 52 carte, sette colonne, fondazioni, drag, tap e autosalvataggio su RetroWebGames.',
    'games/prism-breaker/index.html': '100 livelli originali, brick speciali, power-up e un boss ogni 10 livelli nel brick breaker di RetroWebGames.'
}

pages = [Path('index.html')] + sorted(Path('games').glob('*/index.html'))
for rel_path in pages:
    rel = rel_path.as_posix()
    p = root / rel_path
    text = p.read_text()
    title_match = re.search(r'<title>([\s\S]*?)</title>', text, re.I)
    canonical_match = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)["\'][^>]*>', text, re.I)
    if not title_match or not canonical_match:
        raise RuntimeError(f'{rel}: title/canonical missing')
    title = title_match.group(1).strip()
    canonical = canonical_match.group(1)
    description = descriptions.get(rel, f'{title}: gioca gratis su RetroWebGames.')

    text = re.sub(r'^\s*<meta\s+(?:property=["\']og:[^"\']+["\']|name=["\']twitter:[^"\']+["\'])[^>]*>\s*\n?', '', text, flags=re.I | re.M)
    text = re.sub(r'^\s*<meta\s+name=["\']description["\'][^>]*>\s*\n?', '', text, flags=re.I | re.M)

    esc = lambda value: html_lib.escape(str(value), quote=True)
    block = '\n'.join([
        f'  <meta name="description" content="{esc(description)}" />',
        '  <meta property="og:type" content="website" />',
        '  <meta property="og:site_name" content="RetroWebGames" />',
        f'  <meta property="og:title" content="{esc(title)}" />',
        f'  <meta property="og:description" content="{esc(description)}" />',
        f'  <meta property="og:url" content="{esc(canonical)}" />',
        f'  <meta property="og:image" content="{image_url}" />',
        f'  <meta property="og:image:secure_url" content="{image_url}" />',
        '  <meta property="og:image:type" content="image/jpeg" />',
        f'  <meta property="og:image:width" content="{image_width}" />',
        f'  <meta property="og:image:height" content="{image_height}" />',
        f'  <meta property="og:image:alt" content="{image_alt}" />',
        '  <meta name="twitter:card" content="summary_large_image" />',
        f'  <meta name="twitter:title" content="{esc(title)}" />',
        f'  <meta name="twitter:description" content="{esc(description)}" />',
        f'  <meta name="twitter:image" content="{image_url}" />',
        f'  <meta name="twitter:image:alt" content="{image_alt}" />',
        ''
    ])
    text = re.sub(r'(\s*<title>)', '\n' + block + r'\1', text, count=1, flags=re.I)
    p.write_text(text)

validator = r'''#!/usr/bin/env node
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

if(failures.length){console.error('\nRetroWebGames social-sharing validation FAILED ('+failures.length+')\n');for(const failure of failures)console.error('  ✗ '+failure);console.error('');process.exit(1);}
console.log('RetroWebGames social-sharing validation OK');
console.log('  ✓ '+pages.length+' pages expose static Open Graph + Twitter large-image metadata');
console.log('  ✓ every referenced social image exists under assets/social/');
console.log('  ✓ home uses the global fallback; game pages may later use dedicated covers');
'''
(root / 'scripts/validate-social-sharing.mjs').write_text(validator)

(root / 'docs/SOCIAL-SHARING.md').write_text('''# RetroWebGames — social sharing covers

## Current contract

Every public RetroWebGames page exposes static Open Graph and Twitter/X metadata in its HTML `<head>`. Social crawlers must not depend on JavaScript.

The current global fallback cover is:

`assets/social/retrowebgames-cover.jpg`

Production URL:

`https://www.retrowebgames.it/assets/social/retrowebgames-cover.jpg`

For now home and every game page use this image. The current committed cover is a 600×315 JPEG (the minimum large-preview 1.91:1 format). New dedicated covers should preferably be 1200×630 JPEGs.

## Future per-game covers

Use the convention:

`assets/social/games/<slug>.jpg`

When a dedicated cover is created for a game, update only that game page's `og:image`, `og:image:secure_url`, dimensions/type/alt metadata and `twitter:image`/alt. Keep `og:url` equal to the page canonical URL and use absolute HTTPS image URLs.

## Validation

Every page must have exactly one static Open Graph and Twitter/X `summary_large_image` metadata set.

Run `node scripts/validate-social-sharing.mjs` or `node scripts/validate-contracts.mjs`.
''')

agents_path = root / 'AGENTS.md'
agents = agents_path.read_text()
if '## Social sharing contract — REQUIRED' not in agents:
    agents += '''\n\n## Social sharing contract — REQUIRED

Every current and future public page must expose static Open Graph + Twitter/X metadata; social crawlers must not rely on JavaScript. The global fallback is `assets/social/retrowebgames-cover.jpg`. Future game-specific covers belong under `assets/social/games/<slug>.jpg` and may override only that game's image metadata. Keep absolute production HTTPS URLs and `twitter:card=summary_large_image`. See `docs/SOCIAL-SHARING.md` and run `node scripts/validate-social-sharing.mjs`.
'''
    agents_path.write_text(agents)

contracts_path = root / 'scripts/validate-contracts.mjs'
contracts = contracts_path.read_text()
if 'scripts/validate-social-sharing.mjs' not in contracts:
    contracts = contracts.replace("'scripts/validate-prism-breaker.mjs'", "'scripts/validate-prism-breaker.mjs','scripts/validate-social-sharing.mjs'")
    contracts = contracts.replace('Session, Bubble Burst, Solitario and Prism Breaker specialized validators are green', 'Session, social sharing, Bubble Burst, Solitario and Prism Breaker specialized validators are green')
    contracts_path.write_text(contracts)

print(f'Social metadata applied to {len(pages)} pages.')
