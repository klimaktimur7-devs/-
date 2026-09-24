export function extractGiftSlug(link: string): string | null {
  const match = link.trim().match(/nft\/([A-Za-z0-9_-]+)\/?$/);
  return match ? match[1] : null;
}
