import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getTerminalTheme,
  TERMINAL_THEMES,
  type XtermTheme,
} from '../composables/terminalThemes'

export type AppTheme = 'light' | 'dark'

export interface FontFamilyOption {
  value: string
  label: string
}

export const FONT_FAMILIES: FontFamilyOption[] = [
  {
    value:
      "'Google Sans Code', 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Roboto Mono', 'Space Mono', monospace",
    label: 'Google Sans Code (Default)',
  },
  {
    value: "'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace",
    label: 'JetBrains Mono',
  },
  { value: "'Fira Code', monospace", label: 'Fira Code' },
  { value: "'Source Code Pro', monospace", label: 'Source Code Pro' },
  { value: "'Roboto Mono', monospace", label: 'Roboto Mono' },
  { value: "'Space Mono', monospace", label: 'Space Mono' },
  { value: "'IBM Plex Mono', monospace", label: 'IBM Plex Mono' },
  { value: "'Ubuntu Mono', monospace", label: 'Ubuntu Mono' },
  { value: "'Inconsolata', monospace", label: 'Inconsolata' },
]

export const DEFAULT_FONT = FONT_FAMILIES[0].value

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<AppTheme>('light')
  const terminalTheme = ref<string>('match-ui')
  const fontFamily = ref<string>(DEFAULT_FONT)

  const saved = localStorage.getItem('niocm_settings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.theme === 'light' || parsed.theme === 'dark') {
        theme.value = parsed.theme
      }
      if (parsed.terminalTheme) {
        terminalTheme.value = parsed.terminalTheme
      }
      if (parsed.fontFamily) {
        fontFamily.value = parsed.fontFamily
      }
    } catch (_) {}
  }

  function applyAppTheme() {
    if (theme.value === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function applyFontFamily() {
    document.documentElement.style.setProperty('--app-font-family', fontFamily.value)
  }

  function saveSettings() {
    localStorage.setItem(
      'niocm_settings',
      JSON.stringify({
        theme: theme.value,
        terminalTheme: terminalTheme.value,
        fontFamily: fontFamily.value,
      })
    )
    applyAppTheme()
    applyFontFamily()
  }

  function setTheme(newTheme: AppTheme) {
    theme.value = newTheme
    saveSettings()
  }

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    saveSettings()
  }

  function setTerminalTheme(name: string) {
    terminalTheme.value = name
    saveSettings()
  }

  function setFontFamily(font: string) {
    fontFamily.value = font
    saveSettings()
  }

  function getActiveTerminalPalette(): XtermTheme {
    const uiThemeKey = theme.value === 'dark' ? 'codex-dark' : 'codex'
    return getTerminalTheme(terminalTheme.value, uiThemeKey)
  }

  applyAppTheme()
  applyFontFamily()

  return {
    theme,
    terminalTheme,
    fontFamily,
    terminalFont: fontFamily, // Terminal synchronizes with the chosen font
    availableTerminalThemes: TERMINAL_THEMES,
    availableFontFamilies: FONT_FAMILIES,
    setTheme,
    toggleTheme,
    setTerminalTheme,
    setFontFamily,
    getActiveTerminalPalette,
  }
})
