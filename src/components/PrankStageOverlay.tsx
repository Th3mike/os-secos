'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PrankEvent, PrankType } from '@/types/community'

export const PRANK_OPTIONS: {
  type: PrankType
  label: string
  emoji: string
  description: string
}[] = [
  {
    type: 'bury',
    label: 'Enterrar na Cova',
    emoji: '🪦',
    description: 'Joga o usuário no buraco com lápide 3D e terra por cima',
  },
  {
    type: 'coffin',
    label: 'Fechar no Caixão',
    emoji: '⚰️',
    description: 'Tranca o membro no caixão de madeira 3D dos Secos',
  },
  {
    type: 'reaper',
    label: 'Ceifador da Secura',
    emoji: '💀',
    description: 'O Ceifador busca a alma do membro na call',
  },
  {
    type: 'water',
    label: 'Hidratar o Seco',
    emoji: '🪣',
    description: 'Joga um balde de água para acabar com a secura',
  },
]

interface PrankStageOverlayProps {
  activePrank: PrankEvent | null
  onComplete: () => void
}

export function PrankStageOverlay({ activePrank, onComplete }: PrankStageOverlayProps) {
  useEffect(() => {
    if (!activePrank) return
    const timer = setTimeout(() => {
      onComplete()
    }, 5200)
    return () => clearTimeout(timer)
  }, [activePrank, onComplete])

  return (
    <AnimatePresence>
      {activePrank && (
        <motion.div
          key={activePrank.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onComplete}
          style={{ perspective: '1200px' }}
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-black/80 p-4 backdrop-blur-xs select-none"
        >
          {/* Top Banner */}
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-6 rounded-full border border-white/15 bg-[#1e1f22] px-5 py-2 text-center shadow-2xl"
          >
            <span className="text-xs font-bold text-amber-400">
              {activePrank.fromUser.username}
            </span>{' '}
            <span className="text-xs text-zinc-300">
              {activePrank.type === 'bury' && 'enterrou na cova:'}
              {activePrank.type === 'coffin' && 'fechou no caixão:'}
              {activePrank.type === 'reaper' && 'invocou o Ceifador para:'}
              {activePrank.type === 'water' && 'jogou um balde de água em:'}
            </span>{' '}
            <span className="text-xs font-extrabold text-white">
              {activePrank.targetUser.username}
            </span>
          </motion.div>

          {/* 1. BURY IN GRAVE 3D SCENE */}
          {activePrank.type === 'bury' && (
            <div
              style={{ transformStyle: 'preserve-3d' }}
              className="relative flex h-96 w-96 flex-col items-center justify-end"
            >
              {/* 3D Stone Tombstone dropping from sky */}
              <motion.div
                initial={{ y: -320, rotateX: 35, scale: 0.7, opacity: 0 }}
                animate={{ y: 0, rotateX: 8, scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 150, damping: 14, delay: 0.3 }}
                className="relative z-10 flex h-64 w-52 flex-col items-center justify-center rounded-t-[90px] border-4 border-zinc-600 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.95)]"
              >
                <div className="text-2xl">💀</div>
                <div className="mt-1 text-lg font-black tracking-widest text-zinc-300">
                  R.I.P.
                </div>

                {/* Victim Avatar Sinking */}
                <motion.div
                  initial={{ y: -20, rotate: 0 }}
                  animate={{ y: 12, rotate: -8 }}
                  transition={{ duration: 1.8, delay: 0.6 }}
                  className="my-2 relative"
                >
                  <img
                    src={activePrank.targetUser.avatar_url}
                    alt={activePrank.targetUser.username}
                    className="h-20 w-20 rounded-full border-4 border-zinc-500 object-cover grayscale"
                  />
                </motion.div>

                <div className="max-w-full truncate text-xs font-extrabold text-amber-400">
                  {activePrank.targetUser.username}
                </div>
                <div className="text-[10px] font-semibold text-zinc-400">
                  FOI ENTERRADO SECO
                </div>
              </motion.div>

              {/* Animated Shovel Throwing Dirt */}
              <motion.div
                initial={{ x: 140, y: -80, rotate: 45, opacity: 0 }}
                animate={{
                  x: [140, 40, 120, 40],
                  y: [-80, -10, -70, -10],
                  rotate: [45, -25, 45, -25],
                  opacity: 1,
                }}
                transition={{ duration: 1.8, delay: 0.5 }}
                className="pointer-events-none absolute right-2 top-16 z-30 text-6xl"
              >
                🪏
              </motion.div>

              {/* Rising 3D Dirt Mound Covering the Grave */}
              <motion.div
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ duration: 1.4, delay: 0.9, ease: 'easeOut' }}
                style={{ transformOrigin: 'bottom' }}
                className="relative z-20 -mt-14 flex h-28 w-80 flex-col items-center justify-center rounded-t-[100%] border-t-4 border-[#5c3d24] bg-gradient-to-b from-[#4a301b] to-[#26170b] shadow-2xl"
              >
                <div className="rounded border-2 border-[#3b2311] bg-[#7c5332] px-3 py-0.5 text-xs font-black tracking-wider text-zinc-950 shadow">
                  TERRA ↓
                </div>
              </motion.div>
            </div>
          )}

          {/* 2. 3D COFFIN SLAM SCENE */}
          {activePrank.type === 'coffin' && (
            <div className="relative flex h-80 w-72 flex-col items-center justify-center">
              <motion.div
                initial={{ rotateY: -65, scale: 0.8 }}
                animate={{ rotateY: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 120 }}
                className="relative flex h-72 w-52 flex-col items-center justify-center rounded-3xl border-4 border-[#6b4226] bg-gradient-to-b from-[#422715] to-[#24140a] p-5 shadow-2xl"
              >
                <img
                  src={activePrank.targetUser.avatar_url}
                  alt={activePrank.targetUser.username}
                  className="h-24 w-24 rounded-full border-4 border-amber-500/60 object-cover"
                />
                <div className="mt-3 text-sm font-black text-white">
                  {activePrank.targetUser.username}
                </div>
                <div className="mt-1 text-[11px] font-bold text-amber-400">
                  TRANCADO NO CAIXÃO
                </div>

                {/* Slamming Coffin Lid */}
                <motion.div
                  initial={{ x: -240, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 180, damping: 16, delay: 1.2 }}
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-4 border-[#855433] bg-[#331d0f]/95 p-4 text-center"
                >
                  <span className="text-5xl">⚰️</span>
                  <span className="mt-2 text-sm font-black tracking-widest text-amber-300 uppercase">
                    Descanse em Paz
                  </span>
                  <span className="mt-1 text-xs font-bold text-zinc-300">
                    {activePrank.targetUser.username}
                  </span>
                </motion.div>
              </motion.div>
            </div>
          )}

          {/* 3. GRIM REAPER SLASH SCENE */}
          {activePrank.type === 'reaper' && (
            <div className="relative flex h-80 w-80 flex-col items-center justify-center">
              <motion.div
                initial={{ scale: 0.6, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                className="relative flex flex-col items-center"
              >
                <motion.div
                  initial={{ x: -120, rotate: -45 }}
                  animate={{ x: 20, rotate: 25 }}
                  transition={{ duration: 0.6, delay: 0.4, type: 'spring' }}
                  className="text-7xl"
                >
                  💀镰
                </motion.div>
                <motion.img
                  src={activePrank.targetUser.avatar_url}
                  alt={activePrank.targetUser.username}
                  animate={{
                    y: [0, -35, -70],
                    opacity: [1, 0.85, 0.35],
                    scale: [1, 1.1, 0.85],
                  }}
                  transition={{ duration: 2.4, delay: 0.6 }}
                  className="mt-2 h-24 w-24 rounded-full border-4 border-purple-500 object-cover shadow-[0_0_40px_rgba(168,85,247,0.7)]"
                />
                <span className="mt-3 text-base font-black text-purple-300">
                  A alma de {activePrank.targetUser.username} foi ceifada!
                </span>
              </motion.div>
            </div>
          )}

          {/* 4. HYDRATE / WATER BUCKET SCENE */}
          {activePrank.type === 'water' && (
            <div className="relative flex h-80 w-80 flex-col items-center justify-center">
              <motion.div
                initial={{ y: -90, rotate: -40 }}
                animate={{ y: -30, rotate: -135 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-6xl"
              >
                🪣
              </motion.div>

              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.4, delay: 0.45 }}
                className="relative flex flex-col items-center"
              >
                <img
                  src={activePrank.targetUser.avatar_url}
                  alt={activePrank.targetUser.username}
                  className="h-24 w-24 rounded-full border-4 border-sky-400 object-cover shadow-[0_0_40px_rgba(56,189,248,0.8)]"
                />
                <div className="mt-3 text-base font-black text-sky-300">
                  💦 {activePrank.targetUser.username} foi hidratado!
                </div>
                <div className="text-xs text-zinc-300">Acabou a secura por hoje</div>
              </motion.div>
            </div>
          )}

          <p className="mt-6 text-[11px] text-zinc-400">
            Clique em qualquer lugar para fechar
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

