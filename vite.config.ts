import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-finnhub-api',
      configureServer(server) {
        server.middlewares.use('/api/quote', async (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.setHeader('Allow', 'GET')
            res.end('Method Not Allowed')
            return
          }

          const apiKey = process.env.FINNHUB_API_KEY
          if (!apiKey) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Missing FINNHUB_API_KEY in server environment' }))
            return
          }

          const url = new URL(req.url ?? '', 'http://localhost')
          const symbol = (url.searchParams.get('symbol') ?? '').trim().toUpperCase()

          if (!symbol) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Missing required query param: symbol' }))
            return
          }

          if (!/^[A-Z0-9.-]{1,10}$/.test(symbol)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Invalid symbol format' }))
            return
          }

          try {
            const upstream = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
              { headers: { Accept: 'application/json' } },
            )

            if (!upstream.ok) {
              const text = await upstream.text().catch(() => '')
              res.statusCode = upstream.status
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: 'Upstream API error', details: text || undefined }))
              return
            }

            const data = (await upstream.json()) as { c: number; d: number; dp: number; t: number }

            if (!data || typeof data.c !== 'number' || data.c <= 0) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: 'Quote not found for symbol' }))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(
              JSON.stringify({
                symbol,
                price: data.c,
                change: data.d,
                changePercent: data.dp,
                marketTimestamp: data.t,
              }),
            )
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Failed to fetch quote', details: err?.message }))
          }
        })
      },
    },
  ],
})
