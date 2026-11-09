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
  isSpeaking?: boolean
  isMuted?: boolean
  isDeafened?: boolean
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

export interface SignalPayload {
  type:
    | 'offer'
    | 'answer'
    | 'ice-candidate'
    | 'request-stream'
    | 'stop-stream'
    | 'speaking-state'
  from: string
  fromUser: UserProfile
  to?: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  isSpeaking?: boolean
}
