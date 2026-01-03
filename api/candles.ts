const STOOQ_BASE_URL = 'https://stooq.com/q/d/l/'

function getStringQueryParam(url: URL, name: string): string | null {
  const raw = url.searchParams.get(name)
  if (!raw) return null
  const trimmed = raw.trim().toUpperCase()
  return trimmed.length > 0 ? trimmed : null
}

function json(res: any, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method Not Allowed' })
  }

  const url = new URL(req.url, 'http://localhost')
  const symbol = getStringQueryParam(url, 'symbol')

  if (!symbol) {
    return json(res, 400, { error: 'Missing required query param: symbol' })
  }

  if (!/^[A-Z0-9.-]{1,10}$/.test(symbol)) {
    return json(res, 400, { error: 'Invalid symbol format' })
  }

  // Stooq uses lowercase symbols and a country suffix for US equities.
  // Example: AAPL -> aapl.us
  const stooqSymbol = `${symbol.toLowerCase()}.us`

  try {
    const upstream = await fetch(`${STOOQ_BASE_URL}?s=${encodeURIComponent(stooqSymbol)}&i=d`, {
      headers: { Accept: 'text/csv' },
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return json(res, upstream.status, { error: 'Upstream API error', details: text || undefined })
    }

    const csv = await upstream.text()
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length < 3) {
      return json(res, 404, { error: 'No candle data available for symbol' })
    }

    const header = lines[0]
    const headerCols = header.split(',')
    const dateIdx = headerCols.indexOf('Date')
    const closeIdx = headerCols.indexOf('Close')

    if (dateIdx === -1 || closeIdx === -1) {
      return json(res, 500, { error: 'Unexpected CSV format from upstream provider' })
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
      return json(res, 404, { error: 'Not enough candle data to render chart' })
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')

    return json(res, 200, {
      symbol,
      points,
    })
  } catch (err: any) {
    return json(res, 500, { error: 'Failed to fetch candles', details: err?.message })
  }
}
