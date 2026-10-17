import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncData } from '../scripts/sync-data.mjs';

let root: string;
let dest: string;

function write(rel: string, content = '{}') {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-'));
  dest = path.join(root, 'web', 'public', 'data');
  write('data/json/meta.json', JSON.stringify({
    elections: [
      { year: 2014, vote_date: '2014-11-29', has_results: true },
      { year: 2026, vote_date: '2026-11-28', has_results: false },
    ],
    parties: [], contests: [],
  }));
  for (const lv of ['county', 'town', 'village']) write(`data/json/2014/${lv}.json`, '[]');
  for (const y of [2014, 2026]) for (const f of ['base', 'villages']) write(`data/geo/${y}/${f}.json`);
  write('data/geo/.tmp-x/a.json');
  write('data/geo/.old-y/b.json');
});

describe('syncData', () => {
  it('copies json and geo, skips .tmp-/.old-', async () => {
    await syncData({ repoRoot: root, dest });
    expect(fs.existsSync(path.join(dest, 'json/2014/town.json'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'geo/2026/villages.json'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'geo/.tmp-x'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'geo/.old-y'))).toBe(false);
  });

  it('clears dest first', async () => {
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'stale.json'), '{}');
    await syncData({ repoRoot: root, dest });
    expect(fs.existsSync(path.join(dest, 'stale.json'))).toBe(false);
  });

  it('missing json explains build_db', async () => {
    fs.rmSync(path.join(root, 'data/json/2014/village.json'));
    await expect(syncData({ repoRoot: root, dest })).rejects.toThrow(/tools\/build_db\.py/);
  });

  it('missing geo explains build_geo', async () => {
    fs.rmSync(path.join(root, 'data/geo/2026/base.json'));
    await expect(syncData({ repoRoot: root, dest })).rejects.toThrow(/tools\/geo\/build_geo\.mjs/);
  });
});
