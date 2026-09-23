import { describe, expect, it } from 'vitest';
import { CATEGORY_META, CATEGORY_ORDER, bookingCategory, itemCategory } from '../categories';

describe('categories', () => {
  it('puts hotels, trains and restaurants where a traveller expects them', () => {
    expect(bookingCategory('hotel')).toBe('stay');
    expect(bookingCategory('international-train')).toBe('transport');
    expect(bookingCategory('flight')).toBe('transport');
    expect(bookingCategory('restaurant')).toBe('food');
    expect(bookingCategory('gondola')).toBe('activity');
    expect(itemCategory('transfer')).toBe('transport');
    expect(itemCategory('meal')).toBe('food');
  });

  it('orders and describes every category', () => {
    expect([...CATEGORY_ORDER].sort()).toEqual(Object.keys(CATEGORY_META).sort());
  });
});
