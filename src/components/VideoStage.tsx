'use client'

import { useEffect, useRef, useState } from 'react'
import { UserProfile } from '@/types/community'

interface VideoStageProps {
  stream: MediaStream
  user: UserProfile
  isLocal?: boolean
  deafened?: boolean
  isFocused?: boolean
  onToggleFocus?: () => void
}

export function VideoStage({
  stream,
  user,
  isLocal = false,
  deafened = false,
  isFocused = false,
  onToggleFocus,
}: VideoStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [muted, setMuted] = useState(isLocal)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl || !stream) return

    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream
    }

    const ensurePlay = () => {
      videoEl.play().catch(() => {
        // Fallback: if browser blocks autoplay with audio, start muted so video never stays black
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

    return () => {
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata)
      tracks.forEach((t) => {
        t.onunmute = null
      })
    }
  }, [stream])

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
      {/* Top Overlay Header (Discord Stream Style) */}
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
          <span className="rounded bg-[#da373c] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
            AO VIVO
          </span>
        </div>
      </div>

      {/* Video Element fills adjustable stage */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || muted || deafened}
        onClick={onToggleFocus}
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
            <span className="text-[11px] text-zinc-400">Sua transmissão</span>
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
