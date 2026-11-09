'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { UserProfile, SignalPayload } from '@/types/community'
import { playRoomEventSound } from '@/lib/soundEngine'
import type { RealtimeChannel } from '@supabase/supabase-js'

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
}

export interface RemoteStreamItem {
  peerId: string
  user: UserProfile
  stream: MediaStream
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
}

export function useScreenShare(roomId: string, currentUser: UserProfile | null) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamItem[]>([])
  const [remoteAudios, setRemoteAudios] = useState<RemoteAudioItem[]>([])
  const [roomPeers, setRoomPeers] = useState<UserProfile[]>([])
  const [micEnabled, setMicEnabled] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const localStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const deafenedRef = useRef(false)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const bcRef = useRef<BroadcastChannel | null>(null)
  const audioAnalyserIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const knownPeersRef = useRef<Set<string>>(new Set())
  const initialPresenceSyncedRef = useRef(false)

  useEffect(() => {
    deafenedRef.current = deafened
  }, [deafened])

  const cleanupPeer = useCallback((peerId: string) => {
    const pc = pcsRef.current.get(peerId)
    if (pc) {
      pc.close()
      pcsRef.current.delete(peerId)
    }
    setRemoteStreams((prev) => {
      const hadStream = prev.some((item) => item.peerId === peerId)
      if (hadStream && !deafenedRef.current) {
        playRoomEventSound('stream-stop')
      }
      return prev.filter((item) => item.peerId !== peerId)
    })
    setRemoteAudios((prev) => prev.filter((item) => item.peerId !== peerId))
  }, [])

  const sendSignal = useCallback((payload: SignalPayload) => {
    if (channelRef.current && isSupabaseConfigured()) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload,
      })
    } else if (bcRef.current) {
      bcRef.current.postMessage(payload)
    }
  }, [])

  const createPeerConnection = useCallback(
    (targetPeerId: string, targetUser: UserProfile, isInitiator: boolean) => {
      if (!currentUser) return null

      const existing = pcsRef.current.get(targetPeerId)
      if (existing) {
        existing.close()
      }

      const pc = new RTCPeerConnection(ICE_SERVERS)
      pcsRef.current.set(targetPeerId, pc)

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({
            type: 'ice-candidate',
            from: currentUser.id,
            fromUser: currentUser,
            to: targetPeerId,
            candidate: event.candidate.toJSON(),
          })
        }
      }

      pc.ontrack = (event) => {
        const [stream] = event.streams
        if (!stream) return

        const hasVideo = stream.getVideoTracks().length > 0
        if (hasVideo) {
          setRemoteStreams((prev) => {
            const exists = prev.some((s) => s.peerId === targetPeerId)
            if (!exists && !deafenedRef.current) {
              playRoomEventSound('stream-start')
            }
            if (exists) {
              return prev.map((s) =>
                s.peerId === targetPeerId ? { peerId: targetPeerId, user: targetUser, stream } : s
              )
            }
            return [...prev, { peerId: targetPeerId, user: targetUser, stream }]
          })
        } else {
          setRemoteAudios((prev) => {
            const exists = prev.some((s) => s.peerId === targetPeerId)
            if (exists) {
              return prev.map((s) =>
                s.peerId === targetPeerId ? { peerId: targetPeerId, user: targetUser, stream } : s
              )
            }
            return [...prev, { peerId: targetPeerId, user: targetUser, stream }]
          })
        }
      }

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          cleanupPeer(targetPeerId)
        }
      }

      if (isInitiator) {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current!)
          })
        }
        if (micStreamRef.current) {
          micStreamRef.current.getAudioTracks().forEach((track) => {
            pc.addTrack(track, micStreamRef.current!)
          })
        }
      }

      return pc
    },
    [currentUser, cleanupPeer, sendSignal]
  )

  const renegotiateAllPeers = useCallback(async () => {
    if (!currentUser) return
    for (const peer of roomPeers) {
      if (peer.id === currentUser.id) continue
      const pc = createPeerConnection(peer.id, peer, true)
      if (pc) {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendSignal({
          type: 'offer',
          from: currentUser.id,
          fromUser: currentUser,
          to: peer.id,
          sdp: pc.localDescription!,
        })
      }
    }
  }, [currentUser, roomPeers, createPeerConnection, sendSignal])

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      if (!currentUser || payload.from === currentUser.id) return
      if (payload.to && payload.to !== currentUser.id) return

      try {
        if (payload.type === 'request-stream') {
          setRoomPeers((prev) => {
            if (prev.some((p) => p.id === payload.fromUser.id)) return prev
            return [...prev, payload.fromUser]
          })

          if (!localStreamRef.current && !micStreamRef.current) return
          const pc = createPeerConnection(payload.from, payload.fromUser, true)
          if (!pc) return
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          sendSignal({
            type: 'offer',
            from: currentUser.id,
            fromUser: currentUser,
            to: payload.from,
            sdp: pc.localDescription!,
          })
        } else if (payload.type === 'offer' && payload.sdp) {
          const pc = createPeerConnection(payload.from, payload.fromUser, false)
          if (!pc) return
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          sendSignal({
            type: 'answer',
            from: currentUser.id,
            fromUser: currentUser,
            to: payload.from,
            sdp: pc.localDescription!,
          })
        } else if (payload.type === 'answer' && payload.sdp) {
          const pc = pcsRef.current.get(payload.from)
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          }
        } else if (payload.type === 'ice-candidate' && payload.candidate) {
          const pc = pcsRef.current.get(payload.from)
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
          }
        } else if (payload.type === 'stop-stream') {
          cleanupPeer(payload.from)
        } else if (payload.type === 'speaking-state') {
          setSpeakingPeers((prev) => ({
            ...prev,
            [payload.from]: Boolean(payload.isSpeaking),
          }))
        }
      } catch (err) {
        console.error('WebRTC Signal Error:', err)
      }
    },
    [currentUser, createPeerConnection, cleanupPeer, sendSignal]
  )

  useEffect(() => {
    if (!currentUser || !roomId) return

    const pcsMap = pcsRef.current
    knownPeersRef.current = new Set([currentUser.id])
    initialPresenceSyncedRef.current = false

    if (isSupabaseConfigured()) {
      const supabase = createClient()
      const channel = supabase.channel(`room:${roomId}`, {
        config: {
          presence: { key: currentUser.id },
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
            // Detect someone joining
            for (const id of nextIds) {
              if (id !== currentUser.id && !knownPeersRef.current.has(id)) {
                playRoomEventSound('user-join')
                break
              }
            }
            // Detect someone leaving
            for (const id of knownPeersRef.current) {
              if (id !== currentUser.id && !nextIds.has(id)) {
                playRoomEventSound('user-leave')
                break
              }
            }
          }

          knownPeersRef.current = nextIds
          initialPresenceSyncedRef.current = true
          setRoomPeers(users)
        })
        .on('broadcast', { event: 'webrtc-signal' }, ({ payload }) => {
          handleSignal(payload as SignalPayload)
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              ...currentUser,
              status: localStreamRef.current ? 'streaming' : 'online',
            })
            if (!deafenedRef.current) {
              playRoomEventSound('user-join')
            }
            channel.send({
              type: 'broadcast',
              event: 'webrtc-signal',
              payload: {
                type: 'request-stream',
                from: currentUser.id,
                fromUser: currentUser,
              } satisfies SignalPayload,
            })
          }
        })

      channelRef.current = channel

      return () => {
        pcsMap.forEach((pc) => pc.close())
        pcsMap.clear()
        setRemoteStreams([])
        setRemoteAudios([])
        supabase.removeChannel(channel)
        channelRef.current = null
      }
    }
  }, [roomId, currentUser, handleSignal])

  const stopScreenShare = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }
    setLocalStream(null)
    setIsSharing(false)
    if (!deafenedRef.current) {
      playRoomEventSound('stream-stop')
    }

    pcsRef.current.forEach((pc) => pc.close())
    pcsRef.current.clear()

    if (currentUser) {
      sendSignal({
        type: 'stop-stream',
        from: currentUser.id,
        fromUser: currentUser,
      })
      if (channelRef.current) {
        channelRef.current.track({ ...currentUser, status: 'online' })
      }
    }

    if (micStreamRef.current) {
      setTimeout(() => {
        renegotiateAllPeers()
      }, 150)
    }
  }, [currentUser, sendSignal, renegotiateAllPeers])

  const startScreenShare = useCallback(
    async (options: ScreenShareOptions = { resolution: '1080p', fps: 60, includeAudio: true }) => {
      if (!currentUser) return
      setError(null)

      const heightMap = { '720p': 720, '1080p': 1080, '1440p': 1440 }
      const widthMap = { '720p': 1280, '1080p': 1920, '1440p': 2560 }

      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: widthMap[options.resolution] },
            height: { ideal: heightMap[options.resolution] },
            frameRate: { ideal: options.fps, max: options.fps },
          },
          audio: options.includeAudio
            ? {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              }
            : false,
        })

        const [videoTrack] = stream.getVideoTracks()
        if (videoTrack) {
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
          await channelRef.current.track({ ...currentUser, status: 'streaming' })
        }

        await renegotiateAllPeers()
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'NotAllowedError') {
          setError('Não foi possível iniciar o compartilhamento de tela.')
        }
      }
    },
    [currentUser, renegotiateAllPeers, stopScreenShare]
  )

  const toggleMic = useCallback(async () => {
    if (!currentUser) return
    try {
      if (micEnabled && micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop())
        micStreamRef.current = null
        setMicEnabled(false)
        setIsSpeaking(false)
        playRoomEventSound('mic-off')
        if (audioAnalyserIntervalRef.current) {
          clearInterval(audioAnalyserIntervalRef.current)
          audioAnalyserIntervalRef.current = null
        }
        sendSignal({
          type: 'speaking-state',
          from: currentUser.id,
          fromUser: currentUser,
          isSpeaking: false,
        })
        await renegotiateAllPeers()
      } else {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        micStreamRef.current = audioStream
        setMicEnabled(true)
        setDeafened(false)
        playRoomEventSound('mic-on')

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (AudioCtx) {
          const audioCtx = new AudioCtx()
          const source = audioCtx.createMediaStreamSource(audioStream)
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          const dataArray = new Uint8Array(analyser.frequencyBinCount)

          let lastState = false
          audioAnalyserIntervalRef.current = setInterval(() => {
            analyser.getByteFrequencyData(dataArray)
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
            const talking = avg > 18
            if (talking !== lastState) {
              lastState = talking
              setIsSpeaking(talking)
              sendSignal({
                type: 'speaking-state',
                from: currentUser.id,
                fromUser: currentUser,
                isSpeaking: talking,
              })
            }
          }, 140)
        }

        await renegotiateAllPeers()
      }
    } catch {
      setError('Permissão de microfone negada ou dispositivo não encontrado.')
    }
  }, [currentUser, micEnabled, renegotiateAllPeers, sendSignal])

  const toggleDeafen = useCallback(() => {
    setDeafened((prev) => !prev)
  }, [])

  return {
    localStream,
    isSharing,
    remoteStreams,
    remoteAudios,
    roomPeers,
    micEnabled,
    deafened,
    isSpeaking,
    speakingPeers,
    error,
    startScreenShare,
    stopScreenShare,
    toggleMic,
    toggleDeafen,
  }
}
