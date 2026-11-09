'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye } from 'lucide-react'
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
  onToggleFocus,
}: VideoStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [muted, setMuted] = useState(isLocal)
  const [volume, setVolume] = useState(1)
  const [showViewersPopover, setShowViewersPopover] = useState(false)
  const [liveStats, setLiveStats] = useState<{
    width: number
    height: number
    fps: number
  }>({ width: 1920, height: 1080, fps: 60 })

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
      const settings = stream.getVideoTracks()[0]?.getSettings()
      const configuredFps = targetFps || Math.round(settings?.frameRate || 60)
      const rawHeight = videoEl.videoHeight || settings?.height || 1080
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
        width: videoEl.videoWidth || settings?.width || 1920,
        height: stableHeight,
        fps: configuredFps,
      })
    }

    ensurePlay()
    updateMetadataStats()

    const handleLoadedMetadata = () => {
      ensurePlay()
      updateMetadataStats()
    }

    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata)

    const tracks = stream.getVideoTracks()
    tracks.forEach((t) => {
      t.onunmute = ensurePlay
    })

    // Lightweight 4-second metadata poll (NO requestVideoFrameCallback loop!)
    // Running requestVideoFrameCallback at 60-120Hz on Windows Edge/Chromium locks DWM/DXGI surface handles
    // and causes Windows explorer.exe CPU to spike and freeze!
    const statsTimer = setInterval(updateMetadataStats, 4000)

    return () => {
      clearInterval(statsTimer)
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata)
      tracks.forEach((t) => {
        t.onunmute = null
      })
    }
  }, [stream, targetFps, targetResolution])

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
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || muted || deafened}
        onClick={onToggleFocus}
        className="h-full w-full flex-1 cursor-pointer bg-black object-contain"
      />

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
