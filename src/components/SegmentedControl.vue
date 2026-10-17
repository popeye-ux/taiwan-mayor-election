<script setup lang="ts">
defineProps<{
  options: { value: string; label: string; disabled?: boolean; title?: string }[];
  modelValue: string;
  mono?: boolean;
}>();
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <div class="seg" :class="{ mono }" role="group">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      :class="{ on: o.value === modelValue, off: o.disabled }"
      :aria-disabled="o.disabled"
      :title="o.title"
      :aria-pressed="o.value === modelValue"
      @click="!o.disabled && $emit('update:modelValue', o.value)"
    >{{ o.label }}</button>
  </div>
</template>

<style scoped>
.seg { display: flex; gap: 2px; padding: 3px; border: 1px solid var(--hairline); border-radius: var(--r-full); background: var(--surface); }
.seg.mono button { font-family: var(--font-mono); }
button {
  border: 0; background: none; padding: 6px 12px; border-radius: var(--r-full); font-size: var(--text-sm);
  color: var(--ink-2); cursor: pointer; white-space: nowrap; transition: background var(--dur-fast);
}
button:hover:not(.off) { background: var(--hover); color: var(--ink); }
button.on { background: var(--selected); color: #fff; box-shadow: var(--shadow-selected); }
button.on:hover { background: var(--selected); color: #fff; }
button.off { opacity: .45; cursor: not-allowed; }
</style>
