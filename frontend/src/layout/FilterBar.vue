<script setup lang="ts">
/**
 * 共享筛选栏：/ 与 /archive 用同一个组件、同一个 store（P2）。
 * 四个下拉的值只写进 useRecordsStore.filters，URL query 由 composables/filterQuery.ts 同步。
 * 选项全部由数据推导（filterOptions），深链里出现选项表之外的值时补一条「当前值」占位，
 * 不让 select 变成空白。
 */
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { OWNER_NAME } from '@/config'
import { useRecordsStore } from '@/stores/records'

const props = withDefaults(defineProps<{ showRefresh?: boolean }>(), { showRefresh: false })
const canRefresh = computed(() => props.showRefresh)

const store = useRecordsStore()
const { filters, options, scopeLabel, message, loading, refreshing, error, filteredRecords, records } =
  storeToRefs(store)

const year = computed({
  get: () => filters.value.year,
  set: (value: string) => store.setFilters({ year: value }),
})
const traveler = computed({
  get: () => filters.value.traveler,
  set: (value: string) => store.setFilters({ traveler: value }),
})
const kind = computed({
  get: () => filters.value.kind,
  set: (value: string) => store.setFilters({ kind: value }),
})
const confidence = computed({
  get: () => filters.value.confidence,
  set: (value: string) => store.setFilters({ confidence: value }),
})

const knownYear = computed(
  () => filters.value.year === 'all' || options.value.years.includes(filters.value.year),
)
const knownTraveler = computed(() =>
  ['self', 'all', ...options.value.travelers].includes(filters.value.traveler),
)
const knownKind = computed(
  () => filters.value.kind === 'all' || options.value.kinds.some((item) => item.key === filters.value.kind),
)
const knownConfidence = computed(
  () =>
    filters.value.confidence === 'all' ||
    options.value.confidences.some((item) => item.key === filters.value.confidence),
)

function onRefresh(): void {
  void store.refresh()
}
</script>

<template>
  <section class="filter-bar panel" aria-label="共享筛选栏">
    <div class="filter-fields">
      <label class="field">
        <span>年份</span>
        <select v-model="year" class="select" aria-label="按年份筛选">
          <option value="all">全部年份</option>
          <option v-if="!knownYear" :value="filters.year">{{ filters.year }}</option>
          <option v-for="item in options.years" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>

      <label class="field">
        <span>旅客</span>
        <select v-model="traveler" class="select" aria-label="按旅客筛选">
          <option value="self">{{ OWNER_NAME }}</option>
          <option value="all">全部旅客</option>
          <option v-if="!knownTraveler" :value="filters.traveler">{{ filters.traveler }}</option>
          <option v-for="item in options.travelers" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>

      <label class="field">
        <span>类型</span>
        <select v-model="kind" class="select" aria-label="按出行类型筛选">
          <option value="all">全部类型</option>
          <option v-if="!knownKind" :value="filters.kind">{{ filters.kind }}</option>
          <option v-for="item in options.kinds" :key="item.key" :value="item.key">
            {{ item.label }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>证据</span>
        <select v-model="confidence" class="select" aria-label="按证据置信度筛选">
          <option value="all">全部证据</option>
          <option v-if="!knownConfidence" :value="filters.confidence">{{ filters.confidence }}</option>
          <option v-for="item in options.confidences" :key="item.key" :value="item.key">
            {{ item.label }}
          </option>
        </select>
      </label>
    </div>

    <div class="filter-actions">
      <button type="button" class="btn btn-quiet" @click="store.resetFilters()">重置筛选</button>
      <button v-if="canRefresh" type="button" class="btn" :disabled="refreshing" @click="onRefresh">
        {{ refreshing ? '刷新中…' : '刷新资料' }}
      </button>
      <span class="state-note">筛选条件会写进地址栏，可收藏、可回退；主页与旅行档案口径一致。</span>
    </div>

    <div class="filter-status" aria-live="polite">
      <span class="scope">{{ scopeLabel }}</span>
      <span class="count">{{ filteredRecords.length }} / {{ records.length }} 段</span>
      <span class="source">{{ message }}</span>
      <span v-if="loading">读取中…</span>
      <span v-if="error" class="status-error">{{ error }}</span>
    </div>
  </section>
</template>

<style scoped>
.filter-bar .select {
  cursor: pointer;
}

.filter-actions .state-note {
  margin: 0;
}
</style>
