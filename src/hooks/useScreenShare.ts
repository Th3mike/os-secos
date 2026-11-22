'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import {
  UserProfile,
  SignalPayload,
  PrankEvent,
  PrankType,
  WatchTogetherState,
  CinemaPlayerState,
} from '@/types/community'
import { playRoomEventSound } from '@/lib/soundEngine'
import type { RealtimeChannel } from '@supabase/supabase-js'

const DEFAULT_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  // max-bundle + rtcpMuxPolicy: require sends audio + video + RTCP over a SINGLE UDP port,
  // dramatically improving direct P2P NAT traversal on strict home routers without needing TURN!
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 2,
}

/**
 * Prefers universal VP8 first (followed by VP9 and other codecs).
 * VP8 works reliably across every browser and GPU without H.264 hardware-decode black screens.
 */
function preferUniversalVP8Codec(pc: RTCPeerConnection) {
  try {
    if (typeof RTCRtpSender === 'undefined' || !RTCRtpSender.getCapabilities) return
    const caps = RTCRtpSender.getCapabilities('video')
    if (!caps || !caps.codecs) return

    const vp8Codecs = caps.codecs.filter((c) => c.mimeType.toLowerCase() === 'video/vp8')
    const vp9Codecs = caps.codecs.filter((c) => c.mimeType.toLowerCase() === 'video/vp9')
    const otherCodecs = caps.codecs.filter((c) => {
      const m = c.mimeType.toLowerCase()
      return m !== 'video/vp8' && m !== 'video/vp9'
    })
    if (vp8Codecs.length === 0) return

    const ordered = [...vp8Codecs, ...vp9Codecs, ...otherCodecs]
    for (const transceiver of pc.getTransceivers()) {
      if (
        transceiver.sender.track?.kind === 'video' &&
        typeof transceiver.setCodecPreferences === 'function'
      ) {
        transceiver.setCodecPreferences(ordered)
      }
    }
  } catch {
    // Ignore if browser doesn't support setCodecPreferences
  }
}

function computePerPeerMaxKbps(
  resolution: '720p' | '1080p' | '1440p',
  fps: number,
  peerCount: number
): number {
  const singlePeerMaxKbps =
    resolution === '1440p'
      ? fps === 120
        ? 9000
        : 7000
      : resolution === '1080p'
        ? fps === 120
          ? 6500
          : 4500
        : 3000

  const count = Math.max(1, peerCount)
  if (count === 1) return singlePeerMaxKbps
  // Full-mesh P2P sends one stream per peer: share upload budget cleanly so
  // multiple viewers stay smooth without dropping keyframes!
  const totalUploadBudgetKbps = 12000
  return Math.max(1500, Math.min(singlePeerMaxKbps, Math.round(totalUploadBudgetKbps / count)))
}

export interface RemoteStreamItem {
  peerId: string
  user: UserProfile
  stream: MediaStream
  relayedBy?: string | null
}

export interface RemoteAudioItem {
  peerId: string
  user: UserProfile
  stream: MediaStream
}

export interface ScreenShareOptions {
  resolution: '720p' | '1080p' | '1440p'
  fps: 30 | 60 | 120
  includeAudio: boolean
  surface?: 'window' | 'monitor' | 'browser'
}

const SHARE_OPTIONS_KEY = 'os_secos_screen_share_options_v1'

export function loadScreenShareOptions(): ScreenShareOptions {
  if (typeof window === 'undefined') {
    return { resolution: '1080p', fps: 60, includeAudio: true, surface: 'monitor' }
  }
  try {
    const raw = localStorage.getItem(SHARE_OPTIONS_KEY)
    if (!raw) {
      return { resolution: '1080p', fps: 60, includeAudio: true, surface: 'monitor' }
    }
    const parsed = JSON.parse(raw)
    const resolution =
      parsed.resolution === '720p' || parsed.resolution === '1080p' || parsed.resolution === '1440p'
        ? parsed.resolution
        : '1080p'
    const fps =
      parsed.fps === 30 || parsed.fps === 60 || parsed.fps === 120 ? parsed.fps : 60
    const includeAudio = parsed.includeAudio ?? true
    const surface =
      parsed.surface === 'window' || parsed.surface === 'monitor' || parsed.surface === 'browser'
        ? parsed.surface
        : 'monitor'
    return { resolution, fps, includeAudio, surface }
  } catch {
    return { resolution: '1080p', fps: 60, includeAudio: true, surface: 'monitor' }
  }
}

export function saveScreenShareOptions(opts: ScreenShareOptions) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SHARE_OPTIONS_KEY, JSON.stringify(opts))
  } catch {
    // ignore
  }
}

export type NoiseSuppressionMode = 'krisp' | 'standard' | 'off'

export interface MicAudioSettings {
  mode: NoiseSuppressionMode
  echoCancellation: boolean
  autoGainControl: boolean
}

const MIC_SETTINGS_KEY = 'os_secos_mic_settings_v1'

export function loadMicSettings(): MicAudioSettings {
  if (typeof window === 'undefined') {
    return { mode: 'krisp', echoCancellation: true, autoGainControl: true }
  }
  try {
    const raw = localStorage.getItem(MIC_SETTINGS_KEY)
    if (!raw) return { mode: 'krisp', echoCancellation: true, autoGainControl: true }
    const parsed = JSON.parse(raw)
    return {
      mode: parsed.mode || 'krisp',
      echoCancellation: parsed.echoCancellation ?? true,
      autoGainControl: parsed.autoGainControl ?? true,
    }
  } catch {
    return { mode: 'krisp', echoCancellation: true, autoGainControl: true }
  }
}

export function useScreenShare(roomId: string, currentUser: UserProfile | null) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [localWebcamStream, setLocalWebcamStream] = useState<MediaStream | null>(null)
  const [webcamEnabled, setWebcamEnabled] = useState(false)
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamItem[]>([])
  const [remoteWebcams, setRemoteWebcams] = useState<RemoteStreamItem[]>([])
  const [remoteAudios, setRemoteAudios] = useState<RemoteAudioItem[]>([])
  const [roomPeers, setRoomPeers] = useState<UserProfile[]>([])
  const [micEnabled, setMicEnabled] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [micSettings, setMicSettings] = useState<MicAudioSettings>(() => loadMicSettings())
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({})
  const [peerMuteStates, setPeerMuteStates] = useState<
    Record<string, { isMuted: boolean; isDeafened: boolean }>
  >({})
  const [peerWatchingMap, setPeerWatchingMap] = useState<
    Record<string, { user: UserProfile; watchingIds: string[] }>
  >({})
  const [activePrank, setActivePrank] = useState<PrankEvent | null>(null)
  const [watchState, setWatchState] = useState<WatchTogetherState | null>(null)
  const [cinemaPlayers, setCinemaPlayers] = useState<Record<string, CinemaPlayerState>>({})
  const [peerConnectionStates, setPeerConnectionStates] = useState<
    Record<string, RTCPeerConnectionState>
  >({})
  const [hasTurnServer, setHasTurnServer] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const currentUserRef = useRef<UserProfile | null>(currentUser)
  const roomPeersRef = useRef<UserProfile[]>([])
  const remoteStreamsRef = useRef<RemoteStreamItem[]>([])
  const iceConfigRef = useRef<RTCConfiguration>(DEFAULT_ICE_SERVERS)
  const localStreamRef = useRef<MediaStream | null>(null)
  const localWebcamStreamRef = useRef<MediaStream | null>(null)
  const peerMediaIdsRef = useRef<
    Map<string, { screenStreamId?: string | null; webcamStreamId?: string | null }>
  >(new Map())
  const relayedOfferMetaRef = useRef<
    Map<string, Record<string, { streamerId: string; streamerUser: UserProfile }>>
  >(new Map())
  const outgoingRelayMapRef = useRef<
    Map<string, Map<string, { stream: MediaStream; streamerUser: UserProfile; senders: RTCRtpSender[] }>>
  >(new Map())
  const shareOptionsRef = useRef<ScreenShareOptions>(loadScreenShareOptions())
  const rawMicStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const micAudioCtxRef = useRef<AudioContext | null>(null)
  const micHighpassRef = useRef<BiquadFilterNode | null>(null)
  const micNotchRef = useRef<BiquadFilterNode | null>(null)
  const micLowpassRef = useRef<BiquadFilterNode | null>(null)
  const micGateGainRef = useRef<GainNode | null>(null)
  const micSettingsRef = useRef<MicAudioSettings>(micSettings)
  const micEnabledRef = useRef(false)
  const deafenedRef = useRef(false)
  const micWasEnabledBeforeDeafenRef = useRef(false)
  const myWatchingIdsRef = useRef<string[]>([])
  const watchStateRef = useRef<WatchTogetherState | null>(null)
  const myCinemaPlayerRef = useRef<CinemaPlayerState | null>(null)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const makingOfferRef = useRef<Set<string>>(new Set())
  const peerSignalQueueRef = useRef<Map<string, Promise<void>>>(new Map())
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const peerLeaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const iceDisconnectedTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const iceFailureCountsRef = useRef<Map<string, number>>(new Map())
  const reconnectDebounceRef = useRef<Map<string, number>>(new Map())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const audioAnalyserIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const knownPeersRef = useRef<Set<string>>(new Set())
  const initialPresenceSyncedRef = useRef(false)

  // Fetch dynamic ICE/TURN servers from backend API (falls back to STUN if TURN env vars not set)
  useEffect(() => {
    let active = true
    fetch('/api/ice-servers', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { iceServers?: RTCIceServer[]; hasTurn?: boolean } | null) => {
        if (!active || !data?.iceServers || data.iceServers.length === 0) return
        iceConfigRef.current = {
          iceServers: data.iceServers,
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
          iceCandidatePoolSize: 2,
        }
        setHasTurnServer(Boolean(data.hasTurn))
      })
      .catch(() => {
        // Keep DEFAULT_ICE_SERVERS fallback
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  useEffect(() => {
    roomPeersRef.current = roomPeers
  }, [roomPeers])

  useEffect(() => {
    remoteStreamsRef.current = remoteStreams
  }, [remoteStreams])

  useEffect(() => {
    micEnabledRef.current = micEnabled
  }, [micEnabled])

  useEffect(() => {
    deafenedRef.current = deafened
  }, [deafened])

  useEffect(() => {
    watchStateRef.current = watchState
  }, [watchState])

  const cleanupPeer = useCallback((peerId: string) => {
    // Clear any pending leave / ICE disconnected timers
    const leaveTimer = peerLeaveTimersRef.current.get(peerId)
    if (leaveTimer) {
      clearTimeout(leaveTimer)
      peerLeaveTimersRef.current.delete(peerId)
    }
    const discTimer = iceDisconnectedTimersRef.current.get(peerId)
    if (discTimer) {
      clearTimeout(discTimer)
      iceDisconnectedTimersRef.current.delete(peerId)
    }
    reconnectDebounceRef.current.delete(peerId)
    iceFailureCountsRef.current.delete(peerId)
    makingOfferRef.current.delete(peerId)
    peerSignalQueueRef.current.delete(peerId)

    const pc = pcsRef.current.get(peerId)
    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.oniceconnectionstatechange = null
      pc.close()
      pcsRef.current.delete(peerId)
    }
    pendingCandidatesRef.current.delete(peerId)
    peerMediaIdsRef.current.delete(peerId)
    relayedOfferMetaRef.current.delete(peerId)
    outgoingRelayMapRef.current.delete(peerId)
    setPeerConnectionStates((prev) => {
      if (!prev[peerId]) return prev
      const copy = { ...prev }
      delete copy[peerId]
      return copy
    })
    setRemoteStreams((prev) => {
      const hadStream = prev.some((item) => item.peerId === peerId)
      if (hadStream && !deafenedRef.current) {
        playRoomEventSound('stream-stop')
      }
      return prev.filter((item) => item.peerId !== peerId)
    })
    setRemoteWebcams((prev) => prev.filter((item) => item.peerId !== peerId))
    setRemoteAudios((prev) => prev.filter((item) => item.peerId !== peerId))
    setPeerWatchingMap((prev) => {
      if (!prev[peerId]) return prev
      const copy = { ...prev }
      delete copy[peerId]
      return copy
    })
    setCinemaPlayers((prev) => {
      if (!prev[peerId]) return prev
      const copy = { ...prev }
      delete copy[peerId]
      return copy
    })
  }, [])

  /**
   * Serializes all async WebRTC signaling operations per peerId so concurrent
   * offers/answers/candidates never race on the same RTCPeerConnection.
   */
  const enqueuePeerSignal = useCallback((peerId: string, task: () => Promise<void>) => {
    const prev = peerSignalQueueRef.current.get(peerId) || Promise.resolve()
    const next = prev
      .catch(() => {})
      .then(task)
      .catch((err) => {
        console.error(`WebRTC signaling error (${peerId}):`, err)
      })
    peerSignalQueueRef.current.set(peerId, next)
    return next
  }, [])

  const sendSignal = useCallback((payload: SignalPayload) => {
    if (channelRef.current && isSupabaseConfigured()) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload,
      })
    }
  }, [])

  const getOrCreatePeerConnection = useCallback(
    (targetPeerId: string, targetUser: UserProfile, forceNew = false) => {
      const me = currentUserRef.current
      if (!me) return null

      const existing = pcsRef.current.get(targetPeerId)
      if (
        !forceNew &&
        existing &&
        existing.connectionState !== 'closed' &&
        existing.connectionState !== 'failed'
      ) {
        return existing
      }

      if (existing) {
        existing.onicecandidate = null
        existing.ontrack = null
        existing.onconnectionstatechange = null
        existing.oniceconnectionstatechange = null
        existing.close()
        pcsRef.current.delete(targetPeerId)
        pendingCandidatesRef.current.delete(targetPeerId)
      }

      const pc = new RTCPeerConnection(iceConfigRef.current)
      pcsRef.current.set(targetPeerId, pc)
      setPeerConnectionStates((prev) => ({
        ...prev,
        [targetPeerId]: pc.connectionState || 'new',
      }))

      pc.onicecandidate = (event) => {
        const curMe = currentUserRef.current
        if (event.candidate && curMe) {
          sendSignal({
            type: 'ice-candidate',
            from: curMe.id,
            fromUser: curMe,
            to: targetPeerId,
            candidate: event.candidate.toJSON(),
          })
        }
      }

      pc.ontrack = (event) => {
        const track = event.track
        if (track.readyState === 'ended') return
        const incomingStream = event.streams[0]
        const mediaIds = peerMediaIdsRef.current.get(targetPeerId)
        const relayMetaMap = relayedOfferMetaRef.current.get(targetPeerId)
        const relayInfo = incomingStream && relayMetaMap ? relayMetaMap[incomingStream.id] : undefined

        // Determine whether this stream is a P2P-relayed screen from another streamer (A -> B -> C)
        const effectivePeerId = relayInfo ? relayInfo.streamerId : targetPeerId
        const effectiveUser = relayInfo ? relayInfo.streamerUser : targetUser
        const relayedByName = relayInfo ? targetUser.username : null

        if (track.kind === 'video') {
          const isWebcam = Boolean(
            !relayInfo &&
              incomingStream &&
              mediaIds?.webcamStreamId &&
              incomingStream.id === mediaIds.webcamStreamId
          )

          // Ignore zombie/stale video transceivers from a previous screen share when we know the active screenStreamId
          if (
            !relayInfo &&
            !isWebcam &&
            incomingStream &&
            mediaIds?.screenStreamId &&
            incomingStream.id !== mediaIds.screenStreamId
          ) {
            return
          }

          const liveTracks = incomingStream
            ? incomingStream.getTracks().filter((t) => t.readyState !== 'ended')
            : [track]
          const freshStream = new MediaStream(
            liveTracks.some((t) => t.id === track.id) ? liveTracks : [...liveTracks, track]
          )

          if (isWebcam) {
            setRemoteWebcams((prev) => {
              const exists = prev.some((s) => s.peerId === effectivePeerId)
              if (exists) {
                return prev.map((s) =>
                  s.peerId === effectivePeerId
                    ? { peerId: effectivePeerId, user: effectiveUser, stream: freshStream }
                    : s
                )
              }
              return [...prev, { peerId: effectivePeerId, user: effectiveUser, stream: freshStream }]
            })
          } else {
            setRemoteStreams((prev) => {
              const existingItem = prev.find((s) => s.peerId === effectivePeerId)
              // If we already have a healthy direct (non-relayed) unmuted video track from the streamer, don't overwrite it with a relay
              if (
                relayInfo &&
                existingItem &&
                !existingItem.relayedBy &&
                existingItem.stream.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted)
              ) {
                return prev
              }
              if (!existingItem && !deafenedRef.current) {
                playRoomEventSound('stream-start')
              }
              if (existingItem) {
                return prev.map((s) =>
                  s.peerId === effectivePeerId
                    ? {
                        peerId: effectivePeerId,
                        user: effectiveUser,
                        stream: freshStream,
                        relayedBy: relayedByName,
                      }
                    : s
                )
              }
              return [
                ...prev,
                {
                  peerId: effectivePeerId,
                  user: effectiveUser,
                  stream: freshStream,
                  relayedBy: relayedByName,
                },
              ]
            })
            if (relayInfo) {
              setPeerConnectionStates((prev) => ({
                ...prev,
                [effectivePeerId]: 'connected',
              }))
            }
          }

          track.addEventListener('ended', () => {
            if (isWebcam) {
              setRemoteWebcams((prev) =>
                prev.filter(
                  (item) =>
                    item.peerId !== effectivePeerId ||
                    item.stream.getVideoTracks().some((t) => t.id !== track.id && t.readyState !== 'ended')
                )
              )
            } else {
              setRemoteStreams((prev) =>
                prev.filter(
                  (item) =>
                    item.peerId !== effectivePeerId ||
                    item.stream.getVideoTracks().some((t) => t.id !== track.id && t.readyState !== 'ended')
                )
              )
            }
          })
        } else if (track.kind === 'audio') {
          const isScreenAudio = Boolean(
            relayInfo ||
              (incomingStream &&
                (incomingStream.getVideoTracks().length > 0 ||
                  (mediaIds?.screenStreamId && incomingStream.id === mediaIds.screenStreamId)))
          )

          if (isScreenAudio && incomingStream) {
            // Attach screen-share audio track to the existing remote screen stream if audio arrived after video
            const liveTracks = incomingStream.getTracks().filter((t) => t.readyState !== 'ended')
            const combined = new MediaStream(
              liveTracks.some((t) => t.id === track.id) ? liveTracks : [...liveTracks, track]
            )
            setRemoteStreams((prev) =>
              prev.map((s) =>
                s.peerId === effectivePeerId ? { ...s, stream: combined } : s
              )
            )
          } else {
            const audioStream = new MediaStream([track])
            setRemoteAudios((prev) => {
              const exists = prev.some((s) => s.peerId === targetPeerId)
              if (exists) {
                return prev.map((s) =>
                  s.peerId === targetPeerId
                    ? { peerId: targetPeerId, user: targetUser, stream: audioStream }
                    : s
                )
              }
              return [...prev, { peerId: targetPeerId, user: targetUser, stream: audioStream }]
            })
          }
        }
      }

      const requestIceRecovery = (forceReset: boolean) => {
        const now = Date.now()
        const lastAttempt = reconnectDebounceRef.current.get(targetPeerId) || 0
        if (now - lastAttempt < 4000) return
        reconnectDebounceRef.current.set(targetPeerId, now)

        const curMe = currentUserRef.current
        if (!curMe) return

        if (forceReset) {
          // Close local PC cleanly before requesting a brand-new offer from the peer
          if (pcsRef.current.get(targetPeerId) === pc) {
            pc.onicecandidate = null
            pc.ontrack = null
            pc.onconnectionstatechange = null
            pc.oniceconnectionstatechange = null
            pc.close()
            pcsRef.current.delete(targetPeerId)
            pendingCandidatesRef.current.delete(targetPeerId)
          }
        }

        sendSignal({
          type: 'request-stream',
          from: curMe.id,
          fromUser: curMe,
          to: targetPeerId,
          iceRestart: !forceReset,
          resetConnection: forceReset,
          safeMode: forceReset,
        })

        // If direct P2P failed and there are other friends in the room, ask a connected peer to bridge the stream (A -> B -> C)!
        if (forceReset && roomPeersRef.current.length >= 3) {
          sendSignal({
            type: 'request-relay',
            from: curMe.id,
            fromUser: curMe,
            targetStreamerId: targetPeerId,
          })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pcsRef.current.get(targetPeerId) !== pc) return
        const state = pc.connectionState
        setPeerConnectionStates((prev) => ({ ...prev, [targetPeerId]: state }))

        if (state === 'connected') {
          iceFailureCountsRef.current.delete(targetPeerId)
          const discTimer = iceDisconnectedTimersRef.current.get(targetPeerId)
          if (discTimer) {
            clearTimeout(discTimer)
            iceDisconnectedTimersRef.current.delete(targetPeerId)
          }
          return
        }

        if (state === 'closed') {
          return
        }

        if (state === 'failed') {
          const fails = (iceFailureCountsRef.current.get(targetPeerId) || 0) + 1
          iceFailureCountsRef.current.set(targetPeerId, fails)
          // 1st failure: try ICE restart; 2nd+ failure: full clean peer rebuild
          requestIceRecovery(fails >= 2)
        }
      }

      pc.oniceconnectionstatechange = () => {
        if (pcsRef.current.get(targetPeerId) !== pc) return
        const iceState = pc.iceConnectionState

        if (iceState === 'connected' || iceState === 'completed') {
          iceFailureCountsRef.current.delete(targetPeerId)
          setPeerConnectionStates((prev) => ({ ...prev, [targetPeerId]: 'connected' }))
          const discTimer = iceDisconnectedTimersRef.current.get(targetPeerId)
          if (discTimer) {
            clearTimeout(discTimer)
            iceDisconnectedTimersRef.current.delete(targetPeerId)
          }
          return
        }

        if (iceState === 'disconnected') {
          if (!iceDisconnectedTimersRef.current.has(targetPeerId)) {
            const timer = setTimeout(() => {
              iceDisconnectedTimersRef.current.delete(targetPeerId)
              if (
                pcsRef.current.get(targetPeerId) === pc &&
                (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed')
              ) {
                requestIceRecovery(false)
              }
            }, 5000)
            iceDisconnectedTimersRef.current.set(targetPeerId, timer)
          }
          return
        }

        if (iceState === 'failed') {
          setPeerConnectionStates((prev) => ({ ...prev, [targetPeerId]: 'failed' }))
          const fails = (iceFailureCountsRef.current.get(targetPeerId) || 0) + 1
          iceFailureCountsRef.current.set(targetPeerId, fails)
          requestIceRecovery(fails >= 2)
        }
      }

      return pc
    },
    [sendSignal]
  )

  const flushPendingCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queue = pendingCandidatesRef.current.get(peerId)
    if (!queue || queue.length === 0) return
    pendingCandidatesRef.current.delete(peerId)
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand))
      } catch {
        // Ignore stale candidate
      }
    }
  }, [])

  const applySenderHighQualityParameters = useCallback(
    async (pc: RTCPeerConnection) => {
      const opts = shareOptionsRef.current
      const activePeerCount = Math.max(1, pcsRef.current.size)
      const screenMaxBitrate =
        computePerPeerMaxKbps(opts.resolution, opts.fps, activePeerCount) * 1000
      const webcamTrackId = localWebcamStreamRef.current?.getVideoTracks()[0]?.id

      // Always prefer universal VP8 so every browser & GPU decodes smoothly with zero black screens
      preferUniversalVP8Codec(pc)

      for (const sender of pc.getSenders()) {
        if (sender.track && sender.track.kind === 'video') {
          const isWebcamTrack = Boolean(webcamTrackId && sender.track.id === webcamTrackId)
          try {
            const params = sender.getParameters()
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}]
            }
            const webcamMaxBitrate = activePeerCount > 2 ? 2_000_000 : 3_000_000
            params.encodings[0].maxBitrate = isWebcamTrack ? webcamMaxBitrate : screenMaxBitrate
            params.encodings[0].maxFramerate = isWebcamTrack ? 60 : opts.fps
            params.encodings[0].scaleResolutionDownBy = 1.0
            params.encodings[0].priority = 'high'
            params.encodings[0].networkPriority = 'high'
            ;(params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference =
              'balanced'
            await sender.setParameters(params)
          } catch {
            // Ignore if browser doesn't support specific encoding param
          }
        }
      }
    },
    []
  )

  const syncTracksAndOffer = useCallback(
    async (
      targetPeerId: string,
      targetUser: UserProfile,
      options?: { iceRestart?: boolean; resetConnection?: boolean; safeMode?: boolean }
    ) => {
      const me = currentUserRef.current
      if (!me || targetPeerId === me.id) return

      const peerRelays = outgoingRelayMapRef.current.get(targetPeerId)
      const hasAnyLocalMedia = Boolean(
        localStreamRef.current ||
          localWebcamStreamRef.current ||
          micStreamRef.current ||
          (peerRelays && peerRelays.size > 0)
      )
      if (!hasAnyLocalMedia && !pcsRef.current.has(targetPeerId)) return

      const pc = getOrCreatePeerConnection(
        targetPeerId,
        targetUser,
        Boolean(options?.resetConnection)
      )
      if (!pc) return

      // Clean up any dead/ended senders before adding live tracks
      for (const sender of pc.getSenders()) {
        if (sender.track && sender.track.readyState === 'ended') {
          try {
            pc.removeTrack(sender)
          } catch {
            // ignore
          }
        }
      }

      const existingSenders = pc.getSenders()

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          if (track.readyState === 'ended') return
          const alreadyAdded = existingSenders.some((s) => s.track?.id === track.id)
          if (!alreadyAdded) {
            pc.addTrack(track, localStreamRef.current!)
          }
        })
      }

      if (localWebcamStreamRef.current) {
        localWebcamStreamRef.current.getVideoTracks().forEach((track) => {
          if (track.readyState === 'ended') return
          const alreadyAdded = existingSenders.some((s) => s.track?.id === track.id)
          if (!alreadyAdded) {
            pc.addTrack(track, localWebcamStreamRef.current!)
          }
        })
      }

      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach((track) => {
          if (track.readyState === 'ended') return
          const alreadyAdded = existingSenders.some((s) => s.track?.id === track.id)
          if (!alreadyAdded) {
            pc.addTrack(track, micStreamRef.current!)
          }
        })
      }

      // Build relayedStreamMap metadata for any P2P-bridged streams we are forwarding to this peer
      const relayedStreamMap: Record<string, { streamerId: string; streamerUser: UserProfile }> = {}
      if (peerRelays) {
        for (const [streamerId, entry] of peerRelays.entries()) {
          const liveTracks = entry.stream.getTracks().filter((t) => t.readyState !== 'ended')
          if (liveTracks.length === 0) {
            peerRelays.delete(streamerId)
            continue
          }
          relayedStreamMap[entry.stream.id] = {
            streamerId,
            streamerUser: entry.streamerUser,
          }
          liveTracks.forEach((track) => {
            const alreadyAdded = pc.getSenders().some((s) => s.track?.id === track.id)
            if (!alreadyAdded) {
              const sender = pc.addTrack(track, entry.stream)
              entry.senders.push(sender)
            }
          })
        }
      }

      await applySenderHighQualityParameters(pc)

      makingOfferRef.current.add(targetPeerId)
      try {
        // Send clean, unmodified browser-native SDP (VP8 preferred via setCodecPreferences)
        const offer = await pc.createOffer(
          options?.iceRestart ? { iceRestart: true } : undefined
        )
        await pc.setLocalDescription(offer)
        sendSignal({
          type: 'offer',
          from: me.id,
          fromUser: me,
          to: targetPeerId,
          sdp: pc.localDescription!,
          screenStreamId: localStreamRef.current?.id || null,
          webcamStreamId: localWebcamStreamRef.current?.id || null,
          ...(Object.keys(relayedStreamMap).length > 0 ? { relayedStreamMap } : {}),
        })
      } finally {
        makingOfferRef.current.delete(targetPeerId)
      }
    },
    [applySenderHighQualityParameters, getOrCreatePeerConnection, sendSignal]
  )

  const renegotiateAllPeers = useCallback(async () => {
    const me = currentUserRef.current
    if (!me) return
    const peerMap = new Map<string, UserProfile>()
    for (const peer of roomPeersRef.current) {
      if (peer.id !== me.id) {
        peerMap.set(peer.id, peer)
      }
    }
    // Negotiate with all peers in parallel with per-peer error isolation so
    // one failing peer NEVER blocks other viewers from receiving the screen!
    await Promise.allSettled(
      Array.from(peerMap.values()).map((peer) =>
        enqueuePeerSignal(peer.id, () => syncTracksAndOffer(peer.id, peer))
      )
    )
  }, [enqueuePeerSignal, syncTracksAndOffer])

  const reconnectPeerStream = useCallback(
    (peerId: string, safeMode = false) => {
      const me = currentUserRef.current
      if (!me || peerId === me.id) return
      enqueuePeerSignal(peerId, async () => {
        const pc = pcsRef.current.get(peerId)
        if (pc) {
          pc.onicecandidate = null
          pc.ontrack = null
          pc.onconnectionstatechange = null
          pc.oniceconnectionstatechange = null
          pc.close()
          pcsRef.current.delete(peerId)
        }
        pendingCandidatesRef.current.delete(peerId)
        iceFailureCountsRef.current.delete(peerId)
        setPeerConnectionStates((prev) => ({ ...prev, [peerId]: 'connecting' }))

        sendSignal({
          type: 'request-stream',
          from: me.id,
          fromUser: me,
          to: peerId,
          resetConnection: true,
          safeMode,
        })

        // Also request a P2P bridge from any other friend in the room already seeing this streamer
        if (roomPeersRef.current.length >= 3) {
          sendSignal({
            type: 'request-relay',
            from: me.id,
            fromUser: me,
            targetStreamerId: peerId,
          })
        }
      })
    },
    [enqueuePeerSignal, sendSignal]
  )

  const currentUserId = currentUser?.id

  useEffect(() => {
    const me = currentUserRef.current
    if (!me || !currentUserId || !roomId || !isSupabaseConfigured()) return

    const pcsMap = pcsRef.current
    knownPeersRef.current = new Set([currentUserId])
    initialPresenceSyncedRef.current = false

    const supabase = createClient()
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: currentUserId },
        broadcast: { self: false },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<UserProfile>()
        const users: UserProfile[] = []
        const nextIds = new Set<string>()

        Object.values(state).forEach((presences) => {
          if (presences[0]) {
            users.push(presences[0])
            nextIds.add(presences[0].id)
          }
        })

        if (initialPresenceSyncedRef.current && !deafenedRef.current) {
          for (const id of nextIds) {
            // If user came back or was previously pending disconnect, cancel disconnect timer!
            const pendingTimer = peerLeaveTimersRef.current.get(id)
            if (pendingTimer) {
              clearTimeout(pendingTimer)
              peerLeaveTimersRef.current.delete(id)
            }
            if (id !== currentUserId && !knownPeersRef.current.has(id)) {
              playRoomEventSound('user-join')
              break
            }
          }
          for (const id of knownPeersRef.current) {
            if (id !== currentUserId && !nextIds.has(id)) {
              // Don't kill WebRTC streams on momentary heartbeat glitches! Debounce 6 seconds.
              if (!peerLeaveTimersRef.current.has(id)) {
                const timer = setTimeout(() => {
                  peerLeaveTimersRef.current.delete(id)
                  playRoomEventSound('user-leave')
                  cleanupPeer(id)
                }, 6000)
                peerLeaveTimersRef.current.set(id, timer)
              }
            }
          }
        }

        knownPeersRef.current = nextIds
        initialPresenceSyncedRef.current = true
        setRoomPeers(users)
      })
      .on('broadcast', { event: 'webrtc-signal' }, ({ payload }) => {
        const sig = payload as SignalPayload
        const curMe = currentUserRef.current
        if (!curMe || sig.from === curMe.id) return
        if (sig.to && sig.to !== curMe.id) return

        // Non-WebRTC room state signals can be handled immediately without touching RTCPeerConnection
        if (sig.type === 'stop-stream') {
          setRemoteStreams((prev) => prev.filter((item) => item.peerId !== sig.from))
          if (!deafenedRef.current) {
            playRoomEventSound('stream-stop')
          }
          // If we were relaying this streamer's screen to another friend, cleanly stop forwarding it
          outgoingRelayMapRef.current.forEach((streamerMap, viewerPeerId) => {
            const entry = streamerMap.get(sig.from)
            if (entry) {
              const viewerPc = pcsRef.current.get(viewerPeerId)
              if (viewerPc) {
                entry.senders.forEach((sender) => {
                  try {
                    viewerPc.removeTrack(sender)
                  } catch {
                    // ignore
                  }
                })
              }
              streamerMap.delete(sig.from)
              const viewerProfile = roomPeersRef.current.find((p) => p.id === viewerPeerId)
              if (viewerProfile && viewerPc) {
                enqueuePeerSignal(viewerPeerId, () => syncTracksAndOffer(viewerPeerId, viewerProfile))
              }
            }
          })
          return
        } else if (sig.type === 'stop-webcam') {
          setRemoteWebcams((prev) => prev.filter((item) => item.peerId !== sig.from))
          return
        } else if (sig.type === 'speaking-state') {
          setSpeakingPeers((prev) => ({
            ...prev,
            [sig.from]: Boolean(sig.isSpeaking),
          }))
          return
        } else if (sig.type === 'mute-state') {
          setPeerMuteStates((prev) => ({
            ...prev,
            [sig.from]: {
              isMuted: Boolean(sig.isMuted),
              isDeafened: Boolean(sig.isDeafened),
            },
          }))
          return
        } else if (sig.type === 'watching-state') {
          setPeerWatchingMap((prev) => ({
            ...prev,
            [sig.from]: {
              user: sig.fromUser,
              watchingIds: Array.isArray(sig.watchingIds) ? sig.watchingIds : [],
            },
          }))
          return
        } else if (sig.type === 'prank' && sig.prank) {
          setActivePrank(sig.prank)
          if (!deafenedRef.current) {
            playRoomEventSound(`prank-${sig.prank.type}`)
          }
          return
        } else if (sig.type === 'watch-sync') {
          setWatchState(sig.watchState || null)
          return
        } else if (sig.type === 'cinema-state' && sig.cinemaPlayer) {
          setCinemaPlayers((prev) => ({
            ...prev,
            [sig.from]: sig.cinemaPlayer!,
          }))
          return
        }

        // Serialize WebRTC peer signaling per peerId to prevent race conditions & glare
        enqueuePeerSignal(sig.from, async () => {
          const activeMe = currentUserRef.current
          if (!activeMe) return

          if (sig.type === 'request-stream') {
            if (
              localStreamRef.current ||
              localWebcamStreamRef.current ||
              micStreamRef.current
            ) {
              await syncTracksAndOffer(sig.from, sig.fromUser, {
                iceRestart: Boolean(sig.iceRestart),
                resetConnection: Boolean(sig.resetConnection),
                safeMode: Boolean(sig.safeMode),
              })
            }
            if (watchStateRef.current) {
              sendSignal({
                type: 'watch-sync',
                from: activeMe.id,
                fromUser: activeMe,
                to: sig.from,
                watchState: watchStateRef.current,
              })
            }
            sendSignal({
              type: 'mute-state',
              from: activeMe.id,
              fromUser: activeMe,
              to: sig.from,
              isMuted: !micEnabledRef.current,
              isDeafened: deafenedRef.current,
            })
            if (myWatchingIdsRef.current.length > 0) {
              sendSignal({
                type: 'watching-state',
                from: activeMe.id,
                fromUser: activeMe,
                to: sig.from,
                watchingIds: myWatchingIdsRef.current,
              })
            }
            if (myCinemaPlayerRef.current) {
              sendSignal({
                type: 'cinema-state',
                from: activeMe.id,
                fromUser: activeMe,
                to: sig.from,
                cinemaPlayer: myCinemaPlayerRef.current,
              })
            }
          } else if (sig.type === 'request-relay' && sig.targetStreamerId) {
            // Pure P2P Amigo-Ponte (A -> B -> C): if we are receiving the target streamer's
            // live unmuted video directly, forward their stream to the blocked peer over P2P!
            const targetStreamerId = sig.targetStreamerId
            if (targetStreamerId === activeMe.id || sig.from === activeMe.id) return

            const sourceItem = remoteStreamsRef.current.find(
              (item) =>
                item.peerId === targetStreamerId &&
                !item.relayedBy &&
                item.stream.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted)
            )
            if (!sourceItem) return

            // Elect a single deterministic bridge peer (lowest peerId among candidates other than streamer & requester)
            // so multiple friends don't flood the requester at the same time.
            const candidateIds = roomPeersRef.current
              .map((p) => p.id)
              .filter((id) => id !== targetStreamerId && id !== sig.from)
              .sort()
            const myRank = candidateIds.indexOf(activeMe.id)
            if (myRank > 0) {
              await new Promise((r) => setTimeout(r, Math.min(myRank * 1800, 4000)))
            }

            let viewerRelays = outgoingRelayMapRef.current.get(sig.from)
            if (!viewerRelays) {
              viewerRelays = new Map()
              outgoingRelayMapRef.current.set(sig.from, viewerRelays)
            }
            // Reuse existing live tracks inside a dedicated relay MediaStream
            const relayStream = new MediaStream(
              sourceItem.stream.getTracks().filter((t) => t.readyState !== 'ended')
            )
            viewerRelays.set(targetStreamerId, {
              stream: relayStream,
              streamerUser: sourceItem.user,
              senders: [],
            })
            await syncTracksAndOffer(sig.from, sig.fromUser, { safeMode: true })
          } else if (sig.type === 'offer' && sig.sdp) {
            if (sig.screenStreamId !== undefined || sig.webcamStreamId !== undefined) {
              peerMediaIdsRef.current.set(sig.from, {
                screenStreamId: sig.screenStreamId,
                webcamStreamId: sig.webcamStreamId,
              })
            }
            if (sig.relayedStreamMap) {
              relayedOfferMetaRef.current.set(sig.from, sig.relayedStreamMap)
            }
            const pc = getOrCreatePeerConnection(sig.from, sig.fromUser)
            if (!pc) return

            // Deterministic Perfect Negotiation (polite vs impolite) so glare never drops a screen share!
            const isPolite = activeMe.id < sig.from
            const offerCollision =
              makingOfferRef.current.has(sig.from) || pc.signalingState !== 'stable'

            if (offerCollision && !isPolite) {
              // Impolite peer keeps its own offer in flight; polite peer will accept ours.
              return
            }

            const hadLocalMedia = Boolean(
              localStreamRef.current ||
                localWebcamStreamRef.current ||
                micStreamRef.current
            )

            if (offerCollision) {
              await Promise.all([
                pc.setLocalDescription({ type: 'rollback' }),
                pc.setRemoteDescription(new RTCSessionDescription(sig.sdp)),
              ])
            } else {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp))
            }

            await flushPendingCandidates(sig.from, pc)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            sendSignal({
              type: 'answer',
              from: activeMe.id,
              fromUser: activeMe,
              to: sig.from,
              sdp: pc.localDescription!,
              screenStreamId: localStreamRef.current?.id || null,
              webcamStreamId: localWebcamStreamRef.current?.id || null,
            })

            // If we were polite and rolled back our own offer (or have local tracks not yet sent on this PC),
            // immediately re-offer our local screen/webcam/mic tracks now that signalingState is stable!
            if (hadLocalMedia) {
              const senders = pc.getSenders()
              const hasUnsentScreen = Boolean(
                localStreamRef.current
                  ?.getTracks()
                  .some((t) => t.readyState !== 'ended' && !senders.some((s) => s.track?.id === t.id))
              )
              const hasUnsentWebcam = Boolean(
                localWebcamStreamRef.current
                  ?.getVideoTracks()
                  .some((t) => t.readyState !== 'ended' && !senders.some((s) => s.track?.id === t.id))
              )
              const hasUnsentMic = Boolean(
                micStreamRef.current
                  ?.getAudioTracks()
                  .some((t) => t.readyState !== 'ended' && !senders.some((s) => s.track?.id === t.id))
              )
              if (offerCollision || hasUnsentScreen || hasUnsentWebcam || hasUnsentMic) {
                await syncTracksAndOffer(sig.from, sig.fromUser)
              }
            }
          } else if (sig.type === 'answer' && sig.sdp) {
            if (sig.screenStreamId !== undefined || sig.webcamStreamId !== undefined) {
              peerMediaIdsRef.current.set(sig.from, {
                screenStreamId: sig.screenStreamId,
                webcamStreamId: sig.webcamStreamId,
              })
            }
            const pc = pcsRef.current.get(sig.from)
            if (pc && pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp))
              await flushPendingCandidates(sig.from, pc)
              await applySenderHighQualityParameters(pc)
            }
          } else if (sig.type === 'ice-candidate' && sig.candidate) {
            const pc = pcsRef.current.get(sig.from)
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(sig.candidate))
              } catch {
                // Ignore stale ICE candidate
              }
            } else {
              // Queue candidate until remoteDescription is set!
              const list = pendingCandidatesRef.current.get(sig.from) || []
              list.push(sig.candidate)
              pendingCandidatesRef.current.set(sig.from, list)
            }
          }
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const curMe = currentUserRef.current!
          await channel.track({
            ...curMe,
            status: localStreamRef.current ? 'streaming' : 'online',
            isMuted: !micEnabledRef.current,
            isDeafened: deafenedRef.current,
          })
          if (!deafenedRef.current) {
            playRoomEventSound('user-join')
          }
          channel.send({
            type: 'broadcast',
            event: 'webrtc-signal',
            payload: {
              type: 'request-stream',
              from: curMe.id,
              fromUser: curMe,
            } satisfies SignalPayload,
          })
        }
      })

    channelRef.current = channel

    return () => {
      peerLeaveTimersRef.current.forEach((t) => clearTimeout(t))
      peerLeaveTimersRef.current.clear()
      iceDisconnectedTimersRef.current.forEach((t) => clearTimeout(t))
      iceDisconnectedTimersRef.current.clear()
      iceFailureCountsRef.current.clear()
      makingOfferRef.current.clear()
      peerSignalQueueRef.current.clear()
      reconnectDebounceRef.current.clear()
      pcsMap.forEach((pc) => pc.close())
      pcsMap.clear()
      pendingCandidatesRef.current.clear()
      peerMediaIdsRef.current.clear()
      relayedOfferMetaRef.current.clear()
      outgoingRelayMapRef.current.clear()
      setPeerConnectionStates({})
      setRemoteStreams([])
      setRemoteWebcams([])
      setRemoteAudios([])
      setPeerWatchingMap({})
      setCinemaPlayers({})
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [
    roomId,
    currentUserId,
    applySenderHighQualityParameters,
    cleanupPeer,
    enqueuePeerSignal,
    flushPendingCandidates,
    getOrCreatePeerConnection,
    sendSignal,
    syncTracksAndOffer,
  ])

  const stopScreenShare = useCallback(() => {
    const me = currentUserRef.current
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pcsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.id === track.id)
          if (sender) {
            try {
              pc.removeTrack(sender)
            } catch {
              // ignore
            }
          }
        })
        track.stop()
      })
      localStreamRef.current = null
    }
    setLocalStream(null)
    setIsSharing(false)
    if (!deafenedRef.current) {
      playRoomEventSound('stream-stop')
    }

    if (me) {
      sendSignal({
        type: 'stop-stream',
        from: me.id,
        fromUser: me,
      })
      if (channelRef.current) {
        channelRef.current.track({
          ...me,
          status: 'online',
          isMuted: !micEnabledRef.current,
          isDeafened: deafenedRef.current,
        })
      }
      // Renegotiate cleanly so receivers don't keep dead video transceivers on future shares
      renegotiateAllPeers().catch(() => {})
    }
  }, [renegotiateAllPeers, sendSignal])

  const startScreenShare = useCallback(
    async (
      options: ScreenShareOptions = loadScreenShareOptions()
    ) => {
      const me = currentUserRef.current
      if (!me) return
      setError(null)
      shareOptionsRef.current = options
      saveScreenShareOptions(options)

      const heightMap = { '720p': 720, '1080p': 1080, '1440p': 1440 }
      const widthMap = { '720p': 1280, '1080p': 1920, '1440p': 2560 }

      try {
        // Capture the new screen first so cancelling the picker doesn't kill an existing live stream
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: widthMap[options.resolution] },
            height: { ideal: heightMap[options.resolution] },
            frameRate: { ideal: options.fps },
          },
          audio: options.includeAudio
            ? {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              }
            : false,
        })

        // Cleanly remove previous screen share senders from all PCs before stopping old tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((oldTrack) => {
            oldTrack.onended = null
            pcsRef.current.forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track?.id === oldTrack.id)
              if (sender) {
                try {
                  pc.removeTrack(sender)
                } catch {
                  // ignore
                }
              }
            })
            oldTrack.stop()
          })
        }

        const [videoTrack] = stream.getVideoTracks()
        if (videoTrack) {
          // IMPORTANT: Do NOT pass frameRate: { min: 24 } on screen-share tracks!
          // On Windows, Desktop Duplication stops emitting frames when the screen is static,
          // and a 'min' frameRate constraint causes the Chromium capturer to stall at 1 FPS!
          videoTrack.contentHint = 'motion'
          videoTrack.onended = () => {
            stopScreenShare()
          }
        }

        localStreamRef.current = stream
        setLocalStream(stream)
        setIsSharing(true)
        if (!deafenedRef.current) {
          playRoomEventSound('stream-start')
        }

        if (channelRef.current) {
          await channelRef.current.track({
            ...me,
            status: 'streaming',
            isMuted: !micEnabledRef.current,
            isDeafened: deafenedRef.current,
          })
        }

        await renegotiateAllPeers()
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'NotAllowedError') {
          setError('Não foi possível iniciar o compartilhamento de tela.')
        }
      }
    },
    [renegotiateAllPeers, stopScreenShare]
  )

  const updateMicSettings = useCallback((partial: Partial<MicAudioSettings>) => {
    setMicSettings((prev) => {
      const next: MicAudioSettings = { ...prev, ...partial }
      micSettingsRef.current = next
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(MIC_SETTINGS_KEY, JSON.stringify(next))
        } catch {
          // ignore
        }
      }

      // Apply live WebRTC hardware constraints if mic is active
      if (rawMicStreamRef.current) {
        const track = rawMicStreamRef.current.getAudioTracks()[0]
        if (track && track.applyConstraints) {
          track
            .applyConstraints({
              noiseSuppression: next.mode !== 'off',
              echoCancellation: next.echoCancellation,
              autoGainControl: next.autoGainControl,
            })
            .catch(() => { })
        }
      }

      // Apply live DSP filter updates if AudioContext is running
      if (micHighpassRef.current && micNotchRef.current && micLowpassRef.current && micGateGainRef.current) {
        if (next.mode === 'krisp') {
          micHighpassRef.current.type = 'highpass'
          micHighpassRef.current.frequency.value = 105
          micNotchRef.current.type = 'notch'
          micNotchRef.current.frequency.value = 60
          micNotchRef.current.Q.value = 10
          micLowpassRef.current.type = 'lowpass'
          micLowpassRef.current.frequency.value = 8200
        } else if (next.mode === 'standard') {
          micHighpassRef.current.type = 'highpass'
          micHighpassRef.current.frequency.value = 70
          micNotchRef.current.type = 'allpass'
          micLowpassRef.current.type = 'allpass'
          micGateGainRef.current.gain.value = 1
        } else {
          micHighpassRef.current.type = 'allpass'
          micNotchRef.current.type = 'allpass'
          micLowpassRef.current.type = 'allpass'
          micGateGainRef.current.gain.value = 1
        }
      }

      return next
    })
  }, [])

  const toggleMic = useCallback(async () => {
    const me = currentUserRef.current
    if (!me) return
    try {
      if (micEnabled && micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => {
          pcsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.id === track.id)
            if (sender) pc.removeTrack(sender)
          })
          track.stop()
        })
        rawMicStreamRef.current?.getTracks().forEach((t) => t.stop())
        rawMicStreamRef.current = null
        micStreamRef.current = null
        micAudioCtxRef.current?.close().catch(() => { })
        micAudioCtxRef.current = null
        setMicEnabled(false)
        setIsSpeaking(false)
        playRoomEventSound('mic-off')
        if (audioAnalyserIntervalRef.current) {
          clearInterval(audioAnalyserIntervalRef.current)
          audioAnalyserIntervalRef.current = null
        }
        sendSignal({
          type: 'speaking-state',
          from: me.id,
          fromUser: me,
          isSpeaking: false,
        })
        sendSignal({
          type: 'mute-state',
          from: me.id,
          fromUser: me,
          isMuted: true,
          isDeafened: deafenedRef.current,
        })
        if (channelRef.current) {
          channelRef.current.track({
            ...me,
            status: localStreamRef.current ? 'streaming' : 'online',
            isMuted: true,
            isDeafened: deafenedRef.current,
          })
        }
      } else {
        const cfg = micSettingsRef.current
        const rawAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: cfg.echoCancellation,
            noiseSuppression: cfg.mode !== 'off',
            autoGainControl: cfg.autoGainControl,
          },
        })
        rawMicStreamRef.current = rawAudioStream

        let outboundStream = rawAudioStream

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (AudioCtx) {
          const audioCtx = new AudioCtx()
          micAudioCtxRef.current = audioCtx
          const source = audioCtx.createMediaStreamSource(rawAudioStream)

          // Discord-style Krisp / Noise Suppression + Noise Gate Pipeline:
          // 1. Highpass removes AC / desk rumble (<105Hz)
          const highpass = audioCtx.createBiquadFilter()
          highpass.type = cfg.mode === 'off' ? 'allpass' : 'highpass'
          highpass.frequency.value = cfg.mode === 'krisp' ? 105 : 70
          micHighpassRef.current = highpass

          // 2. Notch filter removes 60Hz electrical hum
          const notch = audioCtx.createBiquadFilter()
          notch.type = cfg.mode === 'krisp' ? 'notch' : 'allpass'
          notch.frequency.value = 60
          notch.Q.value = 10
          micNotchRef.current = notch

          // 3. Lowpass removes high-frequency keyboard click/hiss (>8.2kHz)
          const lowpass = audioCtx.createBiquadFilter()
          lowpass.type = cfg.mode === 'krisp' ? 'lowpass' : 'allpass'
          lowpass.frequency.value = 8200
          micLowpassRef.current = lowpass

          // 4. Dynamics compressor levels voice
          const compressor = audioCtx.createDynamicsCompressor()
          compressor.threshold.value = -26
          compressor.knee.value = 18
          compressor.ratio.value = 4
          compressor.attack.value = 0.003
          compressor.release.value = 0.15

          // 5. Intelligent Voice Activity Noise Gate (cuts background typing/fan noise when not speaking)
          const gateGain = audioCtx.createGain()
          gateGain.gain.value = 1
          micGateGainRef.current = gateGain

          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 256

          const destination = audioCtx.createMediaStreamDestination()

          source.connect(highpass)
          highpass.connect(notch)
          notch.connect(lowpass)
          lowpass.connect(compressor)
          compressor.connect(analyser)
          analyser.connect(gateGain)
          gateGain.connect(destination)

          outboundStream = destination.stream

          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          let lastState = false

          audioAnalyserIntervalRef.current = setInterval(() => {
            analyser.getByteFrequencyData(dataArray)
            // Focus on human voice frequencies (bins 2 to 45)
            let sum = 0
            const voiceBins = Math.min(48, dataArray.length)
            for (let i = 2; i < voiceBins; i++) {
              sum += dataArray[i]
            }
            const avg = sum / (voiceBins - 2)
            const threshold = micSettingsRef.current.mode === 'krisp' ? 16 : 12
            const talking = avg > threshold

            // Smooth noise gate attenuation in 'krisp' mode when user is silent
            if (micGateGainRef.current && micAudioCtxRef.current) {
              const targetGain =
                micSettingsRef.current.mode === 'krisp' ? (talking ? 1.0 : 0.02) : 1.0
              micGateGainRef.current.gain.setTargetAtTime(
                targetGain,
                micAudioCtxRef.current.currentTime,
                talking ? 0.015 : 0.08
              )
            }

            if (talking !== lastState) {
              lastState = talking
              setIsSpeaking(talking)
              const curMe = currentUserRef.current
              if (curMe) {
                sendSignal({
                  type: 'speaking-state',
                  from: curMe.id,
                  fromUser: curMe,
                  isSpeaking: talking,
                })
              }
            }
          }, 90)
        }

        micStreamRef.current = outboundStream
        micEnabledRef.current = true
        deafenedRef.current = false
        micWasEnabledBeforeDeafenRef.current = false
        setMicEnabled(true)
        setDeafened(false)
        playRoomEventSound('mic-on')

        sendSignal({
          type: 'mute-state',
          from: me.id,
          fromUser: me,
          isMuted: false,
          isDeafened: false,
        })
        if (channelRef.current) {
          channelRef.current.track({
            ...me,
            status: localStreamRef.current ? 'streaming' : 'online',
            isMuted: false,
            isDeafened: false,
          })
        }

        await renegotiateAllPeers()
      }
    } catch {
      setError('Permissão de microfone negada ou dispositivo não encontrado.')
    }
  }, [micEnabled, renegotiateAllPeers, sendSignal])

  const toggleDeafen = useCallback(() => {
    const me = currentUserRef.current
    const nextDeafened = !deafenedRef.current
    deafenedRef.current = nextDeafened
    setDeafened(nextDeafened)

    if (nextDeafened) {
      // Discord behavior: muting audio (Deafen) also mutes the microphone immediately!
      if (micEnabledRef.current && micStreamRef.current) {
        micWasEnabledBeforeDeafenRef.current = true
        micStreamRef.current.getTracks().forEach((track) => {
          pcsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.id === track.id)
            if (sender) pc.removeTrack(sender)
          })
          track.stop()
        })
        rawMicStreamRef.current?.getTracks().forEach((t) => t.stop())
        rawMicStreamRef.current = null
        micStreamRef.current = null
        micAudioCtxRef.current?.close().catch(() => {})
        micAudioCtxRef.current = null
        micEnabledRef.current = false
        setMicEnabled(false)
        setIsSpeaking(false)
        if (audioAnalyserIntervalRef.current) {
          clearInterval(audioAnalyserIntervalRef.current)
          audioAnalyserIntervalRef.current = null
        }
        if (me) {
          sendSignal({
            type: 'speaking-state',
            from: me.id,
            fromUser: me,
            isSpeaking: false,
          })
        }
      } else {
        micWasEnabledBeforeDeafenRef.current = false
      }
      playRoomEventSound('mic-off')

      if (me) {
        sendSignal({
          type: 'mute-state',
          from: me.id,
          fromUser: me,
          isMuted: true,
          isDeafened: true,
        })
        if (channelRef.current) {
          channelRef.current.track({
            ...me,
            status: localStreamRef.current ? 'streaming' : 'online',
            isMuted: true,
            isDeafened: true,
          })
        }
      }
    } else {
      // Un-deafening: if mic was active before deafening, re-activate it automatically!
      if (micWasEnabledBeforeDeafenRef.current && !micEnabledRef.current) {
        micWasEnabledBeforeDeafenRef.current = false
        toggleMic()
        return
      }
      playRoomEventSound('mic-on')
      if (me) {
        sendSignal({
          type: 'mute-state',
          from: me.id,
          fromUser: me,
          isMuted: !micEnabledRef.current,
          isDeafened: false,
        })
        if (channelRef.current) {
          channelRef.current.track({
            ...me,
            status: localStreamRef.current ? 'streaming' : 'online',
            isMuted: !micEnabledRef.current,
            isDeafened: false,
          })
        }
      }
    }
  }, [sendSignal, toggleMic])

  const triggerPrank = useCallback(
    (type: PrankType, targetUser: UserProfile) => {
      const me = currentUserRef.current
      if (!me) return
      const prank: PrankEvent = {
        id: crypto.randomUUID(),
        type,
        fromUser: me,
        targetUser,
        timestamp: Date.now(),
      }
      setActivePrank(prank)
      if (!deafenedRef.current) {
        playRoomEventSound(`prank-${type}`)
      }
      sendSignal({
        type: 'prank',
        from: me.id,
        fromUser: me,
        prank,
      })
    },
    [sendSignal]
  )

  const updateWatchTogether = useCallback(
    (next: WatchTogetherState | null) => {
      const me = currentUserRef.current
      if (!me) return
      setWatchState(next)
      sendSignal({
        type: 'watch-sync',
        from: me.id,
        fromUser: me,
        watchState: next,
      })
    },
    [sendSignal]
  )

  const updateShareQuality = useCallback(
    async (options: ScreenShareOptions) => {
      shareOptionsRef.current = options
      saveScreenShareOptions(options)
      const heightMap = { '720p': 720, '1080p': 1080, '1440p': 1440 }
      const widthMap = { '720p': 1280, '1080p': 1920, '1440p': 2560 }

      if (localStreamRef.current) {
        const [videoTrack] = localStreamRef.current.getVideoTracks()
        if (videoTrack) {
          // NOTE: Do NOT call videoTrack.applyConstraints({ width, height, frameRate }) on a live
          // getDisplayMedia track in Windows Edge/Chromium! Re-configuring WGC/DXGI capture dimensions
          // while live leaks DWM desktop duplication handles and spikes explorer.exe CPU/power!
          videoTrack.contentHint = 'motion'
        }
      }

      for (const pc of pcsRef.current.values()) {
        await applySenderHighQualityParameters(pc)
      }
    },
    [applySenderHighQualityParameters]
  )

  const stopWebcam = useCallback(() => {
    const me = currentUserRef.current
    if (localWebcamStreamRef.current) {
      localWebcamStreamRef.current.getTracks().forEach((track) => {
        pcsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.id === track.id)
          if (sender) pc.removeTrack(sender)
        })
        track.stop()
      })
      localWebcamStreamRef.current = null
    }
    setLocalWebcamStream(null)
    setWebcamEnabled(false)

    if (me) {
      sendSignal({
        type: 'stop-webcam',
        from: me.id,
        fromUser: me,
      })
    }
  }, [sendSignal])

  const toggleWebcam = useCallback(async () => {
    const me = currentUserRef.current
    if (!me) return
    setError(null)

    if (webcamEnabled && localWebcamStreamRef.current) {
      stopWebcam()
      await renegotiateAllPeers()
      return
    }

    try {
      let camStream: MediaStream
      try {
        // Try Full HD 1080p @ 60 FPS first for crystal-clear high-FPS Kabeka!
        camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60 },
            facingMode: 'user',
          },
          audio: false,
        })
      } catch {
        // Fallback to 720p @ 60 FPS if webcam doesn't support 1080p
        camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 60 },
          },
          audio: false,
        })
      }

      const [camTrack] = camStream.getVideoTracks()
      if (camTrack) {
        camTrack.contentHint = 'motion'
        camTrack.onended = () => {
          stopWebcam()
        }
      }

      localWebcamStreamRef.current = camStream
      setLocalWebcamStream(camStream)
      setWebcamEnabled(true)
      if (!deafenedRef.current) {
        playRoomEventSound('stream-start')
      }

      await renegotiateAllPeers()
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'NotAllowedError') {
        setError('Não foi possível acessar a webcam (Kabeka).')
      }
    }
  }, [renegotiateAllPeers, stopWebcam, webcamEnabled])

  const broadcastWatchingState = useCallback(
    (watchingIds: string[]) => {
      const me = currentUserRef.current
      if (!me) return
      const prevKey = myWatchingIdsRef.current.slice().sort().join(',')
      const nextKey = watchingIds.slice().sort().join(',')
      myWatchingIdsRef.current = watchingIds
      if (prevKey === nextKey) return

      sendSignal({
        type: 'watching-state',
        from: me.id,
        fromUser: me,
        watchingIds,
      })
    },
    [sendSignal]
  )

  const broadcastCinemaState = useCallback(
    (playerState: CinemaPlayerState) => {
      const me = currentUserRef.current
      if (!me) return
      myCinemaPlayerRef.current = playerState
      setCinemaPlayers((prev) => ({
        ...prev,
        [me.id]: playerState,
      }))
      sendSignal({
        type: 'cinema-state',
        from: me.id,
        fromUser: me,
        cinemaPlayer: playerState,
      })
    },
    [sendSignal]
  )

  return {
    localStream,
    isSharing,
    localWebcamStream,
    webcamEnabled,
    remoteStreams,
    remoteWebcams,
    remoteAudios,
    roomPeers,
    micEnabled,
    deafened,
    isSpeaking,
    micSettings,
    updateMicSettings,
    updateShareQuality,
    speakingPeers,
    peerMuteStates,
    peerWatchingMap,
    broadcastWatchingState,
    activePrank,
    setActivePrank,
    watchState,
    updateWatchTogether,
    cinemaPlayers,
    broadcastCinemaState,
    triggerPrank,
    peerConnectionStates,
    hasTurnServer,
    reconnectPeerStream,
    error,
    startScreenShare,
    stopScreenShare,
    toggleWebcam,
    stopWebcam,
    toggleMic,
    toggleDeafen,
  }
}
