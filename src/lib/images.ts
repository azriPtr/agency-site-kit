import type { ImageMetadata } from 'astro';

/**
 * Resolves an image path from client/facts.yaml to an imported asset, so every
 * photo goes through astro:assets (resized, converted to webp/avif, width and
 * height set to prevent layout shift). A path that does not exist fails the build.
 */
const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/client/**/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
});

export function clientImage(src: string): ImageMetadata {
  const hit = files[`/src/assets/client/${src}`];
  if (!hit) {
    throw new Error(
      `Image "${src}" is referenced in client/facts.yaml or a page but is missing from src/assets/client/.`,
    );
  }
  return hit.default;
}
