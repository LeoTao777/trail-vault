<script setup lang="ts">
import PhaseNotice from '@/components/common/PhaseNotice.vue'
import type { PhaseItem } from '@/components/common/phase'

const phases: PhaseItem[] = [
  { label: '路线 / 票据 / 归属三段表单', done: false },
  { label: 'PlaceInput：Photon 地点联想（同名地点可区分）', done: false },
  { label: 'TravelerSelect：下拉时才向 /api/users 取用户', done: false },
  { label: '提交 POST /api/records → 回主页并刷新', done: false },
  { label: '数据工具：导入 / 导出 JSON·CSV、清空全部数据、重载资料', done: false },
]
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-kicker">RECORD · NEW JOURNEY</p>
        <h1 class="page-title">录入</h1>
        <p class="page-desc">
          只录能证明本人真实出行的段：出发地 / 到达地支持任意真实地名联想，票据信息按票面填写。
          「清空全部数据」「重载资料」等数据操作集中在本页的「数据工具」区。
        </p>
      </div>
      <span class="badge">/record</span>
    </header>

    <PhaseNotice title="本页待实现（P5）" :items="phases" />
  </div>
</template>
