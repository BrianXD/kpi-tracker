import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const gasUrl = env.VITE_GAS_URL

  return {
    plugins: [
      react(),
      {
        name: 'gas-proxy',
        configureServer(server) {
          // server-side proxy：Node.js follow redirect 不受 CORS 限制
          server.middlewares.use('/gas-proxy', async (req, res) => {
            if (!gasUrl) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'VITE_GAS_URL not set' }))
              return
            }
            const search = req.url?.split('?')[1] ?? ''
            const targetUrl = gasUrl + (search ? `?${search}` : '')
            try {
              const response = await fetch(targetUrl, { redirect: 'follow' })
              const text = await response.text()
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(text)
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: String(err) }))
            }
          })
        },
      },
    ],
  }
})
