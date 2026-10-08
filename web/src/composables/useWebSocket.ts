import { ref } from 'vue'
import type { WsReply, WsEvent } from '../types'

export function useWebSocket() {
  const connected = ref(false)
  const connecting = ref(false)
  let socket: WebSocket | null = null
  let reqId = 1
  const pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>()
  const eventListeners = new Map<string, Set<(payload: any) => void>>()

  function getWsUrl(): string {
    const loc = window.location
    if (loc.port === '5174') {
      // Vite dev server proxy
      return `ws://${loc.hostname}:1422/ws`
    }
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${loc.host}/ws`
  }

  function connect() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return
    }

    connecting.value = true
    const url = getWsUrl()
    console.log('[NioCM] Connecting to WebSocket:', url)

    try {
      socket = new WebSocket(url)

      socket.onopen = () => {
        connected.value = true
        connecting.value = false
        console.log('[NioCM] WebSocket connected to backend daemon')
      }

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if ('id' in msg && msg.id !== 0) {
            // Reply to request
            const reply = msg as WsReply
            const pending = pendingRequests.get(reply.id)
            if (pending) {
              pendingRequests.delete(reply.id)
              if (reply.ok) {
                pending.resolve(reply.result)
              } else {
                pending.reject(new Error(reply.error || 'Request failed'))
              }
            }
          } else if ('event' in msg) {
            // Event broadcast
            const ev = msg as WsEvent
            const handlers = eventListeners.get(ev.event)
            if (handlers) {
              handlers.forEach((h) => h(ev.payload))
            }
          }
        } catch (e) {
          console.error('[NioCM] Failed to parse incoming WebSocket message', e)
        }
      }

      socket.onclose = () => {
        connected.value = false
        connecting.value = false
        console.warn('[NioCM] WebSocket disconnected. Reconnecting in 1500ms...')
        setTimeout(connect, 1500)
      }

      socket.onerror = (err) => {
        console.error('[NioCM] WebSocket error', err)
      }
    } catch (e) {
      connecting.value = false
      setTimeout(connect, 2000)
    }
  }

  function sendCommand<T = any>(command: string, args: Record<string, any> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket not connected'))
      }

      const id = reqId++
      pendingRequests.set(id, { resolve, reject })

      // 30s timeout
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id)
          reject(new Error(`Command '${command}' timed out`))
        }
      }, 30000)

      socket.send(JSON.stringify({ id, command, args }))
    })
  }

  function onEvent(event: string, handler: (payload: any) => void) {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set())
    }
    eventListeners.get(event)!.add(handler)

    return () => {
      eventListeners.get(event)?.delete(handler)
    }
  }

  return {
    connected,
    connecting,
    connect,
    sendCommand,
    onEvent,
  }
}
