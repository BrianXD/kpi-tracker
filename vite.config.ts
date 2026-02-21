import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'http'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const gasUrl = env.VITE_GAS_URL

  return {
    plugins: [
      react(),
      {
        name: 'gas-proxy',
        configureServer(server) {
          server.middlewares.use(
            '/gas-proxy',
            async (req: IncomingMessage, res: ServerResponse) => {
              const method = req.method ?? 'GET'

              // CORS preflight
              if (method === 'OPTIONS') {
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
                res.statusCode = 204
                res.end()
                return
              }

              if (!gasUrl) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: 'VITE_GAS_URL not set' }))
                return
              }

              const setHeaders = () => {
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Access-Control-Allow-Origin', '*')
              }

              try {
                if (method === 'GET') {
                  const search = req.url?.split('?')[1] ?? ''
                  const targetUrl = gasUrl + (search ? `?${search}` : '')
                  const response = await fetch(targetUrl, { redirect: 'follow' })
                  setHeaders()
                  res.end(await response.text())
                } else if (method === 'POST') {
                  const body = await new Promise<string>((resolve) => {
                    let data = ''
                    req.on('data', (chunk: Buffer) => { data += chunk.toString() })
                    req.on('end', () => resolve(data))
                  })
                  const response = await fetch(gasUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                    redirect: 'follow',
                  })
                  setHeaders()
                  res.end(await response.text())
                } else {
                  res.statusCode = 405
                  res.end(JSON.stringify({ error: 'Method not allowed' }))
                }
              } catch (err) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: String(err) }))
              }
            },
          )
        },
      },
    ],
  }
})
