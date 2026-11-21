<script setup lang="ts">
import PhaseNotice from '@/components/common/PhaseNotice.vue'
import type { PhaseItem } from '@/components/common/phase'

const phases: PhaseItem[] = [
  { label: '5 个 Hero 指标（里程 / 出行 / 城市 / 国家 / 大洲）', done: false },
  { label: '6 个榜单：城市停留、高频路线、国家、年度、出行方式', done: false },
  { label: '资料明细表 + 表内搜索、命中高亮、跳主页聚焦', done: false },
  { label: '口径标签：年份 · 旅客 · 类型 · 证据', done: false },
]
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

    <PhaseNotice title="本页待实现（P4）" :items="phases" />
  </div>
</template>
