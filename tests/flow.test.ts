import { describe, it, expect } from 'vitest';
import { runApply, type ApplyDeps, type LoadStatus } from '../src/views/flow';
import { STALE } from '../src/data/cache';
import { DEFAULT_STATE, type ViewState } from '../src/state/url';

const s = (p: Partial<ViewState>): ViewState => ({ ...DEFAULT_STATE, ...p });

function deps(state: ViewState, over: Partial<ApplyDeps> = {}) {
  const log: string[] = [];
  let load: LoadStatus = { kind: 'idle' };
  let villages = false;
  const d: ApplyDeps = {
    state: () => state,
    validate: (x) => x,
    replace: () => log.push('replace'),
    hasVillages: () => villages,
    ensureTowns: async () => { log.push('towns'); },
    ensureVillages: async () => { log.push('villages'); villages = true; },
    paint: () => log.push('paint'),
    frame: () => log.push('frame'),
    setLoad: (l) => { load = l; log.push(`load:${l.kind}`); },
    bump: () => {},
    ...over,
  };
  return { d, log, load: () => load };
}

describe('runApply', () => {
  it('town data failure shows a retryable error instead of throwing', async () => {
    const { d, log, load } = deps(s({ county: '63000' }), { ensureTowns: async () => { throw new Error('500'); } });
    await expect(runApply(d)).resolves.toBeUndefined();
    expect(load()).toEqual({ kind: 'error', what: 'towns' });
    expect(log).not.toContain('paint');
  });

  it('frames the town before village data arrives', async () => {
    let release!: () => void;
    const pending = new Promise<void>((r) => { release = r; });
    const { d, log } = deps(s({ county: '63000', town: '63000010' }), { ensureVillages: () => pending });
    const run = runApply(d);
    await new Promise((r) => setTimeout(r, 0));
    expect(log).toContain('frame');
    expect(log.indexOf('frame')).toBeLessThan(log.length);
    release();
    await run;
  });

  it('village failure still framed the town', async () => {
    const { d, log, load } = deps(s({ county: '63000', town: '63000010' }), { ensureVillages: async () => { throw new Error('x'); } });
    await runApply(d);
    expect(log).toContain('frame');
    expect(load()).toEqual({ kind: 'error', what: 'villages' });
  });

  it('leaving the town level clears a village error', async () => {
    const { d, load } = deps(s({ county: '63000' }));
    d.setLoad({ kind: 'error', what: 'villages' });
    await runApply(d);
    expect(load()).toEqual({ kind: 'idle' });
  });

  it('stale village result does nothing more', async () => {
    const { d, log } = deps(s({ county: '63000', town: '63000010' }), { ensureVillages: async () => STALE });
    await runApply(d);
    expect(log.filter((x) => x === 'load:idle').length).toBe(1); // 只有鄉鎮載完那次
    expect(log.at(-1)).not.toBe('paint');
  });

  it('village kept until villages load, then validated once more', async () => {
    const seen: boolean[] = [];
    const { d, log } = deps(s({ county: '63000', town: '63000010', village: 'x' }), {
      validate: (x, withVillages) => { seen.push(withVillages); return withVillages ? { ...x, village: null } : x; },
    });
    await runApply(d);
    expect(seen).toEqual([false, true]);
    expect(log.at(-1)).toBe('replace');
  });
});
