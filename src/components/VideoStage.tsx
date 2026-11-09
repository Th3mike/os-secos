'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Maximize2, Volume2, VolumeX, PictureInPicture2, Radio } from 'lucide-react'
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
    } catch (e) {
      console.error('PiP error:', e)
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
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl ring-1 ring-white/5"
    >
      {/* Top Floating Badge */}
      <div className="pointer-events-none absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/80 px-3 py-1.5 backdrop-blur-md">
          <img
            src={user.avatar_url}
            alt={user.username}
            className="h-5 w-5 rounded-full object-cover ring-1 ring-amber-400/50"
          />
          <span className="text-xs font-semibold text-white">
            {user.username} {isLocal && '(Você)'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-lg shadow-red-500/30">
          <Radio className="h-3 w-3 animate-pulse" />
          AO VIVO
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

      {/* Bottom Floating Controls on Hover */}
      <div className="absolute right-3 bottom-3 left-3 z-10 flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950/80 px-3.5 py-2 opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
        <div className="flex items-center gap-2.5">
          {!isLocal ? (
            <>
              <button
                onClick={toggleMute}
                className="rounded-lg p-1.5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                {muted || deafened ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted || deafened ? 0 : volume}
                onChange={handleVolume}
                className="h-1 w-20 cursor-pointer accent-amber-500"
              />
            </>
          ) : (
            <span className="text-xs text-zinc-400">Sua transmissão (áudio local mutado)</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePiP}
            className="rounded-lg p-1.5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
            title="Janela Flutuante (PiP)"
          >
            <PictureInPicture2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleFullscreen}
            className="rounded-lg p-1.5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
            title="Tela Cheia"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
