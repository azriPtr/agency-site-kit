import { parse } from 'yaml';
import { z } from 'astro/zod';
import raw from '../../client/facts.yaml?raw';

/**
 * client/facts.yaml is the single source of truth for anything a page can get
 * wrong: names, address, phone, hours, prices, room sizes. Components read from
 * here instead of retyping, so the price on the page, the price in the JSON-LD
 * and the price in llms.txt come from the same line.
 *
 * The schema runs at build time. A missing or malformed fact fails the build
 * with the path of the bad field, before anything reaches staging.
 */

const time = z.string().regex(/^\d{2}:\d{2}$/, 'Use 24h HH:MM, e.g. 07:30');
const day = z.enum(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);

const image = z.object({
  /** Path under src/assets/client/, e.g. rooms/garden-villa.jpg */
  src: z.string(),
  /** Describes what is in the photo. Required: there is no decorative image in facts. */
  alt: z.string().min(8, 'Alt text should describe the photo'),
});

const hours = z.object({
  days: z.array(day).min(1),
  opens: time,
  closes: time,
});

const price = z.number().int().positive();

const room = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  sizeSqm: z.number().positive(),
  bed: z.string(),
  maxGuests: z.number().int().positive(),
  /** Lowest nightly rate, in business.currency. */
  priceFrom: price,
  features: z.array(z.string()).default([]),
  image,
});

const menuItem = z.object({
  name: z.string(),
  description: z.string().optional(),
  price,
  diet: z.array(z.enum(['vegetarian', 'vegan', 'gluten-free'])).default([]),
});

const treatment = z.object({
  name: z.string(),
  durationMin: z.number().int().positive(),
  price,
  description: z.string().optional(),
});

export const FactsSchema = z.object({
  site: z.object({
    /** Production URL, no trailing slash. Used for canonicals, sitemap and JSON-LD ids. */
    url: z.url().refine((u) => !u.endsWith('/'), 'No trailing slash'),
    language: z.string().default('en'),
    ogLocale: z.string().default('en_US'),
    /**
     * AI crawler policy, written to robots.txt.
     * allow: every AI crawler. search-only: AI search and user-triggered fetchers
     * (so the client can be cited in ChatGPT, Claude and Perplexity answers) but no
     * model-training crawlers. block: none of them.
     */
    aiCrawlers: z.enum(['allow', 'search-only', 'block']).default('allow'),
    /** Optional line shown above the header on every page (closures, renovations, a demo disclaimer). */
    notice: z.string().optional(),
  }),
  business: z.object({
    name: z.string(),
    /** schema.org type of the main entity. */
    type: z.enum(['Resort', 'Hotel', 'BedAndBreakfast', 'Restaurant', 'DaySpa', 'MedicalClinic']),
    /** One or two factual sentences. Feeds meta descriptions, JSON-LD and llms.txt. */
    description: z.string().min(50).max(300),
    phone: z.string().regex(/^\+[\d ]{7,20}$/, 'International format, e.g. +62 361 975 000'),
    whatsapp: z.string().regex(/^\+[\d ]{7,20}$/).optional(),
    email: z.email(),
    address: z.object({
      street: z.string(),
      locality: z.string(),
      region: z.string(),
      postalCode: z.string(),
      /** ISO 3166-1 alpha-2, e.g. ID */
      country: z.string().length(2),
    }),
    geo: z.object({ lat: z.number(), lng: z.number() }),
    mapUrl: z.url(),
    currency: z.string().length(3),
    priceRange: z.string().optional(),
    checkIn: time.optional(),
    checkOut: time.optional(),
    hours: z.array(hours).optional(),
    amenities: z.array(z.string()).default([]),
    sameAs: z.array(z.url()).default([]),
    image,
  }),
  rooms: z.array(room).default([]),
  dining: z
    .object({
      name: z.string(),
      cuisine: z.array(z.string()).min(1),
      hours: z.array(hours).min(1),
      acceptsReservations: z.boolean().default(true),
      menu: z.array(z.object({ section: z.string(), items: z.array(menuItem).min(1) })).min(1),
    })
    .optional(),
  spa: z
    .object({
      name: z.string(),
      hours: z.array(hours).min(1),
      treatments: z.array(treatment).min(1),
    })
    .optional(),
  /** Answers here are facts the client confirmed (policies, transfers, children). */
  faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
});

export type Facts = z.infer<typeof FactsSchema>;
export type Room = z.infer<typeof room>;
export type MenuItem = z.infer<typeof menuItem>;
export type Treatment = z.infer<typeof treatment>;
export type Hours = z.infer<typeof hours>;
export type FactImage = z.infer<typeof image>;

function load(): Facts {
  const result = FactsSchema.safeParse(parse(raw));
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  client/facts.yaml > ${i.path.join('.')}: ${i.message}`);
    throw new Error(`client/facts.yaml is invalid:\n${lines.join('\n')}`);
  }
  return result.data;
}

export const facts = load();

const dayNames: Record<z.infer<typeof day>, string> = {
  Mo: 'Monday',
  Tu: 'Tuesday',
  We: 'Wednesday',
  Th: 'Thursday',
  Fr: 'Friday',
  Sa: 'Saturday',
  Su: 'Sunday',
};

export function formatPrice(amount: number, currency = facts.business.currency): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatDays(days: Hours['days']): string {
  const order = Object.keys(dayNames);
  const sorted = [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const contiguous = sorted.every((d, i) => i === 0 || order.indexOf(d) === order.indexOf(sorted[i - 1]) + 1);
  if (sorted.length === 7) return 'Daily';
  if (contiguous && sorted.length > 2) return `${dayNames[sorted[0]]} to ${dayNames[sorted.at(-1)!]}`;
  return sorted.map((d) => dayNames[d]).join(', ');
}

export function schemaDays(days: Hours['days']): string[] {
  return days.map((d) => `https://schema.org/${dayNames[d]}`);
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, '')}`;
}

export function whatsappHref(phone: string): string {
  return `https://wa.me/${phone.replace(/[^\d]/g, '')}`;
}
