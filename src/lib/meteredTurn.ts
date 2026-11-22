/**
 * Metered TURN Server REST API Service (Server-Side Only)
 *
 * Docs: https://www.metered.ca/docs/llms-turn-server.txt
 *
 * Security rules:
 * - Reads METERED_APP_NAME and METERED_SECRET_KEY strictly from server env vars.
 * - NEVER hard-codes or returns METERED_SECRET_KEY to the browser.
 * - Caches & rotates credentials ahead of expiry (24h TTL, overlap rotation at 12h)
 *   so Metered's up-to-2-minute global propagation delay never breaks active calls.
 */

export interface MeteredCredential {
  username: string
  password: string
  apiKey: string
  expiryInSeconds: number
  label: string
  createdAt: number
  expiresAt: number
}

export interface MeteredAccountUsage {
  quotaInGB: number
  usageInGB: number
  overageInGB: number
}

export interface MeteredCredentialUsage {
  username: string
  label?: string
  usageInGB: number
}

export interface MeteredUsageReport {
  appName: string
  account: MeteredAccountUsage | null
  credentials: MeteredCredentialUsage[]
  hasMore: boolean
  activeCredential?: {
    username: string
    label: string
    expiresAt: string
    propagating: boolean
  } | null
}

const DEFAULT_EXPIRY_SECONDS = 86_400 // 24 hours
const ROTATE_BEFORE_EXPIRY_MS = 12 * 60 * 60 * 1000 // rotate at half-lifetime (12h overlap)
const PROPAGATION_DELAY_MS = 2 * 60 * 1000 // Metered global propagation window (up to 2 min)
const DEFAULT_LABEL = 'os-secos-24h'

// Persist across Next.js hot reloads / warm serverless invocations
interface MeteredCacheState {
  active: MeteredCredential | null
  previous: MeteredCredential | null
  tracked: Map<string, { username: string; label: string; expiresAt: number }>
  inFlightCreation: Promise<MeteredCredential> | null
}

const globalForMetered = globalThis as unknown as {
  __osSecosMeteredTurnCache?: MeteredCacheState
}

const cache: MeteredCacheState =
  globalForMetered.__osSecosMeteredTurnCache ??
  (globalForMetered.__osSecosMeteredTurnCache = {
    active: null,
    previous: null,
    tracked: new Map(),
    inFlightCreation: null,
  })

function getMeteredBaseUrl(): string {
  const appName = process.env.METERED_APP_NAME?.trim()
  if (!appName) {
    throw new Error('METERED_APP_NAME environment variable is not set.')
  }
  return `https://${appName}.metered.live`
}

function getMeteredSecretKey(): string {
  const secretKey = process.env.METERED_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new Error('METERED_SECRET_KEY environment variable is not set.')
  }
  return secretKey
}

export function isMeteredConfigured(): boolean {
  return Boolean(
    process.env.METERED_APP_NAME?.trim() &&
      (process.env.METERED_SECRET_KEY?.trim() || process.env.METERED_API_KEY?.trim())
  )
}

export function isMeteredSecretConfigured(): boolean {
  return Boolean(process.env.METERED_APP_NAME?.trim() && process.env.METERED_SECRET_KEY?.trim())
}

/**
 * Creates a new auto-expiring Metered TURN credential via REST API (default: 24 hours).
 * POST /api/v1/turn/credential?secretKey=<SECRET_KEY>
 */
export async function createMeteredCredential(options?: {
  expiryInSeconds?: number
  label?: string
}): Promise<MeteredCredential> {
  const baseUrl = getMeteredBaseUrl()
  const secretKey = getMeteredSecretKey()
  const expiryInSeconds = options?.expiryInSeconds ?? DEFAULT_EXPIRY_SECONDS
  const label = options?.label ?? DEFAULT_LABEL

  const res = await fetch(
    `${baseUrl}/api/v1/turn/credential?secretKey=${encodeURIComponent(secretKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiryInSeconds, label }),
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Metered create credential failed (${res.status}): ${errText}`)
  }

  const data = (await res.json()) as {
    username: string
    password: string
    apiKey: string
    expiryInSeconds?: number
    label?: string
  }

  const now = Date.now()
  const ttl = data.expiryInSeconds ?? expiryInSeconds
  const cred: MeteredCredential = {
    username: data.username,
    password: data.password,
    apiKey: data.apiKey,
    expiryInSeconds: ttl,
    label: data.label ?? label,
    createdAt: now,
    expiresAt: now + ttl * 1000,
  }

  // Keep the previous credential during the overlap / propagation window
  if (cache.active && cache.active.expiresAt > now) {
    cache.previous = cache.active
  }
  cache.active = cred
  cache.tracked.set(cred.username, {
    username: cred.username,
    label: cred.label,
    expiresAt: cred.expiresAt,
  })

  return cred
}

/**
 * Tries to discover an existing active credential with our label on cold start
 * (works on Metered paid plans; returns null gracefully on Free plan).
 * GET /api/v2/turn/credentials?secretKey=<SECRET_KEY>&label=<LABEL>
 */
async function tryReuseExistingCredential(label = DEFAULT_LABEL): Promise<MeteredCredential | null> {
  try {
    const baseUrl = getMeteredBaseUrl()
    const secretKey = getMeteredSecretKey()
    const res = await fetch(
      `${baseUrl}/api/v2/turn/credentials?secretKey=${encodeURIComponent(secretKey)}&label=${encodeURIComponent(label)}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return null

    const body = (await res.json()) as {
      data?: Array<{
        username: string
        password: string
        apiKey: string
        expiryInSeconds?: number
        label?: string
        expired?: boolean
      }>
    }

    const valid = body.data?.find((c) => !c.expired && c.apiKey && c.username)
    if (!valid) return null

    const now = Date.now()
    const ttl = valid.expiryInSeconds ?? DEFAULT_EXPIRY_SECONDS
    // Already exists remotely -> assume already propagated
    const cred: MeteredCredential = {
      username: valid.username,
      password: valid.password,
      apiKey: valid.apiKey,
      expiryInSeconds: ttl,
      label: valid.label ?? label,
      createdAt: now - PROPAGATION_DELAY_MS - 1000,
      expiresAt: now + Math.max(3600, Math.floor(ttl / 2)) * 1000,
    }
    cache.active = cred
    cache.tracked.set(cred.username, {
      username: cred.username,
      label: cred.label,
      expiresAt: cred.expiresAt,
    })
    return cred
  } catch {
    return null
  }
}

/**
 * Returns a ready-to-use 24h Metered credential, proactively rotating at half-lifetime (12h)
 * while continuing to serve the previously propagated credential during the 2-minute propagation window.
 */
export async function getOrRotateMeteredCredential(): Promise<MeteredCredential> {
  const now = Date.now()

  // 1. If active credential is healthy and outside rotation threshold, reuse it immediately
  if (cache.active && cache.active.expiresAt - now > ROTATE_BEFORE_EXPIRY_MS) {
    // If active was just created (< 2 min ago) and we still have a valid propagated previous one, serve previous!
    if (
      now - cache.active.createdAt < PROPAGATION_DELAY_MS &&
      cache.previous &&
      cache.previous.expiresAt > now + 60_000
    ) {
      return cache.previous
    }
    return cache.active
  }

  // 2. If active credential is valid but approaching half-life, trigger background rotation & return active now
  if (cache.active && cache.active.expiresAt > now + 5 * 60_000) {
    if (!cache.inFlightCreation) {
      cache.inFlightCreation = createMeteredCredential({
        expiryInSeconds: DEFAULT_EXPIRY_SECONDS,
        label: DEFAULT_LABEL,
      }).finally(() => {
        cache.inFlightCreation = null
      })
    }
    return cache.active
  }

  // 3. Cold start or expired: serialize creation so concurrent requests don't mint duplicate credentials
  if (!cache.inFlightCreation) {
    cache.inFlightCreation = (async () => {
      const reused = await tryReuseExistingCredential(DEFAULT_LABEL)
      if (reused) return reused
      return createMeteredCredential({
        expiryInSeconds: DEFAULT_EXPIRY_SECONDS,
        label: DEFAULT_LABEL,
      })
    })().finally(() => {
      cache.inFlightCreation = null
    })
  }

  return cache.inFlightCreation
}

/**
 * Fetches the ICE Servers array using a credential-scoped apiKey.
 * GET /api/v1/turn/credentials?apiKey=<CREDENTIAL_API_KEY>
 */
export async function fetchIceServersByApiKey(
  apiKey: string,
  region?: string
): Promise<RTCIceServer[]> {
  const baseUrl = getMeteredBaseUrl()
  const params = new URLSearchParams({ apiKey })
  const targetRegion = region?.trim() || process.env.METERED_REGION?.trim()
  if (targetRegion) {
    params.set('region', targetRegion)
  }

  const res = await fetch(`${baseUrl}/api/v1/turn/credentials?${params.toString()}`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Metered get ICE servers failed (${res.status}): ${errText}`)
  }

  const data = (await res.json()) as RTCIceServer[]
  if (!Array.isArray(data)) {
    throw new Error('Unexpected response format from Metered ICE servers endpoint.')
  }
  return data
}

/**
 * Serves the ICE server array for WebRTC clients using Metered REST API.
 * Prefers dynamic 24h rotating credentials when METERED_SECRET_KEY is configured,
 * falling back cleanly to METERED_API_KEY (or using METERED_API_KEY while a brand-new
 * dynamic credential finishes its 2-minute global propagation).
 */
export async function getMeteredIceServers(region?: string): Promise<{
  iceServers: RTCIceServer[]
  credentialUsername?: string
  expiresAt?: string
  propagating?: boolean
}> {
  const staticApiKey = process.env.METERED_API_KEY?.trim()

  if (isMeteredSecretConfigured()) {
    try {
      const cred = await getOrRotateMeteredCredential()
      const propagating = Date.now() - cred.createdAt < PROPAGATION_DELAY_MS

      // If this credential was just minted and a pre-propagated METERED_API_KEY exists,
      // serve the pre-propagated key during the 2-minute propagation window so calls connect immediately.
      if (propagating && staticApiKey) {
        const iceServers = await fetchIceServersByApiKey(staticApiKey, region)
        return {
          iceServers,
          credentialUsername: cred.username,
          expiresAt: new Date(cred.expiresAt).toISOString(),
          propagating: true,
        }
      }

      const iceServers = await fetchIceServersByApiKey(cred.apiKey, region)
      return {
        iceServers,
        credentialUsername: cred.username,
        expiresAt: new Date(cred.expiresAt).toISOString(),
        propagating,
      }
    } catch (err) {
      if (staticApiKey) {
        console.warn('Metered dynamic credential failed, falling back to METERED_API_KEY:', err)
        const iceServers = await fetchIceServersByApiKey(staticApiKey, region)
        return { iceServers }
      }
      throw err
    }
  }

  if (staticApiKey) {
    const iceServers = await fetchIceServersByApiKey(staticApiKey, region)
    return { iceServers }
  }

  throw new Error('Metered is not configured (set METERED_APP_NAME and METERED_SECRET_KEY or METERED_API_KEY).')
}

/**
 * Fetches total account TURN usage for the current billing cycle.
 * GET /api/v1/turn/current_usage?secretKey=<SECRET_KEY>
 */
export async function getMeteredAccountUsage(): Promise<MeteredAccountUsage> {
  const baseUrl = getMeteredBaseUrl()
  const secretKey = getMeteredSecretKey()

  const res = await fetch(
    `${baseUrl}/api/v1/turn/current_usage?secretKey=${encodeURIComponent(secretKey)}`,
    { cache: 'no-store' }
  )
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Metered current_usage failed (${res.status}): ${errText}`)
  }
  return (await res.json()) as MeteredAccountUsage
}

/**
 * Fetches TURN bandwidth usage (in GB) for a specific credential username.
 * GET /api/v1/turn/current_usage_for_user?secretKey=<SECRET_KEY>&username=<USERNAME>
 */
export async function getMeteredUsageForCredential(
  username: string
): Promise<MeteredCredentialUsage> {
  const baseUrl = getMeteredBaseUrl()
  const secretKey = getMeteredSecretKey()

  const res = await fetch(
    `${baseUrl}/api/v1/turn/current_usage_for_user?secretKey=${encodeURIComponent(secretKey)}&username=${encodeURIComponent(username)}`,
    { cache: 'no-store' }
  )
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Metered current_usage_for_user failed (${res.status}): ${errText}`)
  }

  const data = (await res.json()) as { usageInGB: number }
  const tracked = cache.tracked.get(username)
  return {
    username,
    label: tracked?.label,
    usageInGB: data.usageInGB ?? 0,
  }
}

/**
 * Monitors TURN usage across credentials + overall account quota.
 * Uses GET /api/v2/turn/current_usage_by_user when available, and gracefully falls back
 * to polling GET /api/v1/turn/current_usage_for_user for all tracked credentials on Free plans.
 */
export async function getMeteredUsageReport(page = 1): Promise<MeteredUsageReport> {
  const baseUrl = getMeteredBaseUrl()
  const secretKey = getMeteredSecretKey()
  const appName = process.env.METERED_APP_NAME!.trim()

  const account = await getMeteredAccountUsage().catch(() => null)
  let credentials: MeteredCredentialUsage[] = []
  let hasMore = false

  // Try v2 paginated usage-by-user endpoint first
  try {
    const v2Res = await fetch(
      `${baseUrl}/api/v2/turn/current_usage_by_user?secretKey=${encodeURIComponent(secretKey)}&page=${page}`,
      { cache: 'no-store' }
    )
    if (v2Res.ok) {
      const v2Data = (await v2Res.json()) as {
        data?: MeteredCredentialUsage[]
        has_more?: boolean
      }
      credentials = Array.isArray(v2Data.data) ? v2Data.data : []
      hasMore = Boolean(v2Data.has_more)
    }
  } catch {
    // Fall back below
  }

  // Fallback for Free plan (v2 returns 400): query v1/current_usage_for_user for tracked credentials
  if (credentials.length === 0 && cache.tracked.size > 0) {
    const settled = await Promise.allSettled(
      Array.from(cache.tracked.keys()).map((u) => getMeteredUsageForCredential(u))
    )
    credentials = settled
      .filter((r): r is PromiseFulfilledResult<MeteredCredentialUsage> => r.status === 'fulfilled')
      .map((r) => r.value)
  }

  return {
    appName,
    account,
    credentials,
    hasMore,
    activeCredential: cache.active
      ? {
          username: cache.active.username,
          label: cache.active.label,
          expiresAt: new Date(cache.active.expiresAt).toISOString(),
          propagating: Date.now() - cache.active.createdAt < PROPAGATION_DELAY_MS,
        }
      : null,
  }
}

/**
 * Deletes a specific TURN credential immediately (e.g., if leaked).
 * DELETE /api/v1/turn/credential?secretKey=<SECRET_KEY>
 */
export async function deleteMeteredCredential(username: string): Promise<void> {
  const baseUrl = getMeteredBaseUrl()
  const secretKey = getMeteredSecretKey()

  const res = await fetch(
    `${baseUrl}/api/v1/turn/credential?secretKey=${encodeURIComponent(secretKey)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
      cache: 'no-store',
    }
  )
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Metered delete credential failed (${res.status}): ${errText}`)
  }

  cache.tracked.delete(username)
  if (cache.active?.username === username) cache.active = null
  if (cache.previous?.username === username) cache.previous = null
}
