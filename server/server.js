import * as Y from 'yjs'
import { WebSocketServer } from 'ws'

const port = process.env.PORT || 1234

const docs = new Map()

const getDoc = (name) => {
  if (!docs.has(name)) {
    docs.set(name, new Y.Doc())
  }
  return docs.get(name)
}

const wss = new WebSocketServer({ port })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const room = url.pathname.slice(1) || 'agentsync-room'

  console.log(`✓ Client connected to room: ${room}`)

  ws.on('message', (data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(data)
      }
    })
  })

  ws.on('close', () => {
    console.log(`✗ Client disconnected from room: ${room}`)
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message)
  })
})

console.log(`🚀 WebSocket server running on ws://localhost:${port}`)
