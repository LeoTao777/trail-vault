<script setup lang="ts">
import PhaseNotice from '@/components/common/PhaseNotice.vue'
import type { PhaseItem } from '@/components/common/phase'

const phases: PhaseItem[] = [
  { label: 'P0 脚手架：Vite + Vue3 + TS + Router + Pinia', done: true },
  { label: 'P1 domain 纯逻辑搬家 + Vitest 数字快照', done: true },
  { label: 'P2 骨架与状态：AppShell / FilterBar / records store', done: false },
  { label: 'P3 地图舞台（MapLibre）+ 播放 + 时间线', done: false },
  { label: 'P4 旅行档案页（统计榜 + 资料明细）', done: false },
  { label: 'P5 录入页（表单 / 地点联想 / 数据工具）', done: false },
]
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
