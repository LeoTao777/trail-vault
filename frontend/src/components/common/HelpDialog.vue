<script setup lang="ts">
/**
 * 使用说明（P2）：把旧版 HELP_HTML 模板化，彻底去掉 v-html / innerHTML。
 * 内容是静态常量文案，Vue 模板自动转义；Esc / 点遮罩 / 关闭按钮都可关，Tab 焦点锁在弹层内。
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null

function close(): void {
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return

  const focusable = Array.from(
    dialog.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  )
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', onKeydown)
      void nextTick(() => closeButton.value?.focus())
    } else {
      document.removeEventListener('keydown', onKeydown)
      previousFocus?.focus()
      previousFocus = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="dialog-overlay" @mousedown.self="close">
        <div
          ref="dialog"
          class="dialog-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-dialog-title"
        >
          <header class="dialog-head">
            <h2 id="help-dialog-title" class="dialog-title">使用说明</h2>
            <button
              ref="closeButton"
              type="button"
              class="dialog-close"
              aria-label="关闭使用说明"
              @click="close"
            >
              ×
            </button>
          </header>

          <div class="dialog-body">
            <section>
              <h3>这是什么</h3>
              <p>
                把差旅票据整理成一张会「生长」的个人行旅地图：每段行程一条线，去过的城市点亮，
                可按时间播放、可导出海报。数据来自后端接口，断网时回退到本机缓存或内置演示资料。
              </p>
            </section>

            <section>
              <h3>三个页面</h3>
              <ul>
                <li><b>地图 · 时间线</b>：地图舞台、播放与年份生长、行程列表与「当前一段」详情。</li>
                <li><b>录入</b>：路线 / 票据 / 归属表单、地点联想、票据文本试填，以及导入导出、清空、重载等数据工具。</li>
                <li><b>旅行档案</b>：五个 Hero 指标、六个榜单与全部记录的资料明细表。</li>
              </ul>
            </section>

            <section>
              <h3>筛选条件与链接</h3>
              <p>
                年份 / 旅客 / 类型 / 证据四个筛选由主页与档案页共用，写进地址栏的 query，
                所以链接可以收藏、可以直接刷新、浏览器前进后退也能还原口径；默认口径不写参数，链接保持干净。
                档案页里点一行会跳回 <code>/?focus=&lt;id&gt;</code> 并高亮对应的一段。
              </p>
            </section>

            <section>
              <h3>底部五个指标（跟随当前筛选实时算）</h3>
              <ul>
                <li><b>在路天数</b>：计入「在外过夜」的总天数。</li>
                <li><b>可见花销</b>：当前可见记录的金额合计。</li>
                <li><b>移动小时</b>：有时长的 航班、铁路、地面/水路 段累加。</li>
                <li><b>点亮城市</b>：到访过的城市数。</li>
                <li>
                  <b>待补字段</b>：当前可见记录里还缺的字段数（证据 / 时长 / 金额）。换筛选数会变——
                  它统计的是「当前这批记录」的缺口，不是 bug。
                </li>
              </ul>
            </section>

            <section>
              <h3>置信度 = 这段行程有多确定</h3>
              <ul>
                <li><b>已确认</b>：有票 / 订单等确凿证据。</li>
                <li><b>部分确认</b>：大致能确认，细节或归属待核。</li>
                <li><b>推定</b>：靠行程链或旁证推断。</li>
                <li>
                  <b>缺口·待补段</b>：还没录的连接段。选这一档会动态列出「到达地 ≠ 下一段出发地」的断点，
                  这些占位段不写库、不画线、不进统计。
                </li>
              </ul>
            </section>

            <section>
              <h3>配色 / 海报 / 播放</h3>
              <p>
                浅色与深色配色分组，地名文字随主题色走。「行旅海报」可选尺寸 / 范围 / 指标导出 PNG；
                范围只决定地图画多大，指标始终是「当前筛选」的总数。播放旅程从最早一段按时间生长，
                镜头跟随，可暂停、继续、重播、停止。
              </p>
            </section>

            <section>
              <h3>录入口径</h3>
              <p>
                只录能证明本人真实出行的段：付款人 ≠ 出行人、退票 / 改签不点亮，金额与时间只填票面能看到的，
                不猜。图例里的 航线 / 铁路 / 停留 / 地面·水路 / 费用层 对应地图上不同颜色的线。
              </p>
            </section>
          </div>

          <footer class="dialog-foot">
            <span>票据图像 OCR 未开放，录入页只提供「粘贴文本试填」。</span>
            <button type="button" class="btn btn-primary" @click="close">知道了</button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(20, 20, 20, 0.46);
  backdrop-filter: blur(3px);
}

.dialog-panel {
  display: flex;
  flex-direction: column;
  width: min(680px, 100%);
  max-height: min(86vh, 780px);
  border: 1px solid var(--line-strong);
  border-radius: calc(var(--radius) + 4px);
  background: var(--paper);
  box-shadow: 0 24px 70px rgba(20, 20, 20, 0.28);
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}

.dialog-title {
  margin: 0;
  font-size: 18px;
  letter-spacing: 0.06em;
}

.dialog-close {
  width: 32px;
  height: 32px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: transparent;
  font-size: 20px;
  line-height: 1;
}

.dialog-close:hover {
  background: var(--paper-warm);
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 20px 16px;
  font-size: 13.5px;
  line-height: 1.75;
}

.dialog-body section {
  padding: 12px 0;
  border-bottom: 1px dashed var(--line);
}

.dialog-body section:last-child {
  border-bottom: 0;
}

.dialog-body h3 {
  margin: 0 0 6px;
  font-family: var(--sans);
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--red);
}

.dialog-body p,
.dialog-body ul {
  margin: 0;
  color: var(--ink-soft);
}

.dialog-body ul {
  padding-left: 1.2em;
}

.dialog-body li {
  margin: 3px 0;
}

.dialog-body code {
  font-family: var(--mono);
  font-size: 12px;
}

.dialog-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--line);
  font-family: var(--sans);
  font-size: 11.5px;
  color: var(--muted);
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.18s ease;
}

.dialog-enter-active .dialog-panel,
.dialog-leave-active .dialog-panel {
  transition: transform 0.18s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .dialog-panel,
.dialog-leave-to .dialog-panel {
  transform: translateY(10px);
}

@media (max-width: 480px) {
  .dialog-overlay {
    padding: 10px;
  }

  .dialog-body {
    padding-inline: 14px;
  }
}
</style>
