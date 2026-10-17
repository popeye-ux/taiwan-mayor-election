import { interpolateRgb } from 'd3-interpolate';
import type { Layer, ResultRow } from '../data/types';
import type { MetaIndex } from '../data/meta';

export const NONE = '#EEF0F6';
export const FLIP_YES = '#FF4D8D';
export const FLIP_NO = '#DCDFEA';
export const TURNOUT_LOW = '#EEF0FF';
export const TURNOUT_HIGH = '#6C4CF5';
export const TURNOUT_MIN = 40;
export const TURNOUT_MAX = 75;

const turnoutRamp = interpolateRgb(TURNOUT_LOW, TURNOUT_HIGH);

/** 四種圖層的填色規則（design.md 二「圖層」） */
export function fillFor(layer: Layer, row: ResultRow | undefined, meta: MetaIndex, flipped: boolean | null): string {
  if (!row) return NONE;
  const color = meta.partyOfCandidate(row.winner).color;
  switch (layer) {
    case 'party':
      return color;
    case 'margin':
      return interpolateRgb(NONE, color)(Math.min(1, 0.18 + row.margin_pp / 40));
    case 'turnout': {
      const t = Math.min(TURNOUT_MAX, Math.max(TURNOUT_MIN, row.turnout));
      return turnoutRamp((t - TURNOUT_MIN) / (TURNOUT_MAX - TURNOUT_MIN));
    }
    case 'flip':
      return flipped === null ? NONE : flipped ? FLIP_YES : FLIP_NO;
  }
}
