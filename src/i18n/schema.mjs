import { I18N_NAMESPACES, SUPPORTED_LOCALES } from './config.mjs';

const KEY_SEGMENT = /^[a-z][A-Za-z0-9]*$/;
const PLACEHOLDER = /\{([a-z][A-Za-z0-9]*)\}/g;

export function placeholders(value) {
  return [...String(value).matchAll(PLACEHOLDER)].map(match => match[1]).sort();
}

export function flattenCatalog(value, prefix = '', output = new Map()) {
  if (typeof value === 'string') {
    output.set(prefix, value);
    return output;
  }
  if (!value || Array.isArray(value) || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`Catalog value ${prefix || '<root>'} must be a string or plain object`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (!KEY_SEGMENT.test(key)) throw new TypeError(`Invalid i18n key segment: ${key}`);
    flattenCatalog(child, prefix ? `${prefix}.${key}` : key, output);
  }
  return output;
}

export function validateCatalog(locale, catalog) {
  if (!SUPPORTED_LOCALES.includes(locale)) throw new TypeError(`Unsupported locale: ${locale}`);
  const flat = flattenCatalog(catalog);
  const errors = [];
  for (const [key, value] of flat) {
    const namespace = key.split('.')[0];
    if (!I18N_NAMESPACES.includes(namespace)) errors.push(`Unknown namespace: ${namespace}`);
    if (!value.trim()) errors.push(`Empty translation: ${key}`);
    if (/<[^>]+>|javascript:/i.test(value)) errors.push(`Markup is forbidden: ${key}`);
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), flat });
}

export function compareCatalogShape(source, target) {
  const sourceFlat = flattenCatalog(source);
  const targetFlat = flattenCatalog(target);
  const errors = [];
  for (const [key, value] of sourceFlat) {
    if (!targetFlat.has(key)) errors.push(`Missing key: ${key}`);
    else if (placeholders(value).join('|') !== placeholders(targetFlat.get(key)).join('|')) errors.push(`Placeholder mismatch: ${key}`);
  }
  for (const key of targetFlat.keys()) if (!sourceFlat.has(key)) errors.push(`Extra key: ${key}`);
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}
