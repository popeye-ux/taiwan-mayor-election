import { describe, it, expect } from 'vitest';
import { snapHeights, snapTo, nextSnap, afterPick, selectionDeepened, swipeStep, stepYear, type DrawerSnap } from '../src/domain/mobile';
import { DEFAULT_STATE, type ViewState } from '../src/state/url';

const s = (p: Partial<ViewState>): ViewState => ({ ...DEFAULT_STATE, ...p });
const H = snapHeights(844, 150);

describe('drawer', () => {
  it('heights', () => expect(H).toEqual({ collapsed: 120, half: 380, full: 686 }));
  it('nearest when slow', () => {
    expect(snapTo(300, 0, H)).toBe('half');
    expect(snapTo(200, 0, H)).toBe('collapsed');
    expect(snapTo(600, 0.2, H)).toBe('full');
  });
  it('fling goes to next snap in that direction', () => {
    expect(snapTo(200, 0.8, H)).toBe('half');
    expect(snapTo(500, 0.8, H)).toBe('full');
    expect(snapTo(700, 0.8, H)).toBe('full');
    expect(snapTo(500, -0.8, H)).toBe('half');
    expect(snapTo(100, -0.8, H)).toBe('collapsed');
  });
  it('tap cycles, pick lifts only when collapsed', () => {
    expect((['collapsed', 'half', 'full'] as DrawerSnap[]).map(nextSnap)).toEqual(['half', 'full', 'collapsed']);
    expect(afterPick('collapsed')).toBe('half');
    expect(afterPick('half')).toBe('half');
    expect(afterPick('full')).toBe('full');
  });
});

describe('selectionDeepened', () => {
  it('new or deeper selection', () => {
    expect(selectionDeepened(s({}), s({ county: '66000' }))).toBe(true);
    expect(selectionDeepened(s({ county: '66000' }), s({ county: '63000' }))).toBe(true);
    expect(selectionDeepened(s({ county: '66000', town: '66000010' }), s({ county: '66000', town: '66000010', village: '66000010001' }))).toBe(true);
  });
  it('going up, clearing, or year/layer change is not', () => {
    expect(selectionDeepened(s({ county: '66000', town: '66000010' }), s({ county: '66000' }))).toBe(false);
    expect(selectionDeepened(s({ county: '66000' }), s({}))).toBe(false);
    expect(selectionDeepened(s({ county: '66000' }), s({ county: '66000', year: 2018, layer: 'turnout' }))).toBe(false);
  });
});

describe('swipe / year', () => {
  const Y = [2014, 2018, 2022, 2026];
  it('swipeStep', () => {
    expect(swipeStep(-50)).toBe(1);
    expect(swipeStep(50)).toBe(-1);
    expect(swipeStep(30)).toBe(0);
  });
  it('stepYear clamps', () => {
    expect(stepYear(Y, 2022, 1)).toBe(2026);
    expect(stepYear(Y, 2026, 1)).toBe(2026);
    expect(stepYear(Y, 2018, -1)).toBe(2014);
    expect(stepYear(Y, 2014, -1)).toBe(2014);
    expect(stepYear(Y, 2018, 0)).toBe(2018);
  });
});
