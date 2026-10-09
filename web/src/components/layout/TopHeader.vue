<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useSessionStore } from '../../stores/sessionStore'
import { useGridStore, MAX_PANES } from '../../stores/gridStore'
import { useSettingsStore } from '../../stores/settingsStore'
import Button from '../ui/Button.vue'
import Badge from '../ui/Badge.vue'
import AppModal from '../ui/AppModal.vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import { Robot01Icon, Add01Icon, KeyboardIcon, Settings01Icon, FolderOpenIcon } from '@hugeicons/core-free-icons'

const sessionStore = useSessionStore()
const gridStore = useGridStore()
const settingsStore = useSettingsStore()

const isEditingSession = ref(false)
const sessionNameInput = ref('')
const sessionInput = ref<HTMLInputElement | null>(null)
const showShortcutsModal = ref(false)
const showSettingsModal = ref(false)

async function startEdit() {
  sessionNameInput.value = sessionStore.activeSession.name
  isEditingSession.value = true
  await nextTick()
  sessionInput.value?.focus()
  sessionInput.value?.select()
}

function saveEdit() {
  if (sessionNameInput.value.trim()) {
    sessionStore.renameSession(sessionStore.activeSessionId, sessionNameInput.value.trim())
  }
  isEditingSession.value = false
}
</script>

<template>
  <header class="h-11 border-b border-border bg-card/80 backdrop-blur px-2 flex items-center justify-between select-none shrink-0 z-30">
    <!-- Left: Branding & Session info -->
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2 tracking-tight text-sm">
        <div class="h-6 w-6 rounded-sm overflow-hidden flex items-center justify-center shadow-xs shrink-0">
          <svg viewBox="0 0 2042 2042" class="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg" style="color-scheme: light dark;">
            <rect width="2042" height="2042" rx="300" fill="#008080" style="fill: #008080 !important;" />
            <path d="M570 710L980 1021L570 1332" stroke="white" stroke-width="150" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="1330" cy="1235" r="130" fill="white"/>
          </svg>
        </div>
        <span class="text-foreground font-normal text-sm tracking-tight">
          NioCM
        </span>
        <Badge variant="outline" class="text-[9px] px-1.5 py-0 h-4 border-border font-normal bg-muted/40 text-muted-foreground">
          Agentic Terminal
        </Badge>
      </div>

      <div class="h-4 w-px bg-border mx-1"></div>

      <!-- Current Session Name -->
      <div class="flex items-center gap-1.5 text-xs">
        <HugeiconsIcon :icon="FolderOpenIcon" class="w-3.5 h-3.5 text-muted-foreground" />
        <template v-if="!isEditingSession">
          <span 
            @dblclick="startEdit"
            title="Double-click to rename session"
            class="font-normal text-foreground hover:text-primary transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-muted/60"
          >
            {{ sessionStore.activeSession.name }}
          </span>
        </template>
        <template v-else>
          <input
            ref="sessionInput"
            v-model="sessionNameInput"
            @blur="saveEdit"
            @keyup.enter="saveEdit"
            class="h-6 px-1.5 bg-background border border-primary rounded text-xs outline-none w-36"
          />
        </template>
      </div>
    </div>

    <!-- Right: Actions & Settings -->
    <div class="flex items-center gap-1.5">
      <!-- Add Nio Agent -->
      <Button 
        variant="default" 
        size="sm" 
        @click="gridStore.addPane('nio')"
        :disabled="gridStore.activePanes.length >= MAX_PANES"
        title="Spawn NioAI Agent Pane (Alt+N)"
        class="h-7 text-xs gap-1.5 font-normal"
      >
        <HugeiconsIcon :icon="Robot01Icon" class="w-3.5 h-3.5" />
        <span>+ Nio Agent</span>
      </Button>

      <!-- Add Regular Shell -->
      <Button 
        variant="outline" 
        size="sm" 
        @click="gridStore.addPane('bash')"
        :disabled="gridStore.activePanes.length >= MAX_PANES"
        title="Spawn Shell Pane (Alt+Shift+N)"
        class="h-7 text-xs gap-1 font-normal"
      >
        <HugeiconsIcon :icon="Add01Icon" class="w-3.5 h-3.5" />
        <span>Shell</span>
      </Button>


      <!-- Settings Dialog Button -->
      <Button
        variant="ghost"
        size="icon"
        @click="showSettingsModal = !showSettingsModal"
        title="NioCM Settings"
        class="h-7 w-7 text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon :icon="Settings01Icon" class="w-3.5 h-3.5" />
      </Button>

      <!-- Keyboard shortcuts -->
      <Button
        variant="ghost"
        size="icon"
        @click="showShortcutsModal = !showShortcutsModal"
        title="Keyboard Shortcuts"
        class="h-7 w-7 text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon :icon="KeyboardIcon" class="w-3.5 h-3.5" />
      </Button>

    </div>

    <AppModal v-if="showSettingsModal" title="Settings" description="Make your workspace feel right." @close="showSettingsModal = false">
      <template #icon><HugeiconsIcon :icon="Settings01Icon" class="w-4 h-4" /></template>
          <div class="space-y-5">

    <!-- Terminal theme Setting -->
            <div class="space-y-2">
              <label class="block font-medium text-foreground">Terminal theme</label>
              <select
                :value="settingsStore.terminalTheme"
                @change="settingsStore.setTerminalTheme(($event.target as HTMLSelectElement).value)"
                class="w-full h-9 px-3 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors"
              >
                <option 
                  v-for="t in settingsStore.availableTerminalThemes" 
                  :key="t.value" 
                  :value="t.value"
                >
                  {{ t.label }}
                </option>
              </select>
            </div>

            <!-- Font Family Setting -->
            <div class="space-y-2">
              <label class="block font-medium text-foreground">Font family</label>
              <select
                :value="settingsStore.fontFamily"
                @change="settingsStore.setFontFamily(($event.target as HTMLSelectElement).value)"
                class="w-full h-9 px-3 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors"
              >
                <option 
                  v-for="f in settingsStore.availableFontFamilies" 
                  :key="f.value" 
                  :value="f.value"
                >
                  {{ f.label }}
                </option>
              </select>
            </div>

            <!-- App & UI Scale -->
            <div class="space-y-2">
              <label class="block font-medium text-foreground">Interface scale</label>
              <input 
                type="range" 
                min="0.75" 
                max="1.5" 
                step="0.05"
                :value="settingsStore.uiScale"
                @input="settingsStore.setUiScale(parseFloat(($event.target as HTMLInputElement).value))"
                class="w-full accent-primary cursor-pointer"
              />
              <div class="text-[10px] text-muted-foreground text-right">{{ Math.round(settingsStore.uiScale * 100) }}%</div>
            </div>

            <!-- Terminal Font Size -->
            <div class="space-y-2">
              <label class="block font-medium text-foreground">Terminal font size (px)</label>
              <input 
                type="number" 
                min="8" 
                max="32" 
                step="0.5"
                :value="settingsStore.terminalFontSize"
                @input="settingsStore.setTerminalFontSize(parseFloat(($event.target as HTMLInputElement).value))"
                class="w-full h-9 px-3 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors"
              />
            </div>

            <!-- Terminal Cursor style -->
            <div class="space-y-2">
              <label class="block font-medium text-foreground">Cursor style</label>
              <select
                :value="settingsStore.cursorStyle"
                @change="settingsStore.setCursorStyle(($event.target as HTMLSelectElement).value as 'block' | 'underline' | 'bar')"
                class="w-full h-9 px-3 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors"
              >
                <option value="block">Block</option>
                <option value="underline">Underline</option>
                <option value="bar">Bar</option>
              </select>
            </div>

            <!-- Terminal Toggles -->
            <div class="space-y-3 rounded-lg bg-muted/40 p-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  :checked="settingsStore.cursorBlink"
                  @change="settingsStore.setCursorBlink(($event.target as HTMLInputElement).checked)"
                  class="h-3.5 w-3.5 rounded border-border bg-background accent-primary"
                />
                <span class="block font-medium text-foreground">Blink cursor</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  :checked="settingsStore.copyOnSelect"
                  @change="settingsStore.setCopyOnSelect(($event.target as HTMLInputElement).checked)"
                  class="h-3.5 w-3.5 rounded border-border bg-background accent-primary"
                />
                <span class="block font-medium text-foreground">Copy on select</span>
              </label>
            </div>
          </div>

      <template #footer>
        <span class="mr-auto text-[10px] text-muted-foreground">Changes save automatically</span>
        <Button variant="default" size="sm" @click="showSettingsModal = false">Done</Button>
      </template>
    </AppModal>

    <AppModal v-if="showShortcutsModal" title="Keyboard shortcuts" description="Move between panes and manage your workspace." @close="showShortcutsModal = false">
      <template #icon><HugeiconsIcon :icon="KeyboardIcon" class="w-4 h-4" /></template>
          <div class="space-y-4">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span class="text-foreground">Swap Pane Position</span>
              <kbd class="w-fit shrink-0 whitespace-nowrap px-2 py-1 bg-muted/60 rounded-md text-[10px] text-muted-foreground">Alt + ↑ / ↓ / ← / →</kbd>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span class="text-foreground">Focus Spatial Neighbor</span>
              <kbd class="w-fit shrink-0 whitespace-nowrap px-2 py-1 bg-muted/60 rounded-md text-[10px] text-muted-foreground">Alt + Shift + ↑ / ↓ / ← / →</kbd>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span class="text-foreground">Maximize / Restore Pane</span>
              <kbd class="w-fit shrink-0 whitespace-nowrap px-2 py-1 bg-muted/60 rounded-md text-[10px] text-muted-foreground">Alt + Z or Alt + Enter</kbd>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span class="text-foreground">Spawn New Nio Agent</span>
              <kbd class="w-fit shrink-0 whitespace-nowrap px-2 py-1 bg-muted/60 rounded-md text-[10px] text-muted-foreground">Alt + N</kbd>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span class="text-foreground">Spawn New Shell</span>
              <kbd class="w-fit shrink-0 whitespace-nowrap px-2 py-1 bg-muted/60 rounded-md text-[10px] text-muted-foreground">Alt + Shift + N</kbd>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span class="text-foreground">Close Active Pane</span>
              <kbd class="w-fit shrink-0 whitespace-nowrap px-2 py-1 bg-muted/60 rounded-md text-[10px] text-muted-foreground">Alt + W</kbd>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span class="text-foreground">Jump to Pane 1 to 10</span>
              <kbd class="w-fit shrink-0 whitespace-nowrap px-2 py-1 bg-muted/60 rounded-md text-[10px] text-muted-foreground">Alt + 1 ... Alt + 0</kbd>
            </div>
          </div>

      <template #footer>
        <Button variant="default" size="sm" @click="showShortcutsModal = false">Got it</Button>
      </template>
    </AppModal>
  </header>
</template>
