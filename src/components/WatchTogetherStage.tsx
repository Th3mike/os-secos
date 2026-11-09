'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import {
  WatchTogetherState,
  UserProfile,
  CinemaAvatarConfig,
  CinemaPlayerState,
  CinemaPresetId,
  CinemaModelType,
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

const AVATAR_STORAGE_KEY = 'os_secos_cinema_avatar_v3'

export const REAL_3D_MODELS: {
  id: CinemaModelType
  name: string
  desc: string
  badge: string
  url: string
}[] = [
  {
    id: 'anime-vrm',
    name: 'Garota Anime 3D (VRoid Studio VRM)',
    desc: 'Personagem oficial de Anime 3D com cabelo, saia, blusa e olhos anime',
    badge: '🌸 Anime VRM Real',
    url: 'https://pixiv.github.io/three-vrm/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm',
  },
  {
    id: 'anime-glasses-vrm',
    name: 'Estudante Anime 3D (VRoid Óculos)',
    desc: 'Modelo VRM de Anime com óculos, uniforme e cabelo longo 3D',
    badge: '👓 Anime VRM 2',
    url: 'https://raw.githubusercontent.com/josephrocca/ChatVRM-js/main/avatars/5575583359519712199.vrm',
  },
  {
    id: 'dancer-girl',
    name: 'Michelle — Garota Streetwear 3D',
    desc: 'Personagem feminina 3D com jaqueta jeans, calça, tênis e dança real',
    badge: '💃 Mixamo 3D',
    url: 'https://threejs.org/examples/models/gltf/Michelle.glb',
  },
  {
    id: 'soldier-tactical',
    name: 'Vanguard — Guerreiro Tático 3D',
    desc: 'Armadura completa, capacete com visor e mochila tática',
    badge: '🪖 Guerreiro 3D',
    url: 'https://threejs.org/examples/models/gltf/Soldier.glb',
  },
  {
    id: 'cyborg-xbot',
    name: 'X-Bot — Lutador / Ninja 3D',
    desc: 'Corpo estilizado de anime/luta com todas as animações Mixamo',
    badge: '⚡ Lutador 3D',
    url: 'https://threejs.org/examples/models/gltf/Xbot.glb',
  },
  {
    id: 'streetwear-rpm',
    name: 'Humano Casual 3D (ReadyPlayerMe)',
    desc: 'Homem 3D com jaqueta, calça, tênis e barba estilizada',
    badge: '👟 Casual 3D',
    url: 'https://threejs.org/examples/models/gltf/readyplayer.me.glb',
  },
  {
    id: 'robot-bot',
    name: 'Robô Mecha Expressivo 3D',
    desc: 'Robô carismático com 14 animações nativas de dança, pulo e saudação',
    badge: '🤖 Mecha 3D',
    url: 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
  },
]

// Distinct 3D models assigned to each preset (no more repeating the bearded man!)
export const ANIME_PRESETS: {
  id: CinemaPresetId
  name: string
  badge: string
  config: CinemaAvatarConfig
}[] = [
  {
    id: 'naruto',
    name: 'Sakura / Garota Anime VRM',
    badge: '🌸 Anime VRM',
    config: {
      presetId: 'naruto',
      modelType: 'anime-vrm',
      shirtColor: '#ec4899',
      pantsColor: '#18181b',
      hairStyle: 'none',
      hatStyle: 'cat-ears',
      accessory: 'popcorn',
      aura: 'none',
    },
  },
  {
    id: 'tanjiro',
    name: 'Caçadora de Onis (Anime VRM)',
    badge: '🗡️ Demon Slayer',
    config: {
      presetId: 'tanjiro',
      modelType: 'anime-glasses-vrm',
      shirtColor: '#10b981',
      pantsColor: '#18181b',
      hairStyle: 'none',
      hatStyle: 'none',
      accessory: 'katana',
      aura: 'fire-red',
    },
  },
  {
    id: 'goku',
    name: 'Guerreiro Super Saiyajin',
    badge: '🐉 DBZ SSJ',
    config: {
      presetId: 'goku',
      modelType: 'cyborg-xbot',
      shirtColor: '#f97316',
      pantsColor: '#1d4ed8',
      hairStyle: 'spiky-gold',
      hatStyle: 'none',
      accessory: 'none',
      aura: 'super-saiyan',
    },
  },
  {
    id: 'gojo',
    name: 'Feiticeiro Jujutsu (Gojo)',
    badge: '🤞 Energia Roxa',
    config: {
      presetId: 'gojo',
      modelType: 'cyborg-xbot',
      shirtColor: '#1e1b4b',
      pantsColor: '#09090b',
      hairStyle: 'anime-white',
      hatStyle: 'none',
      accessory: 'popcorn',
      aura: 'purple-curse',
    },
  },
  {
    id: 'luffy',
    name: 'Pirata Chapéu de Palha',
    badge: '🏴‍☠️ One Piece',
    config: {
      presetId: 'luffy',
      modelType: 'dancer-girl',
      shirtColor: '#dc2626',
      pantsColor: '#2563eb',
      hairStyle: 'none',
      hatStyle: 'straw-hat',
      accessory: 'popcorn',
      aura: 'none',
    },
  },
  {
    id: 'akatsuki',
    name: 'Vanguard — Soldado de Elite',
    badge: '🪖 Tático 3D',
    config: {
      presetId: 'akatsuki',
      modelType: 'soldier-tactical',
      shirtColor: '#991b1b',
      pantsColor: '#111827',
      hairStyle: 'none',
      hatStyle: 'none',
      accessory: 'katana',
      aura: 'fire-red',
    },
  },
  {
    id: 'cyberpunk',
    name: 'Streetwear Casual (RPM)',
    badge: '👟 Casual 3D',
    config: {
      presetId: 'cyberpunk',
      modelType: 'streetwear-rpm',
      shirtColor: '#eab308',
      pantsColor: '#1e293b',
      hairStyle: 'none',
      hatStyle: 'crown',
      accessory: 'popcorn',
      aura: 'blue-chakra',
    },
  },
  {
    id: 'king-seco',
    name: 'Rei Mecha dos Secos',
    badge: '👑 Robô 3D',
    config: {
      presetId: 'king-seco',
      modelType: 'robot-bot',
      shirtColor: '#a855f7',
      pantsColor: '#facc15',
      hairStyle: 'none',
      hatStyle: 'crown',
      accessory: 'wings',
      aura: 'super-saiyan',
    },
  },
]

const CATALOG_MOVIES: {
  title: string
  posterTitle: string
  posterSub: string
  category: string
  duration: string
  provider: WatchTogetherState['provider']
  url: string
  badgeColor: string
  posterBg: string
}[] = [
  {
    title: 'Big Buck Bunny (Animação 3D HD)',
    posterTitle: 'BIG BUCK BUNNY',
    posterSub: 'ANIMAÇÃO 3D • COMÉDIA',
    category: 'Comédia / Curta',
    duration: '10 min',
    provider: 'mp4',
    url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.720p.vp9.webm',
    badgeColor: '#22c55e',
    posterBg: '#14532d',
  },
  {
    title: 'Sintel — O Dragão Guardião',
    posterTitle: 'SINTEL',
    posterSub: 'FANTASIA ÉPICA • DRAGÕES',
    category: 'Fantasia / Ação',
    duration: '15 min',
    provider: 'mp4',
    url: 'https://mdn.github.io/learning-area/javascript/apis/video-audio/finished/video/sintel-short.mp4',
    badgeColor: '#f59e0b',
    posterBg: '#7c2d12',
  },
  {
    title: 'Caminandes: Llamigos (Blender Studio)',
    posterTitle: 'LLAMIGOS',
    posterSub: 'AVENTURA 3D • HUMOR',
    category: 'Animação HD',
    duration: '3 min',
    provider: 'youtube',
    url: 'https://www.youtube.com/watch?v=Z4C82eyhwgU',
    badgeColor: '#0ea5e9',
    posterBg: '#0c4a6e',
  },
  {
    title: 'Spring — O Espírito da Floresta (Blender)',
    posterTitle: 'SPRING',
    posterSub: 'FANTASIA • BLENDER OPEN MOVIE',
    category: 'Fantasia / Curta',
    duration: '8 min',
    provider: 'youtube',
    url: 'https://www.youtube.com/watch?v=WhWc3b3KhnY',
    badgeColor: '#a855f7',
    posterBg: '#4c1d95',
  },
  {
    title: 'Charge — Cyberpunk Sci-Fi (Blender)',
    posterTitle: 'CHARGE',
    posterSub: 'CYBERPUNK • AÇÃO 4K',
    category: 'Ficção Científica',
    duration: '4 min',
    provider: 'youtube',
    url: 'https://www.youtube.com/watch?v=UXqq0ZvbOnk',
    badgeColor: '#ec4899',
    posterBg: '#831843',
  },
  {
    title: 'Lofi Hip Hop Radio — Beats to Chill/Game',
    posterTitle: 'LOFI RADIO',
    posterSub: 'AO VIVO 24/7 • MÚSICA',
    category: 'YouTube Ao Vivo',
    duration: 'LIVE',
    provider: 'youtube',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    badgeColor: '#ef4444',
    posterBg: '#7f1d1d',
  },
]

// 36 Plush Cinema Armchairs across 4 Tiered Stadium Rows (9 seats per row, with side aisles!)
export const CINEMA_SEATS: { index: number; row: number; x: number; y: number; z: number }[] = (() => {
  const list: { index: number; row: number; x: number; y: number; z: number }[] = []
  const rowConfigs = [
    { row: 1, z: -6.2, y: 0.1 },
    { row: 2, z: -2.4, y: 0.65 },
    { row: 3, z: 1.4, y: 1.25 },
    { row: 4, z: 5.2, y: 1.85 },
  ]
  const xCols = [-8.8, -6.6, -4.4, -2.2, 0.0, 2.2, 4.4, 6.6, 8.8]
  let idx = 0
  for (const r of rowConfigs) {
    for (const x of xCols) {
      list.push({ index: idx++, row: r.row, x, y: r.y, z: r.z })
    }
  }
  return list
})()

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

    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url.pathname)) {
      return {
        provider: 'mp4',
        embedUrl: trimmed,
      }
    }

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

    if (url.hostname.includes('spotify.com')) {
      const cleanPath = url.pathname.replace(/^\/intl-[a-z]+\//i, '/')
      return {
        provider: 'spotify',
        embedUrl: `https://open.spotify.com/embed${cleanPath}?utm_source=generator&theme=0`,
      }
    }

    if (url.hostname.includes('twitch.tv')) {
      const channel = url.pathname.split('/').filter(Boolean)[0]
      if (channel && typeof window !== 'undefined') {
        return {
          provider: 'twitch',
          embedUrl: `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`,
        }
      }
    }

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

// ============================================================================
// REAL GLTF / VRM 3D ASSET LOADER & ANIMATION CACHE
// ============================================================================
let sharedGltfLoader: GLTFLoader | null = null
const gltfPromiseCache = new Map<string, Promise<GLTF>>()
const sharedMocapClips: Record<string, THREE.AnimationClip> = {}
const mocapClipListeners = new Set<() => void>()

function getGltfLoader(): GLTFLoader {
  if (!sharedGltfLoader) {
    sharedGltfLoader = new GLTFLoader()
    sharedGltfLoader.setCrossOrigin('anonymous')
    sharedGltfLoader.register((parser) => new VRMLoaderPlugin(parser))
  }
  return sharedGltfLoader
}

function loadCachedGLTF(url: string): Promise<GLTF> {
  const existing = gltfPromiseCache.get(url)
  if (existing) return existing

  const promise = new Promise<GLTF>((resolve, reject) => {
    getGltfLoader().load(
      url,
      (gltf) => resolve(gltf),
      undefined,
      (err) => {
        gltfPromiseCache.delete(url)
        reject(err)
      }
    )
  })
  gltfPromiseCache.set(url, promise)
  return promise
}

let mocapPreloadStarted = false
function ensureMocapClipsLoaded() {
  if (mocapPreloadStarted) return
  mocapPreloadStarted = true

  loadCachedGLTF('https://threejs.org/examples/models/gltf/Xbot.glb')
    .then((gltf) => {
      gltf.animations.forEach((clip) => {
        sharedMocapClips[clip.name.toLowerCase()] = clip
      })
      mocapClipListeners.forEach((cb) => cb())
    })
    .catch(() => {})

  loadCachedGLTF('https://threejs.org/examples/models/gltf/Michelle.glb')
    .then((gltf) => {
      gltf.animations.forEach((clip) => {
        if (clip.name.toLowerCase().includes('dance')) {
          sharedMocapClips['sambadance'] = clip
        }
      })
      mocapClipListeners.forEach((cb) => cb())
    })
    .catch(() => {})
}

// Maps Mixamo bone names onto BOTH ReadyPlayerMe (`Hips`) AND VRoid VRM (`J_Bip_C_Hips`) skeletons!
const MIXAMO_TO_VRM_BONE_MAP: Record<string, string> = {
  'mixamorig:Hips': 'J_Bip_C_Hips',
  'mixamorig:Spine': 'J_Bip_C_Spine',
  'mixamorig:Spine1': 'J_Bip_C_Chest',
  'mixamorig:Spine2': 'J_Bip_C_UpperChest',
  'mixamorig:Neck': 'J_Bip_C_Neck',
  'mixamorig:Head': 'J_Bip_C_Head',
  'mixamorig:LeftArm': 'J_Bip_L_UpperArm',
  'mixamorig:LeftForeArm': 'J_Bip_L_LowerArm',
  'mixamorig:LeftHand': 'J_Bip_L_Hand',
  'mixamorig:RightArm': 'J_Bip_R_UpperArm',
  'mixamorig:RightForeArm': 'J_Bip_R_LowerArm',
  'mixamorig:RightHand': 'J_Bip_R_Hand',
  'mixamorig:LeftUpLeg': 'J_Bip_L_UpperLeg',
  'mixamorig:LeftLeg': 'J_Bip_L_LowerLeg',
  'mixamorig:LeftFoot': 'J_Bip_L_Foot',
  'mixamorig:RightUpLeg': 'J_Bip_R_UpperLeg',
  'mixamorig:RightLeg': 'J_Bip_R_LowerLeg',
  'mixamorig:RightFoot': 'J_Bip_R_Foot',
}

function retargetClipForRoot(
  clip: THREE.AnimationClip,
  modelRoot: THREE.Object3D
): THREE.AnimationClip {
  const hasMixamoPrefix = Boolean(
    modelRoot.getObjectByName('mixamorig:Hips') || modelRoot.getObjectByName('mixamorigHips')
  )
  const isVrmSkeleton = Boolean(modelRoot.getObjectByName('J_Bip_C_Hips'))

  const cloned = clip.clone()
  const validTracks: THREE.KeyframeTrack[] = []

  cloned.tracks.forEach((track) => {
    const dotIdx = track.name.indexOf('.')
    if (dotIdx === -1) return
    let nodeName = track.name.slice(0, dotIdx)
    const propName = track.name.slice(dotIdx)

    // Skip root position translations on VRM so legs don't stretch
    if (isVrmSkeleton && propName === '.position') return

    if (isVrmSkeleton && MIXAMO_TO_VRM_BONE_MAP[nodeName]) {
      const mapped = MIXAMO_TO_VRM_BONE_MAP[nodeName]
      if (modelRoot.getObjectByName(mapped)) {
        nodeName = mapped
      }
    } else if (!hasMixamoPrefix && nodeName.startsWith('mixamorig:')) {
      const stripped = nodeName.replace('mixamorig:', '')
      if (modelRoot.getObjectByName(stripped)) {
        nodeName = stripped
      }
    }

    if (modelRoot.getObjectByName(nodeName)) {
      const newTrack = track.clone()
      newTrack.name = `${nodeName}${propName}`
      validTracks.push(newTrack)
    }
  })

  return new THREE.AnimationClip(clip.name, clip.duration, validTracks)
}

function createMoviePosterTexture(
  title: string,
  subtitle: string,
  bgColor: string,
  accentColor: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 576
  const ctx = canvas.getContext('2d')!

  // Poster Gradient Background
  const grad = ctx.createLinearGradient(0, 0, 0, 576)
  grad.addColorStop(0, bgColor)
  grad.addColorStop(1, '#09090b')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 384, 576)

  // Glowing Neon Frame
  ctx.strokeStyle = accentColor
  ctx.lineWidth = 14
  ctx.strokeRect(12, 12, 360, 552)

  // Top "EM CARTAZ" header
  ctx.fillStyle = accentColor
  ctx.fillRect(42, 40, 300, 48)
  ctx.fillStyle = '#09090b'
  ctx.font = '900 26px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('🍿 EM CARTAZ • 3D', 192, 73)

  // Decorative center artwork emblem
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.arc(192, 260, 96, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = accentColor
  ctx.lineWidth = 5
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.font = '900 68px sans-serif'
  ctx.fillText('🎬', 192, 282)

  // Movie Title
  ctx.fillStyle = '#ffffff'
  ctx.font = '900 36px sans-serif'
  ctx.fillText(title.slice(0, 16), 192, 430)

  // Subtitle
  ctx.fillStyle = accentColor
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(subtitle, 192, 475)

  ctx.fillStyle = '#a1a1aa'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText('CINE OS SECOS • IMAX 120FPS', 192, 525)

  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  return tex
}

function createFloatingUserBadge(
  avatarUrl: string,
  username: string,
  loadingText?: string
): { sprite: THREE.Sprite; updateStatus: (loading?: string) => void } {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 88
  const ctx = canvas.getContext('2d')!
  let loadedImg: HTMLImageElement | undefined
  let curLoading = loadingText

  const draw = () => {
    ctx.clearRect(0, 0, 320, 88)
    ctx.fillStyle = 'rgba(15, 17, 23, 0.88)'
    ctx.strokeStyle = curLoading ? '#38bdf8' : '#f59e0b'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.roundRect(6, 8, 308, 72, 36)
    ctx.fill()
    ctx.stroke()

    if (loadedImg) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(44, 44, 26, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(loadedImg, 18, 18, 52, 52)
      ctx.restore()
    } else {
      ctx.fillStyle = '#5865f2'
      ctx.beginPath()
      ctx.arc(44, 44, 26, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = '#ffffff'
    ctx.font = '900 24px sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(username.slice(0, 13), 82, curLoading ? 34 : 46)

    if (curLoading) {
      ctx.fillStyle = '#38bdf8'
      ctx.font = 'bold 15px sans-serif'
      ctx.fillText(curLoading, 82, 58)
    }
  }

  draw()
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(1.45, 0.4, 1)
  sprite.position.set(0, 2.38, 0)

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    loadedImg = img
    draw()
    tex.needsUpdate = true
  }
  img.src = avatarUrl

  return {
    sprite,
    updateStatus: (loading?: string) => {
      curLoading = loading
      draw()
      tex.needsUpdate = true
    },
  }
}

function createDetailed3DPopcornBucket(): {
  bucketGroup: THREE.Group
  eatingKernel: THREE.Mesh
} {
  const bucketGroup = new THREE.Group()

  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#dc2626' : '#fef2f2'
    ctx.fillRect(i * 16, 0, 16, 128)
  }
  ctx.fillStyle = '#facc15'
  ctx.fillRect(48, 36, 160, 56)
  ctx.fillStyle = '#7f1d1d'
  ctx.font = '900 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('PIPOCA', 128, 74)

  const tubTex = new THREE.CanvasTexture(canvas)
  const tubMat = new THREE.MeshStandardMaterial({ map: tubTex, roughness: 0.4 })
  const tubMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.34, 20), tubMat)
  bucketGroup.add(tubMesh)

  const kernelMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xca8a04,
    emissiveIntensity: 0.2,
    roughness: 0.6,
  })
  const kernelGeo = new THREE.DodecahedronGeometry(0.048, 1)
  for (let i = 0; i < 18; i++) {
    const k = new THREE.Mesh(kernelGeo, kernelMat)
    const angle = (i / 18) * Math.PI * 2
    const r = (i % 3) * 0.05
    k.position.set(Math.cos(angle) * r, 0.17 + (i % 2) * 0.035, Math.sin(angle) * r)
    k.rotation.set(i, i * 0.7, 0)
    bucketGroup.add(k)
  }

  const eatingKernel = new THREE.Mesh(new THREE.DodecahedronGeometry(0.055, 1), kernelMat)
  eatingKernel.visible = false

  return { bucketGroup, eatingKernel }
}

interface BoneRig {
  hips?: THREE.Object3D
  spine?: THREE.Object3D
  neck?: THREE.Object3D
  head?: THREE.Object3D
  leftUpperArm?: THREE.Object3D
  leftLowerArm?: THREE.Object3D
  leftHand?: THREE.Object3D
  rightUpperArm?: THREE.Object3D
  rightLowerArm?: THREE.Object3D
  rightHand?: THREE.Object3D
  leftUpperLeg?: THREE.Object3D
  leftLowerLeg?: THREE.Object3D
  rightUpperLeg?: THREE.Object3D
  rightLowerLeg?: THREE.Object3D
}

function findBone(root: THREE.Object3D, names: string[]): THREE.Object3D | undefined {
  for (const name of names) {
    const exact = root.getObjectByName(name)
    if (exact) return exact
  }
  let found: THREE.Object3D | undefined
  root.traverse((obj) => {
    if (found) return
    const lower = obj.name.toLowerCase()
    for (const candidate of names) {
      if (lower.endsWith(candidate.toLowerCase())) {
        found = obj
        return
      }
    }
  })
  return found
}

function extractBoneRig(root: THREE.Object3D): BoneRig {
  return {
    hips: findBone(root, ['mixamorig:Hips', 'Hips', 'J_Bip_C_Hips']),
    spine: findBone(root, ['mixamorig:Spine1', 'Spine1', 'mixamorig:Spine', 'Spine', 'J_Bip_C_Spine']),
    neck: findBone(root, ['mixamorig:Neck', 'Neck', 'J_Bip_C_Neck']),
    head: findBone(root, ['mixamorig:Head', 'Head', 'J_Bip_C_Head']),
    leftUpperArm: findBone(root, ['mixamorig:LeftArm', 'LeftArm', 'J_Bip_L_UpperArm', 'Arm.L']),
    leftLowerArm: findBone(root, ['mixamorig:LeftForeArm', 'LeftForeArm', 'J_Bip_L_LowerArm']),
    leftHand: findBone(root, ['mixamorig:LeftHand', 'LeftHand', 'J_Bip_L_Hand', 'Hand.L']),
    rightUpperArm: findBone(root, ['mixamorig:RightArm', 'RightArm', 'J_Bip_R_UpperArm', 'Arm.R']),
    rightLowerArm: findBone(root, ['mixamorig:RightForeArm', 'RightForeArm', 'J_Bip_R_LowerArm']),
    rightHand: findBone(root, ['mixamorig:RightHand', 'RightHand', 'J_Bip_R_Hand', 'Hand.R']),
    leftUpperLeg: findBone(root, ['mixamorig:LeftUpLeg', 'LeftUpLeg', 'J_Bip_L_UpperLeg', 'Leg.L']),
    leftLowerLeg: findBone(root, ['mixamorig:LeftLeg', 'LeftLeg', 'J_Bip_L_LowerLeg', 'LowerLeg.L']),
    rightUpperLeg: findBone(root, ['mixamorig:RightUpLeg', 'RightUpLeg', 'J_Bip_R_UpperLeg', 'Leg.R']),
    rightLowerLeg: findBone(root, ['mixamorig:RightLeg', 'RightLeg', 'J_Bip_R_LowerLeg', 'LowerLeg.R']),
  }
}

interface CinemaCharacterInstance {
  root: THREE.Group
  modelContainer: THREE.Group
  mixer: THREE.AnimationMixer | null
  actions: Record<string, THREE.AnimationAction>
  activeActionName: string
  rig: BoneRig
  popcornBucket: THREE.Group
  eatingKernel: THREE.Mesh
  popcornCrumbs: { mesh: THREE.Mesh; vy: number; vx: number; vz: number; life: number }[]
  auraMesh: THREE.Mesh | null
  talkRing: THREE.Mesh
  configSignature: string
  isVrm: boolean
  cleanup?: () => void
}

function attachCosmeticsToRig(rig: BoneRig, root: THREE.Group, config: CinemaAvatarConfig) {
  const headTarget = rig.head || root
  const isBoneHead = Boolean(rig.head)
  const headScale = isBoneHead ? 0.55 : 1

  if (config.hairStyle !== 'none') {
    const hairGroup = new THREE.Group()
    hairGroup.scale.setScalar(headScale)
    hairGroup.position.y = isBoneHead ? 0.14 : 1.9
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
    const hairMat = new THREE.MeshStandardMaterial({
      color: hairColorMap[config.hairStyle] || 0xfacc15,
      roughness: 0.35,
    })

    if (config.hairStyle === 'afro') {
      const afro = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), hairMat)
      afro.position.set(0, 0.16, -0.04)
      hairGroup.add(afro)
    } else {
      const spikes = [
        [0, 0.36, 0, 0, 0],
        [-0.22, 0.3, 0, 0, 0.58],
        [0.22, 0.3, 0, 0, -0.58],
        [-0.28, 0.16, -0.1, -0.2, 0.9],
        [0.28, 0.16, -0.1, -0.2, -0.9],
        [0, 0.3, -0.22, -0.65, 0],
        [-0.15, 0.32, 0.16, 0.45, 0.3],
        [0.15, 0.32, 0.16, 0.45, -0.3],
      ]
      spikes.forEach(([sx, sy, sz, rx, rz]) => {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 8), hairMat)
        cone.position.set(sx, sy, sz)
        cone.rotation.set(rx, 0, rz)
        hairGroup.add(cone)
      })
    }
    headTarget.add(hairGroup)
  }

  if (config.hatStyle !== 'none') {
    const hatWrap = new THREE.Group()
    hatWrap.scale.setScalar(headScale)
    hatWrap.position.y = isBoneHead ? 0.22 : 2.1

    if (config.hatStyle === 'straw-hat') {
      const strawMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 })
      const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xdc2626 })
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.04, 24), strawMat)
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        strawMat
      )
      const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 24), ribbonMat)
      ribbon.position.y = 0.05
      hatWrap.add(brim, dome, ribbon)
    } else if (config.hatStyle === 'crown') {
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.8,
        roughness: 0.2,
      })
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.2, 16), goldMat)
      hatWrap.add(base)
    } else if (config.hatStyle === 'wizard') {
      const wizMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.5 })
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.04, 20), wizMat)
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.72, 16), wizMat)
      cone.position.y = 0.36
      hatWrap.add(brim, cone)
    } else if (config.hatStyle === 'cat-ears') {
      const earMat = new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xbe185d,
        emissiveIntensity: 0.4,
      })
      const lEar = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 4), earMat)
      lEar.position.set(-0.18, 0.08, 0)
      const rEar = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 4), earMat)
      rEar.position.set(0.18, 0.08, 0)
      hatWrap.add(lEar, rEar)
    } else if (config.hatStyle === 'halo') {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.035, 12, 28),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      )
      halo.rotation.x = Math.PI / 2
      halo.position.y = 0.18
      hatWrap.add(halo)
    } else if (config.hatStyle === 'horns') {
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
      const lH = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 10), hornMat)
      lH.position.set(-0.18, 0.1, 0)
      lH.rotation.z = 0.35
      const rH = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 10), hornMat)
      rH.position.set(0.18, 0.1, 0)
      rH.rotation.z = -0.35
      hatWrap.add(lH, rH)
    }
    headTarget.add(hatWrap)
  }

  const spineTarget = rig.spine || root
  const isBoneSpine = Boolean(rig.spine)
  if (config.accessory === 'katana') {
    const katanaGroup = new THREE.Group()
    const sheath = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.022, 0.95, 12),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3 })
    )
    const guard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.02, 16),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8 })
    )
    guard.position.y = 0.48
    const hilt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.26, 12),
      new THREE.MeshStandardMaterial({ color: 0x991b1b })
    )
    hilt.position.y = 0.62
    katanaGroup.add(sheath, guard, hilt)
    katanaGroup.position.set(0, isBoneSpine ? 0.1 : 1.2, -0.18)
    katanaGroup.rotation.z = 0.62
    spineTarget.add(katanaGroup)
  } else if (config.accessory === 'wings') {
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.25,
      roughness: 0.3,
    })
    const lWing = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.04), wingMat)
    lWing.position.set(-0.38, isBoneSpine ? 0.15 : 1.25, -0.18)
    lWing.rotation.z = 0.35
    const rWing = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.04), wingMat)
    rWing.position.set(0.38, isBoneSpine ? 0.15 : 1.25, -0.18)
    rWing.rotation.z = -0.35
    spineTarget.add(lWing, rWing)
  }
}

function createCinemaCharacterInstance(
  user: UserProfile,
  config: CinemaAvatarConfig
): CinemaCharacterInstance {
  ensureMocapClipsLoaded()

  const root = new THREE.Group()
  const modelContainer = new THREE.Group()
  root.add(modelContainer)

  const { sprite: badge, updateStatus } = createFloatingUserBadge(
    user.avatar_url,
    user.username,
    'Carregando 3D...'
  )
  root.add(badge)

  const talkRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 28),
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

  const { bucketGroup: popcornBucket, eatingKernel } = createDetailed3DPopcornBucket()
  popcornBucket.position.set(-0.28, 1.05, 0.26)
  popcornBucket.visible = config.accessory === 'popcorn'
  root.add(popcornBucket)
  root.add(eatingKernel)

  const popcornCrumbs: { mesh: THREE.Mesh; vy: number; vx: number; vz: number; life: number }[] = []
  const crumbGeo = new THREE.DodecahedronGeometry(0.032, 0)
  const crumbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a })
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(crumbGeo, crumbMat)
    m.visible = false
    root.add(m)
    popcornCrumbs.push({ mesh: m, vy: 0, vx: 0, vz: 0, life: 0 })
  }

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
      new THREE.ConeGeometry(0.75, 2.35, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: auraColorMap[config.aura] || 0xfacc15,
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
      })
    )
    auraMesh.position.y = 1.15
    root.add(auraMesh)
  }

  const instance: CinemaCharacterInstance = {
    root,
    modelContainer,
    mixer: null,
    actions: {},
    activeActionName: '',
    rig: {},
    popcornBucket,
    eatingKernel,
    popcornCrumbs,
    auraMesh,
    talkRing,
    configSignature: JSON.stringify(config),
    isVrm: false,
  }

  const modelType: CinemaModelType = config.modelType || 'anime-vrm'
  const presetModel = REAL_3D_MODELS.find((m) => m.id === modelType) || REAL_3D_MODELS[0]
  const targetUrl =
    modelType === 'custom-url' && config.customModelUrl?.trim()
      ? config.customModelUrl.trim()
      : presetModel.url

  loadCachedGLTF(targetUrl)
    .then((gltf) => {
      updateStatus(undefined)
      const vrm = gltf.userData?.vrm
      let clonedScene: THREE.Object3D

      if (vrm && vrm.scene) {
        clonedScene = SkeletonUtils.clone(vrm.scene)
        instance.isVrm = true
        // VRM 0.x models face -Z by default; rotate if needed so all models face the same direction
        if (targetUrl.includes('ChatVRM')) {
          clonedScene.rotation.y = Math.PI
        }
      } else {
        clonedScene = SkeletonUtils.clone(gltf.scene)
      }

      const box = new THREE.Box3().setFromObject(clonedScene)
      const size = new THREE.Vector3()
      box.getSize(size)
      if (size.y > 0.01) {
        const scale = 1.82 / size.y
        clonedScene.scale.setScalar(scale)
      }

      const shirtColor = new THREE.Color(config.shirtColor || '#f97316')
      const pantsColor = new THREE.Color(config.pantsColor || '#1d4ed8')

      clonedScene.traverse((node) => {
        const mesh = node as THREE.Mesh
        if (!mesh.isMesh || !mesh.material) return
        const cloneAndTint = (mat: THREE.Material) => {
          const m = mat.clone() as THREE.MeshStandardMaterial
          const matName = (m.name || mesh.name || '').toLowerCase()
          if (
            matName.includes('top') ||
            matName.includes('shirt') ||
            matName.includes('onepiece') ||
            matName.includes('main') ||
            matName.includes('vanguardbodymat') ||
            matName.includes('highlimbs')
          ) {
            if (m.color) m.color.lerp(shirtColor, 0.58)
          } else if (
            matName.includes('bottom') ||
            matName.includes('pants') ||
            matName.includes('joints') ||
            matName.includes('grey')
          ) {
            if (m.color) m.color.lerp(pantsColor, 0.58)
          }
          return m
        }

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(cloneAndTint)
        } else {
          mesh.material = cloneAndTint(mesh.material)
        }
      })

      modelContainer.add(clonedScene)

      instance.rig = extractBoneRig(clonedScene)

      // Relax T-pose arms down naturally for VRM models if no idle clip is active yet
      if (instance.isVrm) {
        if (instance.rig.leftUpperArm) instance.rig.leftUpperArm.rotation.z = 1.15
        if (instance.rig.rightUpperArm) instance.rig.rightUpperArm.rotation.z = -1.15
      }

      if (instance.rig.leftHand) {
        instance.rig.leftHand.add(popcornBucket)
        popcornBucket.position.set(0, 0.08, 0.12)
        popcornBucket.scale.setScalar(0.85)
      }
      if (instance.rig.rightHand) {
        instance.rig.rightHand.add(eatingKernel)
        eatingKernel.position.set(0, 0.05, 0.05)
      }

      attachCosmeticsToRig(instance.rig, modelContainer, config)

      const mixer = new THREE.AnimationMixer(clonedScene)
      instance.mixer = mixer

      const registerClips = () => {
        const allClips = [...(gltf.animations || [])]
        Object.values(sharedMocapClips).forEach((mc) => {
          const retargeted = retargetClipForRoot(mc, clonedScene)
          if (retargeted.tracks.length > 0) {
            allClips.push(retargeted)
          }
        })
        allClips.forEach((clip) => {
          const key = clip.name.toLowerCase()
          if (!instance.actions[key]) {
            instance.actions[key] = mixer.clipAction(clip)
          }
        })
      }

      registerClips()
      mocapClipListeners.add(registerClips)
      instance.cleanup = () => {
        mocapClipListeners.delete(registerClips)
      }
    })
    .catch((err) => {
      updateStatus('Erro 3D')
      console.warn('3D Model fallback:', err)
    })

  return instance
}

function playCharacterClip(char: CinemaCharacterInstance, desiredNames: string[]) {
  if (!char.mixer) return false
  for (const name of desiredNames) {
    const action = char.actions[name.toLowerCase()]
    if (action) {
      if (char.activeActionName !== name.toLowerCase()) {
        const prev = char.actions[char.activeActionName]
        if (prev) prev.fadeOut(0.2)
        action.reset().fadeIn(0.2).play()
        char.activeActionName = name.toLowerCase()
      }
      return true
    }
  }
  return false
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

  const mountRef = useRef<HTMLDivElement | null>(null)
  const css3dMountRef = useRef<HTMLDivElement | null>(null)
  const screenDomRef = useRef<HTMLDivElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const htmlVideoRef = useRef<HTMLVideoElement | null>(null)
  const liveStreamVideoRef = useRef<HTMLVideoElement | null>(null)
  const videoTextureRef = useRef<THREE.VideoTexture | null>(null)
  const liveTextureRef = useRef<THREE.VideoTexture | null>(null)
  const isApplyingRemoteSyncRef = useRef(false)

  const myPosRef = useRef<{
    x: number
    y: number
    z: number
    rotY: number
    seatIndex: number | null
  }>({
    x: 0,
    y: 1.85,
    z: 8.5,
    rotY: Math.PI,
    seatIndex: null,
  })
  const keysPressedRef = useRef<Record<string, boolean>>({})
  const cameraYawRef = useRef<number>(0)
  const cameraPitchRef = useRef<number>(0.18)
  const isDraggingCamRef = useRef<boolean>(false)
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const cinemaPlayersRef = useRef(cinemaPlayers)
  const roomPeersRef = useRef(roomPeers)
  const speakingPeersRef = useRef(speakingPeers)
  const isSelfSpeakingRef = useRef(isSelfSpeaking)
  const avatarConfigRef = useRef(avatarConfig)
  const myEmoteRef = useRef(myEmote)
  const cameraViewRef = useRef(cameraView)
  const watchStateRef = useRef(watchState)
  const liveScreenStreamRef = useRef(liveScreenStream)
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
    liveScreenStreamRef.current = liveScreenStream
  }, [liveScreenStream])
  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])
  useEffect(() => {
    onBroadcastRef.current = onBroadcastCinemaState
  }, [onBroadcastCinemaState])

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

  // Bind live WebRTC screen share stream onto true 3D THREE.VideoTexture!
  useEffect(() => {
    const el = liveStreamVideoRef.current
    if (!el || !liveScreenStream) {
      liveTextureRef.current = null
      return
    }
    if (el.srcObject !== liveScreenStream) {
      el.srcObject = liveScreenStream
      el.play().catch(() => {})
    }
    const vTex = new THREE.VideoTexture(el)
    vTex.minFilter = THREE.LinearFilter
    vTex.magFilter = THREE.LinearFilter
    vTex.colorSpace = THREE.SRGBColorSpace
    liveTextureRef.current = vTex

    return () => {
      vTex.dispose()
      liveTextureRef.current = null
    }
  }, [liveScreenStream])

  // Bind HTML5 MP4/WebM video onto true 3D THREE.VideoTexture & sync play/pause/seek!
  useEffect(() => {
    const vid = htmlVideoRef.current
    if (!vid || !watchState || watchState.provider !== 'mp4') {
      videoTextureRef.current = null
      return
    }

    if (!videoTextureRef.current) {
      const vTex = new THREE.VideoTexture(vid)
      vTex.minFilter = THREE.LinearFilter
      vTex.magFilter = THREE.LinearFilter
      vTex.colorSpace = THREE.SRGBColorSpace
      videoTextureRef.current = vTex
    }

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

  // Sync YouTube Iframe play/pause + seek
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = e.key.toLowerCase()
      keysPressedRef.current[k] = true
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
      myPosRef.current = {
        ...cur,
        z: cur.z + 1.15,
        seatIndex: null,
      }
    } else {
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
        rotY: Math.PI,
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

  // =========================================================================
  // MAIN 3D IMAX MEGA-THEATER ENGINE (WebGLRenderer + CSS3DRenderer for Fixed 3D Screen!)
  // =========================================================================
  useEffect(() => {
    if (!mountRef.current || !css3dMountRef.current || !screenDomRef.current) return
    const container = mountRef.current
    const cssContainer = css3dMountRef.current
    const screenElement = screenDomRef.current

    let width = container.clientWidth || 960
    let height = container.clientHeight || 540

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x06060b)
    scene.fog = new THREE.FogExp2(0x06060b, 0.011)

    const cssScene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 140)

    // 1. CSS3DRenderer renders the YouTube/Twitch Iframe with TRUE 3D Perspective Matrix at (0, 6.6, -15.6)!
    // It NEVER slides or resizes like a 2D overlay — it stays physically anchored on the cinema wall!
    const cssRenderer = new CSS3DRenderer()
    cssRenderer.setSize(width, height)
    cssRenderer.domElement.style.position = 'absolute'
    cssRenderer.domElement.style.top = '0'
    cssRenderer.domElement.style.left = '0'
    cssRenderer.domElement.style.pointerEvents = 'none'
    cssContainer.innerHTML = ''
    cssContainer.appendChild(cssRenderer.domElement)

    const cssScreenObject = new CSS3DObject(screenElement)
    // 1280x720 DOM element scaled by 0.0165 => 21.12m wide x 11.88m tall in 3D world units!
    cssScreenObject.scale.setScalar(0.0165)
    cssScreenObject.position.set(0, 6.6, -15.58)
    cssScene.add(cssScreenObject)

    // 2. WebGLRenderer for the 3D Theater Architecture, 36 Seats, Movie Posters & GLTF/VRM Characters
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'low-power',
    })
    renderer.setPixelRatio(1)
    renderer.setSize(width, height)
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Theater Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x2e1065, 1.35)
    scene.add(hemiLight)

    const screenBounceLight = new THREE.PointLight(0x818cf8, 4.2, 38)
    screenBounceLight.position.set(0, 6.2, -12.5)
    scene.add(screenBounceLight)

    const ceilingLight = new THREE.DirectionalLight(0xfff7ed, 1.45)
    ceilingLight.position.set(5, 18, 10)
    scene.add(ceilingLight)

    // 3. Expanded Grand IMAX Auditorium Floor, Walls & Tiered Stadium Platforms
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 40),
      new THREE.MeshStandardMaterial({ color: 0x26070e, roughness: 0.85 })
    )
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)

    // Side & Back Auditorium Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0d0e15, roughness: 0.9 })
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 15, 36), wallMat)
    leftWall.position.set(-15.5, 7.5, -2)
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 15, 36), wallMat)
    rightWall.position.set(15.5, 7.5, -2)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(32, 15, 0.6), wallMat)
    backWall.position.set(0, 7.5, 14)
    scene.add(leftWall, rightWall, backWall)

    // 6 Glowing Framed Movie Posters along Left & Right Cinema Walls!
    CATALOG_MOVIES.forEach((m, idx) => {
      const isLeft = idx < 3
      const slot = idx % 3
      const zPos = -8.5 + slot * 6.5
      const xPos = isLeft ? -15.1 : 15.1

      const posterGroup = new THREE.Group()
      const frameMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 4.2, 2.8),
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0x78350f,
          emissiveIntensity: 0.35,
          roughness: 0.3,
        })
      )
      posterGroup.add(frameMesh)

      const posterTex = createMoviePosterTexture(
        m.posterTitle,
        m.posterSub,
        m.posterBg,
        m.badgeColor
      )
      const posterPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.55, 3.9),
        new THREE.MeshBasicMaterial({ map: posterTex })
      )
      posterPlane.rotation.y = isLeft ? Math.PI / 2 : -Math.PI / 2
      posterPlane.position.x = isLeft ? 0.11 : -0.11
      posterGroup.add(posterPlane)

      posterGroup.position.set(xPos, 5.2, zPos)
      scene.add(posterGroup)
    })

    // Glowing LED aisle floor strips + illuminated steps
    const stripGeo = new THREE.PlaneGeometry(0.22, 24)
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    const leftStrip = new THREE.Mesh(stripGeo, stripMat)
    leftStrip.rotation.x = -Math.PI / 2
    leftStrip.position.set(-10.8, 0.03, -1)
    const rightStrip = new THREE.Mesh(stripGeo, stripMat)
    rightStrip.rotation.x = -Math.PI / 2
    rightStrip.position.set(10.8, 0.03, -1)
    scene.add(leftStrip, rightStrip)

    // 4 Tiered Stadium Platforms (Rows 2, 3, 4 + Rear Lobby Deck)
    const tierMat = new THREE.MeshStandardMaterial({ color: 0x16171d, roughness: 0.85 })
    const tier2 = new THREE.Mesh(new THREE.BoxGeometry(24, 0.55, 16.5), tierMat)
    tier2.position.set(0, 0.275, 4.0)
    const tier3 = new THREE.Mesh(new THREE.BoxGeometry(24, 0.6, 12.6), tierMat)
    tier3.position.set(0, 0.85, 5.9)
    const tier4 = new THREE.Mesh(new THREE.BoxGeometry(24, 0.6, 8.8), tierMat)
    tier4.position.set(0, 1.45, 7.8)
    scene.add(tier2, tier3, tier4)

    // 4. Giant IMAX Stage & Fixed 3D Movie Screen at Z = -15.6
    const stageBase = new THREE.Mesh(
      new THREE.BoxGeometry(26, 1.1, 3.8),
      new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.7 })
    )
    stageBase.position.set(0, 0.55, -14.8)
    scene.add(stageBase)

    const screenBorder = new THREE.Mesh(
      new THREE.BoxGeometry(22.2, 12.6, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.4 })
    )
    screenBorder.position.set(0, 6.6, -15.85)
    scene.add(screenBorder)

    // Idle standby texture on the 3D screen when no video is playing
    const standbyTex = createMoviePosterTexture(
      'CINE OS SECOS',
      'CLIQUE EM ESCOLHER FILME PARA INICIAR',
      '#1e1b4b',
      '#f59e0b'
    )
    const screenMat = new THREE.MeshBasicMaterial({ map: standbyTex })
    const screenSurface = new THREE.Mesh(new THREE.PlaneGeometry(21.12, 11.88), screenMat)
    screenSurface.position.set(0, 6.6, -15.55)
    scene.add(screenSurface)

    // Red Velvet Side Curtains & Cinema Speakers
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.75 })
    const leftCurtain = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 13.2, 16), curtainMat)
    leftCurtain.position.set(-12.2, 6.6, -15.3)
    const rightCurtain = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 13.2, 16), curtainMat)
    rightCurtain.position.set(12.2, 6.6, -15.3)
    scene.add(leftCurtain, rightCurtain)

    // 5. Build 36 Red Plush Cinema Armchairs across 4 Stadium Rows
    const seatCushionMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 })
    const seatArmMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 })
    CINEMA_SEATS.forEach((s) => {
      const chair = new THREE.Group()
      const baseHeight = s.y - 0.1
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.35, 1.2), seatCushionMat)
      cushion.position.set(0, baseHeight + 0.35, 0)
      const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.28, 0.28), seatCushionMat)
      backrest.position.set(0, baseHeight + 0.96, 0.48)
      const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.56, 1.2), seatArmMat)
      lArm.position.set(-0.68, baseHeight + 0.56, 0)
      const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.56, 1.2), seatArmMat)
      rArm.position.set(0.68, baseHeight + 0.56, 0)
      chair.add(cushion, backrest, lArm, rArm)
      chair.position.set(s.x, 0, s.z)
      scene.add(chair)
    })

    // 6. Dynamic Real GLTF/VRM 3D Player Characters
    const characterInstances = new Map<string, CinemaCharacterInstance>()

    const onResize = () => {
      if (!container) return
      width = container.clientWidth || 960
      height = container.clientHeight || 540
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      cssRenderer.setSize(width, height)
    }
    window.addEventListener('resize', onResize)

    let frameId = 0
    let lastRender = 0
    let lastNetworkBroadcast = 0

    // Floor height helper for stadium tiers
    const getFloorHeightAtZ = (z: number) => {
      if (z >= 3.4) return 1.75
      if (z >= -0.4) return 1.15
      if (z >= -4.2) return 0.55
      return 0
    }

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate)
      if (now - lastRender < 32) return // Smooth 30 FPS cap
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
        const speed = 5.8
        const len = Math.hypot(moveX, moveZ)
        const dx = (moveX / len) * speed * dt
        const dz = (moveZ / len) * speed * dt

        const cos = Math.cos(cameraYawRef.current)
        const sin = Math.sin(cameraYawRef.current)
        const worldDx = dx * cos + dz * sin
        const worldDz = dz * cos - dx * sin

        myPos.x = Math.max(-13.8, Math.min(13.8, myPos.x + worldDx))
        myPos.z = Math.max(-12.2, Math.min(12.2, myPos.z + worldDz))
        myPos.y = getFloorHeightAtZ(myPos.z)
        myPos.seatIndex = null
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

      // 2. Update Fixed 3D Movie Screen Material (WebGL VideoTexture vs CSS3D 3D-Transformed Iframe)
      const ws = watchStateRef.current
      const hasLiveStream = Boolean(liveScreenStreamRef.current && liveTextureRef.current)
      const isMp4Video = Boolean(ws?.active && ws.provider === 'mp4' && videoTextureRef.current)
      const isIframeVideo = Boolean(ws?.active && ws.provider !== 'mp4' && !hasLiveStream)

      if (hasLiveStream && liveTextureRef.current) {
        screenSurface.visible = true
        if (screenMat.map !== liveTextureRef.current) {
          screenMat.map = liveTextureRef.current
          screenMat.color.setHex(0xffffff)
          screenMat.needsUpdate = true
        }
      } else if (isMp4Video && videoTextureRef.current) {
        screenSurface.visible = true
        if (screenMat.map !== videoTextureRef.current) {
          screenMat.map = videoTextureRef.current
          screenMat.color.setHex(0xffffff)
          screenMat.needsUpdate = true
        }
      } else if (isIframeVideo) {
        // Hide solid WebGL plane so the 3D-perspective CSS3DObject iframe at the exact same 3D coordinates shines through!
        screenSurface.visible = false
      } else {
        screenSurface.visible = true
        if (screenMat.map !== standbyTex) {
          screenMat.map = standbyTex
          screenMat.color.setHex(0xffffff)
          screenMat.needsUpdate = true
        }
      }

      // 3. Dim theater lights when movie is playing
      const dimmed = ws?.lightsDimmed ?? Boolean((ws?.active && ws?.isPlaying) || hasLiveStream)
      hemiLight.intensity = THREE.MathUtils.lerp(hemiLight.intensity, dimmed ? 0.55 : 1.35, 0.08)
      ceilingLight.intensity = THREE.MathUtils.lerp(ceilingLight.intensity, dimmed ? 0.35 : 1.45, 0.08)
      screenBounceLight.intensity = dimmed
        ? 4.6 + Math.sin(timeSec * 6) * 0.5
        : 2.2

      // 4. Sync all room peers into Real GLTF/VRM 3D Characters
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

        let charInst = characterInstances.get(peer.id)
        if (!charInst || charInst.configSignature !== sig) {
          if (charInst) {
            charInst.cleanup?.()
            scene.remove(charInst.root)
          }
          charInst = createCinemaCharacterInstance(peer, cfg)
          scene.add(charInst.root)
          characterInstances.set(peer.id, charInst)
        }

        const defaultSeat = CINEMA_SEATS[(idx + 10) % CINEMA_SEATS.length]
        const targetX = isMe ? myPos.x : (remote?.x ?? defaultSeat.x)
        const targetY = isMe ? myPos.y : (remote?.y ?? defaultSeat.y)
        const targetZ = isMe ? myPos.z : (remote?.z ?? defaultSeat.z)
        const targetRotY = isMe ? myPos.rotY : (remote?.rotY ?? Math.PI)
        const seatIdx = isMe ? myPos.seatIndex : (remote ? remote.seatIndex : defaultSeat.index)
        const emote: CinemaEmoteType = isMe ? myEmoteRef.current : (remote?.emote || 'none')

        const isMoving =
          isMe
            ? moved
            : Math.hypot(targetX - charInst.root.position.x, targetZ - charInst.root.position.z) >
              0.08

        charInst.root.position.x = THREE.MathUtils.lerp(charInst.root.position.x, targetX, 0.25)
        charInst.root.position.y = THREE.MathUtils.lerp(charInst.root.position.y, targetY, 0.25)
        charInst.root.position.z = THREE.MathUtils.lerp(charInst.root.position.z, targetZ, 0.25)
        charInst.root.rotation.y = targetRotY

        if (charInst.mixer) {
          if (emote === 'dance') {
            playCharacterClip(charInst, ['sambadance', 'dance', 'walkjump'])
          } else if (emote === 'wave') {
            playCharacterClip(charInst, ['wave', 'agree', 'idle'])
          } else if (emote === 'cheer') {
            playCharacterClip(charInst, ['jump', 'thumbsup', 'agree', 'idle'])
          } else if (isMoving) {
            playCharacterClip(charInst, ['walk', 'walking', 'run', 'running'])
          } else if (seatIdx !== null) {
            playCharacterClip(charInst, ['sitting', 'idle', 'standing'])
          } else {
            playCharacterClip(charInst, ['idle', 'standing'])
          }
          charInst.mixer.update(dt)
        }

        const rig = charInst.rig

        if (seatIdx !== null && !charInst.actions['sitting']) {
          if (rig.leftUpperLeg) rig.leftUpperLeg.rotation.x = -Math.PI / 2.15
          if (rig.rightUpperLeg) rig.rightUpperLeg.rotation.x = -Math.PI / 2.15
          if (rig.leftLowerLeg) rig.leftLowerLeg.rotation.x = Math.PI / 2.2
          if (rig.rightLowerLeg) rig.rightLowerLeg.rotation.x = Math.PI / 2.2
          charInst.modelContainer.position.y = -0.32
        } else {
          charInst.modelContainer.position.y = 0
        }

        if (emote === 'popcorn') {
          charInst.popcornBucket.visible = true
          charInst.eatingKernel.visible = true

          const eatPhase = (timeSec * 1.65) % 1
          const liftToMouth = Math.sin(eatPhase * Math.PI)

          if (rig.leftUpperArm) {
            rig.leftUpperArm.rotation.set(-0.75, 0.45, 0.25)
          }
          if (rig.leftLowerArm) {
            rig.leftLowerArm.rotation.set(-0.85, 0, 0)
          }
          if (rig.rightUpperArm) {
            rig.rightUpperArm.rotation.set(
              -0.65 - liftToMouth * 0.75,
              -0.35 - liftToMouth * 0.25,
              -0.2
            )
          }
          if (rig.rightLowerArm) {
            rig.rightLowerArm.rotation.set(-0.7 - liftToMouth * 1.15, 0, 0)
          }
          if (rig.head && eatPhase > 0.4 && eatPhase < 0.75) {
            rig.head.rotation.x = Math.sin(timeSec * 28) * 0.14
          }

          charInst.popcornCrumbs.forEach((c, cIdx) => {
            if (eatPhase > 0.45 && eatPhase < 0.65 && c.life <= 0) {
              c.mesh.visible = true
              c.mesh.position.set(
                (Math.random() - 0.5) * 0.18,
                1.62 + (Math.random() - 0.5) * 0.08,
                0.22
              )
              c.vx = (Math.random() - 0.5) * 0.8
              c.vy = 0.6 + Math.random() * 0.6
              c.vz = 0.4 + Math.random() * 0.6
              c.life = 0.4 + (cIdx % 3) * 0.15
            }
            if (c.life > 0) {
              c.life -= dt
              c.vy -= 3.8 * dt
              c.mesh.position.x += c.vx * dt
              c.mesh.position.y += c.vy * dt
              c.mesh.position.z += c.vz * dt
              if (c.life <= 0) c.mesh.visible = false
            }
          })
        } else {
          charInst.popcornBucket.visible = cfg.accessory === 'popcorn'
          charInst.eatingKernel.visible = false
          charInst.popcornCrumbs.forEach((c) => {
            c.mesh.visible = false
            c.life = 0
          })

          if (emote === 'wave' && rig.rightUpperArm) {
            rig.rightUpperArm.rotation.z = -2.2 + Math.sin(timeSec * 14) * 0.45
          } else if (emote === 'cheer' && rig.leftUpperArm && rig.rightUpperArm) {
            rig.leftUpperArm.rotation.z = 2.3 + Math.sin(timeSec * 12) * 0.35
            rig.rightUpperArm.rotation.z = -2.3 - Math.sin(timeSec * 12) * 0.35
          }
        }

        const talking = isMe
          ? isSelfSpeakingRef.current
          : Boolean(speakingPeersRef.current[peer.id])
        const ringMat = charInst.talkRing.material as THREE.MeshBasicMaterial
        ringMat.opacity = talking ? 0.9 : 0.0
        if (talking && rig.head) {
          rig.head.rotation.x += Math.sin(timeSec * 22) * 0.09
        }

        if (charInst.auraMesh) {
          charInst.auraMesh.rotation.y += 0.08
          const s = 1 + Math.sin(timeSec * 10) * 0.08
          charInst.auraMesh.scale.set(s, 1, s)
        }
      })

      characterInstances.forEach((inst, id) => {
        if (!activeIds.has(id)) {
          inst.cleanup?.()
          scene.remove(inst.root)
          characterInstances.delete(id)
        }
      })

      // 5. Camera Modes:
      // - 'screen-closeup' ("🖥️ Focar Telão"): Locks camera directly in front of the 3D screen!
      // - 'seat-pov' ("👀 Poltrona"): First-person view from the player's seat looking at the 3D screen.
      // - 'free' ("🎮 Jogo 3D"): Third-person game follow camera where the 3D screen stays fixed on the wall!
      const viewMode = cameraViewRef.current
      if (viewMode === 'screen-closeup') {
        camera.position.lerp(new THREE.Vector3(0, 6.6, -2.5), 0.18)
        camera.lookAt(0, 6.6, -15.6)
      } else if (viewMode === 'seat-pov') {
        const targetCam = new THREE.Vector3(myPos.x, myPos.y + 1.85, myPos.z - 0.2)
        camera.position.lerp(targetCam, 0.2)
        camera.lookAt(0, 6.4, -15.6)
      } else {
        const dist = 5.6
        const camX = myPos.x + Math.sin(cameraYawRef.current) * dist
        const camZ = myPos.z + Math.cos(cameraYawRef.current) * dist
        const camY = Math.max(1.2, myPos.y + 2.5 + cameraPitchRef.current * 3.2)
        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.22)

        const lookTargetX = myPos.x - Math.sin(cameraYawRef.current) * 6
        const lookTargetZ = myPos.z - Math.cos(cameraYawRef.current) * 6
        camera.lookAt(lookTargetX, myPos.y + 2.1, lookTargetZ)
      }

      renderer.render(scene, camera)
      cssRenderer.render(cssScene, camera)
    }

    frameId = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(frameId)
      characterInstances.forEach((inst) => inst.cleanup?.())
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

  const isIframeActive = Boolean(
    watchState?.active && watchState.provider !== 'mp4' && !liveScreenStream
  )

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-[#232428] bg-[#06060b] select-none">
      {/* Hidden HTML5 Video Elements feeding the True 3D WebGL THREE.VideoTexture on the Cinema Wall! */}
      <video
        ref={htmlVideoRef}
        src={watchState?.provider === 'mp4' ? watchState.embedUrl : undefined}
        crossOrigin="anonymous"
        playsInline
        className="pointer-events-none fixed -top-[9999px] -left-[9999px] h-1 w-1 opacity-0"
      />
      <video
        ref={liveStreamVideoRef}
        playsInline
        className="pointer-events-none fixed -top-[9999px] -left-[9999px] h-1 w-1 opacity-0"
      />

      {/* TOP CINEMA 3D GAME BAR */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#14151a]/95 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gradient-to-r from-amber-500 to-red-600 px-2 py-0.5 text-[11px] font-black text-white uppercase shadow">
            🍿 IMAX 3D • 36 Poltronas
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
              📡 Telão 3D ao vivo: {liveScreenStreamerName}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">
              Ande com <strong className="text-white">W A S D</strong> • Aperte{' '}
              <strong className="text-amber-300">E</strong> para sentar • Arraste o mouse para
              olhar
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveModal((m) => (m === 'movies' ? null : 'movies'))}
            className="cursor-pointer rounded-lg bg-[#5865f2] px-3 py-1.5 text-xs font-extrabold text-white shadow hover:bg-[#4752c4]"
          >
            🎬 Escolher Filme / Link
          </button>

          <button
            type="button"
            onClick={() => setActiveModal((m) => (m === 'wardrobe' ? null : 'wardrobe'))}
            className="cursor-pointer rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-extrabold text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30"
          >
            👘 Personagens 3D & Roupas
          </button>

          <button
            type="button"
            onClick={handleToggleNearestSeat}
            className="cursor-pointer rounded-lg bg-[#2b2d31] px-2.5 py-1.5 text-xs font-bold text-zinc-200 hover:bg-[#35373c]"
          >
            💺 Sentar / Levantar (E)
          </button>

          <button
            type="button"
            onClick={() =>
              setCameraView((v) => (v === 'screen-closeup' ? 'free' : 'screen-closeup'))
            }
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-extrabold transition shadow ${
              cameraView === 'screen-closeup'
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                : 'bg-[#2b2d31] text-emerald-400 hover:bg-[#35373c]'
            }`}
          >
            {cameraView === 'screen-closeup' ? '🔙 Voltar pro Jogo 3D' : '🖥️ Focar no Telão'}
          </button>

          <div className="flex items-center rounded-lg bg-[#1e1f22] p-0.5 text-[11px]">
            {(
              [
                { id: 'free', label: '🎮 3ª Pessoa' },
                { id: 'seat-pov', label: '👀 Visão Poltrona' },
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
            -0.35,
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
        {/* Layer 1: CSS3DRenderer (Renders YouTube/Twitch Iframe in TRUE 3D Perspective on the Cinema Wall!) */}
        <div ref={css3dMountRef} className="pointer-events-none absolute inset-0 z-0" />

        {/* DOM Element managed by CSS3DObject at (0, 6.6, -15.58) */}
        <div
          ref={screenDomRef}
          style={{
            width: '1280px',
            height: '720px',
            display: isIframeActive ? 'block' : 'none',
            pointerEvents: cameraView === 'screen-closeup' ? 'auto' : 'none',
          }}
          className="overflow-hidden bg-black"
        >
          {isIframeActive && watchState && (
            <iframe
              ref={iframeRef}
              src={watchState.embedUrl}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          )}
        </div>

        {/* Layer 2: WebGLRenderer (3D Cinema Room, Posters, 36 Seats, Characters & WebGL VideoTexture Screen) */}
        <div
          ref={mountRef}
          style={{
            pointerEvents: cameraView === 'screen-closeup' && isIframeActive ? 'none' : 'auto',
          }}
          className="relative z-10 h-full w-full cursor-grab active:cursor-grabbing"
        />

        {/* BOTTOM FLOATING GAME HUD */}
        <div className="pointer-events-auto absolute right-4 bottom-3 left-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#111214]/90 px-3.5 py-2 shadow-2xl">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-extrabold text-zinc-400 uppercase">
              Animações 3D:
            </span>
            {(
              [
                { id: 'none', label: '🧍 Normal' },
                { id: 'popcorn', label: '🍿 Comer Pipoca (3D Real)' },
                { id: 'dance', label: '💃 Dançar Samba / Mixamo' },
                { id: 'wave', label: '👋 Acenar' },
                { id: 'cheer', label: '🙌 Comemorar' },
              ] as { id: CinemaEmoteType; label: string }[]
            ).map((em) => (
              <button
                key={em.id}
                type="button"
                onClick={() => setMyEmote(em.id)}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                  myEmote === em.id
                    ? 'bg-amber-500 text-black shadow'
                    : 'bg-[#2b2d31] text-zinc-200 hover:bg-[#35373c]'
                }`}
              >
                {em.label}
              </button>
            ))}
          </div>

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

        {/* MODAL 1: REAL 3D MODELS (.GLB / .VRM), ANIME PRESETS & OUTFITS */}
        {activeModal === 'wardrobe' && (
          <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-amber-500/40 bg-[#18191c] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    👘 Modelos 3D Reais (.VRM Anime / .GLB), Roupas & Acessórios
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Cada personagem abaixo usa um modelo 3D diferente (Anime VRM, Lutador, Garota
                    Mixamo, Soldado, Mecha)!
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
                {/* 1. Real Rigged 3D Base Models */}
                <div>
                  <label className="mb-2 block text-xs font-extrabold text-emerald-400 uppercase">
                    🧍 1. Escolha o Corpo / Modelo 3D Real Articulado (7 Modelos Diferentes)
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {REAL_3D_MODELS.map((m) => {
                      const active = (avatarConfig.modelType || 'anime-vrm') === m.id
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => updateMyAvatar({ modelType: m.id })}
                          className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3 text-left transition ${
                            active
                              ? 'border-emerald-400 bg-emerald-500/15 text-white ring-1 ring-emerald-400'
                              : 'border-white/10 bg-[#232428] text-zinc-300 hover:bg-[#2b2d31]'
                          }`}
                        >
                          <div>
                            <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              {m.badge}
                            </span>
                            <div className="mt-1.5 text-xs font-extrabold text-white">{m.name}</div>
                            <p className="mt-0.5 text-[10px] text-zinc-400">{m.desc}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Custom VRM / GLB URL Input */}
                <div className="rounded-xl border border-indigo-500/30 bg-[#232428] p-3.5">
                  <label className="mb-1 block text-xs font-extrabold text-indigo-300">
                    🌐 Usar Qualquer Modelo .VRM (Anime) ou .GLB da Internet (Opcional)
                  </label>
                  <p className="mb-2 text-[11px] text-zinc-400">
                    Tem um link direto de avatar <code className="text-white">.vrm</code> (VRoid) ou{' '}
                    <code className="text-white">.glb</code>? Cole abaixo para carregar seu próprio
                    modelo 3D na sala:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={avatarConfig.customModelUrl || ''}
                      onChange={(e) =>
                        updateMyAvatar({
                          modelType: e.target.value.trim() ? 'custom-url' : 'anime-vrm',
                          customModelUrl: e.target.value,
                        })
                      }
                      placeholder="https://.../meu-personagem-anime.vrm ou .glb"
                      className="flex-1 rounded-lg bg-[#111214] px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                    {avatarConfig.customModelUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          updateMyAvatar({ modelType: 'anime-vrm', customModelUrl: '' })
                        }
                        className="cursor-pointer rounded-lg bg-[#da373c] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Quick Anime & Character Presets */}
                <div>
                  <label className="mb-2 block text-xs font-extrabold text-amber-400 uppercase">
                    ⚡ 2. Presets de Anime & Lendas (1 Clique)
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

                {/* 3. Real 3D Clothing Material Tint & Accessories */}
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#232428] p-3.5">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-300">
                      👕 Cor da Roupa Superior 3D
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
                      👖 Cor da Calça / Saia 3D
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

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-300">
                      💇 Cabelo Anime Extra
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
                      <option value="none">Cabelo Original do Modelo 3D</option>
                      <option value="spiky-gold">Espetado Super Saiyajin (Dourado)</option>
                      <option value="spiky-black">Espetado Anime (Preto)</option>
                      <option value="ninja-blonde">Ninja Loiro (Naruto)</option>
                      <option value="anime-white">Platinado (Gojo)</option>
                      <option value="burgundy">Vinho Caçador (Tanjiro)</option>
                      <option value="afro">Black Power / Afro</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-300">
                      🎩 Chapéu 3D na Cabeça
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
                      <option value="straw-hat">Chapéu de Palha 3D (Luffy)</option>
                      <option value="crown">Coroa Dourada de Rei</option>
                      <option value="wizard">Chapéu de Mago</option>
                      <option value="cat-ears">Orelhas Neon</option>
                      <option value="halo">Auréola de Anjo</option>
                      <option value="horns">Chifres Vermelhos</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-300">
                      🗡️ Acessório 3D nas Costas / Mão
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
                      <option value="popcorn">Balde de Pipoca 3D na Mão</option>
                      <option value="katana">Katana 3D com Bainha nas Costas</option>
                      <option value="wings">Asas Douradas 3D</option>
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
                    🎬 Colocar Filme ou Vídeo no Telão 3D Fixo
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
                      placeholder="Cole o link do YouTube, arquivo .mp4/.webm direto, Twitch..."
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

                <div>
                  <label className="mb-2 block text-xs font-extrabold text-amber-400 uppercase">
                    🍿 Em Cartaz no Cinema 3D (Play / Pause / Tempo 100% Sincronizado)
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
                          ▶ Rodar no Telão 3D para Todos
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="text-xs font-extrabold text-emerald-300">
                    📡 Quer assistir Netflix, Prime Video, Crunchyroll ou site de Filmes?
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-300">
                    Você pode transmitir a guia do seu navegador com áudio e ela é renderizada como{' '}
                    <strong>Textura 3D Real fixa na parede do Telão do Cinema</strong>!
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
