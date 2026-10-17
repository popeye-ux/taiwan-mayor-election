import { createRouter, createWebHistory } from 'vue-router';
import CompareView from './views/CompareView.vue';

// 單一路由；檢視狀態全部放在 query（見 state/url.ts）
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [{ path: '/', component: CompareView }],
});
