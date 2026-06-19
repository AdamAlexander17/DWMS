/**
 * Lightweight WebSocket client for DWMS live updates.
 * Auto-reconnects with exponential backoff.
 */

const WS_BASE = (() => {
  // Use current host with ws/wss protocol
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}`
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
      // React 18 StrictMode cleanup may have fired before the socket opened.
      // Close cleanly here instead of letting the browser warn about it.
      if (stopped) {
        ws.close()
        return
      }
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
      // Only close if already OPEN — CONNECTING sockets are handled in onopen
      // (closing a CONNECTING socket produces a browser warning in StrictMode)
      if (ws && ws.readyState === WebSocket.OPEN) {
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
