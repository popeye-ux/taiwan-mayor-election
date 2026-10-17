import { describe, it, expect } from 'vitest';
import { parseQuery, toQuery, validate, up, DEFAULT_STATE, type ViewState, type ValidateCtx } from '../src/state/url';

const s = (p: Partial<ViewState>): ViewState => ({ ...DEFAULT_STATE, ...p });

describe('query round trip', () => {
  const cases: ViewState[] = [
    s({ layer: 'margin', county: '66000', town: '66000060', village: '66000060012' }),
    s({ county: '67000', town: '67000010', village: '2014:67000010001' }),
    s({ county: '64000', town: '64000010', village: 'n:未標示村里（投開票所 320）' }),
  ];
  for (const c of cases) {
    it(`round trips ${c.village}`, () => {
      expect(parseQuery(toQuery(c))).toEqual(c);
    });
  }
  it('default state writes nothing', () => {
    expect(toQuery(DEFAULT_STATE)).toEqual({});
    expect(toQuery(s({ layer: 'margin' }))).toEqual({ layer: 'margin' });
  });
  it('invalid layer falls back to party', () => {
    expect(parseQuery({ layer: 'xx' }).layer).toBe('party');
  });
  it('empty and non-string values are null', () => {
    expect(parseQuery({ county: '', town: ['a'] })).toEqual(DEFAULT_STATE);
  });
});

describe('validate', () => {
  const ctx: ValidateCtx = {
    hasCounty: (c) => c === '66000',
    townInCounty: (t, c) => c === '66000' && t === '66000060',
  };
  const full = s({ county: '66000', town: '66000060', village: '66000060012' });

  it('unknown county clears everything below', () => {
    expect(validate(s({ county: '99999', town: '99999010', village: 'x' }), ctx)).toEqual(DEFAULT_STATE);
  });
  it('town outside county clears town and village', () => {
    expect(validate(s({ county: '66000', town: '63000010', village: 'x' }), ctx)).toEqual(s({ county: '66000' }));
  });
  it('village kept while villages are not loaded', () => {
    expect(validate(full, ctx)).toEqual(full);
  });
  it('invalid village cleared once villages are loaded', () => {
    expect(validate(full, { ...ctx, villageValid: () => false })).toEqual(s({ county: '66000', town: '66000060' }));
    expect(validate(full, { ...ctx, villageValid: () => true })).toEqual(full);
  });
  it('village without town is cleared', () => {
    expect(validate(s({ county: '66000', village: 'x' }), ctx)).toEqual(s({ county: '66000' }));
  });
});

describe('up', () => {
  it('goes one level up', () => {
    expect(up(s({ county: 'a', town: 'b', village: 'c' }))).toEqual(s({ county: 'a', town: 'b' }));
    expect(up(s({ county: 'a', town: 'b' }))).toEqual(s({ county: 'a' }));
    expect(up(s({ county: 'a', layer: 'flip' }))).toEqual(s({ layer: 'flip' }));
    expect(up(DEFAULT_STATE)).toEqual(DEFAULT_STATE);
  });
});
