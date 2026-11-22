import { NextResponse } from 'next/server'

const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

export const dynamic = 'force-dynamic'

export async function GET() {
  // 1. Cloudflare Calls TURN (1 TB/month free tier — generates short-lived credentials securely)
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
            { iceServers: [...DEFAULT_STUN_SERVERS, ...turnServers], hasTurn: true },
            { headers: { 'Cache-Control': 'no-store' } }
          )
        }
      }
    } catch (err) {
      console.error('Failed to fetch Cloudflare TURN credentials:', err)
    }
  }

  // 2. Metered.ca TURN (free tier supported)
  const meteredApp = process.env.METERED_APP_NAME
  const meteredKey = process.env.METERED_API_KEY

  if (meteredApp && meteredKey) {
    try {
      const res = await fetch(
        `https://${meteredApp}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(meteredKey)}`,
        { cache: 'no-store' }
      )
      if (res.ok) {
        const data = (await res.json()) as RTCIceServer[]
        if (Array.isArray(data) && data.length > 0) {
          return NextResponse.json(
            { iceServers: [...DEFAULT_STUN_SERVERS, ...data], hasTurn: true },
            { headers: { 'Cache-Control': 'no-store' } }
          )
        }
      }
    } catch (err) {
      console.error('Failed to fetch Metered TURN credentials:', err)
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
        { iceServers: [...DEFAULT_STUN_SERVERS, customTurn], hasTurn: true },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }
  }

  return NextResponse.json(
    { iceServers: DEFAULT_STUN_SERVERS, hasTurn: false },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
