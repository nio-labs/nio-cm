import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { TerminalPane } from '../types'
import { useSessionStore } from './sessionStore'

export const MAX_PANES = 10
const STORAGE_KEY = 'niocm_grid'

export const useGridStore = defineStore('grid', () => {
  const sessionStore = useSessionStore()

  // Local map of session_id -> TerminalPane[]
  const sessionPanes = ref<Record<string, TerminalPane[]>>({})
  const focusedPaneId = ref<string | null>(null)
  const zoomedPaneId = ref<string | null>(null)
  const splitRatios = ref<Record<string, { columns: number[]; rows: number[] }>>({})

  // Restore pane layouts so each terminal is recreated when its workspace opens.
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed && typeof parsed.sessionPanes === 'object' && parsed.sessionPanes !== null) {
        sessionPanes.value = Object.fromEntries(
          Object.entries(parsed.sessionPanes)
            .filter(([, panes]) => Array.isArray(panes))
            .map(([id, panes]) => [id, (panes as TerminalPane[]).slice(0, MAX_PANES)])
        )
      }
      focusedPaneId.value = typeof parsed.focusedPaneId === 'string' ? parsed.focusedPaneId : null
      if (parsed.splitRatios && typeof parsed.splitRatios === 'object') {
        splitRatios.value = Object.fromEntries(
          Object.entries(parsed.splitRatios)
            .filter(([, value]) => {
              const sizes = value as { columns?: unknown; rows?: unknown }
              return Array.isArray(sizes?.columns) && Array.isArray(sizes?.rows)
            })
            .map(([id, value]) => [id, value as { columns: number[]; rows: number[] }])
        )
      }
    }
  } catch {
    console.warn('Failed to parse saved terminal layouts from localStorage')
  }

  watch([sessionPanes, focusedPaneId, splitRatios], () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessionPanes: sessionPanes.value,
      focusedPaneId: focusedPaneId.value,
      splitRatios: splitRatios.value,
    }))
  }, { deep: true })

  watch(() => sessionStore.sessions.map((session) => session.id), (sessionIds) => {
    const allowedIds = new Set(sessionIds)
    for (const id of Object.keys(sessionPanes.value)) {
      if (!allowedIds.has(id)) delete sessionPanes.value[id]
    }
    for (const id of Object.keys(splitRatios.value)) {
      if (!allowedIds.has(id)) delete splitRatios.value[id]
    }
  })

  const activePanes = computed({
    get() {
      const sId = sessionStore.activeSessionId
      if (!sessionPanes.value[sId]) {
        sessionPanes.value[sId] = []
      }
      return sessionPanes.value[sId]
    },
    set(val: TerminalPane[]) {
      const sId = sessionStore.activeSessionId
      sessionPanes.value[sId] = val
    },
  })

  const activeSplitRatio = computed(() => splitRatios.value[sessionStore.activeSessionId] || { columns: [], rows: [] })

  function setSplitSizes(axis: 'columns' | 'rows', values: number[]) {
    const sessionId = sessionStore.activeSessionId
    const current = splitRatios.value[sessionId] || { columns: [], rows: [] }
    splitRatios.value[sessionId] = { ...current, [axis]: values }
  }

  const gridColumns = computed(() => {
    const count = activePanes.value.length
    if (count <= 1) return 1
    if (count <= 4) return 2
    if (count <= 6) return 3
    if (count <= 9) return 3
    return 4 // 10 panes
  })

  function getFocusedIndex(): number {
    if (!focusedPaneId.value) return 0
    const idx = activePanes.value.findIndex((p) => p.id === focusedPaneId.value)
    return idx === -1 ? 0 : idx
  }

  function addPane(
    shell: string = 'nio',
    args?: string[],
    title?: string,
    cwd?: string
  ): TerminalPane | null {
    if (activePanes.value.length >= MAX_PANES) {
      console.warn(`[NioCM] Maximum limit of ${MAX_PANES} panes reached.`)
      return null
    }

    const sId = sessionStore.activeSessionId
    const count = activePanes.value.length + 1
    const sequenceId = Math.max(0, ...activePanes.value.map(p => p.sequenceId || 0)) + 1
    const id = `pane-${sId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const defaultTitle = title || (shell === 'nio' ? `NioAI Agent #${sequenceId}` : `Terminal #${sequenceId}`)

    const newPane: TerminalPane = {
      id,
      sessionId: id,
      sequenceId,
      title: defaultTitle,
      shell,
      args,
      cwd: cwd || sessionStore.activeSession.cwd,
      status: shell === 'nio' ? 'agent' : 'idle',
      agentMetadata: shell === 'nio' ? { model: 'kilo-auto', mode: 'build' } : undefined,
      createdAt: Date.now(),
    }

    activePanes.value.push(newPane)
    focusedPaneId.value = id
    return newPane
  }

  function closePane(id: string) {
    const idx = activePanes.value.findIndex((p) => p.id === id)
    if (idx !== -1) {
      activePanes.value.splice(idx, 1)
      if (zoomedPaneId.value === id) {
        zoomedPaneId.value = null
      }
      if (focusedPaneId.value === id) {
        if (activePanes.value.length > 0) {
          const nextIdx = Math.min(idx, activePanes.value.length - 1)
          focusedPaneId.value = activePanes.value[nextIdx].id
        } else {
          focusedPaneId.value = null
        }
      }
    }
  }

  function setFocused(id: string) {
    if (activePanes.value.some((p) => p.id === id)) {
      focusedPaneId.value = id
    }
  }

  function updatePaneCwd(id: string, cwd: string) {
    const p = activePanes.value.find((x) => x.id === id)
    if (p) {
      p.cwd = cwd
    }
  }

  function switchAgentPaneToShell(id: string) {
    const pane = activePanes.value.find((item) => item.id === id)
    if (!pane) return

    pane.sessionId = `${id}-shell-${Date.now()}`
    pane.shell = 'bash'
    pane.args = undefined
    pane.title = `Terminal #${pane.sequenceId}`
    pane.status = 'idle'
    pane.agentMetadata = undefined
  }

  function toggleZoom(id?: string) {
    const targetId = id || focusedPaneId.value
    if (!targetId) return

    if (zoomedPaneId.value === targetId) {
      zoomedPaneId.value = null
    } else {
      zoomedPaneId.value = targetId
      focusedPaneId.value = targetId
    }
  }

  function swapPanes(idxA: number, idxB: number) {
    const list = activePanes.value
    if (idxA >= 0 && idxA < list.length && idxB >= 0 && idxB < list.length && idxA !== idxB) {
      const temp = list[idxA]
      list[idxA] = list[idxB]
      list[idxB] = temp
    }
  }

  function getGridMap() {
    const cols = gridColumns.value
    const count = activePanes.value.length
    const rows = Math.ceil(count / cols) || 1
    const extraCells = (cols * rows) - count

    const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1))
    
    let currentIdx = 0
    const spanCount = extraCells > 0 ? 1 + extraCells : 1

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] !== -1) continue
        if (currentIdx >= count) break
        
        if (currentIdx === 0 && extraCells > 0) {
          for (let s = 0; s < spanCount; s++) {
            if (r + s < rows) {
              grid[r + s][c] = currentIdx
            }
          }
        } else {
          grid[r][c] = currentIdx
        }
        currentIdx++
      }
    }
    return { grid, rows, cols }
  }

  function getTargetIdx(direction: 'up' | 'down' | 'left' | 'right') {
    const count = activePanes.value.length
    if (count <= 1) return -1

    const { grid, rows, cols } = getGridMap()
    const currentIdx = getFocusedIndex()

    // Find bounding box of currentIdx
    let minR = rows, maxR = -1, minC = cols, maxC = -1
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === currentIdx) {
          if (r < minR) minR = r
          if (r > maxR) maxR = r
          if (c < minC) minC = c
          if (c > maxC) maxC = c
        }
      }
    }

    let targetR = minR
    let targetC = minC

    switch (direction) {
      case 'left':
        targetC = minC - 1
        break
      case 'right':
        targetC = maxC + 1
        break
      case 'up':
        targetR = minR - 1
        break
      case 'down':
        targetR = maxR + 1
        break
    }

    if (targetR >= 0 && targetR < rows && targetC >= 0 && targetC < cols) {
      return grid[targetR][targetC]
    }
    return -1
  }

  function navigateSpatial(direction: 'up' | 'down' | 'left' | 'right') {
    const targetIdx = getTargetIdx(direction)
    if (targetIdx !== -1 && targetIdx !== getFocusedIndex()) {
      focusedPaneId.value = activePanes.value[targetIdx].id
    }
  }

  function swapSpatial(direction: 'up' | 'down' | 'left' | 'right') {
    const targetIdx = getTargetIdx(direction)
    const currentIdx = getFocusedIndex()
    if (targetIdx !== -1 && targetIdx !== currentIdx) {
      swapPanes(currentIdx, targetIdx)
    }
  }

  return {
    activePanes,
    activeSplitRatio,
    setSplitSizes,
    gridColumns,
    focusedPaneId,
    zoomedPaneId,
    addPane,
    closePane,
    setFocused,
    updatePaneCwd,
    switchAgentPaneToShell,
    toggleZoom,
    swapPanes,
    navigateSpatial,
    swapSpatial,
  }
})
