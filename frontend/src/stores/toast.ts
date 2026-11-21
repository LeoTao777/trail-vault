import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastTone = 'info' | 'warn' | 'error'

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

// 全局轻提示：替代旧版 app.js 里的 flashToast()。
export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([])
  let seq = 0

  function dismiss(id: number): void {
    items.value = items.value.filter((item) => item.id !== id)
  }

  function push(message: string, tone: ToastTone = 'info', duration = 2200): number {
    const id = ++seq
    items.value = [...items.value, { id, message, tone }]
    if (duration > 0) window.setTimeout(() => dismiss(id), duration)
    return id
  }

  return { items, push, dismiss }
})
