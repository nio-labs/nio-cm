<script setup lang="ts">
import { ref } from 'vue'
import { useSessionStore } from '../../stores/sessionStore'
import { useGridStore, MAX_PANES } from '../../stores/gridStore'
import { useSettingsStore } from '../../stores/settingsStore'
import Button from '../ui/Button.vue'
import Badge from '../ui/Badge.vue'
import {
  Terminal,
  Bot,
  Plus,
  Maximize2,
  Minimize2,
  Keyboard,
  Settings,
  FolderOpen
} from 'lucide-vue-next'

const sessionStore = useSessionStore()
const gridStore = useGridStore()
const settingsStore = useSettingsStore()

const isEditingSession = ref(false)
const sessionNameInput = ref('')
const showShortcutsModal = ref(false)
const showSettingsModal = ref(false)

function startEdit() {
  sessionNameInput.value = sessionStore.activeSession.name
  isEditingSession.value = true
}

function saveEdit() {
  if (sessionNameInput.value.trim()) {
    sessionStore.renameSession(sessionStore.activeSessionId, sessionNameInput.value.trim())
  }
  isEditingSession.value = false
}
</script>

<template>
  <header class="h-11 border-b border-border bg-card/80 backdrop-blur px-3 flex items-center justify-between select-none shrink-0 z-30">
    <!-- Left: Branding & Session info -->
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2 tracking-tight text-sm">
        <div class="h-6 w-6 rounded-lg overflow-hidden flex items-center justify-center shadow-xs shrink-0">
          <svg viewBox="0 0 2042 2042" class="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg" style="color-scheme: light dark;">
            <rect width="2042" height="2042" rx="420" fill="#008080" style="fill: #008080 !important;" />
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
        <FolderOpen class="w-3.5 h-3.5 text-muted-foreground" />
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
            v-model="sessionNameInput"
            @blur="saveEdit"
            @keyup.enter="saveEdit"
            class="h-6 px-1.5 bg-background border border-primary rounded text-xs outline-none w-36"
            autoFocus
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
        <Bot class="w-3.5 h-3.5" />
        <span>+ Nio Agent</span>
      </Button>

      <!-- Add Regular Shell -->
      <Button 
        variant="outline" 
        size="sm" 
        @click="gridStore.addPane('bash')"
        :disabled="gridStore.activePanes.length >= MAX_PANES"
        title="Spawn Shell Pane"
        class="h-7 text-xs gap-1 font-normal"
      >
        <Plus class="w-3.5 h-3.5" />
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
        <Settings class="w-3.5 h-3.5" />
      </Button>

      <!-- Keyboard shortcuts -->
      <Button
        variant="ghost"
        size="icon"
        @click="showShortcutsModal = !showShortcutsModal"
        title="Keyboard Shortcuts"
        class="h-7 w-7 text-muted-foreground hover:text-foreground"
      >
        <Keyboard class="w-3.5 h-3.5" />
      </Button>

    </div>

    <!-- Settings Modal -->
    <Teleport to="body">
      <div 
        v-if="showSettingsModal" 
        class="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
        @click.self="showSettingsModal = false"
      >
        <div class="bg-card border border-border rounded-lg shadow-2xl max-w-md w-full p-5 space-y-4 my-auto">
          <div class="flex items-center justify-between pb-2 border-b border-border">
            <div class="flex items-center gap-2 font-normal text-sm">
              <Settings class="w-4 h-4 text-primary" />
              <span>NioCM Settings</span>
            </div>
            <Button variant="ghost" size="icon" @click="showSettingsModal = false" class="h-6 w-6">✕</Button>
          </div>

          <div class="space-y-4 text-xs">

    <!-- Terminal Theme Setting -->
            <div class="space-y-1.5">
              <label class="font-normal text-foreground">Terminal Theme</label>
              <select
                :value="settingsStore.terminalTheme"
                @change="settingsStore.setTerminalTheme(($event.target as HTMLSelectElement).value)"
                class="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
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
            <div class="space-y-1.5 pt-2 border-t border-border">
              <label class="font-normal text-foreground">Typography (System & Terminal Font)</label>
              <select
                :value="settingsStore.fontFamily"
                @change="settingsStore.setFontFamily(($event.target as HTMLSelectElement).value)"
                class="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
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
            <div class="space-y-1.5 pt-2 border-t border-border">
              <label class="font-normal text-foreground">App UI Scale</label>
              <input 
                type="range" 
                min="0.75" 
                max="1.5" 
                step="0.05"
                :value="settingsStore.uiScale"
                @input="settingsStore.setUiScale(parseFloat(($event.target as HTMLInputElement).value))"
                class="w-full"
              />
              <div class="text-[10px] text-muted-foreground text-right">{{ Math.round(settingsStore.uiScale * 100) }}%</div>
            </div>

            <!-- Terminal Font Size -->
            <div class="space-y-1.5 pt-2 border-t border-border">
              <label class="font-normal text-foreground">Terminal Font Size (px)</label>
              <input 
                type="number" 
                min="8" 
                max="32" 
                step="0.5"
                :value="settingsStore.terminalFontSize"
                @input="settingsStore.setTerminalFontSize(parseFloat(($event.target as HTMLInputElement).value))"
                class="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
              />
            </div>

            <!-- Terminal Cursor Style -->
            <div class="space-y-1.5 pt-2 border-t border-border">
              <label class="font-normal text-foreground">Cursor Style</label>
              <select
                :value="settingsStore.cursorStyle"
                @change="settingsStore.setCursorStyle(($event.target as HTMLSelectElement).value as 'block' | 'underline' | 'bar')"
                class="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
              >
                <option value="block">Block</option>
                <option value="underline">Underline</option>
                <option value="bar">Bar</option>
              </select>
            </div>

            <!-- Terminal Toggles -->
            <div class="space-y-2 pt-2 border-t border-border">
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  :checked="settingsStore.cursorBlink"
                  @change="settingsStore.setCursorBlink(($event.target as HTMLInputElement).checked)"
                  class="rounded border-border bg-background text-primary"
                />
                <span class="font-normal text-foreground">Blink Cursor</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  :checked="settingsStore.copyOnSelect"
                  @change="settingsStore.setCopyOnSelect(($event.target as HTMLInputElement).checked)"
                  class="rounded border-border bg-background text-primary"
                />
                <span class="font-normal text-foreground">Copy on Select</span>
              </label>
            </div>
          </div>

          <div class="pt-2 flex justify-end">
            <Button variant="default" size="sm" @click="showSettingsModal = false">Close</Button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Shortcuts Dialog Modal -->
    <Teleport to="body">
      <div 
        v-if="showShortcutsModal" 
        class="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
        @click.self="showShortcutsModal = false"
      >
        <div class="bg-card border border-border rounded-lg shadow-2xl max-w-md w-full p-5 space-y-4 my-auto">
          <div class="flex items-center justify-between pb-2 border-b border-border">
            <div class="flex items-center gap-2 font-normal text-sm">
              <Keyboard class="w-4 h-4 text-primary" />
              <span>NioCM Spatial Shortcuts</span>
            </div>
            <Button variant="ghost" size="icon" @click="showShortcutsModal = false" class="h-6 w-6">✕</Button>
          </div>

          <div class="space-y-2 text-xs">
            <div class="flex justify-between py-1 border-b border-border/50">
              <span class="text-muted-foreground font-normal">Swap Pane Position</span>
              <kbd class="px-1.5 py-0.5 bg-muted rounded text-[10px] font-normal">Alt + ↑ / ↓ / ← / →</kbd>
            </div>
            <div class="flex justify-between py-1 border-b border-border/50">
              <span class="text-muted-foreground font-normal">Focus Spatial Neighbor</span>
              <kbd class="px-1.5 py-0.5 bg-muted rounded text-[10px] font-normal">Alt + Shift + ↑ / ↓ / ← / →</kbd>
            </div>
            <div class="flex justify-between py-1 border-b border-border/50">
              <span class="text-muted-foreground font-normal">Maximize / Restore Pane</span>
              <kbd class="px-1.5 py-0.5 bg-muted rounded text-[10px] font-normal">Alt + Z or Alt + Enter</kbd>
            </div>
            <div class="flex justify-between py-1 border-b border-border/50">
              <span class="text-muted-foreground font-normal">Spawn New Nio Agent</span>
              <kbd class="px-1.5 py-0.5 bg-muted rounded text-[10px] font-normal">Alt + N</kbd>
            </div>
            <div class="flex justify-between py-1 border-b border-border/50">
              <span class="text-muted-foreground font-normal">Close Active Pane</span>
              <kbd class="px-1.5 py-0.5 bg-muted rounded text-[10px] font-normal">Alt + W</kbd>
            </div>
            <div class="flex justify-between py-1 border-b border-border/50">
              <span class="text-muted-foreground font-normal">Jump to Pane 1 to 10</span>
              <kbd class="px-1.5 py-0.5 bg-muted rounded text-[10px] font-normal">Alt + 1 ... Alt + 0</kbd>
            </div>
          </div>

          <div class="pt-2 flex justify-end">
            <Button variant="default" size="sm" @click="showShortcutsModal = false">Got it</Button>
          </div>
        </div>
      </div>
    </Teleport>
  </header>
</template>
