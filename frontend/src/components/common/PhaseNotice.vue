<script setup lang="ts">
import type { PhaseItem } from './phase'

defineProps<{
  title: string
  items: PhaseItem[]
}>()
</script>

<template>
  <section class="notice panel" aria-label="阶段进度">
    <h2 class="notice-title">{{ title }}</h2>
    <ul class="notice-list">
      <li v-for="item in items" :key="item.label" :class="{ 'is-done': item.done }">
        <span class="dot" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.notice-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-family: var(--sans);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}

.notice-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
  color: var(--ink-soft);
}

.notice-list li {
  display: flex;
  gap: 9px;
  align-items: baseline;
}

.dot {
  flex: none;
  width: 7px;
  height: 7px;
  border: 1px solid var(--faint);
  border-radius: 50%;
  transform: translateY(-1px);
}

.is-done {
  color: var(--muted);
  text-decoration: line-through;
  text-decoration-color: var(--faint);
}

.is-done .dot {
  border-color: var(--green);
  background: var(--green);
}
</style>
