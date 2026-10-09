import * as cheerio from 'cheerio';
import { get, normalPath, onBase } from './http.mjs';

/**
 * Technical SEO and AI-readability checks on rendered HTML.
 *
 * Everything here reads what a crawler reads: the HTTP response and the HTML.
 * Nothing reads the Astro source, so the same checks run against a WordPress
 * staging URL.
 *
 * Returns { findings, pages } where each finding is
 * { check: 'seo', level: 'error' | 'warn', page, rule, message }.
 */
export async function checkSeo({ base, pages, sitemap, config, allowPlaceholders, expect }) {
  const findings = [];
  const add = (level, page, rule, message) => findings.push({ check: 'seo', level, page, rule, message });
  const cfg = config.seo;

  // ---- site-level -------------------------------------------------------
  const robots = await get(new URL('/robots.txt', base).href);
  if (robots.status !== 200) add('error', '/robots.txt', 'robots', `robots.txt returned ${robots.status}`);
  else {
    if (!/^sitemap:/im.test(robots.text)) add('warn', '/robots.txt', 'robots', 'robots.txt does not list a Sitemap');
    if (/user-agent:\s*\*\s*\n(?:allow:[^\n]*\n)*disallow:\s*\/\s*$/im.test(robots.text)) {
      add('error', '/robots.txt', 'robots', 'robots.txt disallows every crawler from the whole site');
    }
  }
  if (!sitemap) add('error', '/', 'sitemap', 'No sitemap found via robots.txt or the usual paths');

  const llms = await get(new URL('/llms.txt', base).href);
  if (llms.status !== 200) add('warn', '/llms.txt', 'llms-txt', 'No /llms.txt for AI systems');

  const missing = await get(new URL(`/gate-check-${Date.now()}`, base).href);
  if (missing.status !== 404) {
    add('error', '/404', 'soft-404', `A page that does not exist returned ${missing.status}, not 404`);
  }

  // ---- per page ---------------------------------------------------------
  const seen = { titles: new Map(), descriptions: new Map() };
  const internalLinks = new Map(); // path -> first page that links to it
  const results = [];

  for (const path of pages) {
    const url = new URL(path, base).href;
    const res = await get(url);
    if (res.status !== 200) {
      add('error', path, 'status', `Returned ${res.status}`);
      continue;
    }
    const $ = cheerio.load(res.text);
    const page = { path, title: $('title').first().text().trim(), types: [] };
    results.push(page);

    if (!$('html').attr('lang')) add('error', path, 'html-lang', '<html> has no lang attribute');

    // Title and description
    if (!page.title) add('error', path, 'title', 'Missing <title>');
    else if (page.title.length > cfg.titleMax) {
      add('warn', path, 'title-length', `Title is ${page.title.length} characters (search results cut at about ${cfg.titleMax})`);
    }
    const desc = $('meta[name="description"]').attr('content')?.trim() ?? '';
    if (!desc) add('error', path, 'description', 'Missing meta description');
    else if (desc.length < cfg.descriptionMin || desc.length > cfg.descriptionMax) {
      add('warn', path, 'description-length', `Description is ${desc.length} characters (aim for ${cfg.descriptionMin} to ${cfg.descriptionMax})`);
    }
    track(seen.titles, page.title, path);
    track(seen.descriptions, desc, path);

    // Headings
    const h1s = $('h1').length;
    if (h1s !== 1) add('error', path, 'h1', `Found ${h1s} <h1> elements; a page needs exactly one`);
    let last = 0;
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const level = Number(el.tagName[1]);
      if (last && level > last + 1) {
        add('warn', path, 'heading-order', `<h${level}> "${$(el).text().trim().slice(0, 40)}" follows an <h${last}>`);
      }
      last = level;
    });

    // Canonical
    const canonicals = $('link[rel="canonical"]');
    const canonical = canonicals.attr('href');
    if (canonicals.length !== 1) add('error', path, 'canonical', `Found ${canonicals.length} canonical links; need exactly one`);
    else if (!/^https:\/\//.test(canonical)) add('error', path, 'canonical', `Canonical "${canonical}" is not an absolute https URL`);
    else if (normalPath(canonical) !== normalPath(url)) {
      add('error', path, 'canonical', `Canonical points to ${new URL(canonical).pathname}, not this page`);
    }

    // Robots meta: a page listed in the sitemap must be indexable
    const robotsMeta = $('meta[name="robots"]').attr('content') ?? '';
    if (/noindex/i.test(robotsMeta)) add('error', path, 'noindex', 'Page is meant to be indexed but has a noindex meta tag');

    // Open Graph
    for (const prop of ['og:title', 'og:description', 'og:image']) {
      if (!$(`meta[property="${prop}"]`).attr('content')) add('warn', path, 'open-graph', `Missing ${prop}`);
    }
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage && !/^https?:\/\//.test(ogImage)) add('warn', path, 'open-graph', 'og:image must be an absolute URL');

    // Structured data
    const nodes = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).text());
        nodes.push(...(data['@graph'] ?? [data]));
      } catch (e) {
        add('error', path, 'jsonld-parse', `JSON-LD block does not parse: ${e.message}`);
      }
    });
    if (!nodes.length) add('warn', path, 'jsonld', 'No JSON-LD structured data');
    page.types = [...new Set(nodes.map((n) => n['@type']).flat().filter(Boolean))];

    // NAP: the phone in structured data must be the phone the visitor can tap
    const biz = nodes.find((n) => n.telephone && n.address);
    if (biz) {
      const digits = (s) => s.replace(/\D/g, '');
      const tels = $('a[href^="tel:"]').map((_, el) => digits($(el).attr('href'))).get();
      if (!tels.includes(digits(biz.telephone))) {
        add('error', path, 'nap', `Structured data phone ${biz.telephone} is not a tel: link on the page`);
      }
      const street = biz.address?.streetAddress;
      if (street && !$('body').text().includes(street)) {
        add('warn', path, 'nap', `Structured data street "${street}" does not appear in the page text`);
      }
    }

    // Images
    $('img').each((_, el) => {
      const img = $(el);
      const src = (img.attr('src') ?? '').split('?')[0].split('/').pop();
      if (img.attr('alt') === undefined) add('error', path, 'img-alt', `<img> ${src} has no alt attribute`);
      if (!img.attr('width') || !img.attr('height')) add('warn', path, 'img-size', `<img> ${src} has no width/height (layout shift)`);
    });

    // Leftover drafting text
    if (!allowPlaceholders) {
      const text = visibleText($);
      for (const word of cfg.bannedText) {
        const hit = text.match(new RegExp(`.{0,30}${escape(word)}.{0,30}`, 'i'));
        if (hit) add('error', path, 'banned-text', `Contains "${word}": "…${hit[0].trim()}…"`);
      }
    }

    // Collect internal links for one pass at the end
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (/^(mailto:|tel:|#|javascript:)/.test(href)) return;
      const target = new URL(href, url);
      const prodHost = canonical && /^https?:/.test(canonical) ? new URL(canonical).host : null;
      if (target.host !== new URL(base).host && target.host !== prodHost) return;
      const linkPath = normalPath(onBase(target.href, base));
      if (!internalLinks.has(linkPath)) internalLinks.set(linkPath, path);
    });

    // Indexing expectation for a deployed environment
    if (expect) {
      const header = res.headers.get('x-robots-tag') ?? '';
      const blocked = /noindex/i.test(header) || /noindex/i.test(robotsMeta);
      if (expect === 'indexable' && blocked) {
        add('error', path, 'indexing', `Production page is noindex (X-Robots-Tag: "${header}")`);
      }
      if (expect === 'noindex' && !/noindex/i.test(header)) {
        add('error', path, 'indexing', 'Staging page is indexable: X-Robots-Tag noindex header is missing');
      }
    }
  }

  for (const [value, paths] of seen.titles) {
    if (value && paths.length > 1) add('error', paths[0], 'duplicate-title', `Same title on ${paths.join(', ')}`);
  }
  for (const [value, paths] of seen.descriptions) {
    if (value && paths.length > 1) add('error', paths[0], 'duplicate-description', `Same description on ${paths.join(', ')}`);
  }

  for (const [linkPath, from] of internalLinks) {
    const res = await get(new URL(linkPath, base).href);
    const ok = res.status === 200 || (res.status >= 300 && res.status < 400);
    if (!ok) add('error', from, 'broken-link', `Links to ${linkPath}, which returned ${res.status}`);
  }

  return { findings, pages: results };
}

function track(map, value, path) {
  if (!map.has(value)) map.set(value, []);
  map.get(value).push(path);
}

/** Body text with a space between elements, so "WhatsApp" and "Ubud" in sibling tags do not read as "WhatsAppUbud". */
function visibleText($) {
  const body = $('body').clone();
  body.find('script, style, noscript, template').remove();
  const parts = [];
  body.find('*').addBack().contents().each((_, node) => {
    if (node.type === 'text') parts.push(node.data);
  });
  return parts.join(' ').replace(/\s+/g, ' ');
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
