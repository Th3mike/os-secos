'use client'

import { CommunityEmote } from '@/lib/emotes'

interface EmoteSpriteProps {
  emote: CommunityEmote
  size?: number
  className?: string
}

export function EmoteSprite({ emote, size = 36, className = '' }: EmoteSpriteProps) {
  const posX = `${(emote.col / 4) * 100}%`
  const posY = `${(emote.row / 2) * 100}%`

  return (
    <span
      title={`${emote.label} (${emote.code})`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundImage: 'url(/emotes.png)',
        backgroundSize: '500% 300%',
        backgroundPosition: `${posX} ${posY}`,
        backgroundRepeat: 'no-repeat',
      }}
      className={`inline-block shrink-0 align-middle select-none rounded-md ${className}`}
    />
  )
}
