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

  const currentUserRef = useRef<UserProfile | null>(currentUser)
  const roomPeersRef = useRef<UserProfile[]>([])
  const localStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const deafenedRef = useRef(false)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const audioAnalyserIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const knownPeersRef = useRef<Set<string>>(new Set())
  const initialPresenceSyncedRef = useRef(false)

  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  useEffect(() => {
    roomPeersRef.current = roomPeers
  }, [roomPeers])

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
    }
  }, [])

  const getOrCreatePeerConnection = useCallback(
    (targetPeerId: string, targetUser: UserProfile) => {
      const me = currentUserRef.current
      if (!me) return null

      const existing = pcsRef.current.get(targetPeerId)
      if (
        existing &&
        existing.connectionState !== 'closed' &&
        existing.connectionState !== 'failed'
      ) {
        return existing
      }

      if (existing) {
        existing.close()
      }

      const pc = new RTCPeerConnection(ICE_SERVERS)
      pcsRef.current.set(targetPeerId, pc)

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
        const stream = event.streams[0] || new MediaStream([track])

        if (track.kind === 'video') {
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
        } else if (track.kind === 'audio') {
          // If this stream also has video, it's system audio handled by VideoStage; otherwise voice audio
          if (stream.getVideoTracks().length === 0) {
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
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          cleanupPeer(targetPeerId)
        }
      }

      return pc
    },
    [cleanupPeer, sendSignal]
  )

  const syncTracksAndOffer = useCallback(
    async (targetPeerId: string, targetUser: UserProfile) => {
      const me = currentUserRef.current
      if (!me || targetPeerId === me.id) return

      const pc = getOrCreatePeerConnection(targetPeerId, targetUser)
      if (!pc) return

      const existingSenders = pc.getSenders()

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          const alreadyAdded = existingSenders.some((s) => s.track?.id === track.id)
          if (!alreadyAdded) {
            pc.addTrack(track, localStreamRef.current!)
          }
        })
      }

      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach((track) => {
          const alreadyAdded = existingSenders.some((s) => s.track?.id === track.id)
          if (!alreadyAdded) {
            pc.addTrack(track, micStreamRef.current!)
          }
        })
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sendSignal({
        type: 'offer',
        from: me.id,
        fromUser: me,
        to: targetPeerId,
        sdp: pc.localDescription!,
      })
    },
    [getOrCreatePeerConnection, sendSignal]
  )

  const renegotiateAllPeers = useCallback(async () => {
    const me = currentUserRef.current
    if (!me) return
    for (const peer of roomPeersRef.current) {
      if (peer.id === me.id) continue
      await syncTracksAndOffer(peer.id, peer)
    }
  }, [syncTracksAndOffer])

  // Subscribe ONLY when roomId or userId changes — prevents tearing down active streams!
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
            if (id !== currentUserId && !knownPeersRef.current.has(id)) {
              playRoomEventSound('user-join')
              break
            }
          }
          for (const id of knownPeersRef.current) {
            if (id !== currentUserId && !nextIds.has(id)) {
              playRoomEventSound('user-leave')
              cleanupPeer(id)
              break
            }
          }
        }

        knownPeersRef.current = nextIds
        initialPresenceSyncedRef.current = true
        setRoomPeers(users)
      })
      .on('broadcast', { event: 'webrtc-signal' }, async ({ payload }) => {
        const sig = payload as SignalPayload
        const curMe = currentUserRef.current
        if (!curMe || sig.from === curMe.id) return
        if (sig.to && sig.to !== curMe.id) return

        try {
          if (sig.type === 'request-stream') {
            if (localStreamRef.current || micStreamRef.current) {
              await syncTracksAndOffer(sig.from, sig.fromUser)
            }
          } else if (sig.type === 'offer' && sig.sdp) {
            const pc = getOrCreatePeerConnection(sig.from, sig.fromUser)
            if (!pc) return
            await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            sendSignal({
              type: 'answer',
              from: curMe.id,
              fromUser: curMe,
              to: sig.from,
              sdp: pc.localDescription!,
            })
          } else if (sig.type === 'answer' && sig.sdp) {
            const pc = pcsRef.current.get(sig.from)
            if (pc && pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp))
            }
          } else if (sig.type === 'ice-candidate' && sig.candidate) {
            const pc = pcsRef.current.get(sig.from)
            if (pc && pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(sig.candidate))
            }
          } else if (sig.type === 'stop-stream') {
            setRemoteStreams((prev) => prev.filter((item) => item.peerId !== sig.from))
            if (!deafenedRef.current) {
              playRoomEventSound('stream-stop')
            }
          } else if (sig.type === 'speaking-state') {
            setSpeakingPeers((prev) => ({
              ...prev,
              [sig.from]: Boolean(sig.isSpeaking),
            }))
          }
        } catch (err) {
          console.error('Signal error:', err)
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const curMe = currentUserRef.current!
          await channel.track({
            ...curMe,
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
              from: curMe.id,
              fromUser: curMe,
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
  }, [roomId, currentUserId, cleanupPeer, getOrCreatePeerConnection, sendSignal, syncTracksAndOffer])

  const stopScreenShare = useCallback(() => {
    const me = currentUserRef.current
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pcsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.id === track.id)
          if (sender) pc.removeTrack(sender)
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
        channelRef.current.track({ ...me, status: 'online' })
      }
    }
  }, [sendSignal])

  const startScreenShare = useCallback(
    async (options: ScreenShareOptions = { resolution: '1080p', fps: 60, includeAudio: true }) => {
      const me = currentUserRef.current
      if (!me) return
      setError(null)

      const heightMap = { '720p': 720, '1080p': 1080, '1440p': 1440 }
      const widthMap = { '720p': 1280, '1080p': 1920, '1440p': 2560 }

      try {
        // Stop previous share if any
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop())
        }

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
          await channelRef.current.track({ ...me, status: 'streaming' })
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
          from: me.id,
          fromUser: me,
          isSpeaking: false,
        })
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
          }, 140)
        }

        await renegotiateAllPeers()
      }
    } catch {
      setError('Permissão de microfone negada ou dispositivo não encontrado.')
    }
  }, [micEnabled, renegotiateAllPeers, sendSignal])

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
