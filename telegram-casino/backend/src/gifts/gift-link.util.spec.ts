import { extractGiftSlug } from './gift-link.util';

describe('extractGiftSlug', () => {
  it('extracts the slug from a bare t.me link', () => {
    expect(extractGiftSlug('t.me/nft/ViceCream-33564')).toBe('ViceCream-33564');
  });

  it('extracts the slug from a full https link', () => {
    expect(extractGiftSlug('https://t.me/nft/ViceCream-33564')).toBe('ViceCream-33564');
  });

  it('trims surrounding whitespace', () => {
    expect(extractGiftSlug('  https://t.me/nft/ViceCream-33564  ')).toBe('ViceCream-33564');
  });

  it('returns null for an unrelated link', () => {
    expect(extractGiftSlug('https://example.com/whatever')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractGiftSlug('')).toBeNull();
  });
});
