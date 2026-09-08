import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const outDir = process.env.RWG_ASTRO_OUT_DIR || './.work/astro-site/public';

export default defineConfig({
  site: 'https://www.retrowebgames.it',
  output: 'static',
  srcDir: './astro-site/src',
  publicDir: './.work/astro-site-static',
  outDir,
  build: { format: 'directory' },
  trailingSlash: 'always',
  i18n: {
    locales: ['it', 'en'],
    defaultLocale: 'it',
    routing: { prefixDefaultLocale: false }
  },
  integrations: [sitemap({ i18n: { defaultLocale: 'it', locales: { it: 'it-IT', en: 'en' } } })]
});
