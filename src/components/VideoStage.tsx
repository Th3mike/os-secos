'use client'

import { useEffect, useRef, useState } from 'react'
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
  onToggleFocus,
}: VideoStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [muted, setMuted] = useState(isLocal)
  const [volume, setVolume] = useState(1)
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

    ensurePlay()

    const handleLoadedMetadata = () => {
      ensurePlay()
    }

    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata)

    const tracks = stream.getVideoTracks()
    tracks.forEach((t) => {
      t.onunmute = ensurePlay
    })

    // Measure real rendered FPS & resolution using requestVideoFrameCallback (or fallback)
    let frameCount = 0
    let lastTime = performance.now()
    let rvfcId: number | null = null
    const anyVideo = videoEl as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: (now: number) => void) => number
      cancelVideoFrameCallback?: (id: number) => void
    }

    const onFrame = (now: number) => {
      frameCount++
      const delta = now - lastTime
      if (delta >= 1000) {
        const currentFps = Math.round((frameCount * 1000) / delta)
        const settings = stream.getVideoTracks()[0]?.getSettings()
        const configuredFps = targetFps || Math.round(settings?.frameRate || 60)
        // Windows Desktop Duplication drops capture events when pixels on screen aren't moving.
        // Snap displayed FPS to the nearest standard tier (30 / 60 / 120) or configured target so the badge doesn't flicker constantly!
        const stableFps =
          targetFps ||
          (currentFps >= 95
            ? 120
            : currentFps >= 45
              ? 60
              : currentFps >= 22
                ? 30
                : configuredFps)
        const rawHeight = videoEl.videoWidth
          ? videoEl.videoHeight
          : settings?.height || 1080
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
          fps: stableFps,
        })
        frameCount = 0
        lastTime = now
      }
      if (anyVideo.requestVideoFrameCallback) {
        rvfcId = anyVideo.requestVideoFrameCallback(onFrame)
      }
    }

    if (anyVideo.requestVideoFrameCallback) {
      rvfcId = anyVideo.requestVideoFrameCallback(onFrame)
    }

    const fallbackInterval = setInterval(() => {
      if (!anyVideo.requestVideoFrameCallback) {
        const settings = stream.getVideoTracks()[0]?.getSettings()
        setLiveStats({
          width: videoEl.videoWidth || settings?.width || 0,
          height: videoEl.videoHeight || settings?.height || 0,
          fps: Math.round(settings?.frameRate || 60),
        })
      }
    }, 1500)

    return () => {
      clearInterval(fallbackInterval)
      if (rvfcId !== null && anyVideo.cancelVideoFrameCallback) {
        anyVideo.cancelVideoFrameCallback(rvfcId)
      }
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
      {/* Top Overlay Header (Discord Stream Style with Live Resolution & FPS Badge) */}
      <div className="pointer-events-none absolute top-2.5 right-2.5 left-2.5 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-md bg-[#111214]/85 px-2.5 py-1 backdrop-blur-sm">
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
      </div>

      {/* Video Element fills adjustable stage with GPU layer promotion for crisp text */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || muted || deafened}
        onClick={onToggleFocus}
        style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
        className="h-full w-full flex-1 cursor-pointer bg-black object-contain"
      />

      {/* Bottom Controls Bar */}
      <div className="absolute right-2.5 bottom-2.5 left-2.5 z-10 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#111214]/90 px-3 py-1.5 opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100">
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
            <span className="text-[11px] text-zinc-400">
              Sua transmissão {liveStats.height > 0 ? `(${liveStats.width}x${liveStats.height} @ ${liveStats.fps}fps)` : ''}
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
