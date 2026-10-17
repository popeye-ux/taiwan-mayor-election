<script setup lang="ts">
defineEmits<{ zoom: [dir: 1 | -1] }>();
</script>

<template>
  <div class="zoomc">
    <button type="button" aria-label="放大" @click="$emit('zoom', 1)">+</button>
    <button type="button" aria-label="縮小" @click="$emit('zoom', -1)">−</button>
  </div>
</template>

<style scoped>
.zoomc {
  position: absolute; right: var(--s-4); bottom: var(--s-4); z-index: 5; display: flex; flex-direction: column;
  background: var(--bg-overlay); backdrop-filter: blur(20px); border: 1px solid var(--hairline);
  border-radius: var(--r-md); overflow: hidden;
}
button { width: 40px; height: 40px; border: 0; background: none; cursor: pointer; color: var(--ink); font-family: var(--font-mono); font-size: 16px; }
button + button { border-top: 1px solid var(--hairline); }
button:hover { background: var(--hover); }
</style>
