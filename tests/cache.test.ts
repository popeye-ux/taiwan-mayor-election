import { describe, it, expect } from 'vitest';
import { createJsonCache, latest, STALE } from '../src/data/cache';

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('createJsonCache', () => {
  it('same url fetched once', async () => {
    let calls = 0;
    const cache = createJsonCache((async () => { calls++; return okResponse({ a: 1 }); }) as typeof fetch);
    const [a, b] = await Promise.all([cache.get('/x.json'), cache.get('/x.json')]);
    await cache.get('/x.json');
    expect(calls).toBe(1);
    expect(a).toEqual({ a: 1 });
    expect(b).toBe(a);
  });

  it('failure is not cached', async () => {
    let calls = 0;
    const cache = createJsonCache((async () => {
      calls++;
      if (calls === 1) throw new Error('offline');
      return okResponse([1]);
    }) as typeof fetch);
    await expect(cache.get('/y.json')).rejects.toThrow('offline');
    await expect(cache.get('/y.json')).resolves.toEqual([1]);
  });

  it('non-ok response rejects', async () => {
    const cache = createJsonCache((async () => ({ ok: false, status: 404 }) as Response) as typeof fetch);
    await expect(cache.get('/missing.json')).rejects.toThrow('/missing.json');
  });
});

describe('latest', () => {
  it('latest drops stale', async () => {
    const l = latest<string>();
    let release!: (v: string) => void;
    const slow = new Promise<string>((r) => { release = r; });
    const a = l(slow);
    const b = l(Promise.resolve('fast'));
    release('slow');
    expect(await a).toBe(STALE);
    expect(await b).toBe('fast');
  });
});
