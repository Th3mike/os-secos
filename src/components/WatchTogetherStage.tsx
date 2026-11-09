'use client'

import { useEffect, useRef, useState } from 'react'
import { WatchTogetherState, UserProfile } from '@/types/community'

interface WatchTogetherStageProps {
  watchState: WatchTogetherState | null
  currentUser: UserProfile | null
  onUpdateWatchState: (next: WatchTogetherState | null) => void
  onStartTabShare: () => void
}

function parseMediaUrl(rawUrl: string): {
  provider: WatchTogetherState['provider']
  embedUrl: string
} | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)

    // YouTube
    if (
      url.hostname.includes('youtube.com') ||
      url.hostname.includes('youtu.be')
    ) {
      let videoId = ''
      if (url.hostname.includes('youtu.be')) {
        videoId = url.pathname.slice(1)
      } else if (url.pathname.startsWith('/shorts/')) {
        videoId = url.pathname.split('/')[2]
      } else {
        videoId = url.searchParams.get('v') || ''
      }
      if (videoId) {
        return {
          provider: 'youtube',
          embedUrl: `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&rel=0`,
        }
      }
    }

    // Spotify (Track, Album, Playlist, Episode)
    if (url.hostname.includes('spotify.com')) {
      const cleanPath = url.pathname.replace(/^\/intl-[a-z]+\//i, '/')
      return {
        provider: 'spotify',
        embedUrl: `https://open.spotify.com/embed${cleanPath}?utm_source=generator&theme=0`,
      }
    }

    // Twitch
    if (url.hostname.includes('twitch.tv')) {
      const channel = url.pathname.split('/').filter(Boolean)[0]
      if (channel && typeof window !== 'undefined') {
        return {
          provider: 'twitch',
          embedUrl: `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`,
        }
      }
    }

    // Kick
    if (url.hostname.includes('kick.com')) {
      const channel = url.pathname.split('/').filter(Boolean)[0]
      if (channel) {
        return {
          provider: 'kick',
          embedUrl: `https://player.kick.com/${channel}`,
        }
      }
    }

    // Direct MP4 / WebM or Embed URL
    return {
      provider: 'custom',
      embedUrl: trimmed,
    }
  } catch {
    return null
  }
}

export function WatchTogetherStage({
  watchState,
  currentUser,
  onUpdateWatchState,
  onStartTabShare,
}: WatchTogetherStageProps) {
  const [inputUrl, setInputUrl] = useState('')
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const handleLoadUrl = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !inputUrl.trim()) return

    const parsed = parseMediaUrl(inputUrl)
    if (!parsed) return

    const nextState: WatchTogetherState = {
      active: true,
      provider: parsed.provider,
      url: inputUrl.trim(),
      embedUrl: parsed.embedUrl,
      hostId: currentUser.id,
      hostName: currentUser.username,
      isPlaying: true,
      currentTime: 0,
      updatedAt: Date.now(),
    }

    setInputUrl('')
    onUpdateWatchState(nextState)
  }

  // Sync YouTube play/pause commands via postMessage
  useEffect(() => {
    if (!watchState || watchState.provider !== 'youtube' || !iframeRef.current) return
    const cmd = watchState.isPlaying ? 'playVideo' : 'pauseVideo'
    iframeRef.current.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: cmd, args: [] }),
      '*'
    )
  }, [watchState?.isPlaying, watchState?.updatedAt, watchState?.provider])

  const handleTogglePlayPause = () => {
    if (!watchState) return
    onUpdateWatchState({
      ...watchState,
      isPlaying: !watchState.isPlaying,
      updatedAt: Date.now(),
    })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#232428] bg-[#16171a]">
      {/* Top Watch Together Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#232428] bg-[#232428] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-white">
            🎬 Watch Together & Música
          </span>
          {watchState && (
            <span className="rounded bg-[#5865f2]/20 px-2 py-0.5 text-[10px] font-bold text-[#949cf7]">
              Sincronizado por {watchState.hostName}
            </span>
          )}
        </div>

        <form onSubmit={handleLoadUrl} className="flex flex-1 max-w-xl items-center gap-1.5">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Cole link do YouTube, Spotify (música/playlist), Twitch ou vídeo..."
            className="flex-1 rounded bg-[#111214] px-3 py-1.5 text-xs text-white placeholder-[#80848e] focus:outline-none"
          />
          <button
            type="submit"
            className="cursor-pointer rounded bg-[#5865f2] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#4752c4]"
          >
            Colocar para Todos
          </button>
        </form>

        <div className="flex items-center gap-1.5">
          {watchState && watchState.provider === 'youtube' && (
            <button
              type="button"
              onClick={handleTogglePlayPause}
              className="cursor-pointer rounded bg-[#2b2d31] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#35373c]"
            >
              {watchState.isPlaying ? 'Pausar Todos' : 'Play Todos'}
            </button>
          )}
          {watchState && (
            <button
              type="button"
              onClick={() => onUpdateWatchState(null)}
              className="cursor-pointer rounded bg-[#da373c] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#a1282c]"
            >
              Fechar Player
            </button>
          )}
        </div>
      </div>

      {/* Player Body or Streaming Service Selector */}
      {watchState ? (
        <div className="relative flex flex-1 items-center justify-center bg-black">
          {watchState.provider === 'spotify' ? (
            <div className="flex h-full w-full max-w-2xl flex-col items-center justify-center p-6">
              <iframe
                src={watchState.embedUrl}
                className="h-80 w-full rounded-xl border-0 shadow-2xl"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              />
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={watchState.embedUrl}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <h3 className="text-base font-bold text-white">
            Assista Vídeos, Filmes ou Ouça Músicas Juntos na Call
          </h3>
          <p className="mt-1 max-w-lg text-xs text-[#949ba4]">
            Cole um link do <strong>YouTube</strong>, <strong>Spotify</strong>,{' '}
            <strong>Twitch</strong> ou <strong>Kick</strong> na barra acima para sincronizar o
            player na tela de todo mundo na sala.
          </p>

          {/* Streaming Platforms Cinema Mode */}
          <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#2b2d31] bg-[#232428] p-4 text-left">
              <div className="text-xs font-extrabold text-white">
                🍿 Netflix / Prime Video / Disney+ / Apple TV
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#949ba4]">
                Plataformas de filmes bloqueiam iframe externo, mas você pode transmitir a{' '}
                <strong>Aba do Navegador com Áudio em 1080p/60fps</strong> sem tela preta!
              </p>
              <button
                type="button"
                onClick={onStartTabShare}
                className="mt-3 w-full cursor-pointer rounded bg-[#23a55a] py-2 text-xs font-bold text-white hover:bg-[#1a7f44]"
              >
                Transmitir Aba de Filme com Áudio
              </button>
            </div>

            <div className="rounded-xl border border-[#2b2d31] bg-[#232428] p-4 text-left">
              <div className="text-xs font-extrabold text-white">
                🎵 Spotify / YouTube Sincronizado
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#949ba4]">
                Basta copiar o link de qualquer vídeo do YouTube ou música/playlist do Spotify e
                colar no campo acima para tocar direto para todos na sala.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded bg-[#111214] px-2 py-1 text-[10px] font-semibold text-red-400">
                  YouTube Sync
                </span>
                <span className="rounded bg-[#111214] px-2 py-1 text-[10px] font-semibold text-emerald-400">
                  Spotify Embed
                </span>
                <span className="rounded bg-[#111214] px-2 py-1 text-[10px] font-semibold text-purple-400">
                  Twitch / Kick
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

