'use client'

import { useEffect, useRef, useState } from 'react'
import { UserProfile } from '@/types/community'

interface VideoStageProps {
  stream: MediaStream
  user: UserProfile
  isLocal?: boolean
  deafened?: boolean
}

export function VideoStage({ stream, user, isLocal = false, deafened = false }: VideoStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [muted, setMuted] = useState(isLocal)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
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
      // Ignore PiP error if not supported
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
      className="flex flex-col overflow-hidden rounded-lg border border-[#26282c] bg-[#0b0c0e]"
    >
      {/* Clean Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e2024] bg-[#16171a] px-3 py-2">
        <div className="flex items-center gap-2">
          <img
            src={user.avatar_url}
            alt={user.username}
            className="h-5 w-5 rounded-full object-cover"
          />
          <span className="text-xs font-semibold text-zinc-100">
            {user.username} {isLocal ? '(Você)' : ''}
          </span>
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            AO VIVO
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isLocal && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="cursor-pointer rounded bg-[#23252a] px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-[#2f3238]"
              >
                {muted || deafened ? 'Som: Mudo' : 'Som: Ativo'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted || deafened ? 0 : volume}
                onChange={handleVolume}
                className="h-1.5 w-20 cursor-pointer accent-zinc-200"
                title="Volume da transmissão"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handlePiP}
            className="cursor-pointer rounded bg-[#23252a] px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-[#2f3238] hover:text-white"
          >
            Janela
          </button>
          <button
            type="button"
            onClick={handleFullscreen}
            className="cursor-pointer rounded bg-[#23252a] px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-[#2f3238] hover:text-white"
          >
            Tela Cheia
          </button>
        </div>
      </div>

      {/* Video Player */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || muted || deafened}
        className="aspect-video w-full bg-black object-contain"
      />
    </div>
  )
}
