import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite loads env variables for client usage via import.meta.env, but our dev-only
  // server middleware reads from process.env. We explicitly load .env here to ensure
  // FINNHUB_API_KEY is available during local development.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }

  return {
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

          server.middlewares.use('/api/candles', async (req, res) => {
            if (req.method !== 'GET') {
              res.statusCode = 405
              res.setHeader('Allow', 'GET')
              res.end('Method Not Allowed')
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

            const stooqSymbol = `${symbol.toLowerCase()}.us`

            try {
              const upstream = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`, {
                headers: { Accept: 'text/csv' },
              })

              if (!upstream.ok) {
                const text = await upstream.text().catch(() => '')
                res.statusCode = upstream.status
                res.setHeader('Content-Type', 'application/json; charset=utf-8')
                res.end(JSON.stringify({ error: 'Upstream API error', details: text || undefined }))
                return
              }

              const csv = await upstream.text()
              const lines = csv
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter((l) => l.length > 0)

              if (lines.length < 3) {
                res.statusCode = 404
                res.setHeader('Content-Type', 'application/json; charset=utf-8')
                res.end(JSON.stringify({ error: 'No candle data available for symbol' }))
                return
              }

              const header = lines[0]
              const headerCols = header.split(',')
              const dateIdx = headerCols.indexOf('Date')
              const closeIdx = headerCols.indexOf('Close')

              if (dateIdx === -1 || closeIdx === -1) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json; charset=utf-8')
                res.end(JSON.stringify({ error: 'Unexpected CSV format from upstream provider' }))
                return
              }

              const rows = lines.slice(1)
              const parsed = rows
                .map((line) => line.split(','))
                .map((cols) => {
                  const dateStr = cols[dateIdx]
                  const closeStr = cols[closeIdx]
                  const close = Number(closeStr)
                  const ms = Date.parse(`${dateStr}T00:00:00Z`)
                  const t = Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN
                  return { t, c: close }
                })
                .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c) && p.c > 0)

              const points = parsed.slice(-7)

              if (points.length < 2) {
                res.statusCode = 404
                res.setHeader('Content-Type', 'application/json; charset=utf-8')
                res.end(JSON.stringify({ error: 'Not enough candle data to render chart' }))
                return
              }

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ symbol, points }))
            } catch (err: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: 'Failed to fetch candles', details: err?.message }))
            }
          })
        },
      },
    ],
  }
})
