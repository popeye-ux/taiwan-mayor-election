import { computed, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { parseQuery, toQuery, type ViewState } from './url';

/** 狀態由 route.query 算出，所以上一頁／下一頁會自動還原。 */
export function useViewState(): {
  state: Readonly<Ref<ViewState>>;
  set(next: Partial<ViewState>): void;
  replace(next: ViewState): void;
} {
  const route = useRoute();
  const router = useRouter();
  const state = computed(() => parseQuery(route.query as Record<string, unknown>));
  return {
    state,
    set(next) {
      const merged = { ...state.value, ...next };
      if (JSON.stringify(toQuery(merged)) !== JSON.stringify(toQuery(state.value))) router.push({ query: toQuery(merged) });
    },
    replace(next) {
      router.replace({ query: toQuery(next) });
    },
  };
}
