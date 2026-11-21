<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'

import PhaseNotice from '@/components/common/PhaseNotice.vue'
import type { PhaseItem } from '@/components/common/phase'
import { computeArchiveStats, kmSubText } from '@/domain/stats'
import { useRecordsStore } from '@/stores/records'

const store = useRecordsStore()
const { filteredRecords, ledgerRecords, options, scopeLabel, message, error } = storeToRefs(store)

/** P4 会用同一份 domain/stats.ts 渲染 Hero + 6 榜；这里先暴露数字，便于 P2 口径验收。 */
const stats = computed(() => computeArchiveStats(filteredRecords.value))

const phases: PhaseItem[] = [
  { label: 'P2 共享筛选栏 + URL query 口径（与主页一致）', done: true },
  { label: '5 个 Hero 指标（里程 / 出行 / 城市 / 国家 / 大洲）', done: false },
  { label: '6 个榜单：城市停留、高频路线、国家、年度、出行方式', done: false },
  { label: '资料明细表 + 表内搜索、命中高亮、跳主页聚焦 /?focus=<id>', done: false },
]

onMounted(() => {
  void store.ensureLoaded()
})
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-kicker">ARCHIVE · TRAVEL FILE</p>
        <h1 class="page-title">旅行档案</h1>
        <p class="page-desc">
          统计与明细都在这里：总里程、到访国家与大洲、城市停留时长、高频路线、年度与交通构成；
          下方是全部记录的资料明细表。筛选条件与主页共享（写在 URL query 里，可直接收藏）。
        </p>
      </div>
      <span class="badge">/archive</span>
    </header>

    <section class="panel" aria-label="P2 状态联调">
      <h2 class="state-title">状态联调 · P2</h2>
      <p class="state-note">
        当前口径：<b>{{ scopeLabel }}</b>。下列数字直接来自 P1 的 domain/stats.ts，P4 只是换成正式版式，
        口径不变。切换到主页再回来、或刷新这个带参数的链接，数字与筛选应完全一致。
      </p>

      <dl class="state-grid">
        <div class="state-cell">
          <dt>总里程</dt>
          <dd>{{ stats.kmText }}<small>{{ kmSubText(stats.kmByKind) }}</small></dd>
        </div>
        <div class="state-cell">
          <dt>出行次数</dt>
          <dd>{{ stats.trips }}<small>航班 {{ stats.flights }} · 铁路 {{ stats.rails }}</small></dd>
        </div>
        <div class="state-cell">
          <dt>到访城市</dt>
          <dd>{{ stats.cityCount }}</dd>
        </div>
        <div class="state-cell">
          <dt>国家 / 地区</dt>
          <dd>{{ stats.countryCount }}</dd>
        </div>
        <div class="state-cell">
          <dt>大洲</dt>
          <dd>{{ stats.continentCount }}</dd>
        </div>
        <div class="state-cell">
          <dt>明细行数</dt>
          <dd>{{ ledgerRecords.length }}<small>可见段 {{ filteredRecords.length }} / 年份 {{ options.years.length }}</small></dd>
        </div>
      </dl>

      <p class="state-note">{{ message }}</p>
      <p v-if="error" class="state-note">{{ error }}</p>
    </section>

    <PhaseNotice title="本页待实现（P4）" :items="phases" />
  </div>
</template>

<style scoped>
.state-title {
  margin: 0;
  font-family: var(--sans);
  font-size: 13px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}
</style>
