<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useSessionStore } from '../../stores/sessionStore'
import Button from '../ui/Button.vue'
import { MAX_WORKSPACES } from '../../stores/sessionStore'
import {
  FolderKanban,
  Plus,
  Trash2,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-vue-next'

const sessionStore = useSessionStore()

const isCollapsed = ref(localStorage.getItem('niocm_sidebar_collapsed') === 'true')
watch(isCollapsed, (collapsed) => {
  localStorage.setItem('niocm_sidebar_collapsed', String(collapsed))
})
const editingId = ref<string | null>(null)
const editName = ref('')
const editInput = ref<HTMLInputElement | null>(null)
function setEditInput(element: unknown, id: string) {
  if (id === editingId.value && element instanceof HTMLInputElement) {
    editInput.value = element
  }
}
async function startEdit(id: string, currentName: string) {
  editingId.value = id
  editName.value = currentName
  await nextTick()
  editInput.value?.focus()
  editInput.value?.select()
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
    <div
      class="p-2 space-y-3 flex-1 w-full flex flex-col"
      :class="isCollapsed ? 'items-center overflow-hidden' : 'overflow-y-auto overflow-x-hidden'"
    >
      <div :class="['flex items-center justify-between border-b border-border pb-2 shrink-0', isCollapsed ? 'flex-col gap-2 px-0 pt-1 w-full' : 'border-x border-x-transparent pt-1']">
        <span 
          v-if="!isCollapsed" 
          class="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.14em] flex items-center gap-2"
        >
          <span class="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <FolderKanban class="w-3.5 h-3.5" />
          </span>
          Workspaces
        </span>
        <div class="flex items-center gap-1 shrink-0">
          <Button
            v-if="!isCollapsed"
            variant="ghost"
            size="sm"
            @click.stop="sessionStore.createSession('Default Workspace')"
            :disabled="sessionStore.sessions.length >= MAX_WORKSPACES"
            class="h-6 px-2 rounded-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary text-[10px] gap-1 shrink-0"
            :title="sessionStore.sessions.length >= MAX_WORKSPACES ? `Workspace limit reached (${MAX_WORKSPACES})` : 'New Workspace'"
          >
            <Plus class="w-3 h-3" />
            New
          </Button>
        </div>
      </div>

      <Button 
        v-if="isCollapsed"
        variant="ghost"
        size="icon"
        class="w-8 h-8 rounded-full text-primary hover:bg-primary/10 hover:text-primary shrink-0"
        @click="sessionStore.createSession('Default Workspace')"
        :disabled="sessionStore.sessions.length >= MAX_WORKSPACES"
        :title="sessionStore.sessions.length >= MAX_WORKSPACES ? `Workspace limit reached (${MAX_WORKSPACES})` : 'New Workspace'"
      >
        <Plus class="w-4 h-4 text-primary" />
      </Button>

      <!-- Session list -->
      <div :class="['space-y-0.5 pt-3 w-full', isCollapsed ? 'flex flex-col items-center gap-2' : '']">
        <div
          v-for="s in sessionStore.sessions"
          :key="s.id"
          @click="sessionStore.switchSession(s.id)"
          @dblclick.stop="startEdit(s.id, s.name)"
          :class="[
            'group flex items-center justify-between rounded-md cursor-pointer transition-colors',
            isCollapsed ? 'py-3 px-1 w-8 justify-center flex-col' : 'px-2.5 py-1.5 w-full',
            sessionStore.activeSessionId === s.id
              ? 'bg-secondary/40 text-foreground font-normal shadow-xs border border-border border-l-2 border-l-primary'
              : 'border border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          ]"
        >
          <div :class="['flex items-center gap-2', isCollapsed ? 'flex-col w-full' : 'truncate flex-1 pr-2']">
            <span :class="['flex items-center justify-center shrink-0', isCollapsed ? 'w-2 h-2 mb-1' : 'w-3.5 h-3.5']">
              <span
                :class="[
                  'rounded-full',
                  isCollapsed ? 'w-2 h-2' : 'w-1.5 h-1.5',
                  sessionStore.activeSessionId === s.id ? 'bg-primary' : 'bg-muted-foreground/40'
                ]"
              ></span>
            </span>

            <template v-if="!isCollapsed">
              <input
                v-if="editingId === s.id"
                :ref="(element) => setEditInput(element, s.id)"
                v-model="editName"
                @blur="saveEdit"
                @keyup.enter="saveEdit"
                @click.stop
                @dblclick.stop
                class="h-5 px-1 bg-background border border-primary rounded text-[11px] outline-none w-full"
              />
              <span v-else class="truncate" title="Double click to rename">{{ s.name }}</span>
            </template>
            <template v-else>
              <span 
                class="whitespace-nowrap leading-none tracking-wide font-medium text-[10px]"
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

    <div :class="['shrink-0 border-t border-border p-2', isCollapsed ? 'w-full flex justify-center' : '']">
      <Button
        variant="ghost"
        :size="isCollapsed ? 'icon' : 'sm'"
        @click="isCollapsed = !isCollapsed"
        :class="isCollapsed
          ? 'h-7 w-7 text-muted-foreground hover:text-foreground'
          : 'h-7 w-full justify-start gap-2 px-2 text-[11px] text-muted-foreground hover:text-foreground'"
        :title="isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
      >
        <PanelLeftOpen v-if="isCollapsed" class="w-4 h-4" />
        <PanelLeftClose v-else class="w-4 h-4" />
        <span v-if="!isCollapsed">Collapse sidebar</span>
      </Button>
    </div>
  </aside>
</template>
