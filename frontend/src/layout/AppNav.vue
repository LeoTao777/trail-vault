<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const links = [
  { to: '/', label: '地图 · 时间线' },
  { to: '/record', label: '录入' },
  { to: '/archive', label: '旅行档案' },
] as const

function isActive(to: string): boolean {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <nav class="nav" aria-label="主导航">
    <RouterLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="nav-link"
      :class="{ 'is-active': isActive(link.to) }"
      :aria-current="isActive(link.to) ? 'page' : undefined"
    >
      {{ link.label }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.nav {
  display: flex;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: calc(var(--radius) + 2px);
}

.nav-link {
  padding: 7px 14px;
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--ink-soft);
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.nav-link:hover {
  background: var(--paper-warm);
  color: var(--ink);
}

.nav-link.is-active {
  background: var(--ink);
  color: var(--paper);
}

@media (max-width: 640px) {
  .nav {
    width: 100%;
  }

  .nav-link {
    flex: 1;
    text-align: center;
    padding: 8px 6px;
    font-size: 12.5px;
  }
}
</style>
