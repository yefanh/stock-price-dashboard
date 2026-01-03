# Stock Price Dashboard

A simple stock price dashboard built with React and Tailwind CSS.

## Features

- Displays a watchlist of stock quotes in a table
- Shows price and daily percent change
- Loading and error states
- Search and sortable columns (small UX improvement)

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Finnhub API (quotes)

## Local Development

1) Install dependencies

```bash
npm install
```

2) Create a `.env` file (do not commit it)

```bash
cp .env.example .env
```

Set `FINNHUB_API_KEY` in `.env`.

3) Start the dev server

```bash
npm run dev
```

Open the URL printed in the terminal.

## How the API key is handled

The browser calls `/api/quote?symbol=...`.

- In production on Vercel, this is implemented as a serverless function in `api/quote.ts`.
- In local development, a small Vite dev-server middleware handles the same path so you can run `npm run dev` without extra tooling.

This keeps `FINNHUB_API_KEY` on the server side and out of the client bundle.

## Deployment (Vercel)

1) Import the GitHub repo into Vercel
2) Add an environment variable: `FINNHUB_API_KEY`
3) Deploy
