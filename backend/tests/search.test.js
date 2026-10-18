import { describe, it, expect } from 'vitest';
import { searchTerms, relevance } from '../src/lib/search.js';

describe('on-site search', () => {
  it('understands Indian spellings and synonyms', () => {
    expect(searchTerms('jhumki')[0].test('Oxidised Silver Geometric Jhumka Earrings')).toBe(true);
    expect(searchTerms('earings')[0].test('Golden Drop Earrings')).toBe(true);
    expect(searchTerms('kada')[0].test('Golden Bamboo Bangle Bracelet')).toBe(true);
    expect(searchTerms('ad')[0].test('Green American Diamond Cocktail Ring')).toBe(true);
  });
  it('drops filler words and does not confuse rings with earrings', () => {
    expect(searchTerms('earrings for women').length).toBe(1);
    const ring = searchTerms('ring')[0];
    expect(ring.test('Oval Stone Ring')).toBe(true);
    expect(ring.test('Golden Drop Earrings')).toBe(false);
    expect(searchTerms('earrings')[0].test('party wear ring')).toBe(false);
  });
  it('ranks name matches above tag-only matches', () => {
    const a = { name: 'Golden Geometric Drop Earrings', tags: [], inStock: true };
    const b = { name: 'Stud Earrings Gift Box Set', tags: ['golden'], inStock: true };
    expect(relevance(a, 'gold earrings')).toBeGreaterThan(relevance(b, 'gold earrings'));
  });
});
