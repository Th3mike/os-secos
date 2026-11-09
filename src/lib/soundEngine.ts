import { SoundEffect } from '@/types/community'

export const COMMUNITY_SOUNDS: SoundEffect[] = [
  { id: 'horn', label: 'Buzina Seca', emoji: '📢', color: 'from-amber-500 to-orange-600' },
  { id: 'clutch', label: 'Win / GG', emoji: '🏆', color: 'from-emerald-500 to-teal-600' },
  { id: 'rip', label: 'Foi de Base', emoji: '💀', color: 'from-rose-500 to-red-700' },
  { id: 'suspense', label: 'Tensão', emoji: '👀', color: 'from-purple-500 to-indigo-700' },
  { id: 'cricket', label: 'Secura Total', emoji: '🦗', color: 'from-lime-500 to-green-700' },
  { id: 'alert', label: 'Acorda Seco!', emoji: '🚨', color: 'from-sky-500 to-blue-700' },
]

export function playSynthesizedSound(soundId: string, volume = 0.35) {
  if (typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return

  const ctx = new AudioCtx()
  const now = ctx.currentTime

  const makeOsc = (
    type: OscillatorType,
    freqStart: number,
    freqEnd: number,
    startTime: number,
    duration: number,
    gainVal = volume
  ) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freqStart, startTime)
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 20), startTime + duration)
    }
    gain.gain.setValueAtTime(gainVal, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(startTime)
    osc.stop(startTime + duration)
  }

  switch (soundId) {
    case 'horn': {
      // Airhorn chord
      makeOsc('sawtooth', 440, 435, now, 0.45, volume * 0.6)
      makeOsc('sawtooth', 554.37, 550, now, 0.45, volume * 0.6)
      makeOsc('sawtooth', 659.25, 655, now, 0.55, volume * 0.6)
      break
    }
    case 'clutch': {
      // Victory arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((n, idx) => {
        makeOsc('triangle', n, n, now + idx * 0.09, 0.25, volume * 0.8)
      })
      break
    }
    case 'rip': {
      // Sad trombone descending
      makeOsc('sawtooth', 392, 370, now, 0.28, volume * 0.6)
      makeOsc('sawtooth', 369.99, 349, now + 0.3, 0.28, volume * 0.6)
      makeOsc('sawtooth', 349.23, 330, now + 0.6, 0.28, volume * 0.6)
      makeOsc('sawtooth', 329.63, 220, now + 0.9, 0.65, volume * 0.7)
      break
    }
    case 'suspense': {
      // Dramatic impact
      makeOsc('sawtooth', 146.83, 73.42, now, 0.8, volume * 0.9)
      makeOsc('sine', 110, 55, now, 0.9, volume)
      break
    }
    case 'cricket': {
      // Chirp chirp
      for (let i = 0; i < 4; i++) {
        makeOsc('sine', 4200, 4500, now + i * 0.06, 0.04, volume * 0.4)
        makeOsc('sine', 4200, 4500, now + 0.45 + i * 0.06, 0.04, volume * 0.4)
      }
      break
    }
    case 'alert': {
      // Siren
      makeOsc('square', 600, 1200, now, 0.25, volume * 0.5)
      makeOsc('square', 1200, 600, now + 0.25, 0.25, volume * 0.5)
      makeOsc('square', 600, 1200, now + 0.5, 0.25, volume * 0.5)
      break
    }
  }
}

