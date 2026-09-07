export const SUPPORTED_LOCALES = Object.freeze(['it', 'en', 'de', 'fr', 'es']);
export const DEFAULT_LOCALE = 'it';
export const DEFAULT_LOCALE_PREFIXED = false;

export const LOCALE_META = Object.freeze({
  it: Object.freeze({ languageTag: 'it-IT', openGraph: 'it_IT', label: 'Italiano' }),
  en: Object.freeze({ languageTag: 'en', openGraph: 'en_US', label: 'English' }),
  de: Object.freeze({ languageTag: 'de', openGraph: 'de_DE', label: 'Deutsch' }),
  fr: Object.freeze({ languageTag: 'fr', openGraph: 'fr_FR', label: 'Français' }),
  es: Object.freeze({ languageTag: 'es', openGraph: 'es_ES', label: 'Español' })
});

export const I18N_NAMESPACES = Object.freeze([
  'core', 'home', 'pause', 'session', 'gameOver', 'leaderboard', 'profile',
  'avatar', 'orientation', 'share', 'pwa', 'games'
]);

export const LOCALE_PREFERENCE_KEY = 'rwg.locale.preference.v1';

export function normalizeLocale(value) {
  const candidate = String(value || '').trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LOCALES.includes(candidate) ? candidate : DEFAULT_LOCALE;
}

export function localeFromPathname(pathname) {
  const first = String(pathname || '/').split('/').filter(Boolean)[0] || '';
  return SUPPORTED_LOCALES.includes(first) && first !== DEFAULT_LOCALE ? first : DEFAULT_LOCALE;
}

export function localizedPath(pathname, locale) {
  const target = normalizeLocale(locale);
  const parts = String(pathname || '/').split('/').filter(Boolean);
  if (SUPPORTED_LOCALES.includes(parts[0])) parts.shift();
  const suffix = parts.length ? `/${parts.join('/')}/` : '/';
  return target === DEFAULT_LOCALE ? suffix : `/${target}${suffix}`;
}
