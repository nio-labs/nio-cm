<script setup lang="ts">
import { onMounted } from 'vue'
import TopHeader from './components/layout/TopHeader.vue'
import Sidebar from './components/layout/Sidebar.vue'
import TerminalGrid from './components/terminal/TerminalGrid.vue'
import { useSpatialNav } from './composables/useSpatialNav'
import { useGridStore } from './stores/gridStore'
import { useWebSocket } from './composables/useWebSocket'

useSpatialNav()
const gridStore = useGridStore()
const ws = useWebSocket()

onMounted(() => {
  ws.connect()

  // Auto-spawn first Nio pane if session is empty
  if (gridStore.activePanes.length === 0) {
    gridStore.addPane('nio', undefined, 'NioAI Agent #1')
  }
})
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden font-sans">
    <!-- Top Command Navigation Header -->
    <TopHeader />

    <!-- Main Workspace: Sidebar + Grid -->
    <div class="flex-1 flex w-full min-h-0 overflow-hidden">
      <Sidebar />
      <TerminalGrid />
    </div>

    <!-- Reconnecting Toast Indicator -->
    <div
      v-if="!ws.connected.value && ws.connecting.value"
      class="fixed bottom-3 right-3 bg-card border border-amber-500/40 text-amber-400 text-xs px-3 py-1.5 rounded-md shadow-lg flex items-center gap-2 z-50"
    >
      <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
      Connecting to NioCM daemon (:1422)...
    </div>
  </div>
</template>
