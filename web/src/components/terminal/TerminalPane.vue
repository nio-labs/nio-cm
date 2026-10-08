<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import type { TerminalPane } from '../../types'
import { useGridStore } from '../../stores/gridStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useWebSocket } from '../../composables/useWebSocket'
import Button from '../ui/Button.vue'
import Badge from '../ui/Badge.vue'
import {
  Maximize2,
  Minimize2,
  X,
  Bot,
  Terminal as TerminalIcon
} from 'lucide-vue-next'

const props = defineProps<{
  pane: TerminalPane
  index: number
}>()

const gridStore = useGridStore()
const settingsStore = useSettingsStore()
const ws = useWebSocket()

const terminalEl = ref<HTMLElement | null>(null)
let term: Terminal | null = null
let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
let unbindOutput: (() => void) | null = null
let unbindExit: (() => void) | null = null

const isFocused = computed(() => gridStore.focusedPaneId === props.pane.id)
const isZoomed = computed(() => gridStore.zoomedPaneId === props.pane.id)

onMounted(async () => {
  if (!terminalEl.value) return

  // Connect WebSocket if not connected
  ws.connect()

  const initialPalette = settingsStore.getActiveTerminalPalette()

  // Initialize Xterm with Google Sans Code font family aligned with nio-de-app
  term = new Terminal({
    fontFamily: settingsStore.terminalFont,
    fontSize: 12.5,
    lineHeight: 1.25,
    cursorBlink: true,
    cursorStyle: 'bar',
    theme: initialPalette,
    allowProposedApi: true,
  })

  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.loadAddon(new WebLinksAddon())

  term.open(terminalEl.value)
  fitAddon.fit()

  // Watch for theme and font changes and update terminal in real-time
  watch(
    () => [settingsStore.theme, settingsStore.terminalTheme, settingsStore.terminalFont],
    () => {
      if (term) {
        term.options.theme = settingsStore.getActiveTerminalPalette()
        term.options.fontFamily = settingsStore.terminalFont
        fitAddon?.fit()
      }
    }
  )

  // Send keystrokes to backend PTY
  term.onData((data) => {
    ws.sendCommand('pty_write', {
      sessionId: props.pane.sessionId,
      data,
    }).catch((err) => console.error('pty_write error:', err))
  })

  // Listen for terminal output
  unbindOutput = ws.onEvent('pty_output', (payload) => {
    if (payload.sessionId === props.pane.sessionId && term) {
      term.write(payload.data)
    }
  })

  // Listen for exit
  unbindExit = ws.onEvent('pty_exit', (payload) => {
    if (payload.sessionId === props.pane.sessionId && term) {
      term.write(`\r\n\x1b[90m[Process exited with code ${payload.code}]\x1b[0m\r\n`)
    }
  })

  // Wait for WS connection, then spawn PTY
  const spawnPty = async () => {
    const cols = term?.cols || 80
    const rows = term?.rows || 24

    try {
      await ws.sendCommand('pty_spawn', {
        sessionId: props.pane.sessionId,
        shell: props.pane.shell,
        args: props.pane.args,
        cwd: props.pane.cwd,
        cols,
        rows,
      })
    } catch (e) {
      term?.write(`\r\n\x1b[31mFailed to spawn PTY: ${e}\x1b[0m\r\n`)
    }
  }

  if (ws.connected.value) {
    spawnPty()
  } else {
    const unwatch = watch(ws.connected, (val) => {
      if (val) {
        spawnPty()
        unwatch()
      }
    })
  }

  // Auto-fit on resize with debouncing
  let resizeTimer: any = null
  resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (fitAddon && term) {
        try {
          fitAddon.fit()
          ws.sendCommand('pty_resize', {
            sessionId: props.pane.sessionId,
            cols: term.cols,
            rows: term.rows,
          }).catch(() => {})
        } catch (_) {}
      }
    }, 60)
  })

  resizeObserver.observe(terminalEl.value)
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
  if (unbindOutput) unbindOutput()
  if (unbindExit) unbindExit()
  if (term) term.dispose()
})

function handleFocus() {
  gridStore.setFocused(props.pane.id)
  term?.focus()
}
</script>

<template>
  <div
    @click="handleFocus"
    :class="[
      'flex flex-col h-full w-full rounded-md overflow-hidden transition-all border select-none',
      isFocused
        ? 'border-primary ring-2 ring-primary/40 shadow-sm'
        : 'border-border hover:border-border/80'
    ]"
    :style="{ backgroundColor: settingsStore.getActiveTerminalPalette().background }"
  >
    <!-- Pane Header -->
    <div 
      class="h-7 px-2.5 bg-card border-b border-border flex items-center justify-between text-xs shrink-0 select-none cursor-pointer"
      :class="{ 'bg-secondary/70': isFocused }"
    >
      <div class="flex items-center gap-2 truncate">
        <!-- Index indicator -->
        <span class="font-mono text-[10px] text-muted-foreground">#{{ index + 1 }}</span>

        <!-- Shell or Agent icon -->
        <Bot v-if="pane.shell === 'nio'" class="w-3.5 h-3.5 text-[#008080] shrink-0" />
        <TerminalIcon v-else class="w-3.5 h-3.5 text-muted-foreground shrink-0" />

        <!-- Title -->
        <span class="font-normal text-[11px] truncate text-foreground">{{ pane.title }}</span>

        <!-- Agent Status Badges -->
        <template v-if="pane.shell === 'nio'">
          <Badge variant="outline" class="text-[9px] px-1 py-0 h-3.5 border-[#008080]/40 text-[#008080] bg-[#008080]/10">
            NioAI
          </Badge>
          <Badge variant="outline" class="text-[9px] px-1 py-0 h-3.5 text-muted-foreground">
            {{ pane.agentMetadata?.mode || 'build' }}
          </Badge>
        </template>
      </div>

      <!-- Action buttons -->
      <div class="flex items-center gap-1 shrink-0">
        <!-- Zoom Toggle -->
        <Button
          variant="ghost"
          size="icon"
          @click.stop="gridStore.toggleZoom(pane.id)"
          :title="isZoomed ? 'Restore grid (Alt+Z)' : 'Maximize pane (Alt+Z)'"
          class="h-5 w-5 text-muted-foreground hover:text-foreground"
        >
          <Minimize2 v-if="isZoomed" class="w-3 h-3 text-primary" />
          <Maximize2 v-else class="w-3 h-3" />
        </Button>

        <!-- Close Pane -->
        <Button
          variant="ghost"
          size="icon"
          @click.stop="gridStore.closePane(pane.id)"
          title="Close pane (Alt+W)"
          class="h-5 w-5 text-muted-foreground hover:text-destructive"
        >
          <X class="w-3 h-3" />
        </Button>
      </div>
    </div>

    <!-- Terminal Container -->
    <div class="flex-1 w-full h-full min-h-0 relative">
      <div ref="terminalEl" class="absolute inset-0 w-full h-full"></div>
    </div>
  </div>
</template>
