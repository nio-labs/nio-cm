<script setup lang="ts">
import { ref } from 'vue'
import { useSessionStore } from '../../stores/sessionStore'
import Button from '../ui/Button.vue'
import {
  FolderKanban,
  Plus,
  Trash2,
  ChevronRight
} from 'lucide-vue-next'

const sessionStore = useSessionStore()
const isCreating = ref(false)
const newSessionName = ref('')

function handleCreate() {
  if (newSessionName.value.trim()) {
    sessionStore.createSession(newSessionName.value.trim())
    newSessionName.value = ''
    isCreating.value = false
  }
}
</script>

<template>
  <aside class="w-56 border-r border-border bg-card/60 flex flex-col justify-between select-none shrink-0 text-xs">
    <!-- Sessions Section -->
    <div class="p-2 space-y-3 overflow-y-auto flex-1">
      <div class="flex items-center justify-between px-2 pt-1">
        <span class="text-[11px] font-normal text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <FolderKanban class="w-3.5 h-3.5" />
          Sessions
        </span>
        <Button 
          variant="ghost" 
          size="icon" 
          @click="isCreating = !isCreating"
          title="Create New Session"
          class="h-5 w-5 text-muted-foreground hover:text-primary"
        >
          <Plus class="w-3.5 h-3.5" />
        </Button>
      </div>

      <!-- Quick create input -->
      <div v-if="isCreating" class="px-2 pb-1 space-y-1.5">
        <input 
          v-model="newSessionName"
          @keyup.enter="handleCreate"
          placeholder="Session name..."
          class="w-full h-6 px-2 bg-background border border-border focus:border-primary rounded text-xs outline-none"
          autoFocus
        />
        <div class="flex justify-end gap-1">
          <Button variant="ghost" size="sm" @click="isCreating = false" class="h-5 px-1.5 text-[10px]">Cancel</Button>
          <Button variant="default" size="sm" @click="handleCreate" class="h-5 px-2 text-[10px]">Create</Button>
        </div>
      </div>

      <!-- Session list -->
      <div class="space-y-0.5">
        <div
          v-for="s in sessionStore.sessions"
          :key="s.id"
          @click="sessionStore.switchSession(s.id)"
          :class="[
            'group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-colors',
            sessionStore.activeSessionId === s.id
              ? 'bg-secondary text-foreground font-normal shadow-xs border border-border/80'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          ]"
        >
          <div class="flex items-center gap-2 truncate">
            <span 
              :class="[
                'w-1.5 h-1.5 rounded-full shrink-0',
                sessionStore.activeSessionId === s.id ? 'bg-primary' : 'bg-muted-foreground/40'
              ]"
            ></span>
            <span class="truncate">{{ s.name }}</span>
          </div>

          <div class="flex items-center gap-1">
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
