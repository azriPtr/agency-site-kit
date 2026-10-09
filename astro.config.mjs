// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { parse } from 'yaml';

// The production URL lives in client/facts.yaml with the rest of the client's facts.
const { site } = parse(readFileSync(new URL('./client/facts.yaml', import.meta.url), 'utf8'));

// vercel.json sends X-Robots-Tag: noindex on every host except the production one. If that host and
// facts disagree, either production is noindex (invisible to search) or staging is indexable.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const noindexRule = vercel.headers?.find((h) => h.headers.some((x) => x.key.toLowerCase() === 'x-robots-tag'));
const indexableHost = noindexRule?.missing?.find((m) => m.type === 'host')?.value;
const productionHost = new URL(site.url).host;
if (indexableHost && indexableHost !== productionHost) {
  throw new Error(`vercel.json keeps "${indexableHost}" indexable, but client/facts.yaml says production is "${productionHost}". Update the X-Robots-Tag rule in vercel.json.`);
}
if (noindexRule && !indexableHost) {
  console.warn(`[kit] vercel.json sends noindex on every host, production included. Intended only for sites that must stay out of search.`);
}

/** Pages that exist for the team, not for search. Kept out of the sitemap; they also carry noindex. */
const internal = ['/kit', '/404', '/enquiry-sent'];

export default defineConfig({
  site: site.url,
  // /rooms, never /rooms/ or /rooms.html. vercel.json matches this (cleanUrls, trailingSlash: false).
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    // React only hydrates islands (the enquiry form). Pages ship no framework JS.
    react(),
    sitemap({
      filter: (page) => !internal.includes(new URL(page).pathname),
    }),
  ],
  // Self-hosted at build time with metric-matched fallbacks, so text does not jump when the font loads.
  // Static weights only. The variable files came to 423 KB across four preloads; these three are 66 KB.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Fraunces',
      cssVariable: '--font-display-face',
      weights: [400],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['Georgia', 'serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Inter',
      cssVariable: '--font-text-face',
      weights: [400, 500],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
