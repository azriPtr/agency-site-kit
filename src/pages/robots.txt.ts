import type { APIRoute } from 'astro';
import { facts } from '../lib/facts';

/**
 * robots.txt, generated from client/facts.yaml > site.aiCrawlers.
 *
 * Training crawlers collect pages to train models. Search and user agents
 * fetch pages to answer a question right now and can cite the client, which
 * is what a hotel or restaurant wants. "search-only" separates the two.
 *
 * Staging is kept out of search by the X-Robots-Tag header in vercel.json,
 * not here: a crawler blocked by robots.txt never sees a noindex.
 */
const trainingBots = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent'];
const searchBots = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User'];

export const GET: APIRoute = () => {
  const policy = facts.site.aiCrawlers;
  const blocked = policy === 'block' ? [...trainingBots, ...searchBots] : policy === 'search-only' ? trainingBots : [];

  const lines = [`# AI crawler policy: ${policy} (client/facts.yaml > site.aiCrawlers)`, '', 'User-agent: *', 'Allow: /', ''];
  for (const bot of blocked) lines.push(`User-agent: ${bot}`, 'Disallow: /', '');
  lines.push(`Sitemap: ${facts.site.url}/sitemap-index.xml`, '');

  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
