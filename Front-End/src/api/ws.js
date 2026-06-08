/**
 * Lightweight WebSocket client for DWMS live updates.
 * Auto-reconnects with exponential backoff.
 */

const WS_BASE = (() => {
  // axios.js uses http://127.0.0.1:8000/api → strip /api, swap http→ws
  const httpBase = 'http://127.0.0.1:8000'
  return httpBase.replace(/^http/, 'ws')
})()

export function connectWS(path, token, { onMessage, onOpen, onClose } = {}) {
  let ws = null
  let attempt = 0
  let stopped = false
  let reconnectTimer = null

  const url = () => `${WS_BASE}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`

  const open = () => {
    if (stopped) return
    ws = new WebSocket(url())

    ws.onopen = () => {
      attempt = 0
      onOpen?.()
    }

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        onMessage?.(data)
      } catch (e) {
        // ignore non-JSON
      }
    }

    ws.onerror = () => { /* let onclose handle reconnect */ }

    ws.onclose = (ev) => {
      onClose?.(ev)
      if (stopped) return
      // exponential backoff, capped at 15 s
      const delay = Math.min(15_000, 500 * 2 ** Math.min(attempt, 5))
      attempt += 1
      reconnectTimer = setTimeout(open, delay)
    }
  }

  open()

  return {
    close() {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close()
      }
    },
    send(payload) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload))
      }
    },
  }
}
