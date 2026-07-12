import { GRIDLOCK_API_URL } from './settings.js'
import { fetchWalletJobs } from './wallet-jobs.js'

/** Matches router worker-stats fee share display (20% WORKER_BPS). */
const WORKER_FEE_SHARE = 0.2

export type EarningsDay = { day: string; earn: number; jobs: number }

export type WorkerEarningsView = {
  today: number
  week: number
  total: number
  penalties_paid: number
  earnings_wallet: string | null
  sla_pass_rate: number | null
  jobs_today: number
  history: EarningsDay[]
  source: 'router' | 'local'
}

type RouterWorker = {
  earnings_today?: number
  penalties_paid?: number
  earnings_wallet?: string
  sla_pass_rate?: number
  jobs_today?: number
}

function dayKey(tsSec: number): string {
  const d = new Date(tsSec * 1000)
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

function aggregateFromJobs(jobs: Awaited<ReturnType<typeof fetchWalletJobs>>): Pick<
  WorkerEarningsView,
  'today' | 'week' | 'total' | 'penalties_paid' | 'history'
> {
  const now = Date.now() / 1000
  const dayStart = now - 86400
  const weekStart = now - 7 * 86400

  let today = 0
  let week = 0
  let total = 0
  let penalties_paid = 0
  const byDay = new Map<string, { earn: number; jobs: number }>()

  for (const job of jobs) {
    if (job.status !== 'completed') continue
    const earn = Math.round(job.earn * WORKER_FEE_SHARE * 10000) / 10000
    const ts = job.ts || now
    total += earn
    if (ts >= weekStart) week += earn
    if (ts >= dayStart) today += earn

    const key = dayKey(ts)
    const bucket = byDay.get(key) ?? { earn: 0, jobs: 0 }
    bucket.earn += earn
    bucket.jobs += 1
    byDay.set(key, bucket)
  }

  const history: EarningsDay[] = []
  for (let i = 6; i >= 0; i--) {
    const t = now - i * 86400
    const key = dayKey(t)
    const bucket = byDay.get(key) ?? { earn: 0, jobs: 0 }
    history.push({ day: key, earn: Math.round(bucket.earn * 10000) / 10000, jobs: bucket.jobs })
  }

  return {
    today: Math.round(today * 10000) / 10000,
    week: Math.round(week * 10000) / 10000,
    total: Math.round(total * 10000) / 10000,
    penalties_paid: Math.round(penalties_paid * 10000) / 10000,
    history,
  }
}

export async function fetchWorkerEarningsFromRouter(wallet: string): Promise<WorkerEarningsView | null> {
  try {
    const [workerRes, jobs] = await Promise.all([
      fetch(`${GRIDLOCK_API_URL}/v1/workers/${encodeURIComponent(wallet)}`),
      fetchWalletJobs(wallet, 100),
    ])

    if (!workerRes.ok) return null
    const worker = (await workerRes.json()) as RouterWorker
    const fromJobs = aggregateFromJobs(jobs)

    let penalties_paid = Number(worker.penalties_paid ?? 0)
    if (penalties_paid <= 0) {
      penalties_paid = jobs.reduce((sum, j) => sum + j.penalty_paid, 0)
    }

    return {
      today: Number(worker.earnings_today ?? fromJobs.today),
      week: fromJobs.week,
      total: fromJobs.total,
      penalties_paid,
      earnings_wallet: worker.earnings_wallet ?? null,
      sla_pass_rate: worker.sla_pass_rate ?? null,
      jobs_today: Number(worker.jobs_today ?? 0),
      history: fromJobs.history,
      source: 'router',
    }
  } catch {
    return null
  }
}
