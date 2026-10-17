/** 同一網址只 fetch 一次；同時發出的請求共用 Promise；失敗時從快取移除，下次可重試。 */
export function createJsonCache(fetchFn: typeof fetch = (...a) => fetch(...a)) {
  const store = new Map<string, Promise<unknown>>();
  return {
    get<T>(url: string): Promise<T> {
      let p = store.get(url);
      if (!p) {
        p = fetchFn(url).then((res) => {
          if (!res.ok) throw new Error(`載入失敗（HTTP ${res.status}）：${url}`);
          return res.json();
        });
        p.catch(() => store.delete(url));
        store.set(url, p);
      }
      return p as Promise<T>;
    },
  };
}

export const STALE: unique symbol = Symbol('stale');

/** 包住一連串非同步請求，只有最後一個發出的請求會拿到結果，較早的回傳 STALE。 */
export function latest<T>(): (p: Promise<T>) => Promise<T | typeof STALE> {
  let seq = 0;
  return (p) => {
    const mine = ++seq;
    return p.then((v) => (mine === seq ? v : STALE));
  };
}
