const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

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

  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    return json(res, 500, { error: 'Missing FINNHUB_API_KEY server environment variable' })
  }

  const url = new URL(req.url, 'http://localhost')
  const symbol = getStringQueryParam(url, 'symbol')

  if (!symbol) {
    return json(res, 400, { error: 'Missing required query param: symbol' })
  }

  // Basic validation: 1-10 chars, uppercase letters/numbers/dot/dash only.
  if (!/^[A-Z0-9.-]{1,10}$/.test(symbol)) {
    return json(res, 400, { error: 'Invalid symbol format' })
  }

  try {
    const upstream = await fetch(`${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return json(res, upstream.status, {
        error: 'Upstream API error',
        details: text || undefined,
      })
    }

    const data = (await upstream.json()) as {
      c: number
      d: number
      dp: number
      t: number
    }

    // Finnhub returns 0 for unknown symbols sometimes.
    if (!data || typeof data.c !== 'number' || data.c <= 0) {
      return json(res, 404, { error: 'Quote not found for symbol' })
    }

    // Cache for a short period to reduce rate-limit pressure.
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')

    return json(res, 200, {
      symbol,
      price: data.c,
      change: data.d,
      changePercent: data.dp,
      marketTimestamp: data.t,
    })
  } catch (err: any) {
    return json(res, 500, { error: 'Failed to fetch quote', details: err?.message })
  }
}
