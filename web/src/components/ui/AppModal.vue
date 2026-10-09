<script setup lang="ts">
import { onMounted, onUnmounted, ref, useId } from 'vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import Button from './Button.vue'

defineProps<{ title: string; description?: string }>()
const emit = defineEmits<{ close: [] }>()
const titleId = useId()
const dialog = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
  if (event.key !== 'Tab' || !dialog.value) return
  const elements = Array.from(dialog.value.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'
  ))
  const first = elements[0]
  const last = elements[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

onMounted(() => {
  previousFocus = document.activeElement as HTMLElement | null
  const target = dialog.value?.querySelector<HTMLElement>('[autofocus]')
    ?? dialog.value?.querySelector<HTMLElement>('button')
  target?.focus()
})
onUnmounted(() => previousFocus?.focus())
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      @mousedown.self="emit('close')"
      @keydown="handleKeydown"
    >
      <div
        ref="dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        class="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
      >
        <div class="flex items-start justify-between gap-4 px-5 py-4 border-b border-border bg-muted/30 shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <slot name="icon" />
            </div>
            <div>
              <h2 :id="titleId" class="text-sm font-medium text-foreground">{{ title }}</h2>
              <p v-if="description" class="mt-0.5 text-[11px] text-muted-foreground">{{ description }}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" :aria-label="`Close ${title.toLowerCase()}`" @click="emit('close')" class="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground">
            <HugeiconsIcon :icon="Cancel01Icon" class="h-3.5 w-3.5" />
          </Button>
        </div>
        <div class="px-5 py-5 text-xs overflow-y-auto min-h-0">
          <slot />
        </div>
        <div class="flex items-center justify-end gap-3 px-5 py-3 border-t border-border bg-muted/30 shrink-0">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
