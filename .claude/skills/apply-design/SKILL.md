---
description: Map a Claude Design handoff onto the kit, as design tokens and existing sections, instead of pasting its HTML. Use when a Claude Design handoff or design files arrive in the session.
---

# /apply-design

A Claude Design handoff shows what the site should look like. The kit already has the structure (sections,
SEO, facts). Your job is to move the look across without losing the structure.

## Steps

1. Read the handoff completely. List: colour palette, type (families, weights, sizes), radii, spacing feel,
   and the sections on each page in order.
2. **Tokens.** Write the palette into `src/styles/tokens.css` using the existing token names. Every token
   gets a value; do not add raw colours anywhere else. Check text/background pairs reach 4.5:1 (3:1 for
   text 24px and up). If the design's muted grey fails, darken it and note the change.
3. **Fonts.** Set the families in the `fonts` block of `astro.config.mjs` (Fontsource provider, static
   weights that the design actually uses, `styles: ['normal']` unless italics appear).
4. **Sections.** For each block in the design, pick the kit section that fits (see `/kit`). Adjust that
   section's classes when the design differs. Create a new section only when nothing fits, and say so.
5. Write `docs/design-mapping.md`: a table of design block → kit section, plus every place you departed
   from the design and why (contrast, performance, a fact the design invented).
6. `pnpm build`, `pnpm preview --background`, then open `/kit` and compare with the handoff.

## Do not

- Copy text from the design mockup into pages. Mockup copy is placeholder; page copy comes from the brief.
- Copy prices, room names or hours from the mockup. They come from `client/facts.yaml`.
- Add animation libraries or client JS for effects the design shows. Ask first.
