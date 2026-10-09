/**
 * Fetch helpers shared by every check. Each URL is fetched once per run.
 */
const cache = new Map();

export async function get(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url, { redirect: 'manual', headers: { 'user-agent': 'agency-site-kit-gate' } }).then(async (res) => ({
        url,
        status: res.status,
        headers: res.headers,
        text: await res.text(),
      })),
    );
  }
  return cache.get(url);
}

/** Rewrites a production URL (from a sitemap or canonical) onto the host being tested. */
export function onBase(url, base) {
  const u = new URL(url, base);
  const b = new URL(base);
  u.protocol = b.protocol;
  u.host = b.host;
  return u.href;
}

/** Path without trailing slash (except root) and without .html, for comparing URLs. */
export function normalPath(url) {
  const p = new URL(url).pathname.replace(/\.html$/, '').replace(/index$/, '');
  return p.length > 1 ? p.replace(/\/$/, '') : '/';
}

/**
 * Finds the pages to test from robots.txt > Sitemap, falling back to the
 * common sitemap paths (Astro, Yoast, WordPress core). Works the same on any
 * site with a sitemap, which is why the gate tests URLs, not source files.
 */
export async function discoverPages(base) {
  const robots = await get(new URL('/robots.txt', base).href);
  const listed = robots.status === 200 ? [...robots.text.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]) : [];
  const candidates = listed.length ? listed : ['/sitemap-index.xml', '/sitemap_index.xml', '/wp-sitemap.xml', '/sitemap.xml'];

  for (const candidate of candidates) {
    const urls = await readSitemap(onBase(candidate, base), base);
    if (urls.length) return { sitemap: onBase(candidate, base), pages: [...new Set(urls.map(normalPath))] };
  }
  return { sitemap: null, pages: ['/'] };
}

async function readSitemap(url, base, depth = 0) {
  const res = await get(url);
  if (res.status !== 200 || depth > 2) return [];
  const locs = [...res.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  if (/<sitemapindex/i.test(res.text)) {
    const nested = await Promise.all(locs.map((loc) => readSitemap(onBase(loc, base), base, depth + 1)));
    return nested.flat();
  }
  return locs.map((loc) => onBase(loc, base));
}
