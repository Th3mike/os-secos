'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  WatchTogetherState,
  UserProfile,
  CinemaAvatarConfig,
  CinemaPlayerState,
  CinemaPresetId,
  CinemaHairStyle,
  CinemaHatStyle,
  CinemaAccessoryStyle,
  CinemaAuraStyle,
  CinemaEmoteType,
} from '@/types/community'

interface WatchTogetherStageProps {
  watchState: WatchTogetherState | null
  currentUser: UserProfile | null
  roomPeers: UserProfile[]
  speakingPeers: Record<string, boolean>
  isSelfSpeaking: boolean
  cinemaPlayers: Record<string, CinemaPlayerState>
  liveScreenStream?: MediaStream | null
  liveScreenStreamerName?: string | null
  onBroadcastCinemaState: (state: CinemaPlayerState) => void
  onUpdateWatchState: (next: WatchTogetherState | null) => void
  onStartTabShare: () => void
}

const AVATAR_STORAGE_KEY = 'os_secos_cinema_avatar_v1'

export const ANIME_PRESETS: {
  id: CinemaPresetId
  name: string
  badge: string
  config: CinemaAvatarConfig
}[] = [
  {
    id: 'goku',
    name: 'Goku SSJ',
    badge: '🐉 DBZ',
    config: {
      presetId: 'goku',
      shirtColor: '#f97316',
      pantsColor: '#1d4ed8',
      hairStyle: 'spiky-gold',
      hatStyle: 'none',
      accessory: 'none',
      aura: 'super-saiyan',
    },
  },
  {
    id: 'naruto',
    name: 'Naruto Hokage',
    badge: '🍥 Ninja',
    config: {
      presetId: 'naruto',
      shirtColor: '#fb923c',
      pantsColor: '#18181b',
      hairStyle: 'ninja-blonde',
      hatStyle: 'headband',
      accessory: 'cape',
      aura: 'blue-chakra',
    },
  },
  {
    id: 'luffy',
    name: 'Luffy Gear 5',
    badge: '🏴‍☠️ One Piece',
    config: {
      presetId: 'luffy',
      shirtColor: '#dc2626',
      pantsColor: '#2563eb',
      hairStyle: 'spiky-black',
      hatStyle: 'straw-hat',
      accessory: 'popcorn',
      aura: 'none',
    },
  },
  {
    id: 'gojo',
    name: 'Satoru Gojo',
    badge: '🤞 Jujutsu',
    config: {
      presetId: 'gojo',
      shirtColor: '#0f172a',
      pantsColor: '#09090b',
      hairStyle: 'anime-white',
      hatStyle: 'none',
      accessory: 'blindfold',
      aura: 'purple-curse',
    },
  },
  {
    id: 'tanjiro',
    name: 'Tanjiro Kamado',
    badge: '🗡️ Demon Slayer',
    config: {
      presetId: 'tanjiro',
      shirtColor: '#10b981',
      pantsColor: '#18181b',
      hairStyle: 'burgundy',
      hatStyle: 'none',
      accessory: 'katana',
      aura: 'fire-red',
    },
  },
  {
    id: 'akatsuki',
    name: 'Membro Akatsuki',
    badge: '☁️ Renegado',
    config: {
      presetId: 'akatsuki',
      shirtColor: '#111827',
      pantsColor: '#7f1d1d',
      hairStyle: 'spiky-black',
      hatStyle: 'headband',
      accessory: 'cape',
      aura: 'purple-curse',
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Edgerunner',
    badge: '⚡ Neon',
    config: {
      presetId: 'cyberpunk',
      shirtColor: '#eab308',
      pantsColor: '#1e1b4b',
      hairStyle: 'anime-white',
      hatStyle: 'cat-ears',
      accessory: 'glasses',
      aura: 'blue-chakra',
    },
  },
  {
    id: 'king-seco',
    name: 'Rei dos Secos',
    badge: '👑 Lenda',
    config: {
      presetId: 'king-seco',
      shirtColor: '#7e22ce',
      pantsColor: '#09090b',
      hairStyle: 'none',
      hatStyle: 'crown',
      accessory: 'wings',
      aura: 'super-saiyan',
    },
  },
]

const CATALOG_MOVIES: {
  title: string
  category: string
  duration: string
  provider: WatchTogetherState['provider']
  url: string
  badgeColor: string
}[] = [
  {
    title: 'Big Buck Bunny (Animação 3D HD)',
    category: 'Comédia / Curta',
    duration: '10 min',
    provider: 'mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    badgeColor: '#22c55e',
  },
  {
    title: 'Sintel — O Dragão Guardião (Blender)',
    category: 'Fantasia / Épico',
    duration: '15 min',
    provider: 'mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    badgeColor: '#f59e0b',
  },
  {
    title: 'Tears of Steel (Sci-Fi Cyberpunk)',
    category: 'Ficção Científica',
    duration: '12 min',
    provider: 'mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    badgeColor: '#0ea5e9',
  },
  {
    title: 'Elephants Dream (Surreal 3D)',
    category: 'Sci-Fi / Animação',
    duration: '11 min',
    provider: 'mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    badgeColor: '#a855f7',
  },
  {
    title: 'Lofi Hip Hop Radio — Beats to Chill/Game',
    category: 'YouTube Ao Vivo',
    duration: 'LIVE',
    provider: 'youtube',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    badgeColor: '#ef4444',
  },
]

// 14 Cinema Seats arranged in 2 tiered rows facing the giant screen (z = -11)
export const CINEMA_SEATS: { index: number; row: number; x: number; y: number; z: number }[] = [
  // Row 1 (Front Row)
  { index: 0, row: 1, x: -6.6, y: 0.45, z: -2.2 },
  { index: 1, row: 1, x: -4.4, y: 0.45, z: -2.2 },
  { index: 2, row: 1, x: -2.2, y: 0.45, z: -2.2 },
  { index: 3, row: 1, x: 0.0, y: 0.45, z: -2.2 },
  { index: 4, row: 1, x: 2.2, y: 0.45, z: -2.2 },
  { index: 5, row: 1, x: 4.4, y: 0.45, z: -2.2 },
  { index: 6, row: 1, x: 6.6, y: 0.45, z: -2.2 },
  // Row 2 (Elevated VIP Back Row)
  { index: 7, row: 2, x: -6.6, y: 1.05, z: 1.2 },
  { index: 8, row: 2, x: -4.4, y: 1.05, z: 1.2 },
  { index: 9, row: 2, x: -2.2, y: 1.05, z: 1.2 },
  { index: 10, row: 2, x: 0.0, y: 1.05, z: 1.2 },
  { index: 11, row: 2, x: 2.2, y: 1.05, z: 1.2 },
  { index: 12, row: 2, x: 4.4, y: 1.05, z: 1.2 },
  { index: 13, row: 2, x: 6.6, y: 1.05, z: 1.2 },
]

export function loadSavedCinemaAvatar(): CinemaAvatarConfig {
  if (typeof window === 'undefined') return ANIME_PRESETS[0].config
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE_KEY)
    if (!raw) return ANIME_PRESETS[0].config
    return { ...ANIME_PRESETS[0].config, ...JSON.parse(raw) }
  } catch {
    return ANIME_PRESETS[0].config
  }
}

export function saveCinemaAvatar(cfg: CinemaAvatarConfig) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    // ignore
  }
}

export function parseMediaUrl(rawUrl: string): {
  provider: WatchTogetherState['provider']
  embedUrl: string
} | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)

    // Direct video file (.mp4, .webm, .ogg)
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url.pathname)) {
      return {
        provider: 'mp4',
        embedUrl: trimmed,
      }
    }

    // YouTube
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      let videoId = ''
      if (url.hostname.includes('youtu.be')) {
        videoId = url.pathname.slice(1)
      } else if (url.pathname.startsWith('/shorts/')) {
        videoId = url.pathname.split('/')[2]
      } else {
        videoId = url.searchParams.get('v') || ''
      }
      if (videoId) {
        return {
          provider: 'youtube',
          embedUrl: `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&rel=0`,
        }
      }
    }

    // Spotify
    if (url.hostname.includes('spotify.com')) {
      const cleanPath = url.pathname.replace(/^\/intl-[a-z]+\//i, '/')
      return {
        provider: 'spotify',
        embedUrl: `https://open.spotify.com/embed${cleanPath}?utm_source=generator&theme=0`,
      }
    }

    // Twitch
    if (url.hostname.includes('twitch.tv')) {
      const channel = url.pathname.split('/').filter(Boolean)[0]
      if (channel && typeof window !== 'undefined') {
        return {
          provider: 'twitch',
          embedUrl: `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`,
        }
      }
    }

    // Kick
    if (url.hostname.includes('kick.com')) {
      const channel = url.pathname.split('/').filter(Boolean)[0]
      if (channel) {
        return {
          provider: 'kick',
          embedUrl: `https://player.kick.com/${channel}`,
        }
      }
    }

    return {
      provider: 'custom',
      embedUrl: trimmed,
    }
  } catch {
    return null
  }
}

function createAvatarFaceTexture(
  avatarUrl: string,
  username: string,
  config: CinemaAvatarConfig
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  const draw = (img?: HTMLImageElement) => {
    ctx.fillStyle = '#27272a'
    ctx.fillRect(0, 0, 256, 256)

    if (img) {
      ctx.drawImage(img, 0, 0, 256, 256)
    } else {
      ctx.fillStyle = config.shirtColor || '#f59e0b'
      ctx.fillRect(16, 16, 224, 224)
    }

    // Ninja headband on forehead if selected
    if (config.hatStyle === 'headband') {
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(0, 18, 256, 46)
      ctx.fillStyle = '#cbd5e1'
      ctx.fillRect(68, 24, 120, 34)
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 4
      ctx.strokeRect(68, 24, 120, 34)
    }

    // Gojo Blindfold or Cyberpunk Glasses
    if (config.accessory === 'blindfold') {
      ctx.fillStyle = '#09090b'
      ctx.fillRect(0, 72, 256, 56)
    } else if (config.accessory === 'glasses') {
      ctx.fillStyle = '#06b6d4'
      ctx.fillRect(28, 82, 88, 36)
      ctx.fillRect(140, 82, 88, 36)
      ctx.fillStyle = '#09090b'
      ctx.fillRect(116, 94, 24, 10)
    }

    // Border
    ctx.strokeStyle = '#18181b'
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, 246, 246)

    // Bottom Username Plate
    ctx.fillStyle = 'rgba(0,0,0,0.8)'
    ctx.fillRect(0, 206, 256, 50)
    ctx.fillStyle = '#ffffff'
    ctx.font = '900 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(username.slice(0, 14), 128, 239)
  }

  draw()
  const tex = new THREE.CanvasTexture(canvas)
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    draw(img)
    tex.needsUpdate = true
  }
  img.src = avatarUrl

  return tex
}

interface CinemaCharacterMesh {
  root: THREE.Group
  head: THREE.Mesh
  torso: THREE.Mesh
  leftArmPivot: THREE.Group
  rightArmPivot: THREE.Group
  leftLegPivot: THREE.Group
  rightLegPivot: THREE.Group
  auraMesh: THREE.Mesh | null
  talkRing: THREE.Mesh
  configSignature: string
}

function buildCinemaCharacter3D(
  user: UserProfile,
  config: CinemaAvatarConfig
): CinemaCharacterMesh {
  const root = new THREE.Group()
  const shirtHex = new THREE.Color(config.shirtColor || '#f97316')
  const pantsHex = new THREE.Color(config.pantsColor || '#1d4ed8')

  // Green/Gold Speaking Ring on Floor
  const talkRing = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.82, 24),
    new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    })
  )
  talkRing.rotation.x = -Math.PI / 2
  talkRing.position.y = 0.03
  root.add(talkRing)

  // Head
  const faceTex = createAvatarFaceTexture(user.avatar_url, user.username, config)
  const sideMat = new THREE.MeshLambertMaterial({ color: 0x27272a })
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTex })
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.92), [
    sideMat,
    sideMat,
    sideMat,
    sideMat,
    faceMat,
    faceMat,
  ])
  head.position.y = 1.85
  root.add(head)

  // Hair Styles (Anime Spikes, Afro, etc.)
  if (config.hairStyle !== 'none') {
    const hairGroup = new THREE.Group()
    const hairColorMap: Record<CinemaHairStyle, number> = {
      none: 0x000000,
      'spiky-gold': 0xfacc15,
      'spiky-black': 0x111827,
      'ninja-blonde': 0xfde047,
      'anime-white': 0xf8fafc,
      burgundy: 0x881337,
      afro: 0x1c1917,
      'long-red': 0xdc2626,
    }
    const hairMat = new THREE.MeshLambertMaterial({
      color: hairColorMap[config.hairStyle] || 0xfacc15,
    })

    if (config.hairStyle === 'afro') {
      const afroBall = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 12), hairMat)
      afroBall.position.set(0, 0.35, -0.05)
      hairGroup.add(afroBall)
    } else {
      // Anime Spikes Crown!
      const spikeOffsets = [
        [0, 0.65, 0, 0, 0],
        [-0.38, 0.55, 0, 0, 0.55],
        [0.38, 0.55, 0, 0, -0.55],
        [-0.5, 0.3, -0.15, -0.2, 0.85],
        [0.5, 0.3, -0.15, -0.2, -0.85],
        [0, 0.55, -0.35, -0.6, 0],
        [-0.25, 0.6, 0.25, 0.4, 0.3],
        [0.25, 0.6, 0.25, 0.4, -0.3],
      ]
      spikeOffsets.forEach(([sx, sy, sz, rx, rz]) => {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.68, 6), hairMat)
        cone.position.set(sx, sy, sz)
        cone.rotation.set(rx, 0, rz)
        hairGroup.add(cone)
      })
    }
    head.add(hairGroup)
  }

  // Hat Styles (Luffy Straw Hat, Crown, Wizard, Cat Ears, Halo, Horns)
  if (config.hatStyle === 'straw-hat') {
    const hatGroup = new THREE.Group()
    const strawMat = new THREE.MeshLambertMaterial({ color: 0xfbbf24 })
    const ribbonMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 })
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 16), strawMat)
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.54, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      strawMat
    )
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 16), ribbonMat)
    ribbon.position.y = 0.08
    hatGroup.add(brim, dome, ribbon)
    hatGroup.position.set(0, 0.5, 0)
    head.add(hatGroup)
  } else if (config.hatStyle === 'crown') {
    const crownGroup = new THREE.Group()
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.3 })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.32, 12), goldMat)
    crownGroup.add(base)
    crownGroup.position.set(0, 0.62, 0)
    head.add(crownGroup)
  } else if (config.hatStyle === 'wizard') {
    const wizGroup = new THREE.Group()
    const wizMat = new THREE.MeshLambertMaterial({ color: 0x4f46e5 })
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 14), wizMat)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.1, 12), wizMat)
    cone.position.y = 0.55
    wizGroup.add(brim, cone)
    wizGroup.position.set(0, 0.48, 0)
    head.add(wizGroup)
  } else if (config.hatStyle === 'cat-ears') {
    const earMat = new THREE.MeshLambertMaterial({ color: 0xec4899 })
    const leftEar = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 4), earMat)
    leftEar.position.set(-0.32, 0.62, 0)
    const rightEar = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 4), earMat)
    rightEar.position.set(0.32, 0.62, 0)
    head.add(leftEar, rightEar)
  } else if (config.hatStyle === 'halo') {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.06, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    )
    halo.rotation.x = Math.PI / 2
    halo.position.set(0, 0.78, 0)
    head.add(halo)
  } else if (config.hatStyle === 'horns') {
    const hornMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 })
    const lHorn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 6), hornMat)
    lHorn.position.set(-0.34, 0.62, 0)
    lHorn.rotation.z = 0.35
    const rHorn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 6), hornMat)
    rHorn.position.set(0.34, 0.62, 0)
    rHorn.rotation.z = -0.35
    head.add(lHorn, rHorn)
  }

  // Torso
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 1.05, 0.5),
    new THREE.MeshLambertMaterial({ color: shirtHex })
  )
  torso.position.y = 0.88
  root.add(torso)

  // Accessories on Back / Hand (Katana, Cape, Wings, Popcorn Bucket)
  if (config.accessory === 'katana') {
    const katana = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.45, 0.08),
      new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
    )
    katana.position.set(0, 0.1, -0.32)
    katana.rotation.z = 0.65
    torso.add(katana)
  } else if (config.accessory === 'cape') {
    const cape = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 1.25, 0.06),
      new THREE.MeshLambertMaterial({
        color: config.presetId === 'akatsuki' ? 0x111827 : 0xdc2626,
      })
    )
    cape.position.set(0, -0.05, -0.29)
    cape.rotation.x = 0.12
    torso.add(cape)
  } else if (config.accessory === 'wings') {
    const wingMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 })
    const lWing = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.08), wingMat)
    lWing.position.set(-0.65, 0.15, -0.28)
    lWing.rotation.z = 0.3
    const rWing = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.08), wingMat)
    rWing.position.set(0.65, 0.15, -0.28)
    rWing.rotation.z = -0.3
    torso.add(lWing, rWing)
  }

  // Arms
  const armMat = new THREE.MeshLambertMaterial({ color: shirtHex })
  const leftArmPivot = new THREE.Group()
  leftArmPivot.position.set(-0.6, 1.32, 0)
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.85, 0.3), armMat)
  leftArm.position.y = -0.38
  leftArmPivot.add(leftArm)
  root.add(leftArmPivot)

  const rightArmPivot = new THREE.Group()
  rightArmPivot.position.set(0.6, 1.32, 0)
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.85, 0.3), armMat)
  rightArm.position.y = -0.38
  rightArmPivot.add(rightArm)

  if (config.accessory === 'popcorn') {
    const popBucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.16, 0.38, 10),
      new THREE.MeshLambertMaterial({ color: 0xef4444 })
    )
    popBucket.position.set(0, -0.75, 0.22)
    rightArmPivot.add(popBucket)
  }
  root.add(rightArmPivot)

  // Legs
  const legMat = new THREE.MeshLambertMaterial({ color: pantsHex })
  const leftLegPivot = new THREE.Group()
  leftLegPivot.position.set(-0.24, 0.38, 0)
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.78, 0.36), legMat)
  leftLeg.position.y = -0.36
  leftLegPivot.add(leftLeg)
  root.add(leftLegPivot)

  const rightLegPivot = new THREE.Group()
  rightLegPivot.position.set(0.24, 0.38, 0)
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.78, 0.36), legMat)
  rightLeg.position.y = -0.36
  rightLegPivot.add(rightLeg)
  root.add(rightLegPivot)

  // Anime Energy Aura
  let auraMesh: THREE.Mesh | null = null
  if (config.aura !== 'none') {
    const auraColorMap: Record<CinemaAuraStyle, number> = {
      none: 0x000000,
      'super-saiyan': 0xfacc15,
      'purple-curse': 0xa855f7,
      'blue-chakra': 0x38bdf8,
      'fire-red': 0xef4444,
    }
    auraMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.92, 2.7, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: auraColorMap[config.aura] || 0xfacc15,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      })
    )
    auraMesh.position.y = 1.25
    root.add(auraMesh)
  }

  return {
    root,
    head,
    torso,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    auraMesh,
    talkRing,
    configSignature: JSON.stringify(config),
  }
}

export function WatchTogetherStage({
  watchState,
  currentUser,
  roomPeers,
  speakingPeers,
  isSelfSpeaking,
  cinemaPlayers,
  liveScreenStream,
  liveScreenStreamerName,
  onBroadcastCinemaState,
  onUpdateWatchState,
  onStartTabShare,
}: WatchTogetherStageProps) {
  const [inputUrl, setInputUrl] = useState('')
  const [inputTitle, setInputTitle] = useState('')
  const [avatarConfig, setAvatarConfig] = useState<CinemaAvatarConfig>(() =>
    loadSavedCinemaAvatar()
  )
  const [myEmote, setMyEmote] = useState<CinemaEmoteType>('none')
  const [cameraView, setCameraView] = useState<'free' | 'seat-pov' | 'screen-closeup'>('free')
  const [activeModal, setActiveModal] = useState<'wardrobe' | 'movies' | null>(null)
  const [localScreenRect, setLocalScreenRect] = useState<{
    left: number
    top: number
    width: number
    height: number
    visible: boolean
  }>({ left: 0, top: 0, width: 0, height: 0, visible: false })

  const mountRef = useRef<HTMLDivElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const htmlVideoRef = useRef<HTMLVideoElement | null>(null)
  const liveStreamVideoRef = useRef<HTMLVideoElement | null>(null)
  const isApplyingRemoteSyncRef = useRef(false)

  // Local player movement state in 3D space
  const myPosRef = useRef<{
    x: number
    y: number
    z: number
    rotY: number
    seatIndex: number | null
  }>({
    x: 0,
    y: 0,
    z: 4.5,
    rotY: Math.PI, // Facing the screen (-Z)
    seatIndex: null,
  })
  const keysPressedRef = useRef<Record<string, boolean>>({})
  const cameraYawRef = useRef<number>(0)
  const cameraPitchRef = useRef<number>(0.22)
  const isDraggingCamRef = useRef<boolean>(false)
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Keep latest props in refs for the 30fps Three.js loop
  const cinemaPlayersRef = useRef(cinemaPlayers)
  const roomPeersRef = useRef(roomPeers)
  const speakingPeersRef = useRef(speakingPeers)
  const isSelfSpeakingRef = useRef(isSelfSpeaking)
  const avatarConfigRef = useRef(avatarConfig)
  const myEmoteRef = useRef(myEmote)
  const cameraViewRef = useRef(cameraView)
  const watchStateRef = useRef(watchState)
  const currentUserRef = useRef(currentUser)
  const onBroadcastRef = useRef(onBroadcastCinemaState)

  useEffect(() => {
    cinemaPlayersRef.current = cinemaPlayers
  }, [cinemaPlayers])
  useEffect(() => {
    roomPeersRef.current = roomPeers
  }, [roomPeers])
  useEffect(() => {
    speakingPeersRef.current = speakingPeers
  }, [speakingPeers])
  useEffect(() => {
    isSelfSpeakingRef.current = isSelfSpeaking
  }, [isSelfSpeaking])
  useEffect(() => {
    avatarConfigRef.current = avatarConfig
  }, [avatarConfig])
  useEffect(() => {
    myEmoteRef.current = myEmote
  }, [myEmote])
  useEffect(() => {
    cameraViewRef.current = cameraView
  }, [cameraView])
  useEffect(() => {
    watchStateRef.current = watchState
  }, [watchState])
  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])
  useEffect(() => {
    onBroadcastRef.current = onBroadcastCinemaState
  }, [onBroadcastCinemaState])

  // Broadcast initial avatar + position on mount and whenever avatar/emote changes
  useEffect(() => {
    if (!currentUser) return
    const p = myPosRef.current
    onBroadcastRef.current({
      userId: currentUser.id,
      user: currentUser,
      x: p.x,
      y: p.y,
      z: p.z,
      rotY: p.rotY,
      seatIndex: p.seatIndex,
      emote: myEmote,
      avatar: avatarConfig,
      updatedAt: Date.now(),
    })
  }, [currentUser, avatarConfig, myEmote])

  // Bind live WebRTC screen share stream if someone is sharing their tab/screen in Cinema!
  useEffect(() => {
    const el = liveStreamVideoRef.current
    if (!el || !liveScreenStream) return
    if (el.srcObject !== liveScreenStream) {
      el.srcObject = liveScreenStream
      el.play().catch(() => {})
    }
  }, [liveScreenStream])

  // Synchronize HTML5 MP4 Video playback + seek across all users!
  useEffect(() => {
    const vid = htmlVideoRef.current
    if (!vid || !watchState || watchState.provider !== 'mp4') return

    isApplyingRemoteSyncRef.current = true
    const elapsedSinceUpdate = watchState.isPlaying
      ? Math.max(0, (Date.now() - watchState.updatedAt) / 1000)
      : 0
    const targetTime = (watchState.currentTime || 0) + elapsedSinceUpdate

    if (Math.abs(vid.currentTime - targetTime) > 1.8) {
      vid.currentTime = targetTime
    }

    if (watchState.isPlaying) {
      vid.play().catch(() => {})
    } else {
      vid.pause()
    }

    const t = setTimeout(() => {
      isApplyingRemoteSyncRef.current = false
    }, 350)
    return () => clearTimeout(t)
  }, [
    watchState?.url,
    watchState?.isPlaying,
    watchState?.currentTime,
    watchState?.updatedAt,
    watchState?.provider,
  ])

  // Synchronize YouTube Iframe play/pause + seek across all users!
  useEffect(() => {
    if (!watchState || watchState.provider !== 'youtube' || !iframeRef.current) return
    const win = iframeRef.current.contentWindow
    if (!win) return

    if (typeof watchState.currentTime === 'number' && watchState.currentTime > 0) {
      win.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'seekTo',
          args: [watchState.currentTime, true],
        }),
        '*'
      )
    }

    const cmd = watchState.isPlaying ? 'playVideo' : 'pauseVideo'
    win.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*')
  }, [watchState?.isPlaying, watchState?.currentTime, watchState?.updatedAt, watchState?.provider])

  // Keyboard WASD controls for walking around the 3D Cinema
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = e.key.toLowerCase()
      keysPressedRef.current[k] = true

      // Press E to sit in nearest cinema seat or stand up
      if (k === 'e') {
        handleToggleNearestSeat()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.key.toLowerCase()] = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const handleToggleNearestSeat = () => {
    const cur = myPosRef.current
    if (cur.seatIndex !== null) {
      // Stand up into the aisle
      myPosRef.current = {
        ...cur,
        y: 0,
        z: cur.z + 1.1,
        seatIndex: null,
      }
    } else {
      // Find closest seat
      let bestSeat = CINEMA_SEATS[0]
      let bestDist = Infinity
      for (const s of CINEMA_SEATS) {
        const d = Math.hypot(cur.x - s.x, cur.z - s.z)
        if (d < bestDist) {
          bestDist = d
          bestSeat = s
        }
      }
      myPosRef.current = {
        x: bestSeat.x,
        y: bestSeat.y,
        z: bestSeat.z,
        rotY: Math.PI, // Face the giant movie screen!
        seatIndex: bestSeat.index,
      }
    }

    if (currentUserRef.current) {
      const p = myPosRef.current
      onBroadcastRef.current({
        userId: currentUserRef.current.id,
        user: currentUserRef.current,
        x: p.x,
        y: p.y,
        z: p.z,
        rotY: p.rotY,
        seatIndex: p.seatIndex,
        emote: myEmoteRef.current,
        avatar: avatarConfigRef.current,
        updatedAt: Date.now(),
      })
    }
  }

  // Main 3D Theater Room Three.js Engine
  useEffect(() => {
    if (!mountRef.current) return
    const container = mountRef.current
    let width = container.clientWidth || 960
    let height = container.clientHeight || 540

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x07070c)
    scene.fog = new THREE.FogExp2(0x07070c, 0.018)

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100)

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'low-power',
    })
    renderer.setPixelRatio(1)
    renderer.setSize(width, height)
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Theater Lighting (dims automatically when a movie is playing or lightsDimmed is true)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65)
    scene.add(ambientLight)

    const screenBounceLight = new THREE.PointLight(0x6366f1, 2.8, 28)
    screenBounceLight.position.set(0, 4.5, -8.5)
    scene.add(screenBounceLight)

    const ceilingLight = new THREE.DirectionalLight(0xfff7ed, 0.9)
    ceilingLight.position.set(0, 12, 6)
    scene.add(ceilingLight)

    // 1. Cinema Red Carpet Floor & Tiered Row Platforms
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 28),
      new THREE.MeshLambertMaterial({ color: 0x2a0810 })
    )
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)

    // glowing LED aisle strips on the carpet
    const stripGeo = new THREE.PlaneGeometry(0.18, 16)
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    const leftStrip = new THREE.Mesh(stripGeo, stripMat)
    leftStrip.rotation.x = -Math.PI / 2
    leftStrip.position.set(-8.2, 0.02, -1)
    const rightStrip = new THREE.Mesh(stripGeo, stripMat)
    rightStrip.rotation.x = -Math.PI / 2
    rightStrip.position.set(8.2, 0.02, -1)
    scene.add(leftStrip, rightStrip)

    // Elevated VIP platform for Row 2
    const vipPlatform = new THREE.Mesh(
      new THREE.BoxGeometry(18, 0.6, 3.2),
      new THREE.MeshLambertMaterial({ color: 0x18181b })
    )
    vipPlatform.position.set(0, 0.3, 1.2)
    scene.add(vipPlatform)

    // 2. Giant Cinema Stage & Glowing IMAX Frame at Z = -10.8
    const stageBase = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.9, 3.2),
      new THREE.MeshLambertMaterial({ color: 0x111214 })
    )
    stageBase.position.set(0, 0.45, -10.2)
    scene.add(stageBase)

    const screenBorder = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 8.6, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x1e1b4b })
    )
    screenBorder.position.set(0, 5.1, -11.0)
    scene.add(screenBorder)

    const screenSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(14.4, 8.1),
      new THREE.MeshBasicMaterial({ color: 0x050507 })
    )
    screenSurface.position.set(0, 5.1, -10.8)
    scene.add(screenSurface)

    // Red Velvet Side Curtains
    const curtainMat = new THREE.MeshLambertMaterial({ color: 0x7f1d1d })
    const leftCurtain = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 9.5, 12), curtainMat)
    leftCurtain.position.set(-8.4, 4.75, -10.6)
    const rightCurtain = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 9.5, 12), curtainMat)
    rightCurtain.position.set(8.4, 4.75, -10.6)
    scene.add(leftCurtain, rightCurtain)

    // 3. Build 14 Red Plush Cinema Armchairs
    const seatCushionMat = new THREE.MeshLambertMaterial({ color: 0x991b1b })
    const seatArmMat = new THREE.MeshLambertMaterial({ color: 0x18181b })
    CINEMA_SEATS.forEach((s) => {
      const chair = new THREE.Group()
      const baseHeight = s.row === 2 ? 0.6 : 0
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.35, 1.2), seatCushionMat)
      cushion.position.set(0, baseHeight + 0.35, 0)
      const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.25, 0.28), seatCushionMat)
      backrest.position.set(0, baseHeight + 0.95, 0.48)
      const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 1.2), seatArmMat)
      lArm.position.set(-0.68, baseHeight + 0.55, 0)
      const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 1.2), seatArmMat)
      rArm.position.set(0.68, baseHeight + 0.55, 0)
      chair.add(cushion, backrest, lArm, rArm)
      chair.position.set(s.x, 0, s.z)
      scene.add(chair)
    })

    // 4. Manage Dynamic 3D Player Avatars in the Theater
    const characterMeshes = new Map<string, CinemaCharacterMesh>()

    const onResize = () => {
      if (!container) return
      width = container.clientWidth || 960
      height = container.clientHeight || 540
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', onResize)

    let frameId = 0
    let lastRender = 0
    let lastNetworkBroadcast = 0

    // Corner points of the 3D screen to project HTML/video player onto the exact 3D quad!
    const topLeftWorld = new THREE.Vector3(-7.2, 5.1 + 4.05, -10.8)
    const bottomRightWorld = new THREE.Vector3(7.2, 5.1 - 4.05, -10.8)
    const screenNormal = new THREE.Vector3(0, 0, 1)
    const camToScreen = new THREE.Vector3()

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate)
      if (now - lastRender < 32) return // Smooth 30 FPS cap so GPU video decoding never stutters
      const dt = Math.min(0.1, (now - lastRender) / 1000)
      lastRender = now
      const timeSec = now / 1000

      // 1. Update local player WASD movement
      const keys = keysPressedRef.current
      let moveX = 0
      let moveZ = 0
      if (keys['w'] || keys['arrowup']) moveZ -= 1
      if (keys['s'] || keys['arrowdown']) moveZ += 1
      if (keys['a'] || keys['arrowleft']) moveX -= 1
      if (keys['d'] || keys['arrowright']) moveX += 1

      const myPos = myPosRef.current
      let moved = false
      if (moveX !== 0 || moveZ !== 0) {
        const speed = 5.2
        const len = Math.hypot(moveX, moveZ)
        const dx = (moveX / len) * speed * dt
        const dz = (moveZ / len) * speed * dt

        // Rotate movement by camera yaw
        const cos = Math.cos(cameraYawRef.current)
        const sin = Math.sin(cameraYawRef.current)
        const worldDx = dx * cos + dz * sin
        const worldDz = dz * cos - dx * sin

        myPos.x = Math.max(-10.5, Math.min(10.5, myPos.x + worldDx))
        myPos.z = Math.max(-7.8, Math.min(8.5, myPos.z + worldDz))
        myPos.y = 0
        myPos.seatIndex = null // Standing up automatically when walking
        myPos.rotY = Math.atan2(worldDx, worldDz)
        moved = true
      }

      if (moved && now - lastNetworkBroadcast > 110 && currentUserRef.current) {
        lastNetworkBroadcast = now
        onBroadcastRef.current({
          userId: currentUserRef.current.id,
          user: currentUserRef.current,
          x: myPos.x,
          y: myPos.y,
          z: myPos.z,
          rotY: myPos.rotY,
          seatIndex: myPos.seatIndex,
          emote: myEmoteRef.current,
          avatar: avatarConfigRef.current,
          updatedAt: Date.now(),
        })
      }

      // 2. Dim lights when movie is playing
      const ws = watchStateRef.current
      const dimmed = ws?.lightsDimmed ?? Boolean(ws?.active && ws?.isPlaying)
      ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, dimmed ? 0.25 : 0.7, 0.08)
      ceilingLight.intensity = THREE.MathUtils.lerp(ceilingLight.intensity, dimmed ? 0.2 : 0.9, 0.08)
      screenBounceLight.intensity = dimmed
        ? 3.2 + Math.sin(timeSec * 6) * 0.45
        : 1.5

      // 3. Sync all room peers into 3D avatars
      const peers = roomPeersRef.current
      const remoteStates = cinemaPlayersRef.current
      const activeIds = new Set<string>()

      peers.forEach((peer, idx) => {
        activeIds.add(peer.id)
        const isMe = peer.id === currentUserRef.current?.id
        const remote = remoteStates[peer.id]
        const cfg = isMe
          ? avatarConfigRef.current
          : remote?.avatar || ANIME_PRESETS[idx % ANIME_PRESETS.length].config
        const sig = JSON.stringify(cfg)

        let charMesh = characterMeshes.get(peer.id)
        if (!charMesh || charMesh.configSignature !== sig) {
          if (charMesh) {
            scene.remove(charMesh.root)
          }
          charMesh = buildCinemaCharacter3D(peer, cfg)
          scene.add(charMesh.root)
          characterMeshes.set(peer.id, charMesh)
        }

        // Target coordinates (if remote hasn't moved yet, place them in a default seat!)
        const defaultSeat = CINEMA_SEATS[idx % CINEMA_SEATS.length]
        const targetX = isMe ? myPos.x : (remote?.x ?? defaultSeat.x)
        const targetY = isMe ? myPos.y : (remote?.y ?? defaultSeat.y)
        const targetZ = isMe ? myPos.z : (remote?.z ?? defaultSeat.z)
        const targetRotY = isMe ? myPos.rotY : (remote?.rotY ?? Math.PI)
        const seatIdx = isMe ? myPos.seatIndex : (remote ? remote.seatIndex : defaultSeat.index)
        const emote: CinemaEmoteType = isMe ? myEmoteRef.current : (remote?.emote || 'none')

        // Smooth interpolation
        charMesh.root.position.x = THREE.MathUtils.lerp(charMesh.root.position.x, targetX, 0.25)
        charMesh.root.position.y = THREE.MathUtils.lerp(charMesh.root.position.y, targetY, 0.25)
        charMesh.root.position.z = THREE.MathUtils.lerp(charMesh.root.position.z, targetZ, 0.25)
        charMesh.root.rotation.y = targetRotY

        // Speaking indicator ring + head nod when talking
        const talking = isMe
          ? isSelfSpeakingRef.current
          : Boolean(speakingPeersRef.current[peer.id])
        const ringMat = charMesh.talkRing.material as THREE.MeshBasicMaterial
        ringMat.opacity = talking ? 0.85 : 0.0
        if (talking) {
          charMesh.head.scale.setScalar(1 + Math.sin(timeSec * 18) * 0.06)
        } else {
          charMesh.head.scale.setScalar(1)
        }

        // Aura pulse
        if (charMesh.auraMesh) {
          charMesh.auraMesh.rotation.y += 0.08
          const s = 1 + Math.sin(timeSec * 10) * 0.08
          charMesh.auraMesh.scale.set(s, 1, s)
        }

        // Limb animations (Sitting vs Walking vs Emotes)
        const isMoving =
          isMe
            ? moved
            : Math.hypot(targetX - charMesh.root.position.x, targetZ - charMesh.root.position.z) >
              0.08

        if (seatIdx !== null) {
          // Seated posture facing screen
          charMesh.leftLegPivot.rotation.x = -Math.PI / 2.2
          charMesh.rightLegPivot.rotation.x = -Math.PI / 2.2
        } else if (isMoving) {
          charMesh.leftLegPivot.rotation.x = Math.sin(timeSec * 14) * 0.75
          charMesh.rightLegPivot.rotation.x = -Math.sin(timeSec * 14) * 0.75
        } else {
          charMesh.leftLegPivot.rotation.x = 0
          charMesh.rightLegPivot.rotation.x = 0
        }

        if (emote === 'wave') {
          charMesh.rightArmPivot.rotation.z = -2.4 + Math.sin(timeSec * 14) * 0.45
          charMesh.leftArmPivot.rotation.z = 0
        } else if (emote === 'cheer') {
          charMesh.leftArmPivot.rotation.z = 2.5 + Math.sin(timeSec * 12) * 0.3
          charMesh.rightArmPivot.rotation.z = -2.5 - Math.sin(timeSec * 12) * 0.3
        } else if (emote === 'dance') {
          charMesh.root.rotation.y = targetRotY + Math.sin(timeSec * 8) * 0.6
          charMesh.leftArmPivot.rotation.z = 2.1 + Math.sin(timeSec * 14) * 0.6
          charMesh.rightArmPivot.rotation.z = -2.1 + Math.cos(timeSec * 14) * 0.6
        } else if (emote === 'popcorn') {
          charMesh.rightArmPivot.rotation.x = -1.1 + Math.sin(timeSec * 10) * 0.45
          charMesh.leftArmPivot.rotation.x = 0
          charMesh.leftArmPivot.rotation.z = 0
          charMesh.rightArmPivot.rotation.z = 0
        } else {
          charMesh.leftArmPivot.rotation.z = 0
          charMesh.rightArmPivot.rotation.z = 0
          charMesh.leftArmPivot.rotation.x = isMoving ? -Math.sin(timeSec * 14) * 0.6 : 0
          charMesh.rightArmPivot.rotation.x = isMoving ? Math.sin(timeSec * 14) * 0.6 : 0
        }
      })

      // Remove disconnected peers
      characterMeshes.forEach((mesh, id) => {
        if (!activeIds.has(id)) {
          scene.remove(mesh.root)
          characterMeshes.delete(id)
        }
      })

      // 4. Camera Modes (3rd-Person Game Follow / Seat POV / Screen Closeup)
      const viewMode = cameraViewRef.current
      if (viewMode === 'screen-closeup') {
        camera.position.lerp(new THREE.Vector3(0, 5.1, -0.8), 0.15)
        camera.lookAt(0, 5.1, -10.8)
      } else if (viewMode === 'seat-pov') {
        const targetCam = new THREE.Vector3(myPos.x, myPos.y + 2.35, myPos.z - 0.15)
        camera.position.lerp(targetCam, 0.2)
        camera.lookAt(0, 4.9, -10.8)
      } else {
        // Free 3rd-person game camera behind player with mouse orbit
        const dist = 5.6
        const camX = myPos.x + Math.sin(cameraYawRef.current) * dist
        const camZ = myPos.z + Math.cos(cameraYawRef.current) * dist
        const camY = Math.max(1.2, myPos.y + 2.6 + cameraPitchRef.current * 3.2)
        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.22)
        camera.lookAt(myPos.x * 0.35, 3.8, -10.8)
      }

      camera.updateMatrixWorld()

      // 5. Project 3D Movie Screen bounds to 2D overlay coordinates so the synchronized movie sits INSIDE the 3D screen!
      camToScreen.set(0, 5.1, -10.8).sub(camera.position).normalize()
      const facingScreen = camToScreen.dot(screenNormal) < -0.15

      if (facingScreen) {
        const tl = topLeftWorld.clone().project(camera)
        const br = bottomRightWorld.clone().project(camera)

        const leftPx = ((tl.x + 1) / 2) * width
        const rightPx = ((br.x + 1) / 2) * width
        const topPx = ((-tl.y + 1) / 2) * height
        const bottomPx = ((-br.y + 1) / 2) * height

        const wPx = Math.max(0, rightPx - leftPx)
        const hPx = Math.max(0, bottomPx - topPx)

        setLocalScreenRect((prev) => {
          if (
            Math.abs(prev.left - leftPx) < 1.5 &&
            Math.abs(prev.top - topPx) < 1.5 &&
            Math.abs(prev.width - wPx) < 1.5 &&
            Math.abs(prev.height - hPx) < 1.5 &&
            prev.visible
          ) {
            return prev
          }
          return {
            left: leftPx,
            top: topPx,
            width: wPx,
            height: hPx,
            visible: wPx > 40 && hPx > 25,
          }
        })
      } else {
        setLocalScreenRect((prev) => (prev.visible ? { ...prev, visible: false } : prev))
      }

      renderer.render(scene, camera)
    }

    frameId = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(frameId)
      renderer.dispose()
    }
  }, [])

  const handleLoadUrl = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !inputUrl.trim()) return
    const parsed = parseMediaUrl(inputUrl)
    if (!parsed) return

    const nextState: WatchTogetherState = {
      active: true,
      provider: parsed.provider,
      url: inputUrl.trim(),
      embedUrl: parsed.embedUrl,
      title: inputTitle.trim() || 'Sessão Cinema 3D',
      hostId: currentUser.id,
      hostName: currentUser.username,
      isPlaying: true,
      currentTime: 0,
      updatedAt: Date.now(),
      lightsDimmed: true,
    }

    setInputUrl('')
    setInputTitle('')
    setActiveModal(null)
    onUpdateWatchState(nextState)
  }

  const handleSelectCatalogMovie = (movie: (typeof CATALOG_MOVIES)[number]) => {
    if (!currentUser) return
    const parsed = parseMediaUrl(movie.url)
    if (!parsed) return

    onUpdateWatchState({
      active: true,
      provider: parsed.provider,
      url: movie.url,
      embedUrl: parsed.embedUrl,
      title: movie.title,
      hostId: currentUser.id,
      hostName: currentUser.username,
      isPlaying: true,
      currentTime: 0,
      updatedAt: Date.now(),
      lightsDimmed: true,
    })
    setActiveModal(null)
  }

  // Global Play / Pause for EVERYBODY in the room!
  const handleGlobalPlayPause = (forcePlay?: boolean) => {
    if (!watchState || !currentUser) return
    const nextPlaying = forcePlay !== undefined ? forcePlay : !watchState.isPlaying
    const currentVideoTime =
      watchState.provider === 'mp4' && htmlVideoRef.current
        ? htmlVideoRef.current.currentTime
        : watchState.currentTime || 0

    onUpdateWatchState({
      ...watchState,
      hostId: currentUser.id,
      hostName: currentUser.username,
      isPlaying: nextPlaying,
      currentTime: currentVideoTime,
      updatedAt: Date.now(),
    })
  }

  // Global Seek (-15s / +15s or timeline scrub) for EVERYBODY in the room!
  const handleGlobalSeek = (deltaSeconds: number) => {
    if (!watchState || !currentUser) return
    const baseTime =
      watchState.provider === 'mp4' && htmlVideoRef.current
        ? htmlVideoRef.current.currentTime
        : watchState.currentTime || 0
    const nextTime = Math.max(0, baseTime + deltaSeconds)

    if (watchState.provider === 'mp4' && htmlVideoRef.current) {
      htmlVideoRef.current.currentTime = nextTime
    }

    onUpdateWatchState({
      ...watchState,
      hostId: currentUser.id,
      hostName: currentUser.username,
      currentTime: nextTime,
      updatedAt: Date.now(),
    })
  }

  const handleToggleLights = () => {
    if (!watchState) return
    onUpdateWatchState({
      ...watchState,
      lightsDimmed: !watchState.lightsDimmed,
      updatedAt: Date.now(),
    })
  }

  const updateMyAvatar = (patch: Partial<CinemaAvatarConfig>) => {
    setAvatarConfig((prev) => {
      const next: CinemaAvatarConfig = { ...prev, ...patch }
      saveCinemaAvatar(next)
      return next
    })
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-[#232428] bg-[#07070c] select-none">
      {/* TOP CINEMA 3D GAME BAR */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#14151a]/95 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gradient-to-r from-amber-500 to-red-600 px-2 py-0.5 text-[11px] font-black text-white uppercase shadow">
            🍿 Cinema 3D • Os Secos
          </span>
          {watchState?.active ? (
            <span className="truncate text-xs font-bold text-amber-300">
              🎬 {watchState.title || 'Filme no Telão'} •{' '}
              <span className="text-zinc-400">
                ({watchState.isPlaying ? '▶ Rodando' : '⏸ Pausado'} por {watchState.hostName})
              </span>
            </span>
          ) : liveScreenStream ? (
            <span className="truncate text-xs font-bold text-emerald-400">
              📡 Telão transmitindo ao vivo: {liveScreenStreamerName}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">
              Ande com <strong className="text-white">W A S D</strong> • Aperte{' '}
              <strong className="text-amber-300">E</strong> para sentar na poltrona
            </span>
          )}
        </div>

        {/* Action Buttons: Select Movie / Customize Anime Avatar / Camera View */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveModal((m) => (m === 'movies' ? null : 'movies'))}
            className="cursor-pointer rounded-lg bg-[#5865f2] px-3 py-1.5 text-xs font-extrabold text-white shadow hover:bg-[#4752c4]"
          >
            🎬 Escolher Filme / Colar Link
          </button>

          <button
            type="button"
            onClick={() => setActiveModal((m) => (m === 'wardrobe' ? null : 'wardrobe'))}
            className="cursor-pointer rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-extrabold text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30"
          >
            👘 Personagem Anime & Roupas
          </button>

          <button
            type="button"
            onClick={handleToggleNearestSeat}
            className="cursor-pointer rounded-lg bg-[#2b2d31] px-2.5 py-1.5 text-xs font-bold text-zinc-200 hover:bg-[#35373c]"
          >
            💺 Sentar / Levantar (E)
          </button>

          <div className="flex items-center rounded-lg bg-[#1e1f22] p-0.5 text-[11px]">
            {(
              [
                { id: 'free', label: '🎮 Jogo 3D' },
                { id: 'seat-pov', label: '👀 Poltrona' },
                { id: 'screen-closeup', label: '🖥️ Focar Telão' },
              ] as const
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => setCameraView(cam.id)}
                className={`cursor-pointer rounded-md px-2 py-1 font-bold transition ${
                  cameraView === cam.id
                    ? 'bg-[#5865f2] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN 3D CINEMA VIEWPORT */}
      <div
        className="relative flex-1 overflow-hidden"
        onMouseDown={(e) => {
          if (cameraView !== 'free') return
          isDraggingCamRef.current = true
          lastMouseRef.current = { x: e.clientX, y: e.clientY }
        }}
        onMouseMove={(e) => {
          if (!isDraggingCamRef.current) return
          const dx = e.clientX - lastMouseRef.current.x
          const dy = e.clientY - lastMouseRef.current.y
          lastMouseRef.current = { x: e.clientX, y: e.clientY }
          cameraYawRef.current -= dx * 0.006
          cameraPitchRef.current = Math.max(
            -0.3,
            Math.min(0.65, cameraPitchRef.current + dy * 0.004)
          )
        }}
        onMouseUp={() => {
          isDraggingCamRef.current = false
        }}
        onMouseLeave={() => {
          isDraggingCamRef.current = false
        }}
      >
        {/* Three.js Canvas Container */}
        <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

        {/* PROJECTED GIANT MOVIE SCREEN OVERLAY (Synced for all users!) */}
        {localScreenRect.visible && (
          <div
            style={{
              left: `${localScreenRect.left}px`,
              top: `${localScreenRect.top}px`,
              width: `${localScreenRect.width}px`,
              height: `${localScreenRect.height}px`,
            }}
            className="pointer-events-auto absolute z-10 overflow-hidden rounded border border-indigo-500/40 bg-black shadow-[0_0_50px_rgba(99,102,241,0.45)]"
          >
            {liveScreenStream ? (
              <video
                ref={liveStreamVideoRef}
                autoPlay
                playsInline
                className="h-full w-full bg-black object-contain"
              />
            ) : watchState?.active ? (
              watchState.provider === 'mp4' ? (
                <video
                  ref={htmlVideoRef}
                  src={watchState.embedUrl}
                  controls
                  playsInline
                  onPlay={() => {
                    if (!isApplyingRemoteSyncRef.current && !watchState.isPlaying) {
                      handleGlobalPlayPause(true)
                    }
                  }}
                  onPause={() => {
                    if (!isApplyingRemoteSyncRef.current && watchState.isPlaying) {
                      handleGlobalPlayPause(false)
                    }
                  }}
                  onSeeked={(e) => {
                    if (isApplyingRemoteSyncRef.current || !currentUser) return
                    const vid = e.currentTarget
                    if (Math.abs(vid.currentTime - (watchState.currentTime || 0)) > 2.0) {
                      onUpdateWatchState({
                        ...watchState,
                        hostId: currentUser.id,
                        hostName: currentUser.username,
                        currentTime: vid.currentTime,
                        updatedAt: Date.now(),
                      })
                    }
                  }}
                  className="h-full w-full bg-black object-contain"
                />
              ) : (
                <iframe
                  ref={iframeRef}
                  src={watchState.embedUrl}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              )
            ) : (
              <div
                onClick={() => setActiveModal('movies')}
                className="flex h-full w-full cursor-pointer flex-col items-center justify-center bg-gradient-to-b from-[#131424] to-[#07070c] p-4 text-center hover:brightness-110"
              >
                <div className="text-2xl font-black tracking-wider text-amber-400">
                  🍿 TELÃO DO CINEMA 3D
                </div>
                <p className="mt-1 max-w-md text-xs text-zinc-300">
                  Clique aqui ou em <strong>&quot;🎬 Escolher Filme&quot;</strong> para colocar um
                  filme sincronizado para todo mundo na sala!
                </p>
              </div>
            )}
          </div>
        )}

        {/* BOTTOM FLOATING GAME HUD: Global Synchronized Remote + Emotes */}
        <div className="pointer-events-auto absolute right-4 bottom-3 left-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#111214]/90 px-3.5 py-2 shadow-2xl">
          {/* Left: Emote Bar */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-extrabold text-zinc-400 uppercase">Ações 3D:</span>
            {(
              [
                { id: 'none', label: 'Parado' },
                { id: 'popcorn', label: '🍿 Comer Pipoca' },
                { id: 'wave', label: '👋 Acenar' },
                { id: 'cheer', label: '🙌 Comemorar' },
                { id: 'dance', label: '💃 Dançar' },
              ] as { id: CinemaEmoteType; label: string }[]
            ).map((em) => (
              <button
                key={em.id}
                type="button"
                onClick={() => setMyEmote(em.id)}
                className={`cursor-pointer rounded-md px-2 py-1 text-[11px] font-bold transition ${
                  myEmote === em.id
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#2b2d31] text-zinc-200 hover:bg-[#35373c]'
                }`}
              >
                {em.label}
              </button>
            ))}
          </div>

          {/* Right: Global Movie Sync Controls (Anyone pausing pauses for ALL!) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {watchState?.active && (
              <>
                <button
                  type="button"
                  onClick={() => handleGlobalSeek(-15)}
                  className="cursor-pointer rounded-md bg-[#2b2d31] px-2.5 py-1 text-[11px] font-bold text-zinc-200 hover:bg-[#35373c]"
                  title="Voltar 15 segundos para todos"
                >
                  ⏪ -15s
                </button>
                <button
                  type="button"
                  onClick={() => handleGlobalPlayPause()}
                  className={`cursor-pointer rounded-md px-3.5 py-1 text-xs font-extrabold text-white shadow ${
                    watchState.isPlaying
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-[#23a55a] hover:bg-[#1a7f44]'
                  }`}
                >
                  {watchState.isPlaying ? '⏸ Pausar p/ Todos' : '▶ Dar Play p/ Todos'}
                </button>
                <button
                  type="button"
                  onClick={() => handleGlobalSeek(15)}
                  className="cursor-pointer rounded-md bg-[#2b2d31] px-2.5 py-1 text-[11px] font-bold text-zinc-200 hover:bg-[#35373c]"
                  title="Avançar 15 segundos para todos"
                >
                  +15s ⏩
                </button>
                <button
                  type="button"
                  onClick={handleToggleLights}
                  className="cursor-pointer rounded-md bg-[#2b2d31] px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-[#35373c]"
                >
                  💡 Luzes
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateWatchState(null)}
                  className="cursor-pointer rounded-md bg-[#da373c] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#a1282c]"
                >
                  Desligar Telão
                </button>
              </>
            )}
          </div>
        </div>

        {/* MODAL 1: ANIME CHARACTER & OUTFIT CUSTOMIZER */}
        {activeModal === 'wardrobe' && (
          <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
            <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-500/40 bg-[#18191c] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    👘 Customizar Boneco 3D & Personagens de Anime
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Escolha um personagem pronto ou monte sua roupa, cabelo, chapéu e aura!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="cursor-pointer rounded-md bg-[#2b2d31] px-3 py-1 text-xs font-bold text-zinc-300 hover:text-white"
                >
                  Pronto ✕
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                {/* Anime Character Presets */}
                <div>
                  <label className="mb-2 block text-xs font-extrabold text-amber-400 uppercase">
                    ⚡ Personagens de Anime & Lendas (1 Clique)
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ANIME_PRESETS.map((preset) => {
                      const active = avatarConfig.presetId === preset.id
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setAvatarConfig(preset.config)
                            saveCinemaAvatar(preset.config)
                          }}
                          className={`flex cursor-pointer flex-col items-start rounded-xl border p-2.5 text-left transition ${
                            active
                              ? 'border-amber-400 bg-amber-500/15 text-white ring-1 ring-amber-400'
                              : 'border-white/10 bg-[#232428] text-zinc-300 hover:bg-[#2b2d31]'
                          }`}
                        >
                          <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                            {preset.badge}
                          </span>
                          <span className="mt-1 text-xs font-extrabold">{preset.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Custom Colors */}
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#232428] p-3.5">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-300">
                      👕 Cor da Roupa / Camisa
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={avatarConfig.shirtColor}
                        onChange={(e) =>
                          updateMyAvatar({ presetId: 'custom', shirtColor: e.target.value })
                        }
                        className="h-8 w-14 cursor-pointer rounded border-0 bg-transparent"
                      />
                      <span className="text-xs text-zinc-400">{avatarConfig.shirtColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-300">
                      👖 Cor da Calça
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={avatarConfig.pantsColor}
                        onChange={(e) =>
                          updateMyAvatar({ presetId: 'custom', pantsColor: e.target.value })
                        }
                        className="h-8 w-14 cursor-pointer rounded border-0 bg-transparent"
                      />
                      <span className="text-xs text-zinc-400">{avatarConfig.pantsColor}</span>
                    </div>
                  </div>
                </div>

                {/* Hair, Hat, Accessory, Aura Selectors */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-300">
                      💇 Cabelo Anime
                    </label>
                    <select
                      value={avatarConfig.hairStyle}
                      onChange={(e) =>
                        updateMyAvatar({
                          presetId: 'custom',
                          hairStyle: e.target.value as CinemaHairStyle,
                        })
                      }
                      className="w-full rounded-lg bg-[#232428] px-3 py-2 text-xs font-bold text-white"
                    >
                      <option value="none">Sem Cabelo Extra</option>
                      <option value="spiky-gold">Espetado Super Saiyajin (Dourado)</option>
                      <option value="spiky-black">Espetado Anime (Preto)</option>
                      <option value="ninja-blonde">Ninja Loiro (Naruto)</option>
                      <option value="anime-white">Platinado (Gojo / Cyberpunk)</option>
                      <option value="burgundy">Vinho Caçador (Tanjiro)</option>
                      <option value="afro">Black Power / Afro</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-300">
                      🎩 Chapéu / Cabeça
                    </label>
                    <select
                      value={avatarConfig.hatStyle}
                      onChange={(e) =>
                        updateMyAvatar({
                          presetId: 'custom',
                          hatStyle: e.target.value as CinemaHatStyle,
                        })
                      }
                      className="w-full rounded-lg bg-[#232428] px-3 py-2 text-xs font-bold text-white"
                    >
                      <option value="none">Nenhum</option>
                      <option value="straw-hat">Chapéu de Palha (Luffy)</option>
                      <option value="headband">Bandana Ninja</option>
                      <option value="crown">Coroa Dourada de Rei</option>
                      <option value="wizard">Chapéu de Mago</option>
                      <option value="cat-ears">Orelhas Neon</option>
                      <option value="halo">Auréola de Anjo</option>
                      <option value="horns">Chifres Vermelhos</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-300">
                      🗡️ Acessório / Costas
                    </label>
                    <select
                      value={avatarConfig.accessory}
                      onChange={(e) =>
                        updateMyAvatar({
                          presetId: 'custom',
                          accessory: e.target.value as CinemaAccessoryStyle,
                        })
                      }
                      className="w-full rounded-lg bg-[#232428] px-3 py-2 text-xs font-bold text-white"
                    >
                      <option value="none">Nenhum</option>
                      <option value="katana">Katana nas Costas</option>
                      <option value="cape">Capa de Herói / Akatsuki</option>
                      <option value="blindfold">Venda nos Olhos (Gojo)</option>
                      <option value="glasses">Óculos Cyberpunk</option>
                      <option value="popcorn">Balde de Pipoca na Mão</option>
                      <option value="wings">Asas Douradas</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-300">
                      🔥 Aura de Poder 3D
                    </label>
                    <select
                      value={avatarConfig.aura}
                      onChange={(e) =>
                        updateMyAvatar({
                          presetId: 'custom',
                          aura: e.target.value as CinemaAuraStyle,
                        })
                      }
                      className="w-full rounded-lg bg-[#232428] px-3 py-2 text-xs font-bold text-white"
                    >
                      <option value="none">Sem Aura</option>
                      <option value="super-saiyan">Ki Dourado (Super Saiyajin)</option>
                      <option value="purple-curse">Energia Amaldiçoada (Roxa)</option>
                      <option value="blue-chakra">Chakra Azul</option>
                      <option value="fire-red">Chamas Respiração do Sol</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: SELECT MOVIE / PASTE LINK / STREAM NETFLIX TAB */}
        {activeModal === 'movies' && (
          <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
            <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#5865f2]/50 bg-[#18191c] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    🎬 Colocar Filme ou Vídeo no Telão 3D
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Qualquer usuário pode escolher um filme ou pausar/avançar para todos ao mesmo
                    tempo!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="cursor-pointer rounded-md bg-[#2b2d31] px-3 py-1 text-xs font-bold text-zinc-300 hover:text-white"
                >
                  Fechar ✕
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                {/* Paste Custom URL (YouTube, MP4, Twitch, Kick) */}
                <form
                  onSubmit={handleLoadUrl}
                  className="space-y-2.5 rounded-xl border border-white/10 bg-[#232428] p-4"
                >
                  <label className="block text-xs font-extrabold text-white uppercase">
                    🔗 Colar Link de Filme (.MP4 / YouTube / Twitch / Kick)
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={inputTitle}
                      onChange={(e) => setInputTitle(e.target.value)}
                      placeholder="Nome do Filme (opcional)"
                      className="rounded-lg bg-[#111214] px-3 py-2 text-xs text-white placeholder-zinc-500 sm:w-44 focus:outline-none"
                    />
                    <input
                      type="text"
                      required
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      placeholder="Cole o link do YouTube, arquivo .mp4 direto, Twitch..."
                      className="flex-1 rounded-lg bg-[#111214] px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="cursor-pointer rounded-lg bg-[#5865f2] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#4752c4]"
                    >
                      Passar no Telão
                    </button>
                  </div>
                </form>

                {/* Instant Cinema Catalog (Direct MP4 & YouTube Movies with 100% Sync!) */}
                <div>
                  <label className="mb-2 block text-xs font-extrabold text-amber-400 uppercase">
                    🍿 Catálogo Rápido (Play / Pause / Tempo 100% Sincronizado)
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {CATALOG_MOVIES.map((m) => (
                      <button
                        key={m.title}
                        type="button"
                        onClick={() => handleSelectCatalogMovie(m)}
                        className="flex cursor-pointer flex-col justify-between rounded-xl border border-white/10 bg-[#232428] p-3 text-left transition hover:border-[#5865f2] hover:bg-[#2b2d31]"
                      >
                        <div>
                          <span
                            style={{ backgroundColor: `${m.badgeColor}25`, color: m.badgeColor }}
                            className="rounded px-1.5 py-0.5 text-[10px] font-extrabold"
                          >
                            {m.category} • {m.duration}
                          </span>
                          <div className="mt-1.5 text-xs font-extrabold text-white">{m.title}</div>
                        </div>
                        <div className="mt-2 text-[11px] font-bold text-[#949cf7]">
                          ▶ Rodar no Telão para Todos
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Share Browser Tab directly onto the 3D Screen (Netflix / Prime / Stremio / Anime sites) */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="text-xs font-extrabold text-emerald-300">
                    📡 Quer assistir Netflix, Prime Video, Crunchyroll ou site de Filmes?
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-300">
                    Você pode transmitir a guia do seu navegador com áudio e ela aparece{' '}
                    <strong>direto dentro do Telão 3D do Cinema</strong> para todo mundo assistir
                    sentado nas poltronas!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null)
                      onStartTabShare()
                    }}
                    className="mt-3 cursor-pointer rounded-lg bg-[#23a55a] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#1a7f44]"
                  >
                    Transmitir Aba do Navegador no Telão 3D
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
