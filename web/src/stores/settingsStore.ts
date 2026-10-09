import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import {
  getTerminalTheme,
  isTerminalThemeDark,
  TERMINAL_THEMES,
  type XtermTheme,
} from '../composables/terminalThemes'

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
  const terminalTheme = ref<string>('aurora-light')
  const fontFamily = ref<string>(DEFAULT_FONT)
  const terminalFontSize = ref<number>(12)
  const cursorStyle = ref<'block' | 'underline' | 'bar'>('bar')
  const cursorBlink = ref<boolean>(true)
  const copyOnSelect = ref<boolean>(true)
  const uiScale = ref<number>(1)

  const saved = localStorage.getItem('niocm_settings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.terminalTheme && parsed.terminalTheme !== 'match-ui') {
        terminalTheme.value = parsed.terminalTheme
      }
      if (parsed.fontFamily) {
        fontFamily.value = parsed.fontFamily
      }
      if (parsed.terminalFontSize) {
        terminalFontSize.value = parsed.terminalFontSize
      }
      if (parsed.cursorStyle) {
        cursorStyle.value = parsed.cursorStyle
      }
      if (typeof parsed.cursorBlink === 'boolean') {
        cursorBlink.value = parsed.cursorBlink
      }
      if (typeof parsed.copyOnSelect === 'boolean') {
        copyOnSelect.value = parsed.copyOnSelect
      }
      if (parsed.uiScale) {
        uiScale.value = parsed.uiScale
      }
    } catch (_) {}
  }

  function hexToHsl(hex: string): string {
    let r = 0, g = 0, b = 0
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16)
      g = parseInt(hex[2] + hex[2], 16)
      b = parseInt(hex[3] + hex[3], 16)
    } else if (hex.length === 7) {
      r = parseInt(hex.substring(1, 3), 16)
      g = parseInt(hex.substring(3, 5), 16)
      b = parseInt(hex.substring(5, 7), 16)
    }
    r /= 255
    g /= 255
    b /= 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h = 0, s = 0, l = (max + min) / 2
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
  }

const THEME_ACCENTS: Record<string, string> = {
  'github-dark': '#1f6feb',
  'github-light': '#0550ae',
  'one-dark': '#61afef',
  'one-light': '#4078f2',
  'ember': '#c47f52',
  'dracula': '#ff79c6',
  'tokyo-night': '#7aa2f7',
  'night-owl': '#82aaff',
  'ayu-dark': '#e6b450',
  'gruvbox-dark': '#fe8019',
  'deep-night': '#58a6ff',
  'catppuccin': '#cba6f7',
  'solarized-dark': '#268bd2',
  'solarized-light': '#1f6feb',
  'claw': '#d44d44',
  'midnight': '#4c8dff',
  'nord': '#5e81ac',
  'nord-light': '#1d55c0',
  'codex-dark': '#1f6feb',
  'codex': '#008080',
  'cyberpunk': '#c9b400',
  'cyberpunk-light': '#b89400',
  'msdos': '#00aa00',
  'aurora': '#10b981',
  'aurora-light': '#008080',
  'candy': '#a78bfa',
  'slate': '#404040',
  'phosphor': '#1fd44f',
  'amber': '#ff9f00',
  'cream': '#8b5a2b',
  'ocean-breeze': '#4a90a4',
  'lavender-dream': '#9b72cf',
  'mint-fresh': '#5cb85c',
}

  function applyAppTheme() {
    if (isTerminalThemeDark(terminalTheme.value)) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    const palette = getTerminalTheme(terminalTheme.value)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.background)
    const bgHsl = hexToHsl(palette.background)
    const fgHsl = hexToHsl(palette.foreground)
    
    document.documentElement.style.setProperty('--background', bgHsl)
    document.documentElement.style.setProperty('--card', bgHsl)
    document.documentElement.style.setProperty('--card-foreground', fgHsl)
    document.documentElement.style.setProperty('--popover', bgHsl)
    document.documentElement.style.setProperty('--popover-foreground', fgHsl)
    document.documentElement.style.setProperty('--foreground', fgHsl)
    
    // Sync Primary accent with Terminal Theme
    const accentHex = THEME_ACCENTS[terminalTheme.value] || palette.cursor || '#008080'
    const primaryHsl = hexToHsl(accentHex)
    document.documentElement.style.setProperty('--primary', primaryHsl)
    document.documentElement.style.setProperty('--ring', primaryHsl)
  }

  function applyFontFamily() {
    document.documentElement.style.setProperty('--app-font-family', fontFamily.value)
  }

  function saveSettings() {
    localStorage.setItem(
      'niocm_settings',
      JSON.stringify({
        terminalTheme: terminalTheme.value,
        fontFamily: fontFamily.value,
        terminalFontSize: terminalFontSize.value,
        cursorStyle: cursorStyle.value,
        cursorBlink: cursorBlink.value,
        copyOnSelect: copyOnSelect.value,
        uiScale: uiScale.value,
      })
    )
    applyAppTheme()
    applyFontFamily()
  }

  function setTerminalTheme(name: string) {
    terminalTheme.value = name
    saveSettings()
  }

  function setFontFamily(font: string) {
    fontFamily.value = font
    saveSettings()
  }

  function setTerminalFontSize(size: number) {
    terminalFontSize.value = size
    saveSettings()
  }

  function setCursorStyle(style: 'block' | 'underline' | 'bar') {
    cursorStyle.value = style
    saveSettings()
  }

  function setCursorBlink(blink: boolean) {
    cursorBlink.value = blink
    saveSettings()
  }

  function setCopyOnSelect(copy: boolean) {
    copyOnSelect.value = copy
    saveSettings()
  }

  function setUiScale(scale: number) {
    uiScale.value = scale
    document.documentElement.style.fontSize = `${16 * scale}px`
    saveSettings()
  }

  function getActiveTerminalPalette(): XtermTheme {
    return getTerminalTheme(terminalTheme.value)
  }

  applyAppTheme()
  applyFontFamily()
  document.documentElement.style.fontSize = `${16 * uiScale.value}px`

  return {
    terminalTheme,
    fontFamily,
    terminalFontSize,
    cursorStyle,
    cursorBlink,
    copyOnSelect,
    uiScale,
    terminalFont: fontFamily, // Terminal synchronizes with the chosen font
    availableTerminalThemes: TERMINAL_THEMES,
    availableFontFamilies: FONT_FAMILIES,
    setTerminalTheme,
    setFontFamily,
    setTerminalFontSize,
    setCursorStyle,
    setCursorBlink,
    setCopyOnSelect,
    setUiScale,
    getActiveTerminalPalette,
  }
})
