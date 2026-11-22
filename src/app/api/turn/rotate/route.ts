import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createMeteredCredential, isMeteredSecretConfigured } from '@/lib/meteredTurn'

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

async function handleRotate(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isMeteredSecretConfigured()) {
    return NextResponse.json(
      { error: 'Set METERED_APP_NAME and METERED_SECRET_KEY on the server.' },
      { status: 503 }
    )
  }

  try {
    let expiryInSeconds = 86_400 // 24 hours default
    let label = 'os-secos-24h'

    if (request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        expiryInSeconds?: number
        label?: string
      }
      if (typeof body.expiryInSeconds === 'number' && body.expiryInSeconds > 0) {
        expiryInSeconds = Math.floor(body.expiryInSeconds)
      }
      if (typeof body.label === 'string' && body.label.trim().length > 0) {
        label = body.label.trim().slice(0, 99)
      }
    }

    const cred = await createMeteredCredential({ expiryInSeconds, label })
    return NextResponse.json(
      {
        username: cred.username,
        label: cred.label,
        expiryInSeconds: cred.expiryInSeconds,
        expiresAt: new Date(cred.expiresAt).toISOString(),
        propagationNote:
          'New Metered credentials take up to 2 minutes to propagate globally. Call this endpoint ahead of expiry (e.g. every 12h via cron).',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to rotate Metered TURN credential'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return handleRotate(request)
}

// Also supports GET for Vercel Cron jobs (with Authorization: Bearer <CRON_SECRET>)
export async function GET(request: Request) {
  return handleRotate(request)
}
