<script setup lang="ts">
import { ref } from 'vue'
import { useSessionStore } from '../../stores/sessionStore'
import Button from '../ui/Button.vue'
import {
  FolderKanban,
  Plus,
  Trash2,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-vue-next'

const sessionStore = useSessionStore()

const isCollapsed = ref(false)
const editingId = ref<string | null>(null)
const editName = ref('')
function startEdit(id: string, currentName: string) {
  editingId.value = id
  editName.value = currentName
}

function saveEdit() {
  if (editingId.value && editName.value.trim()) {
    sessionStore.renameSession(editingId.value, editName.value.trim())
  }
  editingId.value = null
}
</script>

<template>
  <aside 
    :class="[
      'border-r border-border bg-card/60 flex flex-col justify-between select-none shrink-0 text-xs transition-all duration-300',
      isCollapsed ? 'w-12 items-center' : 'w-56'
    ]"
  >
    <!-- Sessions Section -->
    <div class="p-2 space-y-3 overflow-y-auto flex-1 w-full flex flex-col" :class="isCollapsed ? 'items-center' : ''">
      <div :class="['flex items-center justify-between', isCollapsed ? 'flex-col gap-2 px-0 pt-1' : 'px-2 pt-1']">
        <span 
          v-if="!isCollapsed" 
          class="text-[11px] font-normal text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"
        >
          <FolderKanban class="w-3.5 h-3.5" />
          Sessions
        </span>
        <Button 
          variant="ghost" 
          size="icon" 
          @click="isCollapsed = !isCollapsed"
          class="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
          :title="isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
        >
          <PanelLeftOpen v-if="isCollapsed" class="w-4 h-4" />
          <PanelLeftClose v-else class="w-4 h-4" />
        </Button>
      </div>

      <Button 
        v-if="!isCollapsed"
        variant="ghost" 
        class="w-full justify-start gap-2 h-7 px-2.5 font-normal text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/80 shrink-0"
        @click="sessionStore.createSession('Default Workspace')"
      >
        <Plus class="w-3.5 h-3.5" />
        New Workspace
      </Button>
      
      <Button 
        v-else
        variant="ghost" 
        size="icon"
        class="w-8 h-8 rounded-full bg-muted/40 hover:bg-muted/80 text-muted-foreground hover:text-foreground shrink-0"
        @click="sessionStore.createSession('Default Workspace')"
        title="New Workspace"
      >
        <Plus class="w-4 h-4" />
      </Button>

      <!-- Session list -->
      <div :class="['space-y-0.5', isCollapsed ? 'flex flex-col items-center gap-2 mt-2 w-full' : '']">
        <div
          v-for="s in sessionStore.sessions"
          :key="s.id"
          @click="sessionStore.switchSession(s.id)"
          :class="[
            'group flex items-center justify-between rounded-md cursor-pointer transition-colors',
            isCollapsed ? 'py-3 px-1 w-8 justify-center flex-col' : 'px-2.5 py-1.5 w-full',
            sessionStore.activeSessionId === s.id
              ? 'bg-secondary text-foreground font-normal shadow-xs border border-border/80'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          ]"
        >
          <div :class="['flex items-center gap-2', isCollapsed ? 'flex-col w-full' : 'truncate flex-1 pr-2']">
            <span 
              :class="[
                'rounded-full shrink-0',
                isCollapsed ? 'w-2 h-2 mb-1' : 'w-1.5 h-1.5',
                sessionStore.activeSessionId === s.id ? 'bg-primary' : 'bg-muted-foreground/40'
              ]"
            ></span>

            <template v-if="!isCollapsed">
              <input
                v-if="editingId === s.id"
                v-model="editName"
                @blur="saveEdit"
                @keyup.enter="saveEdit"
                @click.stop
                class="h-5 px-1 bg-background border border-primary rounded text-[11px] outline-none w-full"
                autoFocus
              />
              <span v-else class="truncate" @dblclick.stop="startEdit(s.id, s.name)" title="Double click to rename">{{ s.name }}</span>
            </template>
            <template v-else>
              <span 
                class="whitespace-nowrap leading-none tracking-wider font-medium text-xs" 
                style="writing-mode: vertical-rl; transform: rotate(180deg);"
                title="Click to switch session"
              >{{ s.name }}</span>
            </template>
          </div>

          <div v-if="!isCollapsed" class="flex items-center gap-1 shrink-0">
            <Button
              v-if="sessionStore.sessions.length > 1"
              variant="ghost"
              size="icon"
              @click.stop="sessionStore.deleteSession(s.id)"
              title="Delete session"
              class="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
            >
              <Trash2 class="w-3 h-3" />
            </Button>
            <ChevronRight 
              v-if="sessionStore.activeSessionId === s.id" 
              class="w-3 h-3 text-muted-foreground" 
            />
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
