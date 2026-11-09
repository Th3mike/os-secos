export interface UserProfile {
  id: string
  username: string
  avatar_url: string
  discord_tag?: string
  status?: 'online' | 'streaming' | 'idle'
  isSpeaking?: boolean
  isMuted?: boolean
  isDeafened?: boolean
}

export interface Room {
  id: string
  name: string
  description: string
  type: 'screen_voice' | 'text'
  icon?: string
  isCustom?: boolean
  createdBy?: string
}

export interface ChatMessage {
  id: string
  room_id: string
  user_id: string
  username: string
  avatar_url: string
  content: string
  created_at: string
}

export interface SoundEffect {
  id: string
  label: string
  emoji: string
  color: string
}

export interface SoundTriggerPayload {
  soundId: string
  fromUser: string
  timestamp: number
}

export interface SignalPayload {
  type:
    | 'offer'
    | 'answer'
    | 'ice-candidate'
    | 'request-stream'
    | 'stop-stream'
    | 'speaking-state'
    | 'soundboard'
    | 'room-created'
  from: string
  fromUser: UserProfile
  to?: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  isSpeaking?: boolean
  soundId?: string
  room?: Room
}
