<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import HelpDialog from '@/components/common/HelpDialog.vue'
import { useFilterQuerySync } from '@/composables/filterQuery'
import { usePrefsStore } from '@/stores/prefs'
import { useRecordsStore } from '@/stores/records'

import AppNav from './AppNav.vue'
import FilterBar from './FilterBar.vue'
import ToastHost from './ToastHost.vue'

const route = useRoute()
const prefs = usePrefsStore()
const recordsStore = useRecordsStore()
const { brandEyebrow, brandLines } = storeToRefs(prefs)

const helpOpen = ref(false)
const showFilterBar = computed(() => route.path === '/' || route.path === '/archive')
const showRefresh = computed(() => route.path === '/')

// 筛选 ↔ URL query 的双向同步挂在壳上：三页切换、深链刷新、前进后退都走同一套规则
useFilterQuerySync()

onMounted(() => {
  prefs.load()
  void recordsStore.ensureLoaded()
})
</script>

<template>
  <div class="shell">
    <header class="shell-head">
      <RouterLink to="/" class="brand" :title="brandEyebrow">
        <span class="brand-eyebrow">{{ brandEyebrow }}</span>
        <span class="brand-name">
          <span v-for="(line, index) in brandLines" :key="index" class="brand-line">{{ line }}</span>
        </span>
      </RouterLink>

      <div class="head-actions">
        <AppNav />
        <button
          type="button"
          class="help-btn"
          aria-haspopup="dialog"
          :aria-expanded="helpOpen"
          @click="helpOpen = true"
        >
          使用说明
        </button>
      </div>
    </header>

    <main class="shell-main">
      <!-- 单组件 + 单 store：主页与档案页共用，杜绝旧版「同一组 select 才碰巧同步」 -->
      <FilterBar v-if="showFilterBar" :show-refresh="showRefresh" />

      <!-- 主页（地图 + 时间线）保活：切到录入/档案再回来时 MapLibre 实例不重建 -->
      <RouterView v-slot="{ Component, route: currentRoute }">
        <KeepAlive include="HomeView">
          <component :is="Component" :key="currentRoute.path" />
        </KeepAlive>
      </RouterView>
    </main>

    <HelpDialog :open="helpOpen" @close="helpOpen = false" />
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

.brand-line {
  display: block;
}

.head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.help-btn {
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: transparent;
  font-family: var(--sans);
  font-size: 12px;
  color: var(--ink-soft);
}

.help-btn:hover {
  border-color: var(--ink-soft);
  background: var(--paper-warm);
}

.shell-main {
  flex: 1;
  padding: clamp(16px, 3vw, 32px) clamp(16px, 4vw, 48px) 64px;
}

@media (max-width: 640px) {
  .shell-head {
    align-items: center;
  }

  .head-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
