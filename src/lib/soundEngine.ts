export type RoomSoundEvent =
  | 'user-join'
  | 'user-leave'
  | 'stream-start'
  | 'stream-stop'
  | 'mic-on'
  | 'mic-off'
  | 'chat-message'

export interface SoundSettings {
  enabled: boolean
  volume: number // 0 to 1
  joinLeaveSounds: boolean
  streamSounds: boolean
  chatSounds: boolean
}

const STORAGE_KEY = 'os-secos-sound-settings'

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 0.5,
  joinLeaveSounds: true,
  streamSounds: true,
  chatSounds: true,
}

export function loadSoundSettings(): SoundSettings {
  if (typeof window === 'undefined') return DEFAULT_SOUND_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SOUND_SETTINGS
    return { ...DEFAULT_SOUND_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SOUND_SETTINGS
  }
}

export function saveSoundSettings(settings: SoundSettings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function playRoomEventSound(event: RoomSoundEvent, settings?: SoundSettings) {
  if (typeof window === 'undefined') return
  const cfg = settings || loadSoundSettings()
  if (!cfg.enabled || cfg.volume <= 0) return

  if ((event === 'user-join' || event === 'user-leave') && !cfg.joinLeaveSounds) return
  if ((event === 'stream-start' || event === 'stream-stop') && !cfg.streamSounds) return
  if (event === 'chat-message' && !cfg.chatSounds) return

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return

  try {
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const vol = Math.min(Math.max(cfg.volume * 0.35, 0.01), 0.6)

    const tone = (
      freqStart: number,
      freqEnd: number,
      startOffset: number,
      duration: number,
      type: OscillatorType = 'sine',
      gainMult = 1
    ) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freqStart, now + startOffset)
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + startOffset + duration)
      }
      gain.gain.setValueAtTime(vol * gainMult, now + startOffset)
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + startOffset)
      osc.stop(now + startOffset + duration)
    }

    switch (event) {
      case 'user-join':
        tone(587.33, 587.33, 0, 0.11, 'sine', 0.8)
        tone(880, 880, 0.09, 0.18, 'sine', 0.9)
        break

      case 'user-leave':
        tone(783.99, 783.99, 0, 0.11, 'sine', 0.8)
        tone(523.25, 523.25, 0.09, 0.18, 'sine', 0.7)
        break

      case 'stream-start':
        tone(523.25, 523.25, 0, 0.08, 'triangle', 0.8)
        tone(659.25, 659.25, 0.07, 0.08, 'triangle', 0.85)
        tone(1046.5, 1046.5, 0.14, 0.22, 'triangle', 1)
        break

      case 'stream-stop':
        tone(659.25, 523.25, 0, 0.14, 'triangle', 0.75)
        tone(440, 349.23, 0.11, 0.18, 'triangle', 0.7)
        break

      case 'mic-on':
        tone(660, 880, 0, 0.08, 'sine', 0.5)
        break

      case 'mic-off':
        tone(660, 440, 0, 0.09, 'sine', 0.5)
        break

      case 'chat-message':
        // Subtle Discord-like message pop
        tone(740, 987.77, 0, 0.07, 'sine', 0.55)
        break
    }
  } catch {
    // Ignore autoplay restriction before user interaction
  }
}
