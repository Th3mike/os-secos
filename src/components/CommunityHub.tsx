'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Headphones, HeadphoneOff, Tv } from 'lucide-react'
import { Room, UserProfile, Role, ChatMessage, PrankType } from '@/types/community'
import { useScreenShare, ScreenShareOptions, RemoteAudioItem } from '@/hooks/useScreenShare'
import { VideoStage } from './VideoStage'
import { ChatPanel } from './ChatPanel'
import { PrankStageOverlay, PRANK_OPTIONS, PrankIcon } from './PrankStageOverlay'
import { WatchTogetherStage } from './WatchTogetherStage'
import { UserProfilePopover, formatRelativeTime } from './UserProfilePopover'
import {
  SoundSettings,
  DEFAULT_SOUND_SETTINGS,
  loadSoundSettings,
  saveSoundSettings,
  playRoomEventSound,
} from '@/lib/soundEngine'
import { createClient } from '@/lib/supabase/client'
import type { User, RealtimeChannel } from '@supabase/supabase-js'

const FALLBACK_CHANNELS: Room[] = [
  { id: 'chat-geral', name: 'chat-geral', description: 'Chat principal da comunidade', type: 'text', position: 1 },
  { id: 'clips-e-prints', name: 'clips-e-prints', description: 'Mande seus clipes e memes', type: 'text', position: 2 },
  { id: 'resenha', name: 'Resenha Geral', description: 'Canal de voz e tela principal', type: 'voice', position: 3 },
  { id: 'gameplay', name: 'Gameplay 120fps', description: 'Telagem de jogos sem travar', type: 'voice', position: 4 },
  { id: 'cinema', name: 'Watch Party', description: 'Filmes, vídeos e lives', type: 'voice', position: 5 },
]

const FALLBACK_ROLES: Role[] = [
  { id: 'fundador', name: 'Fundador Seco', color: '#f59e0b', position: 1 },
  { id: 'admin', name: 'Admin da Cova', color: '#ef4444', position: 2 },
  { id: 'streamer', name: 'Telador 120fps', color: '#a855f7', position: 3 },
  { id: 'seco-raiz', name: 'Seco Raiz', color: '#22c55e', position: 4 },
  { id: 'coveiro', name: 'Coveiro', color: '#3b82f6', position: 5 },
]

function extractDiscordProfile(authUser: User): UserProfile {
  const meta = authUser.user_metadata || {}
  const discordIdentity =
    authUser.identities?.find((i) => i.provider === 'discord')?.identity_data || {}

  const discordUsername =
    meta.custom_claims?.global_name ||
    discordIdentity.custom_claims?.global_name ||
    meta.full_name ||
    discordIdentity.full_name ||
    meta.name ||
    discordIdentity.name ||
    meta.preferred_username ||
    authUser.email?.split('@')[0] ||
    'Membro Seco'

  const avatarUrl =
    meta.avatar_url ||
    discordIdentity.avatar_url ||
    `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${authUser.id}`

  return {
    id: authUser.id,
    username: discordUsername,
    avatar_url: avatarUrl,
    discord_tag: meta.name || discordUsername,
    status: 'online',
  }
}

/**
 * Real-time WebAudio Voice Effect Processor!
 * Applies live DSP filters to a remote peer's voice when they get buried, coffined, reaped, or splashed:
 * - bury: Muffled underground 280Hz lowpass filter
 * - coffin: Boxy wooden resonance bandpass filter
 * - reaper: Haunted ghost echo / delay + high-pass filter
 * - water: Underwater bubbling LFO filter modulation
 */
function RemoteVoicePlayer({
  item,
  muted,
  volume,
  voiceEffect,
}: {
  item: RemoteAudioItem
  muted: boolean
  volume: number
  voiceEffect?: PrankType | null
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const filterRef = useRef<BiquadFilterNode | null>(null)
  const delayRef = useRef<DelayNode | null>(null)
  const feedbackGainRef = useRef<GainNode | null>(null)
  const lfoOscRef = useRef<OscillatorNode | null>(null)
  const lfoGainRef = useRef<GainNode | null>(null)

  useEffect(() => {
    if (!audioRef.current || !item.stream) return
    audioRef.current.srcObject = item.stream

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    try {
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(item.stream)

      const filter = ctx.createBiquadFilter()
      filter.type = 'allpass'
      filterRef.current = filter

      const delay = ctx.createDelay(1.0)
      delay.delayTime.value = 0
      delayRef.current = delay

      const feedback = ctx.createGain()
      feedback.gain.value = 0
      feedbackGainRef.current = feedback

      const lfoOsc = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      lfoOsc.frequency.value = 7
      lfoGain.gain.value = 0
      lfoOsc.connect(lfoGain)
      lfoGain.connect(filter.frequency)
      lfoOsc.start()
      lfoOscRef.current = lfoOsc
      lfoGainRef.current = lfoGain

      // Connect graph: source -> filter -> destination AND filter -> delay -> feedback -> delay -> destination
      source.connect(filter)
      filter.connect(ctx.destination)

      filter.connect(delay)
      delay.connect(feedback)
      feedback.connect(delay)
      delay.connect(ctx.destination)

      // Mute raw HTMLAudioElement so we only hear the WebAudio DSP output
      audioRef.current.muted = true
    } catch {
      // Fallback to normal audio element if WebAudio fails
    }

    return () => {
      lfoOscRef.current?.stop()
      audioCtxRef.current?.close().catch(() => {})
    }
  }, [item.stream])

  // Update DSP filter parameters whenever voiceEffect changes!
  useEffect(() => {
    const ctx = audioCtxRef.current
    const filter = filterRef.current
    const delay = delayRef.current
    const feedback = feedbackGainRef.current
    const lfoGain = lfoGainRef.current

    if (!ctx || !filter || !delay || !feedback || !lfoGain) return

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    // Reset defaults
    lfoGain.gain.value = 0
    delay.delayTime.value = 0
    feedback.gain.value = 0

    if (!voiceEffect) {
      filter.type = 'allpass'
      filter.frequency.value = 350
      filter.Q.value = 1
    } else if (voiceEffect === 'bury') {
      // Deeply muffled underground voice (debaixo da terra)
      filter.type = 'lowpass'
      filter.frequency.value = 280
      filter.Q.value = 2.5
    } else if (voiceEffect === 'coffin') {
      // Hollow wooden coffin box resonance
      filter.type = 'bandpass'
      filter.frequency.value = 520
      filter.Q.value = 4.0
      delay.delayTime.value = 0.045
      feedback.gain.value = 0.35
    } else if (voiceEffect === 'reaper') {
      // Spooky ghost echo from the afterlife
      filter.type = 'highpass'
      filter.frequency.value = 650
      filter.Q.value = 1.8
      delay.delayTime.value = 0.22
      feedback.gain.value = 0.55
    } else if (voiceEffect === 'water') {
      // Underwater bubbling voice
      filter.type = 'lowpass'
      filter.frequency.value = 480
      filter.Q.value = 6.0
      lfoGain.gain.value = 320
    }
  }, [voiceEffect])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : Math.min(Math.max(volume, 0), 1)
    }
  }, [volume, muted])

  return <audio ref={audioRef} autoPlay playsInline muted={muted} className="hidden" />
}

export function CommunityHub() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  // Channels & Multi-Roles state
  const [channels, setChannels] = useState<Room[]>(FALLBACK_CHANNELS)
  const [roles, setRoles] = useState<Role[]>(FALLBACK_ROLES)
  const [memberRoles, setMemberRoles] = useState<Record<string, string[]>>({})
  const [allMembers, setAllMembers] = useState<UserProfile[]>([])

  // Global presence map
  const [globalVoicePresence, setGlobalVoicePresence] = useState<Record<string, UserProfile>>({})

  // Active Text Channel vs Active Voice Channel
  const [selectedChannel, setSelectedChannel] = useState<Room>(FALLBACK_CHANNELS[2])
  const [activeVoiceRoom, setActiveVoiceRoom] = useState<Room | null>(FALLBACK_CHANNELS[2])

  // Unread messages badge map
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  // Active 15-second voice effects per user when pranked: { [userId]: { type, expiresAt } }
  const [userVoiceEffects, setUserVoiceEffects] = useState<
    Record<string, { type: PrankType; expiresAt: number }>
  >({})

  // Stream, Watch Together & UI Controls
  const [resolution, setResolution] = useState<ScreenShareOptions['resolution']>('1080p')
  const [fps, setFps] = useState<ScreenShareOptions['fps']>(60)
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS)
  const [showAudioConfig, setShowAudioConfig] = useState(false)
  const [voiceChatOpen, setVoiceChatOpen] = useState(false)
  const [showMembersSidebar, setShowMembersSidebar] = useState(true)
  const [showWatchTogether, setShowWatchTogether] = useState(false)
  const [focusedStreamId, setFocusedStreamId] = useState<string | null>(null)
  const [stageHeightPct, setStageHeightPct] = useState<number>(75)

  // Selected Member for Profile Popover
  const [inspectedMember, setInspectedMember] = useState<UserProfile | null>(null)

  // Modals for Creating Channels & Managing Roles
  const [createChannelType, setCreateChannelType] = useState<'text' | 'voice' | null>(null)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDesc, setNewChannelDesc] = useState('')
  const [showRolesModal, setShowRolesModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleColor, setNewRoleColor] = useState('#f59e0b')

  const selectedChannelRef = useRef<Room>(selectedChannel)
  const voiceChatOpenRef = useRef<boolean>(voiceChatOpen)
  const globalPresenceChannelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    selectedChannelRef.current = selectedChannel
  }, [selectedChannel])

  useEffect(() => {
    voiceChatOpenRef.current = voiceChatOpen
  }, [voiceChatOpen])

  // Auth & Profile Registration
  useEffect(() => {
    setSoundSettings(loadSoundSettings())
    const supabase = createClient()

    const syncUserToDb = async (profile: UserProfile) => {
      const nowIso = new Date().toISOString()
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', profile.id)
        .maybeSingle()

      if (!existing) {
        await supabase.from('user_profiles').insert({
          id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          role_id: 'seco-raiz',
          role_ids: ['seco-raiz'],
          joined_at: nowIso,
          last_seen_at: nowIso,
          updated_at: nowIso,
        })
      } else {
        await supabase
          .from('user_profiles')
          .update({
            username: profile.username,
            avatar_url: profile.avatar_url,
            last_seen_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', profile.id)
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const prof = extractDiscordProfile(data.user)
        setUser(prof)
        syncUserToDb(prof)
      }
      setLoadingAuth(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const prof = extractDiscordProfile(session.user)
        setUser(prof)
        syncUserToDb(prof)
      } else {
        setUser(null)
      }
      setLoadingAuth(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Heartbeat to update last_seen_at every 2 minutes
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const timer = setInterval(() => {
      supabase
        .from('user_profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user.id)
        .then(() => {})
    }, 120000)
    return () => clearInterval(timer)
  }, [user])

  const {
    localStream,
    isSharing,
    remoteStreams,
    remoteAudios,
    roomPeers,
    micEnabled,
    deafened,
    isSpeaking,
    speakingPeers,
    peerMuteStates,
    activePrank,
    setActivePrank,
    watchState,
    updateWatchTogether,
    triggerPrank,
    error,
    startScreenShare,
    stopScreenShare,
    toggleMic,
    toggleDeafen,
  } = useScreenShare(activeVoiceRoom?.id || '', user)

  // Whenever a prank happens, apply a 15-second voice filter to the target user!
  useEffect(() => {
    if (!activePrank) return
    const targetId = activePrank.targetUser.id
    const expiresAt = Date.now() + 15000

    setUserVoiceEffects((prev) => ({
      ...prev,
      [targetId]: { type: activePrank.type, expiresAt },
    }))

    const timer = setTimeout(() => {
      setUserVoiceEffects((prev) => {
        const current = prev[targetId]
        if (current && current.expiresAt <= Date.now() + 100) {
          const copy = { ...prev }
          delete copy[targetId]
          return copy
        }
        return prev
      })
    }, 15000)

    return () => clearTimeout(timer)
  }, [activePrank])

  // Auto-open Watch Together view when someone starts a synchronized video
  useEffect(() => {
    if (watchState?.active) {
      setShowWatchTogether(true)
    }
  }, [watchState?.active])

  // Global Presence Channel
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const channel = supabase.channel('os-secos-global-presence', {
      config: {
        presence: { key: user.id },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<UserProfile>()
        const map: Record<string, UserProfile> = {}
        Object.values(state).forEach((presences) => {
          if (presences[0]) {
            map[presences[0].id] = presences[0]
          }
        })
        setGlobalVoicePresence(map)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            ...user,
            voice_room_id: activeVoiceRoom?.id || null,
            isMuted: !micEnabled,
            isDeafened: deafened,
            status: isSharing ? 'streaming' : 'online',
          })
        }
      })

    globalPresenceChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      globalPresenceChannelRef.current = null
    }
  }, [user?.id])

  useEffect(() => {
    if (!user || !globalPresenceChannelRef.current) return
    globalPresenceChannelRef.current.track({
      ...user,
      voice_room_id: activeVoiceRoom?.id || null,
      isMuted: !micEnabled,
      isDeafened: deafened,
      status: isSharing ? 'streaming' : 'online',
    })
  }, [user, activeVoiceRoom?.id, micEnabled, deafened, isSharing])

  // Load Channels, Roles, User Profiles & Subscribe to Unread Messages
  useEffect(() => {
    const supabase = createClient()

    const parseMemberRolesMap = (profiles: UserProfile[]) => {
      const map: Record<string, string[]> = {}
      profiles.forEach((p) => {
        if (Array.isArray(p.role_ids) && p.role_ids.length > 0) {
          map[p.id] = p.role_ids
        } else if (p.role_id) {
          map[p.id] = [p.role_id]
        } else {
          map[p.id] = ['seco-raiz']
        }
      })
      return map
    }

    const fetchInitialData = async () => {
      const [{ data: chData }, { data: rData }, { data: pData }] = await Promise.all([
        supabase.from('channels').select('*').order('position', { ascending: true }),
        supabase.from('roles').select('*').order('position', { ascending: true }),
        supabase.from('user_profiles').select('*'),
      ])

      if (chData && chData.length > 0) {
        setChannels(chData as Room[])
      }
      if (rData && rData.length > 0) {
        setRoles(rData as Role[])
      }
      if (pData) {
        setAllMembers(pData as UserProfile[])
        setMemberRoles(parseMemberRolesMap(pData as UserProfile[]))
      }
    }

    fetchInitialData()

    const metaChannel = supabase
      .channel('community-meta-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channels' },
        () => {
          supabase
            .from('channels')
            .select('*')
            .order('position', { ascending: true })
            .then(({ data }) => {
              if (data && data.length > 0) setChannels(data as Room[])
            })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roles' },
        () => {
          supabase
            .from('roles')
            .select('*')
            .order('position', { ascending: true })
            .then(({ data }) => {
              if (data && data.length > 0) setRoles(data as Role[])
            })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        () => {
          supabase
            .from('user_profiles')
            .select('*')
            .then(({ data }) => {
              if (data) {
                setAllMembers(data as UserProfile[])
                setMemberRoles(parseMemberRolesMap(data as UserProfile[]))
              }
            })
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as ChatMessage
          if (!user || msg.user_id === user.id) return

          const curSelected = selectedChannelRef.current
          const isViewingThisChat =
            (curSelected.type === 'text' && curSelected.id === msg.room_id) ||
            (curSelected.type === 'voice' &&
              curSelected.id === msg.room_id &&
              voiceChatOpenRef.current)

          if (!isViewingThisChat) {
            setUnreadCounts((prev) => ({
              ...prev,
              [msg.room_id]: (prev[msg.room_id] || 0) + 1,
            }))
            playRoomEventSound('chat-message')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(metaChannel)
    }
  }, [user])

  const handleSelectChannel = (ch: Room) => {
    setSelectedChannel(ch)
    if (ch.type === 'text') {
      setUnreadCounts((prev) => ({ ...prev, [ch.id]: 0 }))
    } else if (ch.type === 'voice') {
      setActiveVoiceRoom(ch)
      if (voiceChatOpen) {
        setUnreadCounts((prev) => ({ ...prev, [ch.id]: 0 }))
      }
    }
  }

  const handleDisconnectVoice = () => {
    if (isSharing) {
      stopScreenShare()
    }
    playRoomEventSound('user-leave', soundSettings)
    setActiveVoiceRoom(null)
    setVoiceChatOpen(false)
    const firstText = channels.find((c) => c.type === 'text')
    if (firstText) {
      setSelectedChannel(firstText)
      setUnreadCounts((prev) => ({ ...prev, [firstText.id]: 0 }))
    }
  }

  const handleToggleVoiceChat = () => {
    if (!activeVoiceRoom) return
    setVoiceChatOpen((prev) => {
      const next = !prev
      if (next) {
        setUnreadCounts((u) => ({ ...u, [activeVoiceRoom.id]: 0 }))
      }
      return next
    })
  }

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChannelName.trim() || !createChannelType) return

    const cleanName =
      createChannelType === 'text'
        ? newChannelName.trim().toLowerCase().replace(/\s+/g, '-')
        : newChannelName.trim()

    const id = `${cleanName.toLowerCase().replace(/[^a-z0-9-]/g, '')}-${Math.floor(
      100 + Math.random() * 899
    )}`

    const newRoom: Room = {
      id,
      name: cleanName,
      description:
        newChannelDesc.trim() ||
        (createChannelType === 'text' ? 'Canal de texto' : 'Canal de voz e tela'),
      type: createChannelType,
      position: channels.length + 1,
      created_by: user?.id,
    }

    const createdType = createChannelType
    setChannels((prev) => [...prev, newRoom])
    setCreateChannelType(null)
    setNewChannelName('')
    setNewChannelDesc('')

    const supabase = createClient()
    await supabase.from('channels').insert(newRoom)

    if (createdType === 'text') {
      handleSelectChannel(newRoom)
    }
  }

  const handleDeleteChannel = async (chId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (channels.length <= 2) return
    setChannels((prev) => prev.filter((c) => c.id !== chId))
    const supabase = createClient()
    await supabase.from('channels').delete().eq('id', chId)
  }

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleName.trim()) return

    const id = `${newRoleName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')}-${Math.floor(10 + Math.random() * 89)}`

    const role: Role = {
      id,
      name: newRoleName.trim(),
      color: newRoleColor,
      position: roles.length + 1,
    }

    setRoles((prev) => [...prev, role])
    setNewRoleName('')

    const supabase = createClient()
    await supabase.from('roles').insert(role)
  }

  // Toggle multiple roles per member!
  const handleToggleRole = async (targetUserId: string, roleId: string) => {
    const currentList = memberRoles[targetUserId] || ['seco-raiz']
    const exists = currentList.includes(roleId)
    let nextList: string[]
    if (exists) {
      nextList = currentList.filter((id) => id !== roleId)
      if (nextList.length === 0) nextList = ['seco-raiz']
    } else {
      nextList = [...currentList, roleId]
    }

    setMemberRoles((prev) => ({ ...prev, [targetUserId]: nextList }))
    const supabase = createClient()
    await supabase
      .from('user_profiles')
      .update({ role_ids: nextList, role_id: nextList[0] })
      .eq('id', targetUserId)
  }

  const updateSoundConfig = (patch: Partial<SoundSettings>) => {
    setSoundSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSoundSettings(next)
      return next
    })
  }

  const handleDiscordLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  const allStreams = [
    ...(localStream && user ? [{ id: 'local', user, stream: localStream, isLocal: true }] : []),
    ...remoteStreams.map((r) => ({
      id: r.peerId,
      user: r.user,
      stream: r.stream,
      isLocal: false,
    })),
  ]

  const activeFocusedStream =
    allStreams.find((s) => s.id === focusedStreamId) ||
    (allStreams.length === 1 ? allStreams[0] : null)

  const textChannels = channels.filter((c) => c.type === 'text')
  const voiceChannels = channels.filter((c) => c.type === 'voice')

  // Returns all roles assigned to a user sorted by position
  const getRolesForUser = (userId: string): Role[] => {
    const rIds = memberRoles[userId] || ['seco-raiz']
    return roles
      .filter((r) => rIds.includes(r.id))
      .sort((a, b) => a.position - b.position)
  }

  const getPrimaryRoleForUser = (userId: string): Role | undefined => {
    return getRolesForUser(userId)[0]
  }

  const getPeerMuteStatus = (peer: UserProfile) => {
    if (peer.id === user?.id) {
      return { isMuted: !micEnabled, isDeafened: deafened }
    }
    const fromSignal = peerMuteStates[peer.id]
    if (fromSignal) return fromSignal
    const fromGlobal = globalVoicePresence[peer.id]
    return {
      isMuted: peer.isMuted ?? fromGlobal?.isMuted ?? true,
      isDeafened: peer.isDeafened ?? fromGlobal?.isDeafened ?? false,
    }
  }

  if (!loadingAuth && !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#1e1f22] p-4">
        <div className="w-full max-w-sm rounded-lg border border-[#2b2d31] bg-[#313338] p-6 text-center shadow-2xl">
          <img
            src="/logo.png"
            alt="Os Secos"
            className="mx-auto mb-4 h-24 w-24 rounded-full border-2 border-[#232428] object-cover"
          />
          <h1 className="text-xl font-bold text-white">Os Secos</h1>
          <p className="mt-1 text-xs text-[#b5bac1]">
            Entre com sua conta do Discord para acessar os canais de texto, voz e tela 120 FPS.
          </p>

          <button
            type="button"
            onClick={handleDiscordLogin}
            className="mt-5 w-full cursor-pointer rounded bg-[#5865F2] py-2.5 text-xs font-semibold text-white hover:bg-[#4752C4]"
          >
            Entrar com Discord
          </button>
        </div>
      </div>
    )
  }

  const voiceUnread = activeVoiceRoom ? unreadCounts[activeVoiceRoom.id] || 0 : 0

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#313338] text-[#f2f3f5]">
      {/* Real Three.js 3D WebGL Prank Overlay */}
      <PrankStageOverlay
        activePrank={activePrank}
        onComplete={() => setActivePrank(null)}
      />

      {/* User Profile Card Popover with Multi-Roles */}
      {inspectedMember && (
        <UserProfilePopover
          member={
            allMembers.find((m) => m.id === inspectedMember.id) || inspectedMember
          }
          roles={roles}
          currentRoleIds={memberRoles[inspectedMember.id] || ['seco-raiz']}
          isOnline={Boolean(globalVoicePresence[inspectedMember.id])}
          currentVoiceRoomName={
            voiceChannels.find(
              (v) => v.id === globalVoicePresence[inspectedMember.id]?.voice_room_id
            )?.name || null
          }
          canPrank={Boolean(
            activeVoiceRoom &&
              roomPeers.some((p) => p.id === inspectedMember.id)
          )}
          onToggleRole={handleToggleRole}
          onTriggerPrank={triggerPrank}
          onClose={() => setInspectedMember(null)}
        />
      )}

      {/* Hidden Audio Players with Real-Time WebAudio Voice Filters */}
      {remoteAudios.map((item) => (
        <RemoteVoicePlayer
          key={item.peerId}
          item={item}
          muted={deafened}
          volume={soundSettings.volume}
          voiceEffect={userVoiceEffects[item.peerId]?.type || null}
        />
      ))}

      {/* LEFT SIDEBAR: Discord Server Channels */}
      <aside className="flex w-60 shrink-0 flex-col bg-[#2b2d31] select-none">
        {/* Server Header */}
        <div className="flex h-12 items-center justify-between border-b border-[#1f2023] px-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/logo.png"
              alt="Os Secos"
              className="h-7 w-7 rounded-full object-cover"
            />
            <span className="truncate text-sm font-bold text-white">Os Secos</span>
          </div>

          <button
            type="button"
            onClick={() => setShowRolesModal(true)}
            className="cursor-pointer rounded bg-[#35373c] px-2 py-1 text-[10px] font-semibold text-zinc-200 hover:bg-[#404249]"
            title="Gerenciar Cargos da Comunidade"
          >
            Cargos
          </button>
        </div>

        {/* Channels Scroll Area */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
          {/* TEXT CHANNELS SECTION */}
          <div>
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="text-[11px] font-bold tracking-wider text-[#949ba4] uppercase">
                Canais de Texto
              </span>
              <button
                type="button"
                onClick={() => setCreateChannelType('text')}
                className="cursor-pointer rounded px-1.5 text-sm font-bold text-[#949ba4] hover:bg-[#35373c] hover:text-white"
                title="Criar Canal de Texto"
              >
                +
              </button>
            </div>

            <div className="space-y-0.5">
              {textChannels.map((ch) => {
                const isSelected = selectedChannel.id === ch.id
                const unread = unreadCounts[ch.id] || 0
                return (
                  <div
                    key={ch.id}
                    onClick={() => handleSelectChannel(ch)}
                    className={`group relative flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition ${
                      isSelected
                        ? 'bg-[#404249] font-semibold text-white'
                        : unread > 0
                        ? 'font-bold text-white hover:bg-[#35373c]'
                        : 'font-medium text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                    }`}
                  >
                    {unread > 0 && !isSelected && (
                      <span className="absolute left-0 h-2 w-1 rounded-r bg-white" />
                    )}

                    <span className="truncate"># {ch.name}</span>

                    <div className="flex items-center gap-1">
                      {unread > 0 && !isSelected && (
                        <span className="rounded-full bg-[#da373c] px-1.5 py-0.2 text-[10px] font-bold text-white">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                      {textChannels.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteChannel(ch.id, e)}
                          className="hidden cursor-pointer text-[10px] text-[#949ba4] hover:text-[#da373c] group-hover:inline"
                          title="Excluir canal"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* VOICE CHANNELS SECTION */}
          <div>
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="text-[11px] font-bold tracking-wider text-[#949ba4] uppercase">
                Canais de Voz e Tela
              </span>
              <button
                type="button"
                onClick={() => setCreateChannelType('voice')}
                className="cursor-pointer rounded px-1.5 text-sm font-bold text-[#949ba4] hover:bg-[#35373c] hover:text-white"
                title="Criar Sala de Voz/Tela"
              >
                +
              </button>
            </div>

            <div className="space-y-1">
              {voiceChannels.map((room) => {
                const isSelected = selectedChannel.id === room.id
                const isConnectedHere = activeVoiceRoom?.id === room.id
                const roomUnread = unreadCounts[room.id] || 0

                const usersInThisVoiceRoom = isConnectedHere
                  ? roomPeers
                  : Object.values(globalVoicePresence).filter(
                      (p) => p.voice_room_id === room.id
                    )

                return (
                  <div key={room.id}>
                    <div
                      onClick={() => handleSelectChannel(room)}
                      className={`group flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                        isSelected
                          ? 'bg-[#404249] text-white'
                          : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                      }`}
                    >
                      <span className="truncate">🔊 {room.name}</span>

                      <div className="flex items-center gap-1">
                        {roomUnread > 0 && (
                          <span className="rounded-full bg-[#da373c] px-1.5 py-0.2 text-[10px] font-bold text-white">
                            {roomUnread}
                          </span>
                        )}
                        {usersInThisVoiceRoom.length > 0 && (
                          <span className="rounded bg-[#232428] px-1.5 py-0.5 text-[10px] text-[#b5bac1]">
                            {usersInThisVoiceRoom.length}
                          </span>
                        )}
                        {voiceChannels.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteChannel(room.id, e)}
                            className="hidden cursor-pointer text-[10px] text-[#949ba4] hover:text-[#da373c] group-hover:inline"
                            title="Excluir sala"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Connected Users Indented Below ANY Voice Channel */}
                    {usersInThisVoiceRoom.length > 0 && (
                      <div className="mt-1 ml-4 space-y-0.5 border-l border-[#3f4147] pl-2">
                        {usersInThisVoiceRoom.map((peer) => {
                          const talking =
                            isConnectedHere &&
                            (peer.id === user?.id
                              ? isSpeaking
                              : Boolean(speakingPeers[peer.id]))
                          const streaming =
                            peer.status === 'streaming' ||
                            (isConnectedHere &&
                              ((peer.id === user?.id && isSharing) ||
                                remoteStreams.some((s) => s.peerId === peer.id)))
                          const peerRole = getPrimaryRoleForUser(peer.id)
                          const muteInfo = getPeerMuteStatus(peer)

                          return (
                            <div
                              key={peer.id}
                              onClick={() => setInspectedMember(peer)}
                              className="flex cursor-pointer items-center justify-between rounded px-2 py-1 hover:bg-[#35373c]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={peer.avatar_url}
                                  alt={peer.username}
                                  className={`h-6 w-6 shrink-0 rounded-full object-cover transition ${
                                    talking
                                      ? 'ring-2 ring-[#23a55a]'
                                      : 'ring-1 ring-transparent'
                                  }`}
                                />
                                <span
                                  style={{
                                    color: talking
                                      ? '#ffffff'
                                      : peerRole?.color || '#dbdee1',
                                  }}
                                  className="truncate text-xs font-semibold"
                                >
                                  {peer.username}
                                </span>
                              </div>

                              {/* Right Icons: Mic Off, Deafen Off, AO VIVO */}
                              <div className="flex shrink-0 items-center gap-1">
                                {muteInfo.isMuted && (
                                  <span title="Microfone Mutado">
                                    <MicOff className="h-3.5 w-3.5 text-[#da373c]" />
                                  </span>
                                )}
                                {muteInfo.isDeafened && (
                                  <span title="Áudio Desativado">
                                    <HeadphoneOff className="h-3.5 w-3.5 text-[#da373c]" />
                                  </span>
                                )}
                                {streaming && (
                                  <span className="rounded bg-[#da373c] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase">
                                    AO VIVO
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Discord Voice Connected Status Panel */}
        {activeVoiceRoom && (
          <div className="border-t border-[#1f2023] bg-[#232428] px-3 py-2">
            <div className="flex items-center justify-between gap-1">
              <div
                onClick={() => setSelectedChannel(activeVoiceRoom)}
                className="cursor-pointer min-w-0"
              >
                <div className="text-[11px] font-bold text-[#23a55a]">Voz Conectada</div>
                <div className="truncate text-[10px] text-[#949ba4]">
                  {activeVoiceRoom.name}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {!isSharing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChannel(activeVoiceRoom)
                      setShowWatchTogether(false)
                      startScreenShare({ resolution, fps, includeAudio: true })
                    }}
                    className="cursor-pointer rounded bg-[#2b2d31] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#35373c]"
                  >
                    Tela
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopScreenShare}
                    className="cursor-pointer rounded bg-[#da373c] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#a1282c]"
                  >
                    Parar
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDisconnectVoice}
                  className="cursor-pointer rounded bg-[#da373c]/20 px-2 py-1 text-[10px] font-bold text-[#da373c] hover:bg-[#da373c] hover:text-white"
                  title="Desconectar da Sala de Voz"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Discord Bottom User Profile Bar */}
        {user && (
          <div className="flex items-center justify-between bg-[#1e1f22] px-2.5 py-2">
            <div
              onClick={() => setInspectedMember(user)}
              className="flex cursor-pointer items-center gap-2 min-w-0 rounded px-1 py-0.5 hover:bg-[#2b2d31]"
            >
              <img
                src={user.avatar_url}
                alt={user.username}
                className={`h-8 w-8 shrink-0 rounded-full object-cover ${
                  isSpeaking ? 'ring-2 ring-[#23a55a]' : ''
                }`}
              />
              <div className="min-w-0">
                <div
                  style={{ color: getPrimaryRoleForUser(user.id)?.color || '#ffffff' }}
                  className="truncate text-xs font-bold"
                >
                  {user.username}
                </div>
                <div className="truncate text-[10px] text-[#949ba4]">
                  {getRolesForUser(user.id)
                    .map((r) => r.name)
                    .join(' • ') || 'Online'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMic}
                className={`cursor-pointer rounded p-1.5 transition ${
                  micEnabled
                    ? 'text-[#b5bac1] hover:bg-[#2b2d31] hover:text-white'
                    : 'bg-[#da373c]/20 text-[#da373c]'
                }`}
                title={micEnabled ? 'Mutar Microfone' : 'Ativar Microfone'}
              >
                {micEnabled ? (
                  <Mic className="h-4 w-4" />
                ) : (
                  <MicOff className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                onClick={toggleDeafen}
                className={`cursor-pointer rounded p-1.5 transition ${
                  !deafened
                    ? 'text-[#b5bac1] hover:bg-[#2b2d31] hover:text-white'
                    : 'bg-[#da373c]/20 text-[#da373c]'
                }`}
                title={deafened ? 'Ativar Áudio' : 'Desativar Áudio'}
              >
                {deafened ? (
                  <HeadphoneOff className="h-4 w-4" />
                ) : (
                  <Headphones className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* CENTER AREA */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#1e1f22]">
        {/* Top Header */}
        <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-[#1f2023] bg-[#2b2d31] px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="truncate text-sm font-bold text-white">
              {selectedChannel.type === 'text'
                ? `# ${selectedChannel.name}`
                : `🔊 ${selectedChannel.name}`}
            </span>
            <span className="hidden truncate text-xs text-[#949ba4] md:inline">
              {selectedChannel.description}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedChannel.type === 'voice' && allStreams.length > 0 && (
              <div className="hidden items-center gap-2 rounded bg-[#1e1f22] px-2.5 py-1 text-[11px] text-[#b5bac1] sm:flex">
                <span>Tamanho:</span>
                <input
                  type="range"
                  min={45}
                  max={95}
                  value={stageHeightPct}
                  onChange={(e) => setStageHeightPct(Number(e.target.value))}
                  className="h-1.5 w-20 cursor-pointer accent-[#5865f2]"
                />
              </div>
            )}

            {/* Resolution & 120 FPS Selector */}
            <div className="flex items-center gap-1 rounded bg-[#1e1f22] px-2 py-1 text-xs">
              <select
                value={resolution}
                onChange={(e) =>
                  setResolution(e.target.value as ScreenShareOptions['resolution'])
                }
                disabled={isSharing}
                className="cursor-pointer bg-transparent font-semibold text-zinc-200 focus:outline-none disabled:opacity-50"
              >
                <option value="720p" className="bg-[#1e1f22]">
                  720p
                </option>
                <option value="1080p" className="bg-[#1e1f22]">
                  1080p
                </option>
                <option value="1440p" className="bg-[#1e1f22]">
                  1440p
                </option>
              </select>
              <span className="text-zinc-600">/</span>
              <select
                value={fps}
                onChange={(e) =>
                  setFps(Number(e.target.value) as ScreenShareOptions['fps'])
                }
                disabled={isSharing}
                className="cursor-pointer bg-transparent font-semibold text-zinc-200 focus:outline-none disabled:opacity-50"
              >
                <option value={30} className="bg-[#1e1f22]">
                  30 FPS
                </option>
                <option value={60} className="bg-[#1e1f22]">
                  60 FPS
                </option>
                <option value={120} className="bg-[#1e1f22]">
                  120 FPS
                </option>
              </select>
            </div>

            {selectedChannel.type === 'voice' && activeVoiceRoom && (
              <button
                type="button"
                onClick={() => setShowWatchTogether((w) => !w)}
                className={`flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold ${
                  showWatchTogether || watchState?.active
                    ? 'bg-[#5865f2] text-white'
                    : 'bg-[#1e1f22] text-zinc-200 hover:bg-[#35373c]'
                }`}
              >
                <Tv className="h-3.5 w-3.5" />
                Watch / Música
              </button>
            )}

            {/* Sound Settings Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAudioConfig((s) => !s)}
                className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium ${
                  showAudioConfig
                    ? 'bg-[#5865f2] text-white'
                    : 'bg-[#1e1f22] text-zinc-200 hover:bg-[#35373c]'
                }`}
              >
                Sons
              </button>

              {showAudioConfig && (
                <div className="absolute right-0 top-9 z-30 w-64 rounded-lg border border-[#111214] bg-[#2b2d31] p-3.5 shadow-2xl">
                  <div className="mb-2.5 flex items-center justify-between border-b border-[#1f2023] pb-1.5">
                    <span className="text-xs font-bold text-white">Sons & Notificações</span>
                    <button
                      type="button"
                      onClick={() => setShowAudioConfig(false)}
                      className="cursor-pointer text-[11px] text-zinc-400 hover:text-white"
                    >
                      Fechar
                    </button>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <div className="mb-1 flex justify-between text-zinc-300">
                        <span>Volume</span>
                        <span>{Math.round(soundSettings.volume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={soundSettings.volume}
                        onChange={(e) =>
                          updateSoundConfig({ volume: parseFloat(e.target.value) })
                        }
                        className="h-1.5 w-full cursor-pointer accent-[#5865f2]"
                      />
                    </div>

                    <label className="flex cursor-pointer items-center justify-between text-zinc-200">
                      <span>Ativar todos os sons</span>
                      <input
                        type="checkbox"
                        checked={soundSettings.enabled}
                        onChange={(e) => updateSoundConfig({ enabled: e.target.checked })}
                        className="accent-[#23a55a]"
                      />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between text-zinc-200">
                      <span>Entrar / sair da sala</span>
                      <input
                        type="checkbox"
                        checked={soundSettings.joinLeaveSounds}
                        disabled={!soundSettings.enabled}
                        onChange={(e) =>
                          updateSoundConfig({ joinLeaveSounds: e.target.checked })
                        }
                        className="accent-[#23a55a]"
                      />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between text-zinc-200">
                      <span>Iniciar / parar tela</span>
                      <input
                        type="checkbox"
                        checked={soundSettings.streamSounds}
                        disabled={!soundSettings.enabled}
                        onChange={(e) =>
                          updateSoundConfig({ streamSounds: e.target.checked })
                        }
                        className="accent-[#23a55a]"
                      />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between text-zinc-200">
                      <span>Notificação de chat</span>
                      <input
                        type="checkbox"
                        checked={soundSettings.chatSounds}
                        disabled={!soundSettings.enabled}
                        onChange={(e) =>
                          updateSoundConfig({ chatSounds: e.target.checked })
                        }
                        className="accent-[#23a55a]"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => playRoomEventSound('stream-start', soundSettings)}
                      className="w-full cursor-pointer rounded bg-[#1e1f22] py-1.5 text-center text-[11px] font-semibold text-white hover:bg-[#35373c]"
                    >
                      Testar Som
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedChannel.type === 'voice' && activeVoiceRoom && (
              <button
                type="button"
                onClick={handleToggleVoiceChat}
                className={`relative cursor-pointer rounded px-2.5 py-1 text-xs font-semibold ${
                  voiceChatOpen
                    ? 'bg-[#5865f2] text-white'
                    : 'bg-[#1e1f22] text-zinc-200 hover:bg-[#35373c]'
                }`}
              >
                Chat da Sala
                {voiceUnread > 0 && !voiceChatOpen && (
                  <span className="ml-1.5 rounded-full bg-[#da373c] px-1.5 py-0.2 text-[10px] font-bold text-white">
                    {voiceUnread}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowMembersSidebar((s) => !s)}
              className={`cursor-pointer rounded px-2.5 py-1 text-xs font-semibold ${
                showMembersSidebar
                  ? 'bg-[#404249] text-white'
                  : 'bg-[#1e1f22] text-zinc-300 hover:bg-[#35373c]'
              }`}
            >
              Membros
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="cursor-pointer rounded bg-[#1e1f22] px-2.5 py-1 text-xs text-zinc-400 hover:bg-[#35373c] hover:text-white"
            >
              Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-[#da373c] px-4 py-1.5 text-center text-xs font-semibold text-white">
            {error}
          </div>
        )}

        {/* BODY */}
        {selectedChannel.type === 'text' ? (
          user && (
            <ChatPanel
              roomId={selectedChannel.id}
              roomName={selectedChannel.name}
              currentUser={user}
              roles={roles}
              memberRoles={memberRoles}
              fullView
            />
          )
        ) : (
          <>
            {/* Main Discord Call Stage Area */}
            <div className="flex flex-1 flex-col overflow-y-auto p-4 gap-3">
              {showWatchTogether || watchState?.active ? (
                <WatchTogetherStage
                  watchState={watchState}
                  currentUser={user}
                  onUpdateWatchState={updateWatchTogether}
                  onStartTabShare={() => {
                    setShowWatchTogether(false)
                    startScreenShare({ resolution, fps, includeAudio: true })
                  }}
                />
              ) : allStreams.length === 0 ? (
                <div className="flex flex-1 flex-wrap items-center justify-center content-center gap-4 p-4">
                  {roomPeers.map((peer) => {
                    const talking =
                      peer.id === user?.id ? isSpeaking : Boolean(speakingPeers[peer.id])
                    const userRoleList = getRolesForUser(peer.id)
                    const primaryRole = userRoleList[0]
                    const muteInfo = getPeerMuteStatus(peer)
                    const activeVoiceFx = userVoiceEffects[peer.id]?.type

                    return (
                      <div
                        key={peer.id}
                        onClick={() => setInspectedMember(peer)}
                        className={`group relative flex h-56 w-80 cursor-pointer flex-col items-center justify-center rounded-xl bg-[#2b2d31] p-4 shadow-md transition ${
                          talking
                            ? 'ring-2 ring-[#23a55a]'
                            : 'border border-[#232428] hover:border-[#3f4147]'
                        }`}
                      >
                        {/* Top-Left Active Voice Filter Badge */}
                        {activeVoiceFx && (
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-300 ring-1 ring-amber-500/40">
                            <PrankIcon type={activeVoiceFx} className="h-3 w-3" />
                            <span>
                              {activeVoiceFx === 'bury' && 'Soterrado'}
                              {activeVoiceFx === 'coffin' && 'No Caixão'}
                              {activeVoiceFx === 'reaper' && 'Voz do Além'}
                              {activeVoiceFx === 'water' && 'Afogado'}
                            </span>
                          </div>
                        )}

                        {/* Top-Right Status Icons */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                          {muteInfo.isMuted && (
                            <span
                              className="rounded-full bg-[#1e1f22] p-1.5 text-[#da373c]"
                              title="Microfone Mutado"
                            >
                              <MicOff className="h-3.5 w-3.5" />
                            </span>
                          )}
                          {muteInfo.isDeafened && (
                            <span
                              className="rounded-full bg-[#1e1f22] p-1.5 text-[#da373c]"
                              title="Áudio Desativado"
                            >
                              <HeadphoneOff className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>

                        <img
                          src={peer.avatar_url}
                          alt={peer.username}
                          className={`h-20 w-20 rounded-full object-cover ${
                            talking ? 'ring-4 ring-[#23a55a]' : ''
                          }`}
                        />
                        <span
                          style={{ color: primaryRole?.color || '#ffffff' }}
                          className="mt-2.5 text-sm font-bold"
                        >
                          {peer.username}
                        </span>

                        {/* Multi-Role Badges */}
                        <div className="mt-1 flex flex-wrap justify-center gap-1">
                          {userRoleList.map((r) => (
                            <span
                              key={r.id}
                              style={{
                                backgroundColor: `${r.color}22`,
                                color: r.color,
                                borderColor: `${r.color}55`,
                              }}
                              className="rounded border px-1.5 py-0.2 text-[9px] font-bold"
                            >
                              {r.name}
                            </span>
                          ))}
                        </div>

                        {/* Custom SVG 3D Prank Action Buttons (Always visible on Windows!) */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-3 flex items-center gap-1.5"
                        >
                          {PRANK_OPTIONS.map((prank) => (
                            <button
                              key={prank.type}
                              type="button"
                              onClick={() => triggerPrank(prank.type, peer)}
                              title={`${prank.label} (${prank.voiceEffectLabel})`}
                              className="flex cursor-pointer items-center gap-1 rounded-md border border-white/10 bg-[#1e1f22] px-2 py-1 text-[10px] font-bold text-zinc-200 transition hover:border-amber-400/50 hover:bg-[#35373c] hover:text-amber-300"
                            >
                              <PrankIcon type={prank.type} className="h-3.5 w-3.5 text-amber-400" />
                              <span>{prank.shortLabel}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : activeFocusedStream ? (
                <div className="flex flex-1 flex-col gap-3 overflow-hidden">
                  <div
                    style={{ height: `${stageHeightPct}%` }}
                    className="w-full shrink-0 overflow-hidden"
                  >
                    <VideoStage
                      stream={activeFocusedStream.stream}
                      user={activeFocusedStream.user}
                      isLocal={activeFocusedStream.isLocal}
                      deafened={deafened}
                      isFocused={allStreams.length > 1}
                      onToggleFocus={
                        allStreams.length > 1
                          ? () => setFocusedStreamId(null)
                          : undefined
                      }
                    />
                  </div>

                  {/* Centered Participant Cards Strip */}
                  <div className="flex flex-1 items-center justify-center gap-3 overflow-x-auto pb-1">
                    {roomPeers.map((peer) => {
                      const talking =
                        peer.id === user?.id ? isSpeaking : Boolean(speakingPeers[peer.id])
                      const peerRole = getPrimaryRoleForUser(peer.id)
                      const muteInfo = getPeerMuteStatus(peer)
                      return (
                        <div
                          key={peer.id}
                          onClick={() => setInspectedMember(peer)}
                          className={`relative flex h-24 w-44 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg bg-[#2b2d31] p-2 ${
                            talking ? 'ring-2 ring-[#23a55a]' : ''
                          }`}
                        >
                          <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                            {muteInfo.isMuted && (
                              <MicOff className="h-3 w-3 text-[#da373c]" />
                            )}
                            {muteInfo.isDeafened && (
                              <HeadphoneOff className="h-3 w-3 text-[#da373c]" />
                            )}
                          </div>
                          <img
                            src={peer.avatar_url}
                            alt={peer.username}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                          <span
                            style={{ color: peerRole?.color || '#e4e6eb' }}
                            className="mt-1.5 max-w-full truncate text-[11px] font-bold"
                          >
                            {peer.username}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                  {allStreams.map((item) => (
                    <VideoStage
                      key={item.id}
                      stream={item.stream}
                      user={item.user}
                      isLocal={item.isLocal}
                      deafened={deafened}
                      isFocused={false}
                      onToggleFocus={() => setFocusedStreamId(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Discord Call Control Bar */}
            <div className="flex h-16 shrink-0 flex-wrap items-center justify-center gap-2 border-t border-[#111214] bg-[#232428] px-4">
              <button
                type="button"
                onClick={toggleMic}
                className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  micEnabled
                    ? 'bg-[#2b2d31] text-white hover:bg-[#35373c]'
                    : 'bg-[#da373c] text-white hover:bg-[#a1282c]'
                }`}
              >
                {micEnabled ? (
                  <Mic className="h-4 w-4" />
                ) : (
                  <MicOff className="h-4 w-4" />
                )}
                {micEnabled ? 'Microfone' : 'Mutado'}
              </button>

              <button
                type="button"
                onClick={toggleDeafen}
                className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  !deafened
                    ? 'bg-[#2b2d31] text-white hover:bg-[#35373c]'
                    : 'bg-[#da373c] text-white hover:bg-[#a1282c]'
                }`}
              >
                {deafened ? (
                  <HeadphoneOff className="h-4 w-4" />
                ) : (
                  <Headphones className="h-4 w-4" />
                )}
                {deafened ? 'Áudio: OFF' : 'Áudio: ON'}
              </button>

              {!isSharing ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowWatchTogether(false)
                    startScreenShare({ resolution, fps, includeAudio: true })
                  }}
                  className="cursor-pointer rounded-full bg-[#23a55a] px-5 py-2 text-xs font-bold text-white hover:bg-[#1a7f44]"
                >
                  Compartilhar Tela
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopScreenShare}
                  className="cursor-pointer rounded-full bg-[#da373c] px-5 py-2 text-xs font-bold text-white hover:bg-[#a1282c]"
                >
                  Parar Transmissão
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowWatchTogether((w) => !w)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  showWatchTogether || watchState?.active
                    ? 'bg-[#5865f2] text-white'
                    : 'bg-[#2b2d31] text-zinc-200 hover:bg-[#35373c]'
                }`}
              >
                <Tv className="h-3.5 w-3.5" />
                Watch Together
              </button>

              <button
                type="button"
                onClick={handleToggleVoiceChat}
                className={`relative cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition ${
                  voiceChatOpen
                    ? 'bg-[#5865f2] text-white'
                    : 'bg-[#2b2d31] text-zinc-200 hover:bg-[#35373c]'
                }`}
              >
                Chat da Sala
                {voiceUnread > 0 && !voiceChatOpen && (
                  <span className="ml-1.5 rounded-full bg-[#da373c] px-1.5 py-0.2 text-[10px] font-bold text-white">
                    {voiceUnread}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleDisconnectVoice}
                className="cursor-pointer rounded-full bg-[#da373c] px-4 py-2 text-xs font-bold text-white hover:bg-[#a1282c]"
                title="Sair da Sala de Voz"
              >
                Desconectar
              </button>
            </div>
          </>
        )}
      </div>

      {/* RIGHT VOICE CHAT DRAWER */}
      {selectedChannel.type === 'voice' && activeVoiceRoom && voiceChatOpen && user && (
        <ChatPanel
          roomId={activeVoiceRoom.id}
          roomName={activeVoiceRoom.name}
          currentUser={user}
          roles={roles}
          memberRoles={memberRoles}
          onClose={() => setVoiceChatOpen(false)}
        />
      )}

      {/* RIGHT DISCORD MEMBERS LIST GROUPED BY HIGHEST ROLE */}
      {showMembersSidebar && (
        <aside className="hidden w-64 shrink-0 flex-col border-l border-[#1f2023] bg-[#2b2d31] p-3 overflow-y-auto xl:flex">
          {roles.map((role) => {
            const roleMembers = allMembers.filter((m) => {
              const primary = getPrimaryRoleForUser(m.id)
              return (primary?.id || 'seco-raiz') === role.id
            })
            if (roleMembers.length === 0) return null

            return (
              <div key={role.id} className="mb-4">
                <div className="mb-1.5 px-2 text-[11px] font-bold tracking-wider text-[#949ba4] uppercase">
                  {role.name} — {roleMembers.length}
                </div>
                <div className="space-y-1">
                  {roleMembers.map((m) => {
                    const onlineInfo = globalVoicePresence[m.id]
                    const isOnline = Boolean(onlineInfo)
                    const memberVoiceRoom = voiceChannels.find(
                      (v) => v.id === onlineInfo?.voice_room_id
                    )
                    const userAllRoles = getRolesForUser(m.id)

                    return (
                      <div
                        key={m.id}
                        onClick={() => setInspectedMember(m)}
                        className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-[#35373c]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <img
                              src={m.avatar_url}
                              alt={m.username}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                            <span
                              className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#2b2d31] ${
                                isOnline ? 'bg-[#23a55a]' : 'bg-[#80848e]'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span
                                style={{ color: role.color }}
                                className="truncate text-xs font-bold"
                              >
                                {m.username}
                              </span>
                              {userAllRoles.length > 1 && (
                                <span className="rounded bg-[#1e1f22] px-1 py-0.2 text-[9px] font-bold text-zinc-400">
                                  +{userAllRoles.length - 1}
                                </span>
                              )}
                            </div>
                            <div className="truncate text-[10px] text-[#949ba4]">
                              {memberVoiceRoom
                                ? `🔊 ${memberVoiceRoom.name}`
                                : formatRelativeTime(
                                    m.last_seen_at || m.updated_at,
                                    isOnline
                                  )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </aside>
      )}

      {/* MODAL: Create Text or Voice Channel */}
      {createChannelType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#1f2023] bg-[#313338] p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              {createChannelType === 'text'
                ? 'Criar Canal de Texto'
                : 'Criar Sala de Voz / Tela'}
            </h3>
            <p className="mt-1 text-xs text-[#949ba4]">
              {createChannelType === 'text'
                ? 'Envie mensagens, memes e emotes.'
                : 'A sala será criada na lista sem te desconectar da sua call atual.'}
            </p>

            <form onSubmit={handleCreateChannel} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#b5bac1] uppercase">
                  Nome do Canal
                </label>
                <input
                  type="text"
                  required
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder={
                    createChannelType === 'text' ? 'ex: builds-e-dicas' : 'ex: Bossing'
                  }
                  className="w-full rounded bg-[#1e1f22] px-3 py-2 text-xs text-white placeholder-[#80848e] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#b5bac1] uppercase">
                  Descrição (Opcional)
                </label>
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="Sobre o que é este canal?"
                  className="w-full rounded bg-[#1e1f22] px-3 py-2 text-xs text-white placeholder-[#80848e] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateChannelType(null)}
                  className="cursor-pointer rounded px-4 py-2 text-xs font-semibold text-zinc-300 hover:underline"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded bg-[#5865f2] px-4 py-2 text-xs font-bold text-white hover:bg-[#4752c4]"
                >
                  Criar Canal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Manage Multi-Roles (Cargos) */}
      {showRolesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-lg border border-[#1f2023] bg-[#313338] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1f2023] pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Cargos da Comunidade • Os Secos
                </h3>
                <p className="text-xs text-[#949ba4]">
                  Crie cargos coloridos e selecione vários cargos para cada membro.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRolesModal(false)}
                className="cursor-pointer rounded bg-[#2b2d31] px-2.5 py-1 text-xs text-zinc-300 hover:text-white"
              >
                Fechar
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto py-4">
              <form onSubmit={handleCreateRole} className="space-y-2">
                <label className="block text-xs font-bold text-[#b5bac1] uppercase">
                  Criar Novo Cargo
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newRoleColor}
                    onChange={(e) => setNewRoleColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-[#1e1f22] bg-[#1e1f22]"
                  />
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Nome do cargo (ex: Lenda Seca)"
                    className="flex-1 rounded bg-[#1e1f22] px-3 py-2 text-xs text-white placeholder-[#80848e] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="cursor-pointer rounded bg-[#23a55a] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1a7f44]"
                  >
                    Adicionar
                  </button>
                </div>
              </form>

              <div>
                <div className="mb-2 text-xs font-bold text-[#b5bac1] uppercase">
                  Membros e Múltiplos Cargos ({allMembers.length})
                </div>
                <div className="space-y-2">
                  {allMembers.map((m) => {
                    const currentRoleIds = memberRoles[m.id] || ['seco-raiz']
                    const primaryRole = getPrimaryRoleForUser(m.id)

                    return (
                      <div
                        key={m.id}
                        className="flex flex-col gap-2 rounded bg-[#2b2d31] p-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={m.avatar_url}
                            alt={m.username}
                            className="h-7 w-7 rounded-full object-cover"
                          />
                          <span
                            style={{ color: primaryRole?.color || '#ffffff' }}
                            className="text-xs font-bold"
                          >
                            {m.username}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {roles.map((r) => {
                            const active = currentRoleIds.includes(r.id)
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => handleToggleRole(m.id, r.id)}
                                style={{
                                  backgroundColor: active ? `${r.color}30` : '#1e1f22',
                                  borderColor: active ? r.color : '#111214',
                                  color: active ? '#ffffff' : '#949ba4',
                                }}
                                className="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold transition"
                              >
                                <span
                                  style={{ backgroundColor: r.color }}
                                  className="h-2 w-2 rounded-full"
                                />
                                <span>{r.name}</span>
                                {active && <span className="text-emerald-400">✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
