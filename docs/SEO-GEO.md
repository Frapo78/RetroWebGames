# SEO and generative search discovery

## Objective

RetroWebGames targets the useful Italian intent **videogame gratis online**, with natural secondary coverage for retrogame, web game, Snake, Solitario / Solitaire and each game genre. Copy must remain written for people: do not repeat keywords mechanically or create thin doorway pages.

SEO fundamentals are also the current foundation for discovery and citations in generative search. There is no separate “GEO hack” in this project.

## Authoritative references

- Google Search Central, [AI features and your website](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide): useful original content, crawlability, semantic HTML and page experience remain the relevant practices for AI search.
- Google Search Central, [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide): concise unique titles, useful descriptions, logical navigation and crawlable links.
- Google Search Central, [Structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies): JSON-LD is recommended and must describe visible, truthful content.
- Google Search Central, [Site names](https://developers.google.com/search/docs/appearance/site-names): the home page declares one stable `WebSite` name and alternate name.
- Google Search Central, [Robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag): indexed pages permit large image/snippet previews.
- Bing, [Webmaster Guidelines](https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a): canonical URLs, sitemaps, crawlable structure, accurate content and freshness also support Bing and Copilot results.
- Schema.org, [`VideoGame`](https://schema.org/VideoGame), [`WebSite`](https://schema.org/WebSite) and [`ItemList`](https://schema.org/ItemList): vocabulary used by the static JSON-LD graph.
- OpenAI, [crawler overview](https://developers.openai.com/api/docs/bots): `OAI-SearchBot` controls inclusion in ChatGPT search; it is independent from the training crawler.

## Repository implementation

- `scripts/seo-catalog.mjs` is the source of truth for current games, titles, descriptions, genres and canonical identity.
- `scripts/apply-seo.mjs` idempotently applies metadata and Schema.org JSON-LD to the home, all games and the avatar utility.
- `scripts/validate-seo-geo.mjs` enforces canonical URLs, unique titles/descriptions, preview directives, valid JSON-LD, complete game discovery and the utility indexing policy.
- `scripts/generate-sitemap.mjs` builds `sitemap.xml` from indexable canonical pages, excludes `noindex` utilities and attaches an accurate Git-derived `lastmod`; it intentionally omits ignored `priority` and `changefreq` fields.
- `scripts/validate-contracts.mjs` always runs the SEO/GEO validator.
- The home exposes concise factual copy and crawlable links for core game intents. Every game is represented as a free single-player browser `VideoGame`; the home list is an `ItemList`.
- `/avatar/` remains reachable and shareable but is `noindex,follow`: it is a thin local utility, not a search landing page.
- The VPS deploy reruns the sitemap generator against its normalized `public/` webroot and publishes an explicit crawler policy in `robots.txt`.

## Deliberate exclusions

- No `meta keywords`: modern search engines do not use it and it invites stuffing.
- No `llms.txt`: Google explicitly says special AI text files are unnecessary for its generative search features. Add one only if a future interoperable standard and a concrete consumer justify it.
- No fabricated ratings, reviews, authors, release dates or FAQ rich-result markup.
- No programmatic keyword landing pages or hidden SEO copy.
- No IndexNow key is committed. Bing IndexNow can be enabled later with a securely managed key after webmaster ownership is configured.

## Release checklist

Run `node scripts/generate-sitemap.mjs`, `node scripts/validate-seo-geo.mjs` and `node scripts/validate-contracts.mjs`, then smoke-test the home and all game URLs. In production verify HTTPS canonical URLs, `/robots.txt`, `/sitemap.xml`, structured data parsing, responsive layout and absence of console/network failures.
