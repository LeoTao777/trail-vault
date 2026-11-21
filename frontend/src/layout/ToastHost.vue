<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const { items } = storeToRefs(toast)
</script>

<template>
  <div class="toast-host" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="toast">
      <output
        v-for="item in items"
        :key="item.id"
        class="toast"
        :class="`is-${item.tone}`"
        @click="toast.dismiss(item.id)"
      >
        {{ item.message }}
      </output>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  transform: translateX(-50%);
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  max-width: min(88vw, 460px);
  padding: 10px 16px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  background: var(--paper);
  box-shadow: 0 10px 28px rgba(20, 20, 20, 0.16);
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
}

.toast.is-warn {
  border-color: var(--gold);
}

.toast.is-error {
  border-color: var(--red);
  color: var(--red);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
