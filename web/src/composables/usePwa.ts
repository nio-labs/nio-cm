import { ref, readonly } from 'vue'
import { registerSW } from 'virtual:pwa-register'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const canInstall = ref(false)
const isInstalled = ref(false)
const isOnline = ref(navigator.onLine)
const needRefresh = ref(false)
const installError = ref('')
const showUpdateDialog = ref(false)
let installPrompt: InstallPromptEvent | null = null
let initialized = false
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined

export function initializePwa() {
  if (initialized) return
  initialized = true

  const standalone = window.matchMedia('(display-mode: standalone)')
  const overlay = window.matchMedia('(display-mode: window-controls-overlay)')
  const updateInstalled = () => {
    isInstalled.value = standalone.matches
      || overlay.matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  }
  updateInstalled()
  standalone.addEventListener('change', updateInstalled)
  overlay.addEventListener('change', updateInstalled)
  window.addEventListener('online', () => { isOnline.value = true })
  window.addEventListener('offline', () => { isOnline.value = false })
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installPrompt = event as InstallPromptEvent
    canInstall.value = true
    installError.value = ''
  })
  window.addEventListener('appinstalled', () => {
    isInstalled.value = true
    canInstall.value = false
    installPrompt = null
  })

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() { needRefresh.value = true },
      onRegisteredSW(_url, registration) {
        if (!registration) return
        let lastCheck = Date.now()
        window.addEventListener('focus', () => {
          if (navigator.onLine && Date.now() - lastCheck > 60_000) {
            lastCheck = Date.now()
            registration.update().catch((error) => console.warn('PWA update check failed', error))
          }
        })
      },
      onRegisterError(error) { console.error('PWA registration failed', error) },
    })
  }
}

export function usePwa() {
  async function install() {
    if (!installPrompt) return
    const prompt = installPrompt
    installError.value = ''
    try {
      await prompt.prompt()
      await prompt.userChoice
    } catch (error) {
      installError.value = 'Use your browser’s install menu to try again.'
      console.error('PWA installation failed', error)
    } finally {
      installPrompt = null
      canInstall.value = false
    }
  }

  async function reloadToUpdate() {
    await updateServiceWorker?.(true)
  }

  return {
    canInstall: readonly(canInstall),
    isInstalled: readonly(isInstalled),
    isOnline: readonly(isOnline),
    needRefresh: readonly(needRefresh),
    installError: readonly(installError),
    showUpdateDialog: readonly(showUpdateDialog),
    reviewUpdate: () => { showUpdateDialog.value = true },
    dismissUpdate: () => { showUpdateDialog.value = false },
    install,
    reloadToUpdate,
  }
}
