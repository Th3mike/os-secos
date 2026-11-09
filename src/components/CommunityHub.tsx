'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  Monitor,
  MonitorOff,
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  LogOut,
  Users,
  Radio,
  Sparkles,
  Flame,
  Gamepad2,
  Film,
} from 'lucide-react'
import { Room, UserProfile } from '@/types/community'
import { useScreenShare, ScreenShareOptions, RemoteAudioItem } from '@/hooks/useScreenShare'
import { VideoStage } from './VideoStage'
import { ChatPanel } from './ChatPanel'
import { COMMUNITY_SOUNDS } from '@/lib/soundEngine'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const ROOMS: Room[] = [
  {
    id: 'resenha',
    name: 'Resenha',
    description: 'Sala principal dos Secos',
    type: 'screen_voice',
    icon: 'flame',
  },
  {
    id: 'gameplay',
    name: 'Gameplay',
    description: 'Telagem 1080p 60fps',
    type: 'screen_voice',
    icon: 'gamepad',
  },
  {
    id: 'cinema',
    name: 'Cinema',
    description: 'Watch Party & Vídeos',
    type: 'screen_voice',
    icon: 'film',
  },
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

function RemoteVoicePlayer({ item, muted }: { item: RemoteAudioItem; muted: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    if (audioRef.current && item.stream) {
      audioRef.current.srcObject = item.stream
    }
  }, [item.stream])
  return <audio ref={audioRef} autoPlay playsInline muted={muted} className="hidden" />
}

export function CommunityHub() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [activeRoom, setActiveRoom] = useState<Room>(ROOMS[0])
  const [resolution, setResolution] = useState<ScreenShareOptions['resolution']>('1080p')
  const [fps, setFps] = useState<ScreenShareOptions['fps']>(60)
  const [showSoundboard, setShowSoundboard] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(extractDiscordProfile(data.user))
      }
      setLoadingAuth(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(extractDiscordProfile(session.user))
      } else {
        setUser(null)
      }
      setLoadingAuth(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

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
    lastSound,
    error,
    startScreenShare,
    stopScreenShare,
    toggleMic,
    toggleDeafen,
    triggerSoundboard,
  } = useScreenShare(activeRoom.id, user)

  // Fire confetti when someone triggers "clutch" sound
  useEffect(() => {
    if (lastSound?.soundId === 'clutch') {
      confetti({
        particleCount: 55,
        spread: 60,
        origin: { y: 0.75 },
      })
    }
  }, [lastSound])

  const totalStreams = (localStream ? 1 : 0) + remoteStreams.length

  const renderRoomIcon = (icon?: string) => {
    switch (icon) {
      case 'flame':
        return <Flame className="h-3.5 w-3.5 text-amber-400" />
      case 'gamepad':
        return <Gamepad2 className="h-3.5 w-3.5 text-emerald-400" />
      default:
        return <Film className="h-3.5 w-3.5 text-purple-400" />
    }
  }

  // Modern Animated Login Screen
  if (!loadingAuth && !user) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-zinc-950 p-4">
        {/* Ambient Animated Glows */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-500/20 blur-[130px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-indigo-500/15 blur-[130px]" />

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900/70 p-8 text-center shadow-2xl backdrop-blur-2xl"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-2xl font-black text-zinc-950 shadow-xl shadow-amber-500/25">
            OS
          </div>

          <h1 className="bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            Os Secos
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Hub exclusivo da comunidade. Compartilhamento de tela em 60 FPS e voz direto no navegador.
          </p>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDiscordLogin}
            className="mt-7 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-[#5865F2] py-3.5 text-sm font-bold text-white shadow-xl shadow-[#5865F2]/30 transition hover:bg-[#4752C4]"
          >
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
            Entrar com Discord
          </motion.button>

          <p className="mt-4 text-[11px] text-zinc-500">
            Seu nick e avatar são sincronizados automaticamente com o Discord.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-zinc-950 text-zinc-100">
      {/* Ambient Background Glows */}
      <div className="pointer-events-none fixed -top-32 left-1/3 h-96 w-96 rounded-full bg-amber-500/10 blur-[140px]" />
      <div className="pointer-events-none fixed right-10 bottom-10 h-80 w-80 rounded-full bg-orange-600/10 blur-[140px]" />

      {/* Hidden Audio Players for Continuous Voice Call */}
      {remoteAudios.map((item) => (
        <RemoteVoicePlayer key={item.peerId} item={item} muted={deafened} />
      ))}

      {/* Top Glass Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/75 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 font-black text-zinc-950 shadow-lg shadow-amber-500/20">
              OS
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-white sm:text-base">
                OS SECOS
              </h1>
              <p className="text-[11px] text-zinc-400">
                {roomPeers.length} {roomPeers.length === 1 ? 'membro na sala' : 'membros na sala'}
              </p>
            </div>
          </div>

          {/* Animated Room Pills */}
          <nav className="flex items-center gap-1 rounded-2xl border border-white/10 bg-zinc-900/80 p-1">
            {ROOMS.map((room) => {
              const isActive = room.id === activeRoom.id
              return (
                <button
                  key={room.id}
                  onClick={() => setActiveRoom(room)}
                  className={`relative flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                    isActive ? 'text-zinc-950' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeRoomPill"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {renderRoomIcon(room.icon)}
                    {room.name}
                  </span>
                </button>
              )
            })}
          </nav>

          {/* Discord User Badge */}
          {user && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/90 py-1 pr-3 pl-1.5">
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className={`h-6 w-6 rounded-full object-cover transition ${
                    isSpeaking ? 'ring-2 ring-emerald-400' : 'ring-1 ring-white/20'
                  }`}
                />
                <span className="text-xs font-semibold text-white">{user.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="cursor-pointer rounded-full border border-white/10 bg-zinc-900/80 p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                title="Sair da conta"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 sm:p-6 lg:grid lg:grid-cols-12">
        {/* Left/Center Column: Active Members Strip + Video Stage */}
        <div className="flex flex-col gap-4 lg:col-span-8 xl:col-span-9">
          {/* Online Members Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900/50 px-4 py-2.5 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                <Users className="h-3.5 w-3.5 text-amber-400" />
                Na sala:
              </span>

              {roomPeers.map((peer) => {
                const talking =
                  peer.id === user?.id ? isSpeaking : Boolean(speakingPeers[peer.id])
                const streaming =
                  peer.status === 'streaming' ||
                  (peer.id === user?.id && isSharing) ||
                  remoteStreams.some((s) => s.peerId === peer.id)

                return (
                  <motion.div
                    key={peer.id}
                    layout
                    className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition ${
                      talking
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300 shadow-sm shadow-emerald-500/20'
                        : 'border-white/10 bg-zinc-950/70 text-zinc-200'
                    }`}
                  >
                    <img
                      src={peer.avatar_url}
                      alt={peer.username}
                      className={`h-4 w-4 rounded-full object-cover ${
                        talking ? 'ring-2 ring-emerald-400' : ''
                      }`}
                    />
                    <span className="font-medium">{peer.username}</span>
                    {streaming && (
                      <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                        <Radio className="h-2.5 w-2.5 animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </motion.div>
                )
              })}
            </div>

            {/* Stream Quality Selector */}
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <select
                value={resolution}
                onChange={(e) =>
                  setResolution(e.target.value as ScreenShareOptions['resolution'])
                }
                disabled={isSharing}
                className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-xs font-semibold text-amber-400 focus:outline-none disabled:opacity-50"
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="1440p">1440p</option>
              </select>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as ScreenShareOptions['fps'])}
                disabled={isSharing}
                className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-xs font-semibold text-amber-400 focus:outline-none disabled:opacity-50"
              >
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Screen Share Stage */}
          <div className="flex-1">
            {totalStreams === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex min-h-[340px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/60 to-zinc-950/80 p-8 text-center backdrop-blur-xl sm:min-h-[420px]"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/30 shadow-inner">
                  <Monitor className="h-8 w-8 text-amber-400" />
                </div>
                <h2 className="text-lg font-bold text-white">
                  Nenhuma tela transmitindo em {activeRoom.name}
                </h2>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-400">
                  Transmita sua gameplay, vídeo ou área de trabalho em até{' '}
                  <span className="font-semibold text-amber-400">1080p/1440p 60 FPS</span> direto no
                  navegador sem pesar o PC.
                </p>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() =>
                    startScreenShare({ resolution, fps, includeAudio: true })
                  }
                  className="mt-6 flex cursor-pointer items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 text-xs font-extrabold text-zinc-950 shadow-xl shadow-amber-500/25"
                >
                  <Monitor className="h-4 w-4" />
                  Compartilhar Minha Tela
                </motion.button>
              </motion.div>
            ) : (
              <div
                className={`grid gap-4 ${
                  totalStreams === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
                }`}
              >
                {localStream && user && (
                  <VideoStage
                    stream={localStream}
                    user={user}
                    isLocal
                    deafened={deafened}
                  />
                )}
                {remoteStreams.map((item) => (
                  <VideoStage
                    key={item.peerId}
                    stream={item.stream}
                    user={item.user}
                    deafened={deafened}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Floating Control Dock */}
          <div className="relative flex flex-col items-center">
            <AnimatePresence>
              {showSoundboard && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.95 }}
                  className="mb-3 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/95 p-2.5 shadow-2xl backdrop-blur-xl"
                >
                  {COMMUNITY_SOUNDS.map((snd) => (
                    <button
                      key={snd.id}
                      onClick={() => triggerSoundboard(snd.id)}
                      className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-amber-500/40 hover:bg-white/10"
                    >
                      <span>{snd.emoji}</span>
                      <span>{snd.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-2.5 shadow-2xl backdrop-blur-xl">
              <button
                onClick={toggleMic}
                className={`flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  micEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-rose-400" />}
                {micEnabled ? 'Mic Ativo' : 'Ativar Mic'}
              </button>

              <button
                onClick={toggleDeafen}
                className={`flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  deafened
                    ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                {deafened ? <VolumeX className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
                {deafened ? 'Mutado' : 'Áudio'}
              </button>

              {!isSharing ? (
                <button
                  onClick={() =>
                    startScreenShare({ resolution, fps, includeAudio: true })
                  }
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2 text-xs font-extrabold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110"
                >
                  <Monitor className="h-4 w-4" />
                  Transmitir Tela
                </button>
              ) : (
                <button
                  onClick={stopScreenShare}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-rose-500 px-5 py-2 text-xs font-extrabold text-white shadow-lg shadow-rose-500/25 transition hover:bg-rose-600"
                >
                  <MonitorOff className="h-4 w-4" />
                  Parar Tela
                </button>
              )}

              <button
                onClick={() => setShowSoundboard((s) => !s)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  showSoundboard
                    ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <Sparkles className="h-4 w-4 text-amber-400" />
                Sons
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Chat */}
        <div className="lg:col-span-4 xl:col-span-3">
          {user && (
            <ChatPanel
              roomId={activeRoom.id}
              roomName={activeRoom.name}
              currentUser={user}
            />
          )}
        </div>
      </main>
    </div>
  )
}
