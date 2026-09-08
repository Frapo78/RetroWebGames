import { chromium } from '/apps/preview-tools/lib/node/node_modules/playwright/index.mjs';

const base=(process.env.RWG_I18N_BASE||'https://www.retrowebgames.it').replace(/\/$/,'');
const games=['star-swarm','bubble-burst','block-drop','maze-munch','neon-rally','neon-snake','neon-tilt','solitaire','prism-breaker','the-great-empire'];
const routes=['/','/avatar/',...games.map(slug=>`/games/${slug}/`),'/en/','/en/avatar/',...games.map(slug=>`/en/games/${slug}/`)];
const viewports=[{name:'small',width:320,height:568},{name:'mobile',width:390,height:844},{name:'desktop',width:1366,height:768}];
const failures=[];
const browser=await chromium.launch({headless:true});

for(const viewport of viewports){
  for(const route of routes){
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},locale:route.startsWith('/en/')?'en-US':'it-IT'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(`pageerror: ${error.message}`));
    page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`);});
    page.on('response',response=>{const url=new URL(response.url());if(url.origin===base&&response.status()>=400)errors.push(`HTTP ${response.status()} ${url.pathname}`);});
    try{
      const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});
      if(!response?.ok())throw new Error(`navigation HTTP ${response?.status()}`);
      await page.waitForTimeout(700);
      const expectedLocale=route.startsWith('/en/')?'en':'it';
      const actualLocale=await page.locator('html').getAttribute('lang');
      if(actualLocale!==expectedLocale)errors.push(`lang=${actualLocale}, expected ${expectedLocale}`);
      if(await page.locator(`.rwg-language-switcher [data-rwg-language="${expectedLocale}"][aria-current="page"]`).count()!==1)errors.push('active language selector missing');
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      if(overflow>2)errors.push(`horizontal overflow ${overflow}px`);
      if(route.includes('/games/')){
        const start=page.locator('#startBtn');
        if(!await start.isVisible())errors.push('start button not visible');
        if(!await page.locator('.rwg-intro-leaderboard-slot,.rwg-leaderboard').first().isVisible())errors.push('intro leaderboard not visible');
        if(viewport.name==='mobile'&&await start.isEnabled()){
          await start.click({timeout:5000});
          await page.waitForTimeout(350);
        }
      }
      if(expectedLocale==='en'){
        const visible=await page.locator('body').innerText();
        const residual=visible.match(/\b(partita|livello|punti|pausa|nuova|completata|torna|gioca|vite|frecce|tastiera|consigliato|pietra)\b/i);
        if(residual)errors.push(`Italian fallback: ${residual[0]}`);
      }
    }catch(error){errors.push(error.message);}
    if(errors.length)failures.push(`${viewport.name} ${route}: ${[...new Set(errors)].join(' | ')}`);
    await context.close();
  }
}

await browser.close();
if(failures.length){console.error(`I18N browser smoke FAILED (${failures.length})`);for(const failure of failures)console.error(`  ✗ ${failure}`);process.exit(1);}
console.log(`I18N browser smoke OK: ${routes.length} routes × ${viewports.length} viewports = ${routes.length*viewports.length} checks`);
