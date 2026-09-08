import fs from 'node:fs';
import path from 'node:path';
import itShared from '../src/i18n/it/shared.mjs';
import enShared from '../src/i18n/en/shared.mjs';
import itGames from '../src/i18n/it/games.mjs';
import enGames from '../src/i18n/en/games.mjs';
import esShared from '../src/i18n/es/shared.mjs';
import esGames from '../src/i18n/es/games.mjs';

const locales = Object.freeze({
  it: { languageTag: 'it-IT', shared: itShared, games: itGames },
  en: { languageTag: 'en-US', shared: enShared, games: enGames },
  es: { languageTag: 'es-ES', shared: esShared, games: esGames }
});
const slugKeys = Object.freeze({
  'block-drop':'blockDrop','bubble-burst':'bubbleBurst','maze-munch':'mazeMunch','neon-rally':'neonRally','neon-snake':'neonSnake',
  'neon-tilt':'neonTilt','prism-breaker':'prismBreaker','solitaire':'solitaire','star-swarm':'starSwarm','the-great-empire':'theGreatEmpire'
});

function runtime(locale, languageTag, catalog) {
  const payload=JSON.stringify(catalog);
  return `(() => {
  'use strict';
  if (window.RWGI18n) return;
  const bootstrapStartedAt = performance.now();
  const catalog = Object.freeze(${payload});
  const get = key => String(key || '').split('.').reduce((value, part) => value && value[part], catalog);
  const interpolate = (message, params) => message.replace(/\\{([A-Za-z][A-Za-z0-9_]*)\\}/g, (_, key) => Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : '{' + key + '}');
  const t = (key, params = {}) => { const value = get(key); if (typeof value !== 'string') throw new Error('RWGI18n missing key: ' + key); return interpolate(value, params); };
  let numberFormat;
  let dateFormat;
  let pluralRules;
  const duration = value => { const total = Math.max(0, Math.round(Number(value || 0) / 1000)); const min = Math.floor(total / 60); const sec = total % 60; return min ? min + ':' + String(sec).padStart(2, '0') : sec + 's'; };
  const localize = (root = document) => {
    root.querySelectorAll?.('[data-rwg-i18n]').forEach(node => { const key=node.dataset.rwgI18n; const params=node.dataset.rwgI18nParams ? JSON.parse(node.dataset.rwgI18nParams) : {}; node.textContent=t(key,params); });
    root.querySelectorAll?.('[data-rwg-i18n-aria]').forEach(node => node.setAttribute('aria-label', t(node.dataset.rwgI18nAria)));
    root.querySelectorAll?.('[data-rwg-i18n-title]').forEach(node => node.setAttribute('title', t(node.dataset.rwgI18nTitle)));
  };
  window.RWGI18n = Object.freeze({ locale: '${locale}', languageTag: '${languageTag}', catalog, t, localize, number: value => (numberFormat ||= new Intl.NumberFormat('${languageTag}')).format(Number(value || 0)), date: value => (dateFormat ||= new Intl.DateTimeFormat('${languageTag}')).format(value instanceof Date ? value : new Date(value)), duration, pluralCategory: value => (pluralRules ||= new Intl.PluralRules('${languageTag}')).select(Number(value || 0)), bootstrapMs: performance.now() - bootstrapStartedAt });
  if (document.documentElement.lang === '${locale}') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => localize(), { once: true }); else localize(); }
  window.dispatchEvent(new CustomEvent('rwg:i18n-ready', { detail: { locale: '${locale}', bootstrapMs: window.RWGI18n.bootstrapMs } }));
})();
`;
}

function write(relative, contents) {
  const target=path.resolve('public',relative); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,contents); console.log(`Generated ${path.relative(process.cwd(),target)}`);
}
write('rwg-i18n.js',runtime('it',locales.it.languageTag,locales.it.shared));
write('rwg-i18n.en.js',runtime('en',locales.en.languageTag,locales.en.shared));
write('rwg-i18n.es.js',runtime('es',locales.es.languageTag,locales.es.shared));
for (const [locale, config] of Object.entries(locales)) for (const [slug,key] of Object.entries(slugKeys)) {
  write(`i18n/${locale}/games/${slug}.js`,runtime(locale,config.languageTag,{...config.shared,games:{[key]:config.games[key]}}));
}
