<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
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
  Terminal as TerminalIcon,
  FolderOpen,
  MoreHorizontal,
  ChevronDown,
  ChevronUp
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
let spawnPty: () => Promise<void> = async () => {}

function fitTerminalAndNotifyPty() {
  if (!fitAddon || !term) return

  try {
    fitAddon.fit()
    ws.sendCommand('pty_resize', {
      sessionId: props.pane.sessionId,
      cols: term.cols,
      rows: term.rows,
    }).catch(() => {})
  } catch (_) {}
}

const isFocused = computed(() => gridStore.focusedPaneId === props.pane.id)
const isZoomed = computed(() => gridStore.zoomedPaneId === props.pane.id)

const showCwdModal = ref(false)
const showPaneMenu = ref(false)
const isFooterCollapsed = ref(false)
const paneMenuRoot = ref<HTMLElement | null>(null)
const cwdInput = ref('')
const cwdDirs = ref<string[]>([])
const cwdLoading = ref(false)
const cwdFilter = ref('')

function openFolderPicker() {
  showPaneMenu.value = false
  cwdInput.value = props.pane.cwd || ''
  showCwdModal.value = true
}

function togglePaneZoom() {
  showPaneMenu.value = false
  gridStore.toggleZoom(props.pane.id)
}

function closeMenuOnOutsidePointer(event: PointerEvent) {
  if (!paneMenuRoot.value?.contains(event.target as Node)) {
    showPaneMenu.value = false
  }
}

watch(showPaneMenu, (open) => {
  if (open) window.addEventListener('pointerdown', closeMenuOnOutsidePointer)
  else window.removeEventListener('pointerdown', closeMenuOnOutsidePointer)
})

async function fetchDirs(path: string) {
  cwdLoading.value = true
  try {
    const res = await ws.sendCommand('list_dirs', { path })
    cwdDirs.value = res.dirs || []
    cwdInput.value = res.current || path
  } catch (e) {
  } finally {
    cwdLoading.value = false
  }
}

watch(showCwdModal, (v) => {
  if (v) {
    cwdFilter.value = ''
    fetchDirs(cwdInput.value)
  }
})

const filteredDirs = computed(() => {
  if (!cwdFilter.value) return cwdDirs.value
  return cwdDirs.value.filter(d => d.toLowerCase().includes(cwdFilter.value.toLowerCase()))
})

function selectDir(d: string) {
  if (d === '..') {
    const parts = cwdInput.value.replace(/\/$/, '').split('/')
    parts.pop()
    cwdInput.value = parts.join('/') || '/'
  } else {
    cwdInput.value = cwdInput.value.replace(/\/$/, '') + '/' + d
  }
  cwdFilter.value = ''
  fetchDirs(cwdInput.value)
}

async function changeWorkingDirectory() {
  if (cwdInput.value.trim() && cwdInput.value.trim() !== props.pane.cwd) {
    gridStore.updatePaneCwd(props.pane.id, cwdInput.value.trim())
    // Kill existing PTY
    try {
      await ws.sendCommand('pty_kill', { sessionId: props.pane.sessionId })
    } catch (e) {}
    term?.reset()
    term?.write(`\x1b[36mRestarting in ${cwdInput.value.trim()}...\x1b[0m\r\n`)
    spawnPty()
  }
  showCwdModal.value = false
}

onMounted(async () => {
  if (!terminalEl.value) return

  // Connect WebSocket if not connected
  ws.connect()

  const initialPalette = settingsStore.getActiveTerminalPalette()

  // Initialize Xterm with Google Sans Code font family aligned with nio-de-app
  term = new Terminal({
    fontFamily: settingsStore.terminalFont,
    fontSize: settingsStore.terminalFontSize,
    lineHeight: 1.25,
    cursorBlink: settingsStore.cursorBlink,
    cursorStyle: settingsStore.cursorStyle,
    theme: initialPalette,
    allowProposedApi: true,
  })
  
  term.onSelectionChange(() => {
    if (settingsStore.copyOnSelect && term!.hasSelection()) {
      const text = term!.getSelection()
      if (text) {
        navigator.clipboard.writeText(text).catch(() => {})
      }
    }
  })

  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.loadAddon(new WebLinksAddon())
  term.loadAddon(new Unicode11Addon())
  term.unicode.activeVersion = '11'

  term.open(terminalEl.value)
  fitAddon.fit()
  const initialFontsReady = document.fonts.ready.then(fitTerminalAndNotifyPty)

  // Watch for theme and font changes and update terminal in real-time
  watch(
    () => [
      settingsStore.terminalTheme,
      settingsStore.terminalFont,
      settingsStore.terminalFontSize,
      settingsStore.cursorStyle,
      settingsStore.cursorBlink
    ],
    () => {
      if (term) {
        term.options.theme = settingsStore.getActiveTerminalPalette()
        term.options.fontFamily = settingsStore.terminalFont
        term.options.fontSize = settingsStore.terminalFontSize
        term.options.cursorStyle = settingsStore.cursorStyle
        term.options.cursorBlink = settingsStore.cursorBlink
        document.fonts.load(`${settingsStore.terminalFontSize}px "${settingsStore.terminalFont}"`)
          .then(fitTerminalAndNotifyPty)
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
  spawnPty = async () => {
    await initialFontsReady
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
        fitTerminalAndNotifyPty()
      }
    }, 60)
  })

  resizeObserver.observe(terminalEl.value)
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', closeMenuOnOutsidePointer)
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
    :data-pane-index="index"
    @click="handleFocus"
    :class="[
      'flex flex-col h-full w-full rounded-md overflow-hidden transition-all border select-none',
      isFocused
        ? 'border-primary ring-1 ring-primary/30 shadow-sm'
        : 'border-border hover:border-border/80'
    ]"
    :style="{ backgroundColor: settingsStore.getActiveTerminalPalette().background }"
  >
    <!-- Pane Header -->
    <div 
      class="h-7 px-2.5 bg-card border-b border-border flex items-center justify-between text-xs shrink-0 select-none cursor-pointer"
      :class="{ 'bg-secondary/70': isFocused }"
    >
      <div class="flex items-center gap-2 truncate flex-1 pr-2">
        <!-- Index indicator -->
        <span class="font-mono text-[10px] text-muted-foreground shrink-0">#{{ pane.sequenceId }}</span>

        <!-- Shell or Agent icon -->
        <Bot v-if="pane.shell === 'nio'" class="w-3.5 h-3.5 text-primary shrink-0" />
        <TerminalIcon v-else class="w-3.5 h-3.5 text-muted-foreground shrink-0" />

        <!-- Title -->
        <span class="font-normal text-[11px] truncate text-foreground shrink-0">{{ pane.title }}</span>

      </div>

      <!-- Action buttons -->
      <div class="flex items-center gap-1 shrink-0">
        <div ref="paneMenuRoot" class="relative">
          <Button
            variant="ghost"
            size="icon"
            @click.stop="showPaneMenu = !showPaneMenu"
            @keydown.esc.stop="showPaneMenu = false"
            title="Pane actions"
            :aria-expanded="showPaneMenu"
            class="h-5 w-5 text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal class="w-3.5 h-3.5" />
          </Button>

          <div
            v-if="showPaneMenu"
            class="absolute right-0 top-full z-50 mt-1 min-w-40 rounded-md border border-border bg-card p-1 shadow-lg"
            @pointerdown.stop
            @click.stop
          >
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-muted"
              @click="openFolderPicker"
            >
              <FolderOpen class="h-3.5 w-3.5 text-muted-foreground" />
              Change folder
            </button>
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-muted"
              @click="togglePaneZoom"
            >
              <Minimize2 v-if="isZoomed" class="h-3.5 w-3.5 text-primary" />
              <Maximize2 v-else class="h-3.5 w-3.5 text-muted-foreground" />
              {{ isZoomed ? 'Restore grid' : 'Fullscreen pane' }}
            </button>
          </div>
        </div>

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

    <!-- Pane Footer -->
    <div v-if="!isFooterCollapsed" class="h-6 shrink-0 border-t border-border bg-muted/60 px-2 flex items-center justify-between gap-2 text-[10px]">
      <div class="flex min-w-0 flex-1 items-center gap-1.5">
        <span class="shrink-0 text-muted-foreground">{{ pane.shell === 'nio' ? 'Agent' : 'Shell' }}</span>
        <Badge v-if="pane.shell === 'nio'" variant="outline" class="h-3.5 shrink-0 border-primary/40 bg-primary/10 px-1 text-[9px] text-primary">
          NioAI
        </Badge>
        <button
          type="button"
          class="inline-flex h-4 min-w-0 items-center rounded-full border border-border/70 bg-muted/50 px-1.5 text-[9px] leading-none text-muted-foreground font-mono truncate hover:border-primary/40 hover:bg-primary/5 hover:text-foreground transition-colors"
          :title="`Change working directory: ${pane.cwd}`"
          @click.stop="openFolderPicker"
        >
          <FolderOpen class="mr-1 h-2.5 w-2.5 shrink-0" />
          {{ pane.cwd }}
        </button>
      </div>
      <Button
        variant="ghost"
        size="icon"
        class="h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground"
        title="Collapse pane footer"
        @click.stop="isFooterCollapsed = true"
      >
        <ChevronDown class="h-3 w-3" />
      </Button>
    </div>
    <div v-else class="h-4 shrink-0 flex items-center justify-end border-t border-border/70 bg-muted/50 px-1">
      <Button
        variant="ghost"
        size="icon"
        class="h-4 w-4 text-muted-foreground hover:text-foreground"
        title="Expand pane footer"
        @click.stop="isFooterCollapsed = false"
      >
        <ChevronUp class="h-3 w-3" />
      </Button>
    </div>

    <!-- Change Directory Modal -->
    <Teleport to="body">
      <div 
        v-if="showCwdModal" 
        class="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        @mousedown.self="showCwdModal = false"
      >
        <div class="bg-card border border-border rounded-lg shadow-2xl max-w-sm w-full flex flex-col overflow-hidden">
          <div class="p-4 flex flex-col gap-3">
            <div class="text-sm font-medium text-foreground">Change Working Directory</div>
            <div class="flex items-center gap-2">
              <input
                v-model="cwdInput"
                @keydown.enter.prevent="fetchDirs(cwdInput)"
                type="text"
                class="flex-1 h-8 px-2.5 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:border-primary font-mono"
                placeholder="/path/to/folder"
              />
              <Button variant="outline" size="sm" class="h-8" @click="fetchDirs(cwdInput)">Go</Button>
            </div>
            <input
              v-model="cwdFilter"
              type="text"
              class="w-full h-8 px-2.5 rounded-md border border-border bg-muted/30 text-foreground text-xs outline-none focus:border-primary"
              placeholder="Search"
              autofocus
            />
          </div>
          <div class="h-48 overflow-y-auto border-t border-b border-border bg-muted/10 relative">
            <div v-if="cwdLoading" class="absolute inset-0 flex items-center justify-center bg-background/50">
              <span class="text-xs text-muted-foreground">Loading...</span>
            </div>
            <ul v-else-if="filteredDirs.length" class="py-1">
              <li 
                v-for="d in filteredDirs" 
                :key="d"
                @click="selectDir(d)"
                class="px-4 py-1.5 text-xs text-foreground hover:bg-secondary cursor-pointer flex items-center gap-2"
              >
                <FolderOpen class="w-3.5 h-3.5 text-muted-foreground" />
                <span :class="{'font-medium text-primary': d === '..'}">{{ d }}</span>
              </li>
            </ul>
            <div v-else class="p-4 text-center text-xs text-muted-foreground">
              No folders found
            </div>
          </div>
          <div class="p-4 flex justify-end gap-2 bg-muted/20">
            <Button variant="ghost" size="sm" @click="showCwdModal = false">Cancel</Button>
            <Button variant="default" size="sm" @click="changeWorkingDirectory">Restart Pane Here</Button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
