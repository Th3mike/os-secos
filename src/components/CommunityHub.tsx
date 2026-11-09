'use client'

import { useState, useEffect, useRef } from 'react'
import { Room, UserProfile } from '@/types/community'
import { useScreenShare, ScreenShareOptions, RemoteAudioItem } from '@/hooks/useScreenShare'
import { VideoStage } from './VideoStage'
import { ChatPanel } from './ChatPanel'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const ROOMS: Room[] = [
  {
    id: 'world-1-resenha',
    name: 'World 1 - Resenha',
    description: 'Lobby principal dos Secos',
    type: 'screen_voice',
  },
  {
    id: 'world-2-gameplay',
    name: 'World 2 - Telagem',
    description: 'Gameplay & Bossing',
    type: 'screen_voice',
  },
  {
    id: 'world-3-cinema',
    name: 'World 3 - Cinema',
    description: 'Vídeos & Watch Party',
    type: 'screen_voice',
  },
]

function extractDiscordProfile(authUser: User): UserProfile {
  const meta = authUser.user_metadata || {}
  const discordIdentity = authUser.identities?.find((i) => i.provider === 'discord')?.identity_data || {}

  // Exact Discord display name / username priority
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
    error,
    startScreenShare,
    stopScreenShare,
    toggleMic,
    toggleDeafen,
  } = useScreenShare(activeRoom.id, user)

  const totalStreams = (localStream ? 1 : 0) + remoteStreams.length

  // OSRS Login Screen (when not logged in with Discord)
  if (!loadingAuth && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="osrs-panel w-full max-w-md p-6 text-center">
          <div className="mb-4 border-b-2 border-[#5c5040] pb-3">
            <h1 className="text-3xl font-extrabold tracking-widest text-[#ffff00] osrs-text-shadow">
              OS SECOS
            </h1>
            <p className="mt-1 text-xs text-[#ff981f] osrs-text-shadow">
              OldSchool Community Hub • Tela & Voz Direto no Browser
            </p>
          </div>

          <div className="osrs-inset mb-5 p-4 text-xs leading-relaxed text-[#c6b497]">
            <p className="text-[#ffff00] font-bold mb-1">Bem-vindo ao Hub de Os Secos!</p>
            <p>
              Entre com sua conta do Discord para usar seu nick oficial da comunidade, assistir ou
              transmitir sua tela sem travar o PC.
            </p>
          </div>

          <button
            onClick={handleDiscordLogin}
            className="osrs-btn w-full py-3 text-sm uppercase tracking-wider"
          >
            [ Entrar com Discord ]
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full p-2 sm:p-4">
      {/* Hidden audio players for continuous voice chat */}
      {remoteAudios.map((item) => (
        <RemoteVoicePlayer key={item.peerId} item={item} muted={deafened} />
      ))}

      {/* Centered Responsive OldSchool Layout */}
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        {/* Top Banner Header */}
        <header className="osrs-panel flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-xl font-extrabold tracking-wider text-[#ffff00] osrs-text-shadow">
              ⚔️ OS SECOS
            </span>
            <span className="hidden text-xs text-[#00ff00] osrs-text-shadow sm:inline">
              • {activeRoom.name} ({roomPeers.length} online)
            </span>
          </div>

          {user && (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 osrs-inset px-2.5 py-1">
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="h-5 w-5 border border-[#ff981f]"
                />
                <span className="text-xs font-bold text-[#ffff00] osrs-text-shadow">
                  {user.username}
                </span>
              </div>
              <button onClick={handleLogout} className="osrs-btn px-2.5 py-1 text-xs">
                Logout
              </button>
            </div>
          )}
        </header>

        {/* Main 2-Column Responsive Area */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {/* Left Panel: World Select, Controls & Online Friends List */}
          <aside className="flex flex-col gap-3 lg:col-span-1">
            {/* World Selector */}
            <div className="osrs-panel p-2.5">
              <div className="mb-2 border-b border-[#5c5040] pb-1 text-xs font-bold text-[#ffff00] osrs-text-shadow">
                Select World (Salas)
              </div>
              <div className="flex flex-col gap-1.5">
                {ROOMS.map((room) => {
                  const isActive = room.id === activeRoom.id
                  return (
                    <button
                      key={room.id}
                      onClick={() => setActiveRoom(room)}
                      className={`osrs-btn px-2.5 py-1.5 text-left text-xs ${
                        isActive ? 'osrs-btn-active' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{room.name}</span>
                        {isActive && <span className="text-[#00ff00]">*</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Action Buttons (Screen Share & Mic) */}
            <div className="osrs-panel p-2.5">
              <div className="mb-2 border-b border-[#5c5040] pb-1 text-xs font-bold text-[#ffff00] osrs-text-shadow">
                Controles de Tela & Voz
              </div>

              <div className="flex flex-col gap-2">
                {!isSharing ? (
                  <button
                    onClick={() =>
                      startScreenShare({ resolution, fps, includeAudio: true })
                    }
                    className="osrs-btn py-2 text-xs text-[#00ff00]"
                  >
                    [ Compartilhar Tela ]
                  </button>
                ) : (
                  <button
                    onClick={stopScreenShare}
                    className="osrs-btn osrs-btn-active py-2 text-xs text-[#ff3333]"
                  >
                    [ Parar Transmissão ]
                  </button>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={toggleMic}
                    className={`osrs-btn py-1.5 text-xs ${
                      micEnabled ? 'text-[#00ff00]' : 'text-[#ff3333]'
                    }`}
                  >
                    Mic: {micEnabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={toggleDeafen}
                    className={`osrs-btn py-1.5 text-xs ${
                      !deafened ? 'text-[#00ff00]' : 'text-[#ff3333]'
                    }`}
                  >
                    Áudio: {deafened ? 'MUTE' : 'ON'}
                  </button>
                </div>

                {/* Simple Quality Dropdown */}
                <div className="osrs-inset flex items-center justify-between px-2 py-1 text-[11px]">
                  <span>Qualidade:</span>
                  <select
                    value={resolution}
                    onChange={(e) =>
                      setResolution(e.target.value as ScreenShareOptions['resolution'])
                    }
                    disabled={isSharing}
                    className="bg-transparent font-bold text-[#ffff00] focus:outline-none"
                  >
                    <option value="720p" className="bg-[#1c1712]">
                      720p
                    </option>
                    <option value="1080p" className="bg-[#1c1712]">
                      1080p
                    </option>
                    <option value="1440p" className="bg-[#1c1712]">
                      1440p
                    </option>
                  </select>
                  <select
                    value={fps}
                    onChange={(e) =>
                      setFps(Number(e.target.value) as ScreenShareOptions['fps'])
                    }
                    disabled={isSharing}
                    className="bg-transparent font-bold text-[#ffff00] focus:outline-none"
                  >
                    <option value={30} className="bg-[#1c1712]">
                      30 FPS
                    </option>
                    <option value={60} className="bg-[#1c1712]">
                      60 FPS
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Friends / Members Online List (OSRS Friends Tab style) */}
            <div className="osrs-panel flex-1 p-2.5">
              <div className="mb-2 flex items-center justify-between border-b border-[#5c5040] pb-1 text-xs font-bold text-[#ffff00] osrs-text-shadow">
                <span>Friends List (Na Sala)</span>
                <span className="text-[#00ff00]">{roomPeers.length}</span>
              </div>

              <div className="osrs-inset max-h-56 overflow-y-auto p-2 space-y-1.5">
                {roomPeers.map((peer) => {
                  const peerTalking =
                    peer.id === user?.id ? isSpeaking : Boolean(speakingPeers[peer.id])
                  const peerStreaming =
                    peer.status === 'streaming' ||
                    (peer.id === user?.id && isSharing) ||
                    remoteStreams.some((s) => s.peerId === peer.id)

                  return (
                    <div
                      key={peer.id}
                      className="flex items-center justify-between text-xs py-0.5"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <img
                          src={peer.avatar_url}
                          alt={peer.username}
                          className={`h-4 w-4 shrink-0 border ${
                            peerTalking ? 'border-[#00ff00]' : 'border-[#5c5040]'
                          }`}
                        />
                        <span
                          className={`truncate font-bold osrs-text-shadow ${
                            peerTalking ? 'text-[#00ff00]' : 'text-[#ffff00]'
                          }`}
                        >
                          {peer.username}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-[#00ff00] osrs-text-shadow">
                        {peerStreaming ? '[TELA]' : 'Online'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </aside>

          {/* Right Main Area: Screen Share Stage + Bottom Parchment Chat */}
          <main className="flex flex-col gap-3 lg:col-span-3">
            {error && (
              <div className="osrs-panel border-[#ff3333] p-2 text-xs text-[#ff3333] osrs-text-shadow">
                Erro: {error}
              </div>
            )}

            {/* Video Stage Box */}
            <div className="osrs-panel p-2.5">
              <div className="mb-2 flex items-center justify-between border-b border-[#5c5040] pb-1 text-xs font-bold text-[#ffff00] osrs-text-shadow">
                <span>Telas Transmitindo ({totalStreams})</span>
                <span className="text-[11px] text-[#c6b497]">WebRTC Direto • Zero WebView</span>
              </div>

              {totalStreams === 0 ? (
                <div className="osrs-inset flex min-h-[280px] flex-col items-center justify-center p-6 text-center sm:min-h-[360px]">
                  <p className="text-sm font-bold text-[#ffff00] osrs-text-shadow">
                    Nenhuma tela sendo transmitida em {activeRoom.name}
                  </p>
                  <p className="mt-1 max-w-md text-xs text-[#c6b497]">
                    Clique no botão abaixo para abrir a tela do seu jogo ou navegador em até 1080p
                    60 FPS.
                  </p>
                  <button
                    onClick={() =>
                      startScreenShare({ resolution, fps, includeAudio: true })
                    }
                    className="osrs-btn mt-4 px-5 py-2 text-xs text-[#00ff00]"
                  >
                    [ Iniciar Transmissão de Tela ]
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

            {/* Classic OSRS Chat Box at the bottom */}
            {user && (
              <ChatPanel
                roomId={activeRoom.id}
                roomName={activeRoom.name}
                currentUser={user}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
