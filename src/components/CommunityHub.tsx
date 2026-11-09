'use client'

import { useState, useEffect, useRef } from 'react'
import { Room, UserProfile } from '@/types/community'
import { useScreenShare, ScreenShareOptions, RemoteAudioItem } from '@/hooks/useScreenShare'
import { VideoStage } from './VideoStage'
import { ChatPanel } from './ChatPanel'
import {
  SoundSettings,
  DEFAULT_SOUND_SETTINGS,
  loadSoundSettings,
  saveSoundSettings,
  playRoomEventSound,
} from '@/lib/soundEngine'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const ROOMS: Room[] = [
  {
    id: 'resenha',
    name: 'Resenha',
    description: 'Sala principal',
    type: 'screen_voice',
  },
  {
    id: 'gameplay',
    name: 'Gameplay',
    description: 'Jogos em 60/120 FPS',
    type: 'screen_voice',
  },
  {
    id: 'cinema',
    name: 'Cinema',
    description: 'Vídeos e lives',
    type: 'screen_voice',
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

function RemoteVoicePlayer({
  item,
  muted,
  volume,
}: {
  item: RemoteAudioItem
  muted: boolean
  volume: number
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    if (audioRef.current && item.stream) {
      audioRef.current.srcObject = item.stream
    }
  }, [item.stream])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(Math.max(volume, 0), 1)
    }
  }, [volume])

  return <audio ref={audioRef} autoPlay playsInline muted={muted} className="hidden" />
}

export function CommunityHub() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [activeRoom, setActiveRoom] = useState<Room>(ROOMS[0])
  const [resolution, setResolution] = useState<ScreenShareOptions['resolution']>('1080p')
  const [fps, setFps] = useState<ScreenShareOptions['fps']>(60)
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS)
  const [showAudioConfig, setShowAudioConfig] = useState(false)

  useEffect(() => {
    setSoundSettings(loadSoundSettings())

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
    error,
    startScreenShare,
    stopScreenShare,
    toggleMic,
    toggleDeafen,
  } = useScreenShare(activeRoom.id, user)

  const totalStreams = (localStream ? 1 : 0) + remoteStreams.length

  if (!loadingAuth && !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#111214] p-4">
        <div className="w-full max-w-sm rounded-lg border border-[#26282c] bg-[#16171a] p-6 text-center">
          <img
            src="/logo.png"
            alt="Os Secos"
            className="mx-auto mb-4 h-28 w-28 rounded-full border border-[#2e3035] object-cover"
          />
          <h1 className="text-xl font-bold text-white">Os Secos</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Entre com sua conta do Discord para acessar as salas de voz e compartilhamento de tela.
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

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#111214] text-zinc-100">
      {/* Hidden audio elements for voice chat */}
      {remoteAudios.map((item) => (
        <RemoteVoicePlayer
          key={item.peerId}
          item={item}
          muted={deafened}
          volume={soundSettings.volume}
        />
      ))}

      {/* Top Navigation Bar */}
      <header className="border-b border-[#26282c] bg-[#16171a] px-3 py-2.5 sm:px-5">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          {/* Logo & Rooms */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="Os Secos"
                className="h-8 w-8 rounded-full border border-[#2e3035] object-cover"
              />
              <span className="text-sm font-bold tracking-tight text-white">OS SECOS</span>
            </div>

            <div className="flex items-center gap-1 rounded bg-[#111214] p-1 border border-[#26282c]">
              {ROOMS.map((room) => {
                const active = room.id === activeRoom.id
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setActiveRoom(room)}
                    className={`cursor-pointer rounded px-3 py-1 text-xs font-medium transition ${
                      active
                        ? 'bg-[#2b2d31] text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {room.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Controls & User */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quality & FPS (30 / 60 / 120 FPS) */}
            <div className="flex items-center gap-1.5 rounded border border-[#26282c] bg-[#111214] px-2 py-1 text-xs">
              <select
                value={resolution}
                onChange={(e) =>
                  setResolution(e.target.value as ScreenShareOptions['resolution'])
                }
                disabled={isSharing}
                className="cursor-pointer bg-transparent font-medium text-zinc-200 focus:outline-none disabled:opacity-50"
              >
                <option value="720p" className="bg-[#16171a]">
                  720p
                </option>
                <option value="1080p" className="bg-[#16171a]">
                  1080p
                </option>
                <option value="1440p" className="bg-[#16171a]">
                  1440p
                </option>
              </select>
              <span className="text-zinc-600">/</span>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as ScreenShareOptions['fps'])}
                disabled={isSharing}
                className="cursor-pointer bg-transparent font-medium text-zinc-200 focus:outline-none disabled:opacity-50"
              >
                <option value={30} className="bg-[#16171a]">
                  30 FPS
                </option>
                <option value={60} className="bg-[#16171a]">
                  60 FPS
                </option>
                <option value={120} className="bg-[#16171a]">
                  120 FPS
                </option>
              </select>
            </div>

            {/* Screen Share Button */}
            {!isSharing ? (
              <button
                type="button"
                onClick={() => startScreenShare({ resolution, fps, includeAudio: true })}
                className="cursor-pointer rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Transmitir Tela
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScreenShare}
                className="cursor-pointer rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                Parar Tela
              </button>
            )}

            {/* Mic Toggle */}
            <button
              type="button"
              onClick={toggleMic}
              className={`cursor-pointer rounded px-3 py-1.5 text-xs font-medium ${
                micEnabled
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/40'
                  : 'bg-[#23252a] text-zinc-300 hover:bg-[#2f3238]'
              }`}
            >
              {micEnabled ? 'Mic: ON' : 'Mic: OFF'}
            </button>

            {/* Deafen Toggle */}
            <button
              type="button"
              onClick={toggleDeafen}
              className={`cursor-pointer rounded px-3 py-1.5 text-xs font-medium ${
                deafened
                  ? 'bg-red-600/20 text-red-300 border border-red-600/40'
                  : 'bg-[#23252a] text-zinc-300 hover:bg-[#2f3238]'
              }`}
            >
              {deafened ? 'Áudio: Mudo' : 'Áudio: ON'}
            </button>

            {/* Sound Settings Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAudioConfig((s) => !s)}
                className={`cursor-pointer rounded px-3 py-1.5 text-xs font-medium ${
                  showAudioConfig
                    ? 'bg-zinc-200 text-zinc-900'
                    : 'bg-[#23252a] text-zinc-300 hover:bg-[#2f3238]'
                }`}
              >
                Sons
              </button>

              {showAudioConfig && (
                <div className="absolute right-0 top-10 z-30 w-64 rounded-lg border border-[#32353b] bg-[#16171a] p-3.5 shadow-2xl">
                  <div className="mb-2.5 flex items-center justify-between border-b border-[#26282c] pb-2">
                    <span className="text-xs font-semibold text-white">
                      Configurações de Áudio
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAudioConfig(false)}
                      className="cursor-pointer text-[11px] text-zinc-400 hover:text-white"
                    >
                      Fechar
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="mb-1 flex justify-between text-zinc-300">
                        <span>Volume dos Avisos</span>
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
                        className="h-1.5 w-full cursor-pointer accent-zinc-200"
                      />
                    </div>

                    <label className="flex cursor-pointer items-center justify-between text-zinc-300">
                      <span>Ativar todos os sons</span>
                      <input
                        type="checkbox"
                        checked={soundSettings.enabled}
                        onChange={(e) => updateSoundConfig({ enabled: e.target.checked })}
                        className="accent-emerald-500"
                      />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between text-zinc-300">
                      <span>Som ao entrar / sair da sala</span>
                      <input
                        type="checkbox"
                        checked={soundSettings.joinLeaveSounds}
                        disabled={!soundSettings.enabled}
                        onChange={(e) =>
                          updateSoundConfig({ joinLeaveSounds: e.target.checked })
                        }
                        className="accent-emerald-500"
                      />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between text-zinc-300">
                      <span>Som de abrir / fechar tela</span>
                      <input
                        type="checkbox"
                        checked={soundSettings.streamSounds}
                        disabled={!soundSettings.enabled}
                        onChange={(e) =>
                          updateSoundConfig({ streamSounds: e.target.checked })
                        }
                        className="accent-emerald-500"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => playRoomEventSound('stream-start', soundSettings)}
                      className="w-full cursor-pointer rounded bg-[#23252a] py-1.5 text-center text-[11px] font-medium text-zinc-200 hover:bg-[#2f3238]"
                    >
                      Testar Som
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Badge & Logout */}
            {user && (
              <div className="flex items-center gap-2 border-l border-[#26282c] pl-2">
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className={`h-6 w-6 rounded-full object-cover ${
                    isSpeaking ? 'ring-2 ring-emerald-400' : ''
                  }`}
                />
                <span className="hidden text-xs font-medium text-zinc-200 sm:inline">
                  {user.username}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="cursor-pointer rounded bg-[#23252a] px-2 py-1 text-[11px] text-zinc-400 hover:bg-[#2f3238] hover:text-white"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Responsive Grid */}
      <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-3 p-3 sm:p-4 lg:grid-cols-12">
        {/* Left/Center Column: Members Bar + Screen Share Stage */}
        <div className="flex flex-col gap-3 lg:col-span-8 xl:col-span-9">
          {/* Simple Members Bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#26282c] bg-[#16171a] px-3 py-2">
            <span className="text-xs font-semibold text-zinc-400">
              Na sala ({roomPeers.length}):
            </span>

            {roomPeers.map((peer) => {
              const talking =
                peer.id === user?.id ? isSpeaking : Boolean(speakingPeers[peer.id])
              const streaming =
                peer.status === 'streaming' ||
                (peer.id === user?.id && isSharing) ||
                remoteStreams.some((s) => s.peerId === peer.id)

              return (
                <div
                  key={peer.id}
                  className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs ${
                    talking
                      ? 'bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/50'
                      : 'bg-[#111214] text-zinc-200'
                  }`}
                >
                  <img
                    src={peer.avatar_url}
                    alt={peer.username}
                    className="h-4 w-4 rounded-full object-cover"
                  />
                  <span className="font-medium">{peer.username}</span>
                  {streaming && (
                    <span className="rounded bg-red-600 px-1 py-0.2 text-[9px] font-bold text-white">
                      TELA
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Video Stage */}
          <div className="flex-1">
            {totalStreams === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-[#26282c] bg-[#16171a] p-6 text-center sm:min-h-[460px]">
                <img
                  src="/logo.png"
                  alt="Os Secos"
                  className="mb-3 h-20 w-20 rounded-full border border-[#2e3035] object-cover opacity-85"
                />
                <p className="text-sm font-semibold text-zinc-200">
                  Nenhuma tela sendo transmitida em {activeRoom.name}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Suporte a 720p, 1080p e 1440p em 30, 60 ou 120 FPS direto pelo navegador.
                </p>
                <button
                  type="button"
                  onClick={() => startScreenShare({ resolution, fps, includeAudio: true })}
                  className="mt-4 cursor-pointer rounded bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-white"
                >
                  Compartilhar Tela
                </button>
              </div>
            ) : (
              <div
                className={`grid gap-3 ${
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
        </div>

        {/* Right Column: Chat */}
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
