<script setup lang="ts">
import { computed } from 'vue'
import { useGridStore } from '../../stores/gridStore'
import TerminalPane from './TerminalPane.vue'
import Button from '../ui/Button.vue'
import { Bot, Plus, Terminal as TerminalIcon, Sparkles } from 'lucide-vue-next'

const gridStore = useGridStore()

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

  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
    gap: '6px',
  }
})
</script>

<template>
  <div class="flex-1 w-full h-full min-h-0 bg-background p-1.5 overflow-hidden relative select-none">
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
      <div :style="gridStyle" class="w-full h-full">
        <TerminalPane
          v-for="(pane, idx) in gridStore.activePanes"
          :key="pane.id"
          :pane="pane"
          :index="idx"
        />
      </div>
    </template>

    <!-- Empty State -->
    <template v-else>
      <div class="h-full w-full flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div class="h-16 w-16 rounded-2xl bg-[#008080]/10 border border-[#008080]/30 flex items-center justify-center text-primary shadow-inner">
          <Bot class="w-8 h-8 animate-pulse text-[#008080] dark:text-teal-400" />
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
          <span><kbd class="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">Alt + Arrows</kbd> Navigate</span>
          <span><kbd class="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">Alt + Shift + Arrows</kbd> Swap</span>
        </div>
      </div>
    </template>
  </div>
</template>
