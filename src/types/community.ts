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
  image_url?: string | null
  created_at: string
}

export type PrankType = 'bury' | 'coffin' | 'reaper' | 'water' | 'bed'

export interface PrankEvent {
  id: string
  type: PrankType
  fromUser: UserProfile
  targetUser: UserProfile
  timestamp: number
}

export type CinemaModelType =
  | 'anime-vrm'
  | 'anime-glasses-vrm'
  | 'streetwear-rpm'
  | 'dancer-girl'
  | 'soldier-tactical'
  | 'cyborg-xbot'
  | 'robot-bot'
  | 'custom-url'

export type CinemaPresetId =
  | 'custom'
  | 'goku'
  | 'naruto'
  | 'luffy'
  | 'gojo'
  | 'tanjiro'
  | 'akatsuki'
  | 'cyberpunk'
  | 'knight'
  | 'king-seco'

export type CinemaHairStyle =
  | 'none'
  | 'spiky-gold'
  | 'spiky-black'
  | 'ninja-blonde'
  | 'anime-white'
  | 'burgundy'
  | 'afro'
  | 'long-red'

export type CinemaHatStyle =
  | 'none'
  | 'straw-hat'
  | 'headband'
  | 'crown'
  | 'wizard'
  | 'cat-ears'
  | 'halo'
  | 'horns'

export type CinemaAccessoryStyle =
  | 'none'
  | 'katana'
  | 'blindfold'
  | 'glasses'
  | 'cape'
  | 'popcorn'
  | 'wings'

export type CinemaAuraStyle =
  | 'none'
  | 'super-saiyan'
  | 'purple-curse'
  | 'blue-chakra'
  | 'fire-red'

export type CinemaEmoteType = 'none' | 'wave' | 'dance' | 'cheer' | 'popcorn'

export interface CinemaAvatarConfig {
  presetId: CinemaPresetId
  modelType?: CinemaModelType
  customModelUrl?: string
  shirtColor: string
  pantsColor: string
  hairStyle: CinemaHairStyle
  hatStyle: CinemaHatStyle
  accessory: CinemaAccessoryStyle
  aura: CinemaAuraStyle
}

export interface CinemaPlayerState {
  userId: string
  user: UserProfile
  x: number
  y: number
  z: number
  rotY: number
  seatIndex: number | null
  emote: CinemaEmoteType
  avatar: CinemaAvatarConfig
  updatedAt: number
}

export interface WatchTogetherState {
  active: boolean
  provider: 'youtube' | 'spotify' | 'twitch' | 'kick' | 'mp4' | 'custom'
  url: string
  embedUrl: string
  title?: string
  hostId: string
  hostName: string
  isPlaying: boolean
  currentTime: number
  updatedAt: number
  lightsDimmed?: boolean
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
    | 'watching-state'
    | 'prank'
    | 'watch-sync'
    | 'cinema-state'
  from: string
  fromUser: UserProfile
  to?: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  isSpeaking?: boolean
  isMuted?: boolean
  isDeafened?: boolean
  watchingIds?: string[]
  prank?: PrankEvent
  watchState?: WatchTogetherState | null
  cinemaPlayer?: CinemaPlayerState
  screenStreamId?: string | null
  webcamStreamId?: string | null
}
