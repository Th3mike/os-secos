import { NextResponse } from 'next/server'
import { getMeteredIceServers, isMeteredConfigured } from '@/lib/meteredTurn'

const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const region = searchParams.get('region') || undefined

  // 1. Metered.ca TURN (supports dynamic 24h credentials via METERED_SECRET_KEY or static METERED_API_KEY)
  if (isMeteredConfigured()) {
    try {
      const result = await getMeteredIceServers(region)
      if (result.iceServers.length > 0) {
        return NextResponse.json(
          {
            iceServers: [...DEFAULT_STUN_SERVERS, ...result.iceServers],
            hasTurn: true,
            provider: 'metered',
            ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}),
            ...(result.propagating !== undefined ? { propagating: result.propagating } : {}),
          },
          { headers: { 'Cache-Control': 'no-store' } }
        )
      }
    } catch (err) {
      console.error('Failed to fetch Metered TURN ICE servers:', err)
    }
  }

  // 2. Cloudflare Calls TURN (1 TB/month free tier — generates short-lived credentials securely)
  const cfTokenId = process.env.CLOUDFLARE_TURN_TOKEN_ID
  const cfApiToken = process.env.CLOUDFLARE_TURN_API_TOKEN

  if (cfTokenId && cfApiToken) {
    try {
      const res = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${cfTokenId}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl: 86400 }),
          cache: 'no-store',
        }
      )
      if (res.ok) {
        const data = (await res.json()) as { iceServers?: RTCIceServer | RTCIceServer[] }
        const turnServers = Array.isArray(data.iceServers)
          ? data.iceServers
          : data.iceServers
            ? [data.iceServers]
            : []
        if (turnServers.length > 0) {
          return NextResponse.json(
            { iceServers: [...DEFAULT_STUN_SERVERS, ...turnServers], hasTurn: true, provider: 'cloudflare' },
            { headers: { 'Cache-Control': 'no-store' } }
          )
        }
      }
    } catch (err) {
      console.error('Failed to fetch Cloudflare TURN credentials:', err)
    }
  }

  // 3. Static TURN server (coturn / Xirsys / Twilio / custom)
  const turnUrlRaw = process.env.TURN_URL
  const turnUsername = process.env.TURN_USERNAME
  const turnCredential = process.env.TURN_CREDENTIAL

  if (turnUrlRaw) {
    const urls = turnUrlRaw
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)
    if (urls.length > 0) {
      const customTurn: RTCIceServer = {
        urls: urls.length === 1 ? urls[0] : urls,
        ...(turnUsername ? { username: turnUsername } : {}),
        ...(turnCredential ? { credential: turnCredential } : {}),
      }
      return NextResponse.json(
        { iceServers: [...DEFAULT_STUN_SERVERS, customTurn], hasTurn: true, provider: 'custom' },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }
  }

  return NextResponse.json(
    { iceServers: DEFAULT_STUN_SERVERS, hasTurn: false, provider: 'stun-only' },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
