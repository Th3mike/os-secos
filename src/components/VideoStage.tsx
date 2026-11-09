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

  const toggleMute = () => {
    if (isLocal) return
    if (videoRef.current) {
      videoRef.current.muted = !muted
      setMuted(!muted)
    }
  }

  return (
    <div ref={containerRef} className="osrs-panel flex flex-col p-1.5">
      {/* Header Bar OSRS Style */}
      <div className="mb-1 flex items-center justify-between bg-[#1c1712] px-2 py-1 border border-[#473d30]">
        <div className="flex items-center gap-2">
          <img
            src={user.avatar_url}
            alt={user.username}
            className="h-5 w-5 border border-[#ff981f]"
          />
          <span className="text-xs font-bold text-[#ffff00] osrs-text-shadow">
            {user.username} {isLocal ? '(Sua Tela)' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isLocal && (
            <button
              onClick={toggleMute}
              className="osrs-btn px-2 py-0.5 text-[11px]"
              title={muted ? 'Ativar Som' : 'Mutar Som'}
            >
              {muted || deafened ? 'Som: OFF' : 'Som: ON'}
            </button>
          )}
          <button
            onClick={handleFullscreen}
            className="osrs-btn px-2 py-0.5 text-[11px]"
          >
            [Tela Cheia]
          </button>
        </div>
      </div>

      {/* Video Screen */}
      <div className="osrs-inset relative w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || muted || deafened}
          className="aspect-video w-full bg-black object-contain"
        />
      </div>
    </div>
  )
}
