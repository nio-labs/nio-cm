import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WorkspaceSession } from '../types'

export const MAX_WORKSPACES = 5
const STORAGE_KEY = 'niocm_sessions'

export const useSessionStore = defineStore('sessions', () => {
  const sessions = ref<WorkspaceSession[]>([
    {
      id: 'session-default',
      name: 'Default Workspace',
      cwd: '~',
      panes: [],
      activePaneId: null,
      createdAt: Date.now(),
    },
  ])

  const activeSessionId = ref<string>('session-default')

  // Load saved workspaces. Accept the old array format for existing installs.
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      const savedSessions = Array.isArray(parsed) ? parsed : parsed.sessions
      if (Array.isArray(savedSessions) && savedSessions.length > 0) {
        sessions.value = savedSessions.slice(0, MAX_WORKSPACES)
        const storedActiveId = Array.isArray(parsed) ? null : parsed.activeSessionId
        activeSessionId.value = sessions.value.some((s) => s.id === storedActiveId)
          ? storedActiveId
          : sessions.value[0].id
      }
    } catch (e) {
      console.warn('Failed to parse saved sessions from localStorage')
    }
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessions: sessions.value,
      activeSessionId: activeSessionId.value,
    }))
  }

  const activeSession = computed(() => {
    return sessions.value.find((s) => s.id === activeSessionId.value) || sessions.value[0]
  })

  function createSession(name: string, cwd: string = '~'): string | null {
    if (sessions.value.length >= MAX_WORKSPACES) return null

    const id = `session-${Date.now()}`
    sessions.value.push({
      id,
      name,
      cwd,
      panes: [],
      activePaneId: null,
      createdAt: Date.now(),
    })
    activeSessionId.value = id
    saveToStorage()
    return id
  }

  function renameSession(id: string, newName: string) {
    const s = sessions.value.find((item) => item.id === id)
    if (s && newName.trim()) {
      s.name = newName.trim()
      saveToStorage()
    }
  }

  function deleteSession(id: string) {
    if (sessions.value.length <= 1) return // Keep at least one
    const idx = sessions.value.findIndex((s) => s.id === id)
    if (idx !== -1) {
      sessions.value.splice(idx, 1)
      if (activeSessionId.value === id) {
        activeSessionId.value = sessions.value[0].id
      }
      saveToStorage()
    }
  }

  function switchSession(id: string) {
    if (sessions.value.some((s) => s.id === id)) {
      activeSessionId.value = id
      saveToStorage()
    }
  }

  return {
    sessions,
    activeSessionId,
    activeSession,
    createSession,
    renameSession,
    deleteSession,
    switchSession,
    saveToStorage,
  }
})
