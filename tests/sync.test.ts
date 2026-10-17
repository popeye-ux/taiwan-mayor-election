import { describe, it, expect } from 'vitest';
import { syncCameras, type CameraLike } from '../src/map/sync';

type MoveFn = (e: { originalEvent?: unknown }) => void;

/** 假地圖：jumpTo 會同步觸發 move（沒有 originalEvent），和 MapLibre 一樣。 */
function fakeMap(name: string) {
  const handlers = new Set<MoveFn>();
  const jumps: { center: [number, number]; zoom: number }[] = [];
  let center: [number, number] = [0, 0];
  let zoom = 1;
  const m: CameraLike & { name: string; jumps: typeof jumps; userMove(c: [number, number], z: number): void } = {
    name, jumps,
    getCenter: () => ({ lng: center[0], lat: center[1] }),
    getZoom: () => zoom,
    jumpTo(o) {
      jumps.push(o);
      center = o.center;
      zoom = o.zoom;
      handlers.forEach((h) => h({}));
    },
    on: (_t, fn) => { handlers.add(fn); },
    off: (_t, fn) => { handlers.delete(fn as MoveFn); },
    userMove(c, z) {
      center = c;
      zoom = z;
      handlers.forEach((h) => h({ originalEvent: {} }));
    },
  };
  return m;
}

describe('syncCameras', () => {
  it('user move is forwarded to the other maps once', () => {
    const [a, b, c] = [fakeMap('a'), fakeMap('b'), fakeMap('c')];
    syncCameras([a, b, c]);
    a.userMove([121, 25], 9);
    expect(b.jumps).toEqual([{ center: [121, 25], zoom: 9 }]);
    expect(c.jumps).toEqual([{ center: [121, 25], zoom: 9 }]);
    expect(a.jumps).toEqual([]);
  });

  it('programmatic move is not forwarded', () => {
    const [a, b] = [fakeMap('a'), fakeMap('b')];
    syncCameras([a, b]);
    a.jumpTo({ center: [120, 23], zoom: 7 });
    expect(b.jumps).toEqual([]);
  });

  it('moves during user wheel animation are forwarded', () => {
    const [a, b] = [fakeMap('a'), fakeMap('b')];
    let active = true;
    a.userActive = () => active;
    syncCameras([a, b]);
    a.jumpTo({ center: [121, 24], zoom: 8 }); // 滾輪動畫後段：沒有 originalEvent
    expect(b.jumps).toEqual([{ center: [121, 24], zoom: 8 }]);
    active = false;
    a.jumpTo({ center: [120, 23], zoom: 7 });
    expect(b.jumps.length).toBe(1);
  });

  it('dispose stops forwarding', () => {
    const [a, b] = [fakeMap('a'), fakeMap('b')];
    const dispose = syncCameras([a, b]);
    dispose();
    a.userMove([121, 25], 9);
    expect(b.jumps).toEqual([]);
  });
});
