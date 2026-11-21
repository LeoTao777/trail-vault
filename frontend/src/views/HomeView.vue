<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'

import PhaseNotice from '@/components/common/PhaseNotice.vue'
import type { PhaseItem } from '@/components/common/phase'
import { displayTitle } from '@/domain/format'
import { confidenceLabel, kindLabel } from '@/domain/kind'
import { useRecordsStore } from '@/stores/records'

const store = useRecordsStore()
const {
  filteredRecords,
  records,
  scopeLabel,
  message,
  source,
  loading,
  error,
  selectedRecord,
  focusId,
  metrics,
} = storeToRefs(store)

const preview = computed(() => filteredRecords.value.filter((record) => !record._gap).slice(0, 6))

const phases: PhaseItem[] = [
  { label: 'P0 脚手架：Vite + Vue3 + TS + Router + Pinia', done: true },
  { label: 'P1 domain 纯逻辑搬家 + Vitest 数字快照', done: true },
  { label: 'P2 骨架与状态：FilterBar / HelpDialog / records + prefs store / URL query', done: true },
  { label: 'P3 地图舞台（MapLibre）+ 播放 + 时间线', done: false },
  { label: 'P4 旅行档案页（统计榜 + 资料明细）', done: false },
  { label: 'P5 录入页（表单 / 地点联想 / 数据工具）', done: false },
]

onMounted(() => {
  void store.ensureLoaded()
})
</script>

<template>
  <div class="page home">
    <header class="page-head">
      <div>
        <p class="page-kicker">HOME · MAP &amp; TIMELINE</p>
        <h1 class="page-title">地图 · 时间线</h1>
        <p class="page-desc">
          主页只留地图与时间线：地图舞台承载路线、播放与年份生长，下方时间线按时间顺序列出每一段行程，
          右侧显示当前选中的一段。录入与旅行档案已拆成独立页面。
        </p>
      </div>
      <span class="badge">默认页 · /</span>
    </header>

    <section class="panel" aria-label="P2 状态联调">
      <h2 class="state-title">状态联调 · P2</h2>
      <p class="state-note">
        records / filters / selectedId 已收进 useRecordsStore，筛选与地址栏 query 双向同步；
        地图舞台与时间线列表在 P3 接入，下面这块是三个页面共用的实时状态验收位。
      </p>

      <dl class="state-grid">
        <div class="state-cell">
          <dt>资料来源</dt>
          <dd>{{ source }}<small>{{ message }}</small></dd>
        </div>
        <div class="state-cell">
          <dt>统计口径</dt>
          <dd>{{ scopeLabel }}</dd>
        </div>
        <div class="state-cell">
          <dt>可见 / 全部</dt>
          <dd>{{ filteredRecords.length }} / {{ records.length }}</dd>
        </div>
        <div class="state-cell">
          <dt>当前一段</dt>
          <dd>
            {{ selectedRecord ? displayTitle(selectedRecord) : '无' }}
            <small>focus：{{ focusId || '—' }}</small>
          </dd>
        </div>
        <div class="state-cell">
          <dt>在路天数</dt>
          <dd>{{ metrics.days }}<small>移动小时 {{ metrics.hours }}</small></dd>
        </div>
        <div class="state-cell">
          <dt>点亮城市</dt>
          <dd>{{ metrics.cities.length }}<small>待补字段 {{ metrics.missing }}</small></dd>
        </div>
      </dl>

      <ul v-if="preview.length" class="state-list">
        <li v-for="record in preview" :key="record.id">
          <span class="date">{{ record.startDate }}</span>
          <span class="kind">{{ kindLabel(record.kind) }} · {{ confidenceLabel(record.confidence) }}</span>
          <span>{{ displayTitle(record) }}</span>
        </li>
      </ul>
      <p v-else class="state-empty">当前筛选下没有可见行程（资料{{ loading ? '读取中…' : '已读取' }}）。</p>
      <p v-if="error" class="state-note">{{ error }}</p>
    </section>

    <section class="stage panel" aria-label="地图舞台占位">
      <div class="stage-grid">
        <div class="stage-map">
          <p class="stage-label">地图舞台</p>
          <p class="stage-hint">
            MapLibre 容器（P3 接入）：中国 / 世界视图、航线与铁路、皮肤切换、播放与岁月。
          </p>
        </div>
        <div class="stage-timeline">
          <p class="stage-label">时间线</p>
          <p class="stage-hint">按开始日期排序的行程列表 + 当前一段详情（P3）。</p>
        </div>
      </div>
    </section>

    <PhaseNotice title="重构阶段进度" :items="phases" />
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

.stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 16px;
}

.stage-map,
.stage-timeline {
  position: relative;
  min-height: 300px;
  padding: 18px;
  border: 1px dashed var(--line);
  border-radius: var(--radius);
  background:
    repeating-linear-gradient(135deg, transparent 0 10px, rgba(20, 20, 20, 0.022) 10px 20px), var(--paper);
}

.stage-label {
  margin: 0;
  font-family: var(--sans);
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
}

.stage-hint {
  max-width: 40ch;
  margin: 10px 0 0;
  font-size: 13.5px;
  color: var(--ink-soft);
}

@media (max-width: 860px) {
  .stage-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
