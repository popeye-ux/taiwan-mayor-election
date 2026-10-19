// 手機版判斷（寬度 ≤ 760px）與兩個畫面共用的抽屜狀態（不寫進網址，切換 / 與 /gis 時保留）。
import { readonly, ref, type Ref } from 'vue';
import type { DrawerSnap } from '../domain/mobile';

export const MOBILE_QUERY = '(max-width: 760px)';

const mobile = ref(false);
let watching = false;

export function useMobile(): Readonly<Ref<boolean>> {
  if (!watching && typeof window !== 'undefined' && window.matchMedia) {
    watching = true;
    const mq = window.matchMedia(MOBILE_QUERY);
    mobile.value = mq.matches;
    mq.addEventListener('change', (e) => { mobile.value = e.matches; });
  }
  return readonly(mobile);
}

export const drawerSnap: Ref<DrawerSnap> = ref('collapsed');
