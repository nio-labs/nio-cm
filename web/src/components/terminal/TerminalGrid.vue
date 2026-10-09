<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGridStore } from '../../stores/gridStore'
import TerminalPane from './TerminalPane.vue'
import Button from '../ui/Button.vue'
import { Bot, Plus, Terminal as TerminalIcon, Sparkles } from 'lucide-vue-next'

const gridStore = useGridStore()
const gridElement = ref<HTMLElement | null>(null)
const columnDividerPositions = ref<number[]>([])
const rowDividerPositions = ref<Array<{ left: number; top: number; width: number }>>([])
const isResizing = ref(false)
const COLUMN_GAP = 6
const ROW_GAP = 6
const MIN_PANE_WIDTH = 320
const MIN_PANE_HEIGHT = 160
let gridResizeObserver: ResizeObserver | null = null

function getTrackSizes(axis: 'columns' | 'rows', count: number) {
  const saved = gridStore.activeSplitRatio[axis]
  if (saved.length === count && saved.every((size) => Number.isFinite(size) && size > 0)) {
    const total = saved.reduce((sum, size) => sum + size, 0)
    return saved.map((size) => size / total)
  }
  return Array.from({ length: count }, () => 1 / count)
}

const columnSizes = computed(() => getTrackSizes('columns', gridStore.gridColumns))
const rowCount = computed(() => Math.ceil(gridStore.activePanes.length / gridStore.gridColumns) || 1)
const rowSizes = computed(() => getTrackSizes('rows', rowCount.value))

const gridStyle = computed(() => {
  if (gridStore.zoomedPaneId) {
    return {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gridTemplateRows: '1fr',
    }
  }

  const cols = gridStore.gridColumns
  const count = gridStore.activePanes.length
  const rows = Math.ceil(count / cols) || 1
  const columnGapTotal = COLUMN_GAP * (cols - 1)
  const rowGapTotal = ROW_GAP * (rows - 1)

  return {
    display: 'grid',
    gridTemplateColumns: columnSizes.value
      .map((size) => `minmax(${MIN_PANE_WIDTH}px, calc(${size * 100}% - ${size * columnGapTotal}px))`)
      .join(' '),
    gridTemplateRows: rowSizes.value
      .map((size) => `minmax(0px, calc(${size * 100}% - ${size * rowGapTotal}px))`)
      .join(' '),
    columnGap: `${COLUMN_GAP}px`,
    rowGap: `${ROW_GAP}px`,
    minWidth: `${cols * MIN_PANE_WIDTH + columnGapTotal}px`,
  }
})

function getPaneStyle(idx: number) {
  const count = gridStore.activePanes.length
  const cols = gridStore.gridColumns
  const rows = Math.ceil(count / cols) || 1
  const extraCells = (cols * rows) - count

  if (idx === 0 && extraCells > 0) {
    return { gridRow: `span ${1 + extraCells}` }
  }
  return {}
}

function paneElement(index: number) {
  return gridElement.value?.querySelector<HTMLElement>(`[data-pane-index="${index}"]`) ?? null
}

function hasSpanningPane() {
  return gridStore.gridColumns * rowCount.value > gridStore.activePanes.length
}

function renderedTrackSizes(axis: 'columns' | 'rows', count: number) {
  const spansRows = hasSpanningPane()
  const sizes = Array.from({ length: count }, (_, trackIndex) => {
    const paneIndex = axis === 'columns'
      ? trackIndex
      : spansRows
        ? 1 + trackIndex * (gridStore.gridColumns - 1)
        : trackIndex * gridStore.gridColumns
    const rect = paneElement(paneIndex)?.getBoundingClientRect()
    return rect ? (axis === 'columns' ? rect.width : rect.height) : 0
  })
  const total = sizes.reduce((sum, size) => sum + size, 0)
  return total > 0 ? sizes.map((size) => size / total) : getTrackSizes(axis, count)
}

function updateDividerPositions() {
  const gridRect = gridElement.value?.getBoundingClientRect()
  if (!gridRect) return

  columnDividerPositions.value = Array.from({ length: Math.max(0, gridStore.gridColumns - 1) }, (_, index) => {
    const left = paneElement(index)?.getBoundingClientRect()
    const right = paneElement(index + 1)?.getBoundingClientRect()
    return left && right ? (left.right + right.left) / 2 - gridRect.left : 0
  })

  const spansRows = hasSpanningPane()
  rowDividerPositions.value = Array.from({ length: Math.max(0, rowCount.value - 1) }, (_, index) => {
    const firstPaneIndex = spansRows ? 1 + index * (gridStore.gridColumns - 1) : index * gridStore.gridColumns
    const nextPaneIndex = spansRows ? firstPaneIndex + gridStore.gridColumns - 1 : firstPaneIndex + gridStore.gridColumns
    const upper = paneElement(firstPaneIndex)?.getBoundingClientRect()
    const lower = paneElement(nextPaneIndex)?.getBoundingClientRect()
    const left = spansRows && upper ? upper.left - gridRect.left : 0
    return {
      left,
      top: upper && lower ? (upper.bottom + lower.top) / 2 - gridRect.top : 0,
      width: gridRect.width - left,
    }
  })
}

watch([columnSizes, rowSizes, () => gridStore.activePanes.length], async () => {
  await nextTick()
  requestAnimationFrame(updateDividerPositions)
}, { flush: 'post' })

watch(gridElement, (element) => {
  gridResizeObserver?.disconnect()
  if (element) {
    gridResizeObserver = new ResizeObserver(updateDividerPositions)
    gridResizeObserver.observe(element)
    requestAnimationFrame(updateDividerPositions)
  }
}, { flush: 'post' })

onMounted(() => requestAnimationFrame(updateDividerPositions))

onBeforeUnmount(() => gridResizeObserver?.disconnect())

function startResize(axis: 'columns' | 'rows', dividerIndex: number, event: PointerEvent) {
  if (!gridElement.value) return
  event.preventDefault()
  event.stopPropagation()

  const bounds = gridElement.value.getBoundingClientRect()
  const trackCount = axis === 'columns' ? gridStore.gridColumns : rowCount.value
  const initialSizes = renderedTrackSizes(axis, trackCount)
  const before = initialSizes.slice(0, dividerIndex).reduce((sum, size) => sum + size, 0)
  const adjacentTotal = initialSizes[dividerIndex] + initialSizes[dividerIndex + 1]
  const dimension = axis === 'columns' ? bounds.width : bounds.height
  const gap = axis === 'columns' ? COLUMN_GAP : ROW_GAP
  const usableDimension = dimension - gap * (trackCount - 1)
  const minTrackSize = axis === 'columns' ? MIN_PANE_WIDTH : MIN_PANE_HEIGHT
  const minAdjacent = Math.min(minTrackSize / usableDimension, adjacentTotal / 2)

  const onMove = (moveEvent: PointerEvent) => {
    const coordinate = axis === 'columns' ? moveEvent.clientX - bounds.left : moveEvent.clientY - bounds.top
    const cumulative = (coordinate - gap * (dividerIndex + 0.5)) / usableDimension
    const firstSize = Math.min(adjacentTotal - minAdjacent, Math.max(minAdjacent, cumulative - before))
    const nextSizes = [...initialSizes]
    nextSizes[dividerIndex] = firstSize
    nextSizes[dividerIndex + 1] = adjacentTotal - firstSize
    gridStore.setSplitSizes(axis, nextSizes)
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    document.body.style.cursor = ''
    isResizing.value = false
  }

  isResizing.value = true
  document.body.style.cursor = axis === 'columns' ? 'col-resize' : 'row-resize'
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
  window.addEventListener('pointercancel', onUp, { once: true })
}
</script>

<template>
  <div class="flex-1 w-full h-full min-h-0 bg-background p-1.5 overflow-auto relative select-none">
    <!-- Zoomed Pane View -->
    <template v-if="gridStore.zoomedPaneId">
      <div class="w-full h-full">
        <template v-for="(pane, idx) in gridStore.activePanes" :key="pane.id">
          <TerminalPane 
            v-if="pane.id === gridStore.zoomedPaneId" 
            :pane="pane" 
            :index="idx" 
          />
        </template>
      </div>
    </template>

    <!-- Normal Grid View -->
    <template v-else-if="gridStore.activePanes.length > 0">
      <div ref="gridElement" :style="gridStyle" class="relative w-full h-full">
        <TerminalPane
          v-for="(pane, idx) in gridStore.activePanes"
          :key="pane.id"
          :pane="pane"
          :index="idx"
          :style="getPaneStyle(idx)"
        />

        <div
          v-for="dividerIndex in Math.max(0, gridStore.gridColumns - 1)"
          :key="`column-divider-${dividerIndex}`"
          class="absolute top-0 bottom-0 z-20 flex w-2 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center bg-transparent group"
          :style="{ left: `${columnDividerPositions[dividerIndex - 1]}px` }"
          @pointerdown="startResize('columns', dividerIndex - 1, $event)"
        >
          <span :class="['h-full w-px bg-primary transition-opacity group-hover:opacity-100', isResizing ? 'opacity-100' : 'opacity-0']" />
        </div>

        <div
          v-for="dividerIndex in Math.max(0, rowCount - 1)"
          :key="`row-divider-${dividerIndex}`"
          class="absolute z-20 flex h-2 cursor-row-resize touch-none items-center justify-center bg-transparent group -translate-y-1/2"
          :style="{
            left: `${rowDividerPositions[dividerIndex - 1]?.left ?? 0}px`,
            top: `${rowDividerPositions[dividerIndex - 1]?.top ?? 0}px`,
            width: `${rowDividerPositions[dividerIndex - 1]?.width ?? 0}px`
          }"
          @pointerdown="startResize('rows', dividerIndex - 1, $event)"
        >
          <span :class="['h-px w-full bg-primary transition-opacity group-hover:opacity-100', isResizing ? 'opacity-100' : 'opacity-0']" />
        </div>
      </div>
    </template>

    <!-- Empty State -->
    <template v-else>
      <div class="h-full w-full flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div class="h-16 w-16 rounded-2xl bg-[#008080]/10 border border-[#008080]/30 flex items-center justify-center text-primary shadow-inner">
          <Bot class="w-8 h-8 animate-pulse text-[#008080]" />
        </div>

        <div class="space-y-1 max-w-sm">
          <h3 class="text-base font-normal text-foreground">Welcome to NioCM</h3>
          <p class="text-xs text-muted-foreground leading-relaxed">
            The Agentic Terminal. Spawn a multi-pane grid with NioAI at the heart of your workflow.
          </p>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <Button 
            variant="default" 
            size="sm" 
            @click="gridStore.addPane('nio')"
            class="gap-1.5 shadow-md"
          >
            <Sparkles class="w-3.5 h-3.5" />
            Launch NioAI Agent
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            @click="gridStore.addPane('bash')"
            class="gap-1.5"
          >
            <TerminalIcon class="w-3.5 h-3.5" />
            Standard Shell
          </Button>
        </div>

        <div class="pt-6 flex items-center gap-4 text-[11px] text-muted-foreground/80">
          <span><kbd class="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">Alt + N</kbd> New Pane</span>
          <span><kbd class="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">Alt + Arrows</kbd> Swap</span>
          <span><kbd class="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">Alt + Shift + Arrows</kbd> Navigate</span>
        </div>
      </div>
    </template>
  </div>
</template>
