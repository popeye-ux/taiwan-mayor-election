import type { Meta } from '../../src/data/types';

/** 小型 meta：2014（有結果）、2026（未開票），臺北市各一場。 */
export const META: Meta = {
  elections: [
    { year: 2014, vote_date: '2014-11-29', has_results: true },
    { year: 2026, vote_date: '2026-11-28', has_results: false },
  ],
  parties: [
    { id: 1, name: '中國國民黨', label: '國民黨', short: 'KMT', color: '#3B6FFF' },
    { id: 2, name: '民主進步黨', label: '民進黨', short: 'DPP', color: '#22B573' },
    { id: 3, name: '無黨籍及未經政黨推薦', label: '無黨籍', short: 'IND', color: '#A3A8B8' },
  ],
  contests: [
    { id: 1, year: 2014, county: '臺北市', vote_date: '2014-11-29', note: null, candidates: [
      { id: 1, ballot_no: 1, name: '甲', party: 1, gender: null, age: null, incumbent: null, elected: false },
      { id: 2, ballot_no: 2, name: '乙', party: 3, gender: null, age: null, incumbent: null, elected: true },
    ] },
    { id: 2, year: 2026, county: '臺北市', vote_date: '2026-11-28', note: null, candidates: [
      { id: 3, ballot_no: null, name: '丙', party: 1, gender: null, age: null, incumbent: null, elected: null },
      { id: 4, ballot_no: null, name: '丁', party: 2, gender: null, age: null, incumbent: null, elected: null },
      { id: 5, ballot_no: null, name: '戊', party: 3, gender: null, age: null, incumbent: null, elected: null },
    ] },
  ],
};
