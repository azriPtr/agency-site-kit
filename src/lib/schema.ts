import { facts, schemaDays, type Hours } from './facts';

/**
 * JSON-LD builders. Every node is built from client/facts.yaml, never from page
 * copy, so structured data cannot say something the facts file does not.
 *
 * Nodes share stable @id values (`<site>/#business`, `#restaurant`, `#spa`) so
 * search engines and AI systems can join them across pages into one entity.
 */

type Node = Record<string, unknown>;

const site = facts.site.url;
const biz = facts.business;

export const ids = {
  website: `${site}/#website`,
  business: `${site}/#business`,
  restaurant: `${site}/#restaurant`,
  spa: `${site}/#spa`,
};

const address = {
  '@type': 'PostalAddress',
  streetAddress: biz.address.street,
  addressLocality: biz.address.locality,
  addressRegion: biz.address.region,
  postalCode: biz.address.postalCode,
  addressCountry: biz.address.country,
};

function openingHours(hours: Hours[]) {
  return hours.map((h) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: schemaDays(h.days),
    opens: h.opens,
    closes: h.closes,
  }));
}

function offer(price: number, extra: Node = {}): Node {
  return { '@type': 'Offer', price, priceCurrency: biz.currency, ...extra };
}

export function websiteNode(): Node {
  return {
    '@type': 'WebSite',
    '@id': ids.website,
    url: site,
    name: biz.name,
    inLanguage: facts.site.language,
    publisher: { '@id': ids.business },
  };
}

/**
 * The main entity. `imageUrl` is the absolute URL of the optimised hero photo.
 * `extra` lets a page add properties to the same node, e.g. room offers on /rooms.
 */
export function businessNode(imageUrl: string, extra: Node = {}): Node {
  const node: Node = {
    '@type': biz.type,
    '@id': ids.business,
    name: biz.name,
    description: biz.description,
    url: site,
    image: imageUrl,
    telephone: biz.phone.replace(/\s+/g, ''),
    email: biz.email,
    address,
    geo: { '@type': 'GeoCoordinates', latitude: biz.geo.lat, longitude: biz.geo.lng },
    hasMap: biz.mapUrl,
    currenciesAccepted: biz.currency,
  };
  if (biz.priceRange) node.priceRange = biz.priceRange;
  if (biz.checkIn) node.checkinTime = biz.checkIn;
  if (biz.checkOut) node.checkoutTime = biz.checkOut;
  if (biz.hours) node.openingHoursSpecification = openingHours(biz.hours);
  if (biz.sameAs.length) node.sameAs = biz.sameAs;
  if (biz.amenities.length) {
    node.amenityFeature = biz.amenities.map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true }));
  }
  const places = [facts.dining && { '@id': ids.restaurant }, facts.spa && { '@id': ids.spa }].filter(Boolean);
  if (places.length) node.containsPlace = places;
  return { ...node, ...extra };
}

/** Room types as offers. Passed as `extra` to businessNode on the rooms page. */
export function roomOffers(): Node {
  return {
    makesOffer: facts.rooms.map((r) =>
      offer(r.priceFrom, {
        name: r.name,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: r.priceFrom,
          priceCurrency: biz.currency,
          unitText: 'night',
        },
        itemOffered: {
          '@type': 'HotelRoom',
          name: r.name,
          bed: { '@type': 'BedDetails', typeOfBed: r.bed },
          occupancy: { '@type': 'QuantitativeValue', maxValue: r.maxGuests },
          floorSize: { '@type': 'QuantitativeValue', value: r.sizeSqm, unitCode: 'MTK' },
          amenityFeature: r.features.map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
        },
      }),
    ),
  };
}

const dietUrl = {
  vegetarian: 'https://schema.org/VegetarianDiet',
  vegan: 'https://schema.org/VeganDiet',
  'gluten-free': 'https://schema.org/GlutenFreeDiet',
} as const;

export function restaurantNode(): Node | null {
  const d = facts.dining;
  if (!d) return null;
  return {
    '@type': 'Restaurant',
    '@id': ids.restaurant,
    name: d.name,
    servesCuisine: d.cuisine,
    acceptsReservations: d.acceptsReservations,
    telephone: biz.phone.replace(/\s+/g, ''),
    address,
    url: `${site}/dining`,
    openingHoursSpecification: openingHours(d.hours),
    containedInPlace: { '@id': ids.business },
    hasMenu: {
      '@type': 'Menu',
      hasMenuSection: d.menu.map((s) => ({
        '@type': 'MenuSection',
        name: s.section,
        hasMenuItem: s.items.map((i) => ({
          '@type': 'MenuItem',
          name: i.name,
          ...(i.description && { description: i.description }),
          offers: offer(i.price),
          ...(i.diet.length && { suitableForDiet: i.diet.map((x) => dietUrl[x]) }),
        })),
      })),
    },
  };
}

export function spaNode(): Node | null {
  const s = facts.spa;
  if (!s) return null;
  return {
    '@type': 'DaySpa',
    '@id': ids.spa,
    name: s.name,
    telephone: biz.phone.replace(/\s+/g, ''),
    address,
    url: `${site}/spa`,
    openingHoursSpecification: openingHours(s.hours),
    containedInPlace: { '@id': ids.business },
    makesOffer: s.treatments.map((t) =>
      offer(t.price, {
        itemOffered: {
          '@type': 'Service',
          name: t.name,
          ...(t.description && { description: t.description }),
          duration: `PT${t.durationMin}M`,
        },
      }),
    ),
  };
}

export function faqNode(items: { q: string; a: string }[]): Node {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  };
}

export function breadcrumbNode(trail: { name: string; path: string }[]): Node {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: `${site}${t.path === '/' ? '' : t.path}`,
    })),
  };
}

/** Serialises a graph for a <script type="application/ld+json">. Escapes `<` so copy can never close the tag. */
export function toJsonLd(nodes: (Node | null)[]): string {
  const graph = { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) };
  return JSON.stringify(graph).replace(/</g, '\\u003c');
}
