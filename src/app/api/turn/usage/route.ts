import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getMeteredUsageForCredential,
  getMeteredUsageReport,
  isMeteredSecretConfigured,
} from '@/lib/meteredTurn'

export const dynamic = 'force-dynamic'

async function isAuthorized(request: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = request.headers.get('authorization')
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true
  }

  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return Boolean(data.user)
  } catch {
    return false
  }
}

/**
 * Monitors Metered TURN bandwidth usage per credential and account totals.
 * - GET /api/turn/usage                  -> account totals + all credentials (paginated via ?page=1)
 * - GET /api/turn/usage?username=<USER>  -> usage in GB for a specific credential username
 */
export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isMeteredSecretConfigured()) {
    return NextResponse.json(
      { error: 'Set METERED_APP_NAME and METERED_SECRET_KEY on the server to monitor usage.' },
      { status: 503 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')?.trim()

    if (username) {
      const usage = await getMeteredUsageForCredential(username)
      return NextResponse.json(usage, { headers: { 'Cache-Control': 'no-store' } })
    }

    const page = Math.max(1, Number(searchParams.get('page') || 1) || 1)
    const report = await getMeteredUsageReport(page)
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Metered TURN usage'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
