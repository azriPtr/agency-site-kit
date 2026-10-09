import type { APIRoute } from 'astro';
import { facts, formatDays, formatPrice, type Hours } from '../lib/facts';
import { pages, type PageMeta } from '../lib/pages';

/**
 * /llms.txt: a plain-markdown summary for AI systems (llmstxt.org format).
 * Built from the same facts as the pages and the JSON-LD, so an assistant
 * quoting it gets the same price and phone number a visitor sees.
 */
const { site, business: biz } = facts;
const url = (path: string) => `${site.url}${path === '/' ? '' : path}`;
const hoursLine = (hours: Hours[]) => hours.map((h) => `${formatDays(h.days)} ${h.opens} to ${h.closes}`).join('; ');
const roomsPage = (pages as Record<string, PageMeta>).rooms;

export const GET: APIRoute = () => {
  const a = biz.address;
  const out: string[] = [
    `# ${biz.name}`,
    '',
    `> ${biz.description}`,
    '',
    '## Key facts',
    '',
    `- Type: ${biz.type}`,
    `- Address: ${a.street}, ${a.locality}, ${a.region} ${a.postalCode}, ${a.country}`,
    `- Phone: ${biz.phone}`,
    ...(biz.whatsapp ? [`- WhatsApp: ${biz.whatsapp}`] : []),
    `- Email: ${biz.email}`,
    `- Map: ${biz.mapUrl}`,
    ...(biz.checkIn ? [`- Check-in from ${biz.checkIn}`] : []),
    ...(biz.checkOut ? [`- Check-out until ${biz.checkOut}`] : []),
    ...(biz.amenities.length ? [`- Amenities: ${biz.amenities.join(', ')}`] : []),
  ];

  if (facts.rooms.length) {
    out.push('', '## Rooms', '');
    for (const r of facts.rooms) {
      const name = roomsPage ? `[${r.name}](${url(roomsPage.path)}#${r.id})` : r.name;
      out.push(
        `- ${name}: ${r.sizeSqm} m², ${r.bed} bed, up to ${r.maxGuests} guests, from ${formatPrice(r.priceFrom)} per night`,
      );
    }
  }

  if (facts.dining) {
    const d = facts.dining;
    out.push('', `## ${d.name}`, '', `- Cuisine: ${d.cuisine.join(', ')}`, `- Hours: ${hoursLine(d.hours)}`);
  }

  if (facts.spa) {
    const s = facts.spa;
    out.push('', `## ${s.name}`, '', `- Hours: ${hoursLine(s.hours)}`);
    for (const t of s.treatments) out.push(`- ${t.name}: ${t.durationMin} min, ${formatPrice(t.price)}`);
  }

  out.push('', '## Pages', '');
  for (const p of Object.values(pages as Record<string, PageMeta>)) out.push(`- [${p.title}](${url(p.path)}): ${p.description}`);

  if (facts.faq.length) {
    out.push('', '## FAQ', '');
    for (const f of facts.faq) out.push(`- ${f.q} ${f.a}`);
  }

  return new Response(out.join('\n') + '\n', { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
