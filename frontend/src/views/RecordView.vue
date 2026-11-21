<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'

import PhaseNotice from '@/components/common/PhaseNotice.vue'
import type { PhaseItem } from '@/components/common/phase'
import { useRecordsStore } from '@/stores/records'

const store = useRecordsStore()
const { records, message, source, error } = storeToRefs(store)

const phases: PhaseItem[] = [
  { label: 'P2 数据 store 已接通（录入后刷新全站数据）', done: true },
  { label: '路线 / 票据 / 归属三段表单', done: false },
  { label: 'PlaceInput：Photon 地点联想（同名地点可区分）', done: false },
  { label: 'TravelerSelect：下拉时才向 /api/users 取用户', done: false },
  { label: '提交 POST /api/records → 回主页并刷新', done: false },
  { label: '数据工具：导入 / 导出 JSON·CSV、清空全部数据、重载资料', done: false },
]

onMounted(() => {
  void store.ensureLoaded()
})
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

    <section class="panel" aria-label="P2 状态联调">
      <h2 class="state-title">状态联调 · P2</h2>
      <p class="state-note">
        本页不显示筛选栏（筛选状态仍在 store 里保留，回主页 / 档案页时写回地址栏）；
        P5 的「清空全部数据」「重载资料」会调用 store.clearAll() / store.reload()。
      </p>
      <dl class="state-grid">
        <div class="state-cell">
          <dt>资料来源</dt>
          <dd>{{ source }}<small>{{ message }}</small></dd>
        </div>
        <div class="state-cell">
          <dt>全量记录</dt>
          <dd>{{ records.length }}<small>POST /api/records 后自动刷新</small></dd>
        </div>
      </dl>
      <p v-if="error" class="state-note">{{ error }}</p>
    </section>

    <PhaseNotice title="本页待实现（P5）" :items="phases" />
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
