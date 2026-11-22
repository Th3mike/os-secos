'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, RefreshCw, WifiOff } from 'lucide-react'
import { UserProfile } from '@/types/community'

interface VideoStageProps {
  stream: MediaStream
  user: UserProfile
  isLocal?: boolean
  isWebcam?: boolean
  deafened?: boolean
  isFocused?: boolean
  targetFps?: number
  targetResolution?: '720p' | '1080p' | '1440p'
  viewers?: UserProfile[]
  connectionState?: RTCPeerConnectionState
  relayedBy?: string | null
  onReconnect?: (safeMode?: boolean) => void
  onToggleFocus?: () => void
}

export function VideoStage({
  stream,
  user,
  isLocal = false,
  isWebcam = false,
  deafened = false,
  isFocused = false,
  targetFps,
  targetResolution,
  viewers = [],
  connectionState,
  relayedBy = null,
  onReconnect,
  onToggleFocus,
}: VideoStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [muted, setMuted] = useState(isLocal)
  const [volume, setVolume] = useState(1)
  const [showViewersPopover, setShowViewersPopover] = useState(false)
  const [pauseLocalPreview, setPauseLocalPreview] = useState(false)
  const [hasVideoFrames, setHasVideoFrames] = useState(isLocal)
  const [stalledWaiting, setStalledWaiting] = useState(false)
  const [liveStats, setLiveStats] = useState<{
    width: number
    height: number
    fps: number
  }>({ width: 0, height: 0, fps: 0 })

  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl || !stream) return

    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream
    }

    const ensurePlay = () => {
      videoEl.play().catch(() => {
        videoEl.muted = true
        setMuted(true)
        videoEl.play().catch(() => {})
      })
    }

    const updateMetadataStats = () => {
      // Never call videoTrack.getSettings() on a timer! On Windows Edge/Chromium,
      // querying WGC/DXGI track settings wakes up DWM/explorer.exe. Read videoWidth/videoHeight from the DOM element only.
      const w = videoEl.videoWidth || 0
      const h = videoEl.videoHeight || 0
      const receiving = isLocal || (w > 0 && h > 0)
      setHasVideoFrames(receiving)
      if (receiving) {
        setStalledWaiting(false)
      }

      if (!receiving && !isLocal) {
        setLiveStats({ width: 0, height: 0, fps: 0 })
        return
      }

      const configuredFps = targetFps || 60
      const rawHeight = h || 1080
      const stableHeight =
        targetResolution === '1440p'
          ? 1440
          : targetResolution === '1080p'
            ? 1080
            : targetResolution === '720p'
              ? 720
              : rawHeight >= 1300
                ? 1440
                : rawHeight >= 900
                  ? 1080
                  : rawHeight > 0
                    ? 720
                    : 1080

      setLiveStats({
        width: w || 1920,
        height: stableHeight,
        fps: configuredFps,
      })
    }

    ensurePlay()
    updateMetadataStats()

    const handleFrameReady = () => {
      ensurePlay()
      updateMetadataStats()
    }

    videoEl.addEventListener('loadedmetadata', handleFrameReady)
    videoEl.addEventListener('loadeddata', handleFrameReady)
    videoEl.addEventListener('canplay', handleFrameReady)
    videoEl.addEventListener('playing', updateMetadataStats)
    videoEl.addEventListener('resize', updateMetadataStats)

    const tracks = stream.getVideoTracks()
    tracks.forEach((t) => {
      t.addEventListener('unmute', handleFrameReady)
    })

    // Safety net: while waiting for first video frame on a remote stream, verify videoWidth periodically
    // (only touches DOM properties, never getSettings()) and surface reconnect controls after 4s
    let stallTimer: ReturnType<typeof setTimeout> | null = null
    let framePollTimer: ReturnType<typeof setInterval> | null = null
    if (!isLocal && (videoEl.videoWidth === 0 || videoEl.videoHeight === 0)) {
      framePollTimer = setInterval(() => {
        if (!videoRef.current) return
        if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
          updateMetadataStats()
          if (framePollTimer) {
            clearInterval(framePollTimer)
            framePollTimer = null
          }
        } else if (videoRef.current.paused) {
          ensurePlay()
        }
      }, 1000)

      stallTimer = setTimeout(() => {
        if (videoRef.current && (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0)) {
          setStalledWaiting(true)
        }
      }, 4500)
    }

    return () => {
      if (stallTimer) clearTimeout(stallTimer)
      if (framePollTimer) clearInterval(framePollTimer)
      videoEl.removeEventListener('loadedmetadata', handleFrameReady)
      videoEl.removeEventListener('loadeddata', handleFrameReady)
      videoEl.removeEventListener('canplay', handleFrameReady)
      videoEl.removeEventListener('playing', updateMetadataStats)
      videoEl.removeEventListener('resize', updateMetadataStats)
      tracks.forEach((t) => {
        t.removeEventListener('unmute', handleFrameReady)
      })
    }
  }, [stream, isLocal, targetFps, targetResolution, pauseLocalPreview])

  const handleFullscreen = () => {
    if (!containerRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      containerRef.current.requestFullscreen()
    }
  }

  const handlePiP = async () => {
    if (!videoRef.current) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await videoRef.current.requestPictureInPicture()
      }
    } catch {
      // Ignore if PiP unsupported
    }
  }

  const toggleMute = () => {
    if (isLocal) return
    if (videoRef.current) {
      videoRef.current.muted = !muted
      setMuted(!muted)
    }
  }

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (videoRef.current) {
      videoRef.current.volume = val
      videoRef.current.muted = val === 0
      setMuted(val === 0)
    }
  }

  return (
    <div
      ref={containerRef}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-lg border border-[#232428] bg-black"
    >
      {/* Top Overlay Header (Discord Stream Style with Live Resolution, FPS & Viewers List) */}
      <div className=" absolute top-2.5 right-2.5 left-2.5 z-20 flex items-center justify-between gap-2">
        <div className="pointer-events-none flex items-center gap-2 rounded-md bg-[#111214]/90 px-2.5 py-1 shadow-md">
          <img
            src={user.avatar_url}
            alt={user.username}
            className="h-4 w-4 rounded-full object-cover"
          />
          <span className="text-xs font-semibold text-white">
            {user.username} {isLocal ? '(Você)' : ''}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase ${
              isWebcam ? 'bg-amber-600' : 'bg-[#da373c]'
            }`}
          >
            {isWebcam ? '🙂 KABEKA' : 'AO VIVO'}
          </span>
          {liveStats.height > 0 && (
            <span className="rounded bg-[#2b2d31] px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-400">
              {liveStats.height}p {liveStats.fps > 0 ? `${liveStats.fps} FPS` : ''}
            </span>
          )}
          {relayedBy && (
            <span
              className="rounded bg-indigo-600/80 px-1.5 py-0.5 text-[10px] font-bold text-white"
              title={`Recebendo via ponte P2P de ${relayedBy}`}
            >
              Ponte: {relayedBy}
            </span>
          )}
        </div>

        {/* Who is watching this stream (Discord-style eye badge + avatars + popover) */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowViewersPopover((v) => !v)
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-[#111214]/90 px-2.5 py-1 text-xs font-bold text-zinc-200 shadow-md transition hover:bg-[#2b2d31] hover:text-white"
            title={
              viewers.length > 0
                ? `Assistindo agora: ${viewers.map((v) => v.username).join(', ')}`
                : 'Ninguém assistindo no momento'
            }
          >
            <Eye className="h-3.5 w-3.5 text-emerald-400" />
            <span>{viewers.length}</span>
            {viewers.length > 0 && (
              <div className="ml-0.5 flex -space-x-1.5">
                {viewers.slice(0, 4).map((v) => (
                  <img
                    key={v.id}
                    src={v.avatar_url}
                    alt={v.username}
                    className="h-4 w-4 rounded-full object-cover ring-1 ring-[#111214]"
                  />
                ))}
              </div>
            )}
          </button>

          {showViewersPopover && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-8 z-30 w-56 rounded-lg border border-[#1f2023] bg-[#111214]/95 p-2.5 shadow-2xl"
            >
              <div className="mb-1.5 flex items-center justify-between border-b border-[#2b2d31] pb-1">
                <span className="text-[10px] font-extrabold tracking-wider text-[#b5bac1] uppercase">
                  Assistindo à Tela ({viewers.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowViewersPopover(false)}
                  className="cursor-pointer text-[10px] text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              {viewers.length === 0 ? (
                <p className="py-1 text-[11px] text-zinc-400">
                  Nenhum membro está com esta transmissão aberta no palco agora.
                </p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {viewers.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-[#2b2d31]"
                    >
                      <img
                        src={v.avatar_url}
                        alt={v.username}
                        className="h-5 w-5 rounded-full object-cover"
                      />
                      <span className="truncate text-xs font-semibold text-white">
                        {v.username}
                      </span>
                      <span className="ml-auto text-[9px] font-bold text-emerald-400">
                        VENDO
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Video Element fills adjustable stage cleanly without extra DWM composite layers */}
      {isLocal && pauseLocalPreview ? (
        <div
          onClick={onToggleFocus}
          className="flex h-full w-full flex-1 cursor-pointer flex-col items-center justify-center bg-[#111214] p-6 text-center select-none"
        >
          <div className="mb-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-extrabold text-emerald-400 ring-1 ring-emerald-500/30">
            ⚡ MODO LEVE ATIVO (ECONOMIA DE ENERGIA / EXPLORER)
          </div>
          <p className="text-sm font-bold text-white">
            Sua tela está sendo transmitida em {liveStats.height}p @ {liveStats.fps} FPS
          </p>
          <p className="mt-1 max-w-md text-xs text-zinc-400">
            A pré-visualização local foi ocultada para zerar o uso do Windows Explorer / DWM enquanto você joga ou transmite.
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setPauseLocalPreview(false)
            }}
            className="mt-4 cursor-pointer rounded-md bg-[#2b2d31] px-3.5 py-1.5 text-xs font-bold text-zinc-200 hover:bg-[#35373c] hover:text-white"
          >
            Mostrar Prévia da Minha Tela
          </button>
        </div>
      ) : (
        <div className="relative flex h-full w-full flex-1 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal || muted || deafened}
            onClick={onToggleFocus}
            className="h-full w-full flex-1 cursor-pointer bg-black object-contain"
          />

          {/* Connecting / Stalled Overlay so remote viewers never stare at a silent black screen */}
          {!isLocal && !hasVideoFrames && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0d0e12]/90 p-5 text-center">
              {connectionState === 'failed' || stalledWaiting ? (
                <>
                  <WifiOff className="mb-2 h-8 w-8 text-amber-400" />
                  <p className="text-sm font-bold text-white">
                    {connectionState === 'failed'
                      ? `Conexão direta bloqueada com ${user.username}`
                      : `Aguardando vídeo de ${user.username}...`}
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-zinc-400">
                    {connectionState === 'connected'
                      ? 'Conectado, aguardando decodificação do vídeo. Tente o Modo Compatível (VP8).'
                      : 'Tentando estabelecer rota P2P direta (ou ponte via outro amigo da sala).'}
                  </p>
                  <span className="mt-1.5 rounded bg-[#1e1f22] px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                    WebRTC: {connectionState || 'connecting'}
                  </span>
                  {onReconnect && (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setStalledWaiting(false)
                          onReconnect(false)
                        }}
                        className="flex cursor-pointer items-center gap-1.5 rounded-md bg-[#5865f2] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#4752c4]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reconectar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setStalledWaiting(false)
                          onReconnect(true)
                        }}
                        className="flex cursor-pointer items-center gap-1.5 rounded-md bg-[#2b2d31] px-3 py-1.5 text-xs font-bold text-zinc-200 transition hover:bg-[#35373c] hover:text-white"
                        title="Reconecta usando codec VP8 universal (compatível com todos os navegadores e GPUs)"
                      >
                        Modo Compatível (VP8)
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mb-2.5 h-7 w-7 animate-spin rounded-full border-2 border-zinc-600 border-t-[#5865f2]" />
                  <p className="text-xs font-semibold text-zinc-200">
                    Conectando à tela de {user.username}...
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div className="absolute right-2.5 bottom-2.5 left-2.5 z-10 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#111214]/90 px-3 py-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <div className="flex items-center gap-2">
          {!isLocal ? (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className="cursor-pointer rounded bg-[#2b2d31] px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-[#35373c]"
              >
                {muted || deafened ? 'Som: Mudo' : 'Som: ON'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted || deafened ? 0 : volume}
                onChange={handleVolume}
                className="h-1.5 w-20 cursor-pointer accent-[#5865f2]"
              />
            </>
          ) : (
            <span className="text-[11px] text-zinc-300">
              Sua transmissão ({liveStats.height}p @ {liveStats.fps}fps)
              {viewers.length > 0
                ? ` • 👁️ Vendo agora: ${viewers.map((v) => v.username).join(', ')}`
                : ' • Aguardando espectadores'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isLocal && !isWebcam && (
            <button
              type="button"
              onClick={() => setPauseLocalPreview((p) => !p)}
              className={`cursor-pointer rounded px-2.5 py-1 text-[11px] font-bold transition ${
                pauseLocalPreview
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-[#2b2d31] text-emerald-400 hover:bg-[#35373c]'
              }`}
              title="Oculta a pré-visualização para você (os amigos continuam vendo normal) e reduz o uso de GPU/Explorer no seu PC"
            >
              {pauseLocalPreview ? 'Ver Prévia' : '⚡ Modo Leve (Ocultar Prévia)'}
            </button>
          )}
          {onToggleFocus && (
            <button
              type="button"
              onClick={onToggleFocus}
              className="cursor-pointer rounded bg-[#2b2d31] px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-[#35373c]"
            >
              {isFocused ? 'Ver em Grade' : 'Expandir no Palco'}
            </button>
          )}
          <button
            type="button"
            onClick={handlePiP}
            className="cursor-pointer rounded bg-[#2b2d31] px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-[#35373c]"
          >
            PiP
          </button>
          <button
            type="button"
            onClick={handleFullscreen}
            className="cursor-pointer rounded bg-[#2b2d31] px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-[#35373c]"
          >
            Tela Cheia
          </button>
        </div>
      </div>
    </div>
  )
}
