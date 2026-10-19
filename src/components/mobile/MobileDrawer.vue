<script setup lang="ts">
// 手機版底部抽屜：收合／半開／全開三段（共用 drawerSnap）。拖曳把手或（非全開時）內容區移動，點把手循環切換；
// 只有全開時內容區可以捲動。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { drawerSnap } from '../../state/useMobile';
import { DRAWER_COLLAPSED, nextSnap, snapHeights, snapTo } from '../../domain/mobile';

/** resetKey：選取改變時由畫面傳入新值，內容捲回頂端 */
const props = defineProps<{ topH: number; resetKey?: string }>();

const viewportH = ref(window.innerHeight);
const onResize = () => { viewportH.value = window.innerHeight; };
onMounted(() => window.addEventListener('resize', onResize));
onBeforeUnmount(() => window.removeEventListener('resize', onResize));

const heights = computed(() => snapHeights(viewportH.value, props.topH));
const dragH = ref<number | null>(null);
const height = computed(() => dragH.value ?? heights.value[drawerSnap.value]);
const full = computed(() => drawerSnap.value === 'full' && dragH.value === null);

const root = ref<HTMLElement | null>(null);
const body = ref<HTMLElement | null>(null);
// 收合／半開時內容不能捲，要捲回頂端才看得到眉標與標題；換了選取也從頂端開始
const toTop = () => { if (body.value) body.value.scrollTop = 0; };
watch(drawerSnap, (s) => { if (s !== 'full') toTop(); });
watch(() => props.resetKey, toTop);
/** 位移超過這個值才算拖曳；之前不擷取指標，內容裡的按鈕照常收到 click */
const TAP = 6;
let start: { y: number; h: number; id: number; onHandle: boolean } | null = null;
let samples: { t: number; h: number }[] = [];

function down(e: PointerEvent) {
  const onHandle = !!(e.target as HTMLElement).closest('.grip');
  if (!onHandle && drawerSnap.value === 'full') return; // 全開時內容區交給原生捲動
  start = { y: e.clientY, h: height.value, id: e.pointerId, onHandle };
  samples = [{ t: e.timeStamp, h: start.h }];
}

function move(e: PointerEvent) {
  if (!start || e.pointerId !== start.id) return;
  const dy = e.clientY - start.y;
  if (dragH.value === null) {
    if (Math.abs(dy) < TAP) return;
    root.value?.setPointerCapture(e.pointerId);
  }
  const h = Math.min(heights.value.full, Math.max(DRAWER_COLLAPSED, start.h - dy));
  dragH.value = h;
  samples.push({ t: e.timeStamp, h });
  while (samples.length > 2 && e.timeStamp - samples[0].t > 80) samples.shift();
}

function up(e: PointerEvent) {
  if (!start || e.pointerId !== start.id) return;
  if (dragH.value !== null) {
    const first = samples[0];
    const last = samples[samples.length - 1];
    const v = last.t > first.t ? (last.h - first.h) / (last.t - first.t) : 0;
    drawerSnap.value = snapTo(dragH.value, v, heights.value);
    dragH.value = null;
  } else if (start.onHandle && e.type === 'pointerup') {
    drawerSnap.value = nextSnap(drawerSnap.value);
  }
  start = null;
}
</script>

<template>
  <section
    ref="root" class="drawer" :class="{ dragging: dragH !== null, full }" :style="{ height: `${height}px` }"
    @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up"
  >
    <div class="grip"><i /></div>
    <div ref="body" class="body"><slot /></div>
  </section>
</template>

<style scoped>
.drawer {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 15; display: flex; flex-direction: column;
  background: var(--surface); border-radius: 18px 18px 0 0; box-shadow: 0 -6px 24px rgba(22, 22, 29, .12);
  transition: height var(--dur-slow) var(--ease); touch-action: none;
}
.drawer.dragging { transition: none; }
.grip { flex: none; display: flex; justify-content: center; padding: 8px 0 12px; cursor: grab; }
.grip i { width: 36px; height: 4px; border-radius: 2px; background: var(--coastline); }
.body { flex: 1; min-height: 0; overflow: hidden; padding: 0 var(--s-4) var(--s-6); overscroll-behavior: contain; }
.drawer.full .body { overflow-y: auto; touch-action: pan-y; }
</style>
