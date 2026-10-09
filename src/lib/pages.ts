import { facts, whatsappHref } from './facts';

/**
 * Every public page, with its search title and meta description.
 *
 * Keeping these in one list (instead of inside each page file) means the
 * header nav, the footer, llms.txt and the SEO gate all read the same titles,
 * and a duplicate title or description is visible at a glance.
 *
 * /build-from-brief rewrites this file from the page list in client/brief.md.
 */
export interface PageMeta {
  path: string;
  /** <title> before the " | Business" suffix. Under ~50 characters. */
  title: string;
  /** Meta description, 70-160 characters, specific to this page. */
  description: string;
  /** Label in the header nav. Omit to keep the page out of the nav. */
  nav?: string;
}

export const pages = {
  home: {
    path: '/',
    title: facts.business.name,
    description: facts.business.description,
    nav: 'Home',
  },
} satisfies Record<string, PageMeta>;

/** Internal pages: noindex, out of the sitemap, out of llms.txt. */
export const internalPages = {
  kit: {
    path: '/kit',
    title: 'Section catalog',
    description: 'Every section in the agency site kit, rendered with the current client facts and tokens.',
  },
  enquirySent: {
    path: '/enquiry-sent',
    title: 'Enquiry sent',
    description: 'Confirmation page shown after the enquiry form is sent without JavaScript.',
  },
  notFound: {
    path: '/404',
    title: 'Page not found',
    description: 'This page does not exist.',
  },
} satisfies Record<string, PageMeta>;

export const navItems = Object.values(pages as Record<string, PageMeta>).filter((p) => p.nav);

/** Header call to action: WhatsApp when the client has a number in facts, email otherwise. */
export const headerCta = facts.business.whatsapp
  ? { label: 'Enquire on WhatsApp', href: whatsappHref(facts.business.whatsapp), external: true }
  : { label: 'Email us', href: `mailto:${facts.business.email}`, external: false };
