import { createRouter, createWebHistory } from 'vue-router';
import CompareView from './views/CompareView.vue';

// 四屆比較 /、GIS /gis；檢視狀態全部放在 query（見 state/url.ts），兩畫面切換時原樣保留
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: CompareView },
    { path: '/gis', component: () => import('./views/GisView.vue') },
  ],
});
