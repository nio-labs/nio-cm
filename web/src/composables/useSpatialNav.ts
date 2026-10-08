import { onMounted, onUnmounted } from 'vue'
import { useGridStore } from '../stores/gridStore'

export function useSpatialNav() {
  const gridStore = useGridStore()

  function handleKeyDown(e: KeyboardEvent) {
    // Check for Alt shortcuts
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      if (e.shiftKey) {
        // Alt + Shift + Arrows: SWAP PANES
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          gridStore.swapSpatial('up')
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          gridStore.swapSpatial('down')
          return
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          gridStore.swapSpatial('left')
          return
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          gridStore.swapSpatial('right')
          return
        }
      } else {
        // Alt + Arrows: NAVIGATE FOCUS
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          gridStore.navigateSpatial('up')
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          gridStore.navigateSpatial('down')
          return
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          gridStore.navigateSpatial('left')
          return
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          gridStore.navigateSpatial('right')
          return
        }

        // Alt + Z or Alt + Enter: TOGGLE ZOOM
        if (e.key.toLowerCase() === 'z' || e.key === 'Enter') {
          e.preventDefault()
          gridStore.toggleZoom()
          return
        }

        // Alt + N: ADD NEW PANE
        if (e.key.toLowerCase() === 'n') {
          e.preventDefault()
          gridStore.addPane('nio')
          return
        }

        // Alt + W: CLOSE FOCUSED PANE
        if (e.key.toLowerCase() === 'w') {
          e.preventDefault()
          if (gridStore.focusedPaneId) {
            gridStore.closePane(gridStore.focusedPaneId)
          }
          return
        }

        // Alt + 1 to Alt + 9, Alt + 0
        if (e.key >= '1' && e.key <= '9') {
          const idx = parseInt(e.key) - 1
          if (idx < gridStore.activePanes.length) {
            e.preventDefault()
            gridStore.setFocused(gridStore.activePanes[idx].id)
            return
          }
        } else if (e.key === '0') {
          if (gridStore.activePanes.length >= 10) {
            e.preventDefault()
            gridStore.setFocused(gridStore.activePanes[9].id)
            return
          }
        }
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown, true)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown, true)
  })
}
