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
    name: 'Resenha Geral',
    description: 'Canal de voz e tela principal',
    type: 'screen_voice',
  },
  {
    id: 'gameplay',
    name: 'Gameplay 120fps',
    description: 'Telagem de jogos sem travar',
    type: 'screen_voice',
  },
  {
    id: 'cinema',
    name: 'Watch Party',
    description: 'Filmes, vídeos e clipes',
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
  const [chatOpen, setChatOpen] = useState(false)
  const [focusedStreamId, setFocusedStreamId] = useState<string | null>(null)
  const [stageHeightPct, setStageHeightPct] = useState<number>(75)

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

  // Discord-style Login Screen
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
            Entre com sua conta do Discord para conectar nos canais de voz e tela.
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#313338] text-[#f2f3f5]">
      {/* Hidden Audio Players */}
      {remoteAudios.map((item) => (
        <RemoteVoicePlayer
          key={item.peerId}
          item={item}
          muted={deafened}
          volume={soundSettings.volume}
        />
      ))}

      {/* LEFT SIDEBAR: Discord Channels + Members Indented Under Active Channel + Bottom User Panel */}
      <aside className="flex w-60 shrink-0 flex-col bg-[#2b2d31] select-none">
        {/* Server Header */}
        <div className="flex h-12 items-center gap-2.5 border-b border-[#1f2023] px-4 shadow-xs">
          <img
            src="/logo.png"
            alt="Os Secos"
            className="h-7 w-7 rounded-full object-cover"
          />
          <span className="truncate text-sm font-bold text-white">Os Secos</span>
        </div>

        {/* Voice Channels & Connected Users Tree (Exact Discord Layout) */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          <div>
            <div className="mb-1 px-2 text-[11px] font-bold tracking-wider text-[#949ba4] uppercase">
              Canais de Voz e Tela
            </div>

            <div className="space-y-1">
              {ROOMS.map((room) => {
                const isActive = room.id === activeRoom.id
                return (
                  <div key={room.id}>
                    <button
                      type="button"
                      onClick={() => setActiveRoom(room)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition ${
                        isActive
                          ? 'bg-[#404249] text-white'
                          : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
                      }`}
                    >
                      <span className="truncate">🔊 {room.name}</span>
                      {isActive && (
                        <span className="rounded bg-[#232428] px-1.5 py-0.5 text-[10px] text-[#b5bac1]">
                          {roomPeers.length}
                        </span>
                      )}
                    </button>

                    {/* Connected Users Indented Below Active Channel (Just like Discord) */}
                    {isActive && roomPeers.length > 0 && (
                      <div className="mt-1 ml-4 space-y-0.5 border-l border-[#3f4147] pl-2">
                        {roomPeers.map((peer) => {
                          const talking =
                            peer.id === user?.id
                              ? isSpeaking
                              : Boolean(speakingPeers[peer.id])
                          const streaming =
                            peer.status === 'streaming' ||
                            (peer.id === user?.id && isSharing) ||
                            remoteStreams.some((s) => s.peerId === peer.id)

                          return (
                            <div
                              key={peer.id}
                              onClick={() => {
                                if (streaming) {
                                  setFocusedStreamId(
                                    peer.id === user?.id ? 'local' : peer.id
                                  )
                                }
                              }}
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
                                  className={`truncate text-xs ${
                                    talking
                                      ? 'font-semibold text-white'
                                      : 'text-[#dbdee1]'
                                  }`}
                                >
                                  {peer.username}
                                </span>
                              </div>

                              {streaming && (
                                <span className="shrink-0 rounded bg-[#da373c] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase">
                                  AO VIVO
                                </span>
                              )}
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
        <div className="border-t border-[#1f2023] bg-[#232428] px-3 py-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-[#23a55a]">Voz Conectada</div>
              <div className="text-[10px] text-[#949ba4]">{activeRoom.name} / WebRTC</div>
            </div>

            {!isSharing ? (
              <button
                type="button"
                onClick={() =>
                  startScreenShare({ resolution, fps, includeAudio: true })
                }
                className="cursor-pointer rounded bg-[#2b2d31] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#35373c]"
              >
                Tela
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScreenShare}
                className="cursor-pointer rounded bg-[#da373c] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#a1282c]"
              >
                Parar
              </button>
            )}
          </div>
        </div>

        {/* Discord Bottom User Profile Bar */}
        {user && (
          <div className="flex items-center justify-between bg-[#1e1f22] px-2.5 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={user.avatar_url}
                alt={user.username}
                className={`h-8 w-8 shrink-0 rounded-full object-cover ${
                  isSpeaking ? 'ring-2 ring-[#23a55a]' : ''
                }`}
              />
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-white">
                  {user.username}
                </div>
                <div className="truncate text-[10px] text-[#949ba4]">Online</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMic}
                className={`cursor-pointer rounded px-2 py-1 text-[10px] font-semibold ${
                  micEnabled
                    ? 'bg-[#2b2d31] text-[#23a55a] hover:bg-[#35373c]'
                    : 'bg-[#da373c]/20 text-[#da373c]'
                }`}
                title="Ativar/Desativar Microfone"
              >
                {micEnabled ? 'Mic' : 'Mudo'}
              </button>

              <button
                type="button"
                onClick={toggleDeafen}
                className={`cursor-pointer rounded px-2 py-1 text-[10px] font-semibold ${
                  !deafened
                    ? 'bg-[#2b2d31] text-zinc-200 hover:bg-[#35373c]'
                    : 'bg-[#da373c]/20 text-[#da373c]'
                }`}
                title="Silenciar Áudio"
              >
                {deafened ? 'Surdo' : 'Fone'}
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* CENTER STAGE: Discord Voice/Stream Stage */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#1e1f22]">
        {/* Top Stage Bar */}
        <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-[#111214] bg-[#2b2d31] px-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white">{activeRoom.name}</span>
            <span className="hidden text-xs text-[#949ba4] md:inline">
              {activeRoom.description}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Stage Size Slider when watching a stream */}
            {allStreams.length > 0 && (
              <div className="hidden items-center gap-2 rounded bg-[#1e1f22] px-2.5 py-1 text-[11px] text-[#b5bac1] sm:flex">
                <span>Tamanho da Tela:</span>
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
                    <span className="text-xs font-bold text-white">Sons da Sala</span>
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
                      <span>Ativar sons</span>
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

            {/* Toggle Chat Drawer Button */}
            <button
              type="button"
              onClick={() => setChatOpen((o) => !o)}
              className={`cursor-pointer rounded px-2.5 py-1 text-xs font-semibold ${
                chatOpen
                  ? 'bg-[#5865f2] text-white'
                  : 'bg-[#1e1f22] text-zinc-200 hover:bg-[#35373c]'
              }`}
            >
              {chatOpen ? 'Fechar Chat' : 'Abrir Chat'}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="cursor-pointer rounded bg-[#1e1f22] px-2.5 py-1 text-xs text-zinc-400 hover:bg-[#35373c] hover:text-white"
            >
              Sair
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-[#da373c] px-4 py-1.5 text-center text-xs font-semibold text-white">
            {error}
          </div>
        )}

        {/* Main Discord Call Stage Area */}
        <div className="flex flex-1 flex-col overflow-y-auto p-3 gap-3">
          {allStreams.length === 0 ? (
            /* Discord Voice Participant Cards Grid when no one is sharing screen */
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <div className="grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {roomPeers.map((peer) => {
                  const talking =
                    peer.id === user?.id ? isSpeaking : Boolean(speakingPeers[peer.id])
                  return (
                    <div
                      key={peer.id}
                      className={`relative flex aspect-video flex-col items-center justify-center rounded-xl bg-[#2b2d31] p-4 transition ${
                        talking
                          ? 'ring-2 ring-[#23a55a]'
                          : 'border border-[#232428]'
                      }`}
                    >
                      <img
                        src={peer.avatar_url}
                        alt={peer.username}
                        className={`h-16 w-16 rounded-full object-cover ${
                          talking ? 'ring-4 ring-[#23a55a]' : ''
                        }`}
                      />
                      <span className="mt-2.5 text-xs font-semibold text-white">
                        {peer.username}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : activeFocusedStream ? (
            /* Focused Adjustable Stage + Participant Strip Below */
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

              {/* Bottom Participant & Other Streams Strip */}
              <div className="flex flex-1 items-center gap-2.5 overflow-x-auto pb-1">
                {roomPeers.map((peer) => {
                  const talking =
                    peer.id === user?.id ? isSpeaking : Boolean(speakingPeers[peer.id])
                  return (
                    <div
                      key={peer.id}
                      className={`flex h-24 w-40 shrink-0 flex-col items-center justify-center rounded-lg bg-[#2b2d31] p-2 ${
                        talking ? 'ring-2 ring-[#23a55a]' : ''
                      }`}
                    >
                      <img
                        src={peer.avatar_url}
                        alt={peer.username}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <span className="mt-1.5 max-w-full truncate text-[11px] font-medium text-zinc-200">
                        {peer.username}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Multi-stream Grid (click any stream to focus) */
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
        <div className="flex h-16 shrink-0 items-center justify-center gap-2.5 border-t border-[#111214] bg-[#232428] px-4">
          <button
            type="button"
            onClick={toggleMic}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition ${
              micEnabled
                ? 'bg-[#2b2d31] text-white hover:bg-[#35373c]'
                : 'bg-[#da373c] text-white hover:bg-[#a1282c]'
            }`}
          >
            {micEnabled ? 'Microfone: Ligado' : 'Microfone: Mutado'}
          </button>

          <button
            type="button"
            onClick={toggleDeafen}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition ${
              !deafened
                ? 'bg-[#2b2d31] text-white hover:bg-[#35373c]'
                : 'bg-[#da373c] text-white hover:bg-[#a1282c]'
            }`}
          >
            {deafened ? 'Áudio: Desativado' : 'Áudio: Ligado'}
          </button>

          {!isSharing ? (
            <button
              type="button"
              onClick={() => startScreenShare({ resolution, fps, includeAudio: true })}
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
            onClick={() => setChatOpen((o) => !o)}
            className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition ${
              chatOpen
                ? 'bg-[#5865f2] text-white'
                : 'bg-[#2b2d31] text-zinc-200 hover:bg-[#35373c]'
            }`}
          >
            Chat
          </button>
        </div>
      </div>

      {/* RIGHT COLLAPSIBLE DRAWER: Chat only appears when toggled */}
      {chatOpen && user && (
        <ChatPanel
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          currentUser={user}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  )
}
