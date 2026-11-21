<script setup lang="ts">
import AppNav from './AppNav.vue'
import ToastHost from './ToastHost.vue'
</script>

<template>
  <div class="shell">
    <header class="shell-head">
      <RouterLink to="/" class="brand">
        <span class="brand-eyebrow">TRAIL VAULT</span>
        <span class="brand-name">行旅地图</span>
      </RouterLink>

      <AppNav />
    </header>

    <main class="shell-main">
      <!-- 主页（地图 + 时间线）保活：切到录入/档案再回来时 MapLibre 实例不重建 -->
      <RouterView v-slot="{ Component, route }">
        <KeepAlive include="HomeView">
          <component :is="Component" :key="route.path" />
        </KeepAlive>
      </RouterView>
    </main>

    <ToastHost />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.shell-head {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 14px clamp(16px, 4vw, 48px);
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--paper) 88%, transparent);
  backdrop-filter: blur(10px);
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.1;
}

.brand-eyebrow {
  font-family: var(--sans);
  font-size: 10px;
  letter-spacing: 0.28em;
  color: var(--muted);
}

.brand-name {
  font-size: 19px;
  letter-spacing: 0.06em;
}

.shell-main {
  flex: 1;
  padding: clamp(16px, 3vw, 32px) clamp(16px, 4vw, 48px) 64px;
}

@media (max-width: 640px) {
  .shell-head {
    align-items: center;
  }
}
</style>
