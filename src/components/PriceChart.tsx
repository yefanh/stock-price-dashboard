import {
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip)

export type PriceChartPoint = {
  label: string
  value: number
}

type Props = {
  title: string
  points: PriceChartPoint[]
}

export function PriceChart({ title, points }: Props) {
  const labels = points.map((p) => p.label)
  const values = points.map((p) => p.value)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <div className="text-xs text-slate-500">Last 7 trading days</div>
      </div>

      <div className="h-44">
        <Line
          data={{
            labels,
            datasets: [
              {
                label: 'Close',
                data: values,
                tension: 0.25,
                pointRadius: 2,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const y = ctx.parsed.y
                    return typeof y === 'number' ? `$${y.toFixed(2)}` : ''
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { maxRotation: 0, autoSkip: true },
              },
              y: {
                grid: { color: 'rgba(148, 163, 184, 0.35)' },
                ticks: {
                  callback: (v) => `$${v}`,
                },
              },
            },
          }}
        />
      </div>
    </div>
  )
}
