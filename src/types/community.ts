export interface Role {
  id: string
  name: string
  color: string
  position: number
}

export interface UserProfile {
  id: string
  username: string
  avatar_url: string
  discord_tag?: string
  status?: 'online' | 'streaming' | 'idle'
  role_id?: string | null
  role_ids?: string[]
  voice_room_id?: string | null
  isSpeaking?: boolean
  isMuted?: boolean
  isDeafened?: boolean
  joined_at?: string
  last_seen_at?: string
  updated_at?: string
}

export interface Room {
  id: string
  name: string
  description: string
  type: 'text' | 'voice'
  position?: number
  created_by?: string
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

export type PrankType = 'bury' | 'coffin' | 'reaper' | 'water'

export interface PrankEvent {
  id: string
  type: PrankType
  fromUser: UserProfile
  targetUser: UserProfile
  timestamp: number
}

export interface WatchTogetherState {
  active: boolean
  provider: 'youtube' | 'spotify' | 'twitch' | 'kick' | 'custom'
  url: string
  embedUrl: string
  title?: string
  hostId: string
  hostName: string
  isPlaying: boolean
  currentTime: number
  updatedAt: number
}

export interface SignalPayload {
  type:
    | 'offer'
    | 'answer'
    | 'ice-candidate'
    | 'request-stream'
    | 'stop-stream'
    | 'stop-webcam'
    | 'speaking-state'
    | 'mute-state'
    | 'prank'
    | 'watch-sync'
  from: string
  fromUser: UserProfile
  to?: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  isSpeaking?: boolean
  isMuted?: boolean
  isDeafened?: boolean
  prank?: PrankEvent
  watchState?: WatchTogetherState | null
  screenStreamId?: string | null
  webcamStreamId?: string | null
}
