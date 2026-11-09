'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
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

const AVATAR_STORAGE_KEY = 'os_secos_cinema_avatar_v2'

export const REAL_3D_MODELS: {
  id: CinemaModelType
  name: string
  desc: string
  badge: string
  url: string
}[] = [
  {
    id: 'streetwear-rpm',
    name: 'Humano 3D Realista (ReadyPlayerMe)',
    desc: 'Jaqueta, Calça, Tênis, Barba e Rosto 3D articulado',
    badge: '👟 Roupas Reais',
    url: 'https://threejs.org/examples/models/gltf/readyplayer.me.glb',
  },
  {
    id: 'anime-vrm',
    name: 'Garota Anime 3D (VRoid Studio VRM)',
    desc: 'Modelo oficial VRM de Anime com cabelo, saia, blusa e olhos 3D',
    badge: '🌸 Anime VRM Real',
    url: 'https://pixiv.github.io/three-vrm/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm',
  },
  {
    id: 'dancer-girl',
    name: 'Michelle — Dançarina 3D (Mixamo)',
    desc: 'Personagem feminina 3D com jaqueta jeans, tênis e captura de dança',
    badge: '💃 Mixamo 3D',
    url: 'https://threejs.org/examples/models/gltf/Michelle.glb',
  },
  {
    id: 'soldier-tactical',
    name: 'Vanguard — Soldado Tático 3D',
    desc: 'Armadura militar completa, capacete com visor e mochila tática',
    badge: '🪖 Militar 3D',
    url: 'https://threejs.org/examples/models/gltf/Soldier.glb',
  },
  {
    id: 'cyborg-xbot',
    name: 'X-Bot — Androide Cyberpunk 3D',
    desc: 'Corpo biomecânico articulado de alta precisão Mixamo',
    badge: '⚡ Cyborg 3D',
    url: 'https://threejs.org/examples/models/gltf/Xbot.glb',
  },
  {
    id: 'robot-bot',
    name: 'Robô Expressivo 3D (14 Animações)',
    desc: 'Robô carismático com animações nativas de dança, pulo e saudação',
    badge: '🤖 Mecha 3D',
    url: 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
  },
]

export const ANIME_PRESETS: {
  id: CinemaPresetId
  name: string
  badge: string
  config: CinemaAvatarConfig
}[] = [
  {
    id: 'goku',
    name: 'Goku SSJ (Humano 3D)',
    badge: '🐉 DBZ 3D',
    config: {
      presetId: 'goku',
      modelType: 'streetwear-rpm',
      shirtColor: '#f97316',
      pantsColor: '#1d4ed8',
      hairStyle: 'spiky-gold',
      hatStyle: 'none',
      accessory: 'popcorn',
      aura: 'super-saiyan',
    },
  },
  {
    id: 'naruto',
    name: 'Anime VRoid (Chakra)',
    badge: '🌸 Anime VRM',
    config: {
      presetId: 'naruto',
      modelType: 'anime-vrm',
      shirtColor: '#fb923c',
      pantsColor: '#18181b',
      hairStyle: 'none',
      hatStyle: 'headband',
      accessory: 'katana',
      aura: 'blue-chakra',
    },
  },
  {
    id: 'luffy',
    name: 'Luffy Chapéu de Palha',
    badge: '🏴‍☠️ One Piece 3D',
    config: {
      presetId: 'luffy',
      modelType: 'streetwear-rpm',
      shirtColor: '#dc2626',
      pantsColor: '#2563eb',
      hairStyle: 'none',
      hatStyle: 'straw-hat',
      accessory: 'popcorn',
      aura: 'none',
    },
  },
  {
    id: 'gojo',
    name: 'Satoru Gojo (Jujutsu)',
    badge: '🤞 Gojo 3D',
    config: {
      presetId: 'gojo',
      modelType: 'streetwear-rpm',
      shirtColor: '#1e1b4b',
      pantsColor: '#09090b',
      hairStyle: 'anime-white',
      hatStyle: 'none',
      accessory: 'blindfold',
      aura: 'purple-curse',
    },
  },
  {
    id: 'tanjiro',
    name: 'Michelle Dançarina',
    badge: '💃 Mixamo 3D',
    config: {
      presetId: 'tanjiro',
      modelType: 'dancer-girl',
      shirtColor: '#10b981',
      pantsColor: '#18181b',
      hairStyle: 'none',
      hatStyle: 'cat-ears',
      accessory: 'popcorn',
      aura: 'fire-red',
    },
  },
  {
    id: 'akatsuki',
    name: 'Soldado Tático Elite',
    badge: '🪖 Vanguard 3D',
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
    name: 'Cyborg Neon X-Bot',
    badge: '⚡ Cyberpunk 3D',
    config: {
      presetId: 'cyberpunk',
      modelType: 'cyborg-xbot',
      shirtColor: '#eab308',
      pantsColor: '#06b6d4',
      hairStyle: 'none',
      hatStyle: 'halo',
      accessory: 'wings',
      aura: 'blue-chakra',
    },
  },
  {
    id: 'king-seco',
    name: 'Rei Robô Mecha',
    badge: '👑 Mecha 3D',
    config: {
      presetId: 'king-seco',
      modelType: 'robot-bot',
      shirtColor: '#a855f7',
      pantsColor: '#facc15',
      hairStyle: 'none',
      hatStyle: 'crown',
      accessory: 'popcorn',
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
  { index: 0, row: 1, x: -6.6, y: 0.1, z: -2.2 },
  { index: 1, row: 1, x: -4.4, y: 0.1, z: -2.2 },
  { index: 2, row: 1, x: -2.2, y: 0.1, z: -2.2 },
  { index: 3, row: 1, x: 0.0, y: 0.1, z: -2.2 },
  { index: 4, row: 1, x: 2.2, y: 0.1, z: -2.2 },
  { index: 5, row: 1, x: 4.4, y: 0.1, z: -2.2 },
  { index: 6, row: 1, x: 6.6, y: 0.1, z: -2.2 },
  { index: 7, row: 2, x: -6.6, y: 0.7, z: 1.2 },
  { index: 8, row: 2, x: -4.4, y: 0.7, z: 1.2 },
  { index: 9, row: 2, x: -2.2, y: 0.7, z: 1.2 },
  { index: 10, row: 2, x: 0.0, y: 0.7, z: 1.2 },
  { index: 11, row: 2, x: 2.2, y: 0.7, z: 1.2 },
  { index: 12, row: 2, x: 4.4, y: 0.7, z: 1.2 },
  { index: 13, row: 2, x: 6.6, y: 0.7, z: 1.2 },
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

// Preload motion-capture animation clips (Walk, Run, Idle, Agree, Dance) from Xbot & Michelle
let mocapPreloadStarted = false
function ensureMocapClipsLoaded() {
  if (mocapPreloadStarted) return
  mocapPreloadStarted = true

  loadCachedGLTF('https://threejs.org/examples/models/gltf/Xbot.glb')
    .then((gltf) => {
      gltf.animations.forEach((clip) => {
        sharedMocapClips[clip.name.toLowerCase()] = clip
      })
    })
    .catch(() => {})

  loadCachedGLTF('https://threejs.org/examples/models/gltf/Michelle.glb')
    .then((gltf) => {
      gltf.animations.forEach((clip) => {
        if (clip.name.toLowerCase().includes('dance')) {
          sharedMocapClips['sambadance'] = clip
        }
      })
    })
    .catch(() => {})
}

// Retargets a Mixamo AnimationClip so it works seamlessly on both `mixamorig:Bone` (Mixamo)
// AND non-prefixed `Bone` skeletons (like ReadyPlayerMe Wolf3D)!
function retargetClipForRoot(clip: THREE.AnimationClip, modelRoot: THREE.Object3D): THREE.AnimationClip {
  const hasMixamoPrefix = Boolean(modelRoot.getObjectByName('mixamorig:Hips') || modelRoot.getObjectByName('mixamorigHips'))
  const cloned = clip.clone()
  cloned.tracks = cloned.tracks.map((track) => {
    const dotIdx = track.name.indexOf('.')
    if (dotIdx === -1) return track
    let nodeName = track.name.slice(0, dotIdx)
    const propName = track.name.slice(dotIdx)

    if (!hasMixamoPrefix && nodeName.startsWith('mixamorig:')) {
      const stripped = nodeName.replace('mixamorig:', '')
      if (modelRoot.getObjectByName(stripped)) {
        nodeName = stripped
      }
    }
    const newTrack = track.clone()
    newTrack.name = `${nodeName}${propName}`
    return newTrack
  })
  return cloned
}

function createFloatingUserBadge(avatarUrl: string, username: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 88
  const ctx = canvas.getContext('2d')!

  const draw = (img?: HTMLImageElement) => {
    ctx.clearRect(0, 0, 320, 88)
    // Rounded dark pill background
    ctx.fillStyle = 'rgba(15, 17, 23, 0.88)'
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.roundRect(6, 8, 308, 72, 36)
    ctx.fill()
    ctx.stroke()

    // Avatar circle
    if (img) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(44, 44, 26, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(img, 18, 18, 52, 52)
      ctx.restore()
    } else {
      ctx.fillStyle = '#5865f2'
      ctx.beginPath()
      ctx.arc(44, 44, 26, 0, Math.PI * 2)
      ctx.fill()
    }

    // Username text
    ctx.fillStyle = '#ffffff'
    ctx.font = '900 26px sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(username.slice(0, 14), 82, 46)
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
    draw(img)
    tex.needsUpdate = true
  }
  img.src = avatarUrl

  return sprite
}

// Builds a high-detail 3D Striped Cinema Popcorn Bucket with 3D Buttered Popcorn Kernels inside!
function createDetailed3DPopcornBucket(): {
  bucketGroup: THREE.Group
  eatingKernel: THREE.Mesh
} {
  const bucketGroup = new THREE.Group()

  // Striped red/white cinema tub texture
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

  // Mound of 3D Fluffy Buttered Popcorn Kernels overflowing the top!
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
    k.position.set(
      Math.cos(angle) * r,
      0.17 + (i % 2) * 0.035,
      Math.sin(angle) * r
    )
    k.rotation.set(i, i * 0.7, 0)
    bucketGroup.add(k)
  }

  // Animated kernel held in right hand when eating popcorn!
  const eatingKernel = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.055, 1),
    kernelMat
  )
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
}

function attachCosmeticsToRig(
  rig: BoneRig,
  root: THREE.Group,
  config: CinemaAvatarConfig
) {
  const headTarget = rig.head || root
  const isBoneHead = Boolean(rig.head)
  const headScale = isBoneHead ? 0.55 : 1

  // Anime Hair Attachments on real 3D head bone
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

  // Hat Attachments on real 3D head bone
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

  // Back / Spine Attachments (Katana with sheath & hilt, Hero Cape, Golden Wings)
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

  // Floating Discord Avatar + Username Plate above head
  const badge = createFloatingUserBadge(user.avatar_url, user.username)
  root.add(badge)

  // Green Speaking Ring on Floor
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

  // 3D Popcorn Bucket & Kernel
  const { bucketGroup: popcornBucket, eatingKernel } = createDetailed3DPopcornBucket()
  popcornBucket.position.set(-0.28, 1.05, 0.26)
  popcornBucket.visible = config.accessory === 'popcorn'
  root.add(popcornBucket)
  root.add(eatingKernel)

  // Flying 3D Popcorn Crumbs when eating popcorn
  const popcornCrumbs: { mesh: THREE.Mesh; vy: number; vx: number; vz: number; life: number }[] = []
  const crumbGeo = new THREE.DodecahedronGeometry(0.032, 0)
  const crumbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a })
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(crumbGeo, crumbMat)
    m.visible = false
    root.add(m)
    popcornCrumbs.push({ mesh: m, vy: 0, vx: 0, vz: 0, life: 0 })
  }

  // Energy Aura
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

  // Resolve which Real 3D Model URL to load (.GLB / .VRM)
  const modelType: CinemaModelType = config.modelType || 'streetwear-rpm'
  const presetModel = REAL_3D_MODELS.find((m) => m.id === modelType) || REAL_3D_MODELS[0]
  const targetUrl =
    modelType === 'custom-url' && config.customModelUrl?.trim()
      ? config.customModelUrl.trim()
      : presetModel.url

  loadCachedGLTF(targetUrl)
    .then((gltf) => {
      const vrm = gltf.userData?.vrm
      let clonedScene: THREE.Object3D

      if (vrm && vrm.scene) {
        // VRM Anime Model
        clonedScene = SkeletonUtils.clone(vrm.scene)
        instance.isVrm = true
      } else {
        clonedScene = SkeletonUtils.clone(gltf.scene)
      }

      // Normalize height to ~1.85m so any custom GLB/VRM fits the cinema chairs!
      const box = new THREE.Box3().setFromObject(clonedScene)
      const size = new THREE.Vector3()
      box.getSize(size)
      if (size.y > 0.01) {
        const scale = 1.82 / size.y
        clonedScene.scale.setScalar(scale)
      }

      // Tint Shirt / Outfit Top & Pants / Outfit Bottom materials with user's chosen colors!
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
            matName.includes('body') ||
            matName.includes('main') ||
            matName.includes('vanguardbodymat') ||
            matName.includes('highlimbs')
          ) {
            if (m.color) m.color.lerp(shirtColor, 0.65)
          } else if (
            matName.includes('bottom') ||
            matName.includes('pants') ||
            matName.includes('joints') ||
            matName.includes('grey')
          ) {
            if (m.color) m.color.lerp(pantsColor, 0.65)
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

      // Extract Skeletal Bone Rig (Head, Spine, Left/Right Arm, ForeArm, Hand, UpperLeg, LowerLeg)
      instance.rig = extractBoneRig(clonedScene)

      // Parent the 3D Popcorn Bucket to Left Hand bone and Eating Kernel to Right Hand bone if available!
      if (instance.rig.leftHand) {
        instance.rig.leftHand.add(popcornBucket)
        popcornBucket.position.set(0, 0.08, 0.12)
        popcornBucket.scale.setScalar(0.85)
      }
      if (instance.rig.rightHand) {
        instance.rig.rightHand.add(eatingKernel)
        eatingKernel.position.set(0, 0.05, 0.05)
      }

      // Attach 3D Hair, Hats, Katana, Wings to the actual skeleton bones
      attachCosmeticsToRig(instance.rig, modelContainer, config)

      // Set up AnimationMixer with native + retargeted Mixamo clips
      const mixer = new THREE.AnimationMixer(clonedScene)
      instance.mixer = mixer

      const allClips = [...(gltf.animations || [])]
      Object.values(sharedMocapClips).forEach((mc) => {
        allClips.push(retargetClipForRoot(mc, clonedScene))
      })

      allClips.forEach((clip) => {
        const key = clip.name.toLowerCase()
        instance.actions[key] = mixer.clipAction(clip)
      })
    })
    .catch((err) => {
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
    rotY: Math.PI,
    seatIndex: null,
  })
  const keysPressedRef = useRef<Record<string, boolean>>({})
  const cameraYawRef = useRef<number>(0)
  const cameraPitchRef = useRef<number>(0.22)
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

  useEffect(() => {
    const el = liveStreamVideoRef.current
    if (!el || !liveScreenStream) return
    if (el.srcObject !== liveScreenStream) {
      el.srcObject = liveScreenStream
      el.play().catch(() => {})
    }
  }, [liveScreenStream])

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
        y: 0,
        z: cur.z + 1.1,
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

  // Main 3D Theater Room Three.js Engine
  useEffect(() => {
    if (!mountRef.current) return
    const container = mountRef.current
    let width = container.clientWidth || 960
    let height = container.clientHeight || 540

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x07070c)
    scene.fog = new THREE.FogExp2(0x07070c, 0.016)

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100)

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'low-power',
    })
    renderer.setPixelRatio(1)
    renderer.setSize(width, height)
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Rich Theater Lighting for real GLTF PBR meshes
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x2e1065, 1.35)
    scene.add(hemiLight)

    const screenBounceLight = new THREE.PointLight(0x818cf8, 3.5, 30)
    screenBounceLight.position.set(0, 4.5, -8.2)
    scene.add(screenBounceLight)

    const ceilingLight = new THREE.DirectionalLight(0xfff7ed, 1.45)
    ceilingLight.position.set(4, 14, 8)
    scene.add(ceilingLight)

    // 1. Cinema Red Carpet Floor & Tiered Row Platforms
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 28),
      new THREE.MeshStandardMaterial({ color: 0x2a0810, roughness: 0.85 })
    )
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)

    const stripGeo = new THREE.PlaneGeometry(0.18, 16)
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    const leftStrip = new THREE.Mesh(stripGeo, stripMat)
    leftStrip.rotation.x = -Math.PI / 2
    leftStrip.position.set(-8.2, 0.02, -1)
    const rightStrip = new THREE.Mesh(stripGeo, stripMat)
    rightStrip.rotation.x = -Math.PI / 2
    rightStrip.position.set(8.2, 0.02, -1)
    scene.add(leftStrip, rightStrip)

    const vipPlatform = new THREE.Mesh(
      new THREE.BoxGeometry(18, 0.6, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 })
    )
    vipPlatform.position.set(0, 0.3, 1.2)
    scene.add(vipPlatform)

    // 2. Giant Cinema Stage & Glowing IMAX Frame at Z = -10.8
    const stageBase = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.9, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.7 })
    )
    stageBase.position.set(0, 0.45, -10.2)
    scene.add(stageBase)

    const screenBorder = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 8.6, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.4 })
    )
    screenBorder.position.set(0, 5.1, -11.0)
    scene.add(screenBorder)

    const screenSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(14.4, 8.1),
      new THREE.MeshBasicMaterial({ color: 0x050507 })
    )
    screenSurface.position.set(0, 5.1, -10.8)
    scene.add(screenSurface)

    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.75 })
    const leftCurtain = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 9.5, 16), curtainMat)
    leftCurtain.position.set(-8.4, 4.75, -10.6)
    const rightCurtain = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 9.5, 16), curtainMat)
    rightCurtain.position.set(8.4, 4.75, -10.6)
    scene.add(leftCurtain, rightCurtain)

    // 3. Build 14 Red Plush Cinema Armchairs with Cupholders
    const seatCushionMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 })
    const seatArmMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 })
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

    // 4. Manage Dynamic Real GLTF/VRM 3D Player Avatars in the Theater
    const characterInstances = new Map<string, CinemaCharacterInstance>()

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

    const topLeftWorld = new THREE.Vector3(-7.2, 5.1 + 4.05, -10.8)
    const bottomRightWorld = new THREE.Vector3(7.2, 5.1 - 4.05, -10.8)
    const screenNormal = new THREE.Vector3(0, 0, 1)
    const camToScreen = new THREE.Vector3()

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
        const speed = 5.2
        const len = Math.hypot(moveX, moveZ)
        const dx = (moveX / len) * speed * dt
        const dz = (moveZ / len) * speed * dt

        const cos = Math.cos(cameraYawRef.current)
        const sin = Math.sin(cameraYawRef.current)
        const worldDx = dx * cos + dz * sin
        const worldDz = dz * cos - dx * sin

        myPos.x = Math.max(-10.5, Math.min(10.5, myPos.x + worldDx))
        myPos.z = Math.max(-7.8, Math.min(8.5, myPos.z + worldDz))
        myPos.y = 0
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

      // 2. Dim lights when movie is playing
      const ws = watchStateRef.current
      const dimmed = ws?.lightsDimmed ?? Boolean(ws?.active && ws?.isPlaying)
      hemiLight.intensity = THREE.MathUtils.lerp(hemiLight.intensity, dimmed ? 0.55 : 1.35, 0.08)
      ceilingLight.intensity = THREE.MathUtils.lerp(ceilingLight.intensity, dimmed ? 0.35 : 1.45, 0.08)
      screenBounceLight.intensity = dimmed
        ? 4.0 + Math.sin(timeSec * 6) * 0.5
        : 2.0

      // 3. Sync all room peers into Real GLTF/VRM 3D Characters
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
            scene.remove(charInst.root)
          }
          charInst = createCinemaCharacterInstance(peer, cfg)
          scene.add(charInst.root)
          characterInstances.set(peer.id, charInst)
        }

        const defaultSeat = CINEMA_SEATS[idx % CINEMA_SEATS.length]
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

        // Advance Skeletal AnimationMixer (Motion-Capture Walk, Run, Dance, Idle)
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

        // Apply Real Skeletal Bone Overrides after mixer update (Seated posture, Eating Popcorn hand-to-mouth, Speaking nod)
        const rig = charInst.rig

        // Seated posture override on UpperLeg & LowerLeg bones
        if (seatIdx !== null && !charInst.actions['sitting']) {
          if (rig.leftUpperLeg) rig.leftUpperLeg.rotation.x = -Math.PI / 2.15
          if (rig.rightUpperLeg) rig.rightUpperLeg.rotation.x = -Math.PI / 2.15
          if (rig.leftLowerLeg) rig.leftLowerLeg.rotation.x = Math.PI / 2.2
          if (rig.rightLowerLeg) rig.rightLowerLeg.rotation.x = Math.PI / 2.2
          charInst.modelContainer.position.y = -0.32
        } else {
          charInst.modelContainer.position.y = 0
        }

        // REAL 3D POPCORN EATING ANIMATION:
        // Left arm holds the striped 3D Popcorn Bucket in front of chest,
        // Right arm reaches into the bucket, grabs a 3D buttered popcorn kernel, lifts it to the mouth, and chews with crumbs flying!
        if (emote === 'popcorn') {
          charInst.popcornBucket.visible = true
          charInst.eatingKernel.visible = true

          // Cycle 0 -> 1: 0..0.45 reach into bucket, 0.45..0.85 lift to mouth & chew
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
            // Chewing head motion!
            rig.head.rotation.x = Math.sin(timeSec * 28) * 0.14
          }

          // Animate flying popcorn crumbs near the mouth!
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

          // Wave / Cheer bone overrides when clip doesn't have dedicated arm wave
          if (emote === 'wave' && rig.rightUpperArm) {
            rig.rightUpperArm.rotation.z = -2.2 + Math.sin(timeSec * 14) * 0.45
          } else if (emote === 'cheer' && rig.leftUpperArm && rig.rightUpperArm) {
            rig.leftUpperArm.rotation.z = 2.3 + Math.sin(timeSec * 12) * 0.35
            rig.rightUpperArm.rotation.z = -2.3 - Math.sin(timeSec * 12) * 0.35
          }
        }

        // Speaking indicator ring + head talk animation
        const talking = isMe
          ? isSelfSpeakingRef.current
          : Boolean(speakingPeersRef.current[peer.id])
        const ringMat = charInst.talkRing.material as THREE.MeshBasicMaterial
        ringMat.opacity = talking ? 0.9 : 0.0
        if (talking && rig.head) {
          rig.head.rotation.x += Math.sin(timeSec * 22) * 0.09
        }

        // Aura pulse
        if (charInst.auraMesh) {
          charInst.auraMesh.rotation.y += 0.08
          const s = 1 + Math.sin(timeSec * 10) * 0.08
          charInst.auraMesh.scale.set(s, 1, s)
        }
      })

      // Remove disconnected peers
      characterInstances.forEach((inst, id) => {
        if (!activeIds.has(id)) {
          scene.remove(inst.root)
          characterInstances.delete(id)
        }
      })

      // 4. Camera Modes
      const viewMode = cameraViewRef.current
      if (viewMode === 'screen-closeup') {
        camera.position.lerp(new THREE.Vector3(0, 5.1, -0.8), 0.15)
        camera.lookAt(0, 5.1, -10.8)
      } else if (viewMode === 'seat-pov') {
        const targetCam = new THREE.Vector3(myPos.x, myPos.y + 1.85, myPos.z - 0.18)
        camera.position.lerp(targetCam, 0.2)
        camera.lookAt(0, 4.9, -10.8)
      } else {
        const dist = 5.4
        const camX = myPos.x + Math.sin(cameraYawRef.current) * dist
        const camZ = myPos.z + Math.cos(cameraYawRef.current) * dist
        const camY = Math.max(1.2, myPos.y + 2.45 + cameraPitchRef.current * 3.0)
        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.22)
        camera.lookAt(myPos.x * 0.35, 3.6, -10.8)
      }

      camera.updateMatrixWorld()

      // 5. Project 3D Movie Screen bounds to 2D overlay coordinates
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
            👘 Modelos 3D Reais, Anime & Roupas
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
        <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

        {/* PROJECTED GIANT MOVIE SCREEN OVERLAY */}
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
                    👘 Modelos 3D Reais (.GLB / .VRM Anime), Roupas & Acessórios
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Escolha um modelo 3D articulado real (ReadyPlayerMe, VRoid Anime VRM, Mixamo) ou
                    cole o link de qualquer modelo <code className="text-amber-300">.vrm</code> /{' '}
                    <code className="text-amber-300">.glb</code>!
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
                    🧍 1. Escolha o Corpo / Modelo 3D Real Articulado (GLTF / VRM)
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {REAL_3D_MODELS.map((m) => {
                      const active = (avatarConfig.modelType || 'streetwear-rpm') === m.id
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

                {/* Custom VRM / GLB URL Input (VRoid Hub, ReadyPlayerMe, Sketchfab, etc.) */}
                <div className="rounded-xl border border-indigo-500/30 bg-[#232428] p-3.5">
                  <label className="mb-1 block text-xs font-extrabold text-indigo-300">
                    🌐 Usar Qualquer Modelo .VRM (Anime) ou .GLB da Internet (Opcional)
                  </label>
                  <p className="mb-2 text-[11px] text-zinc-400">
                    Tem um link direto de avatar <code className="text-white">.vrm</code> (VRoid) ou{' '}
                    <code className="text-white">.glb</code> (ReadyPlayerMe)? Cole abaixo para
                    carregar seu próprio modelo 3D na sala:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={avatarConfig.customModelUrl || ''}
                      onChange={(e) =>
                        updateMyAvatar({
                          modelType: e.target.value.trim() ? 'custom-url' : 'streetwear-rpm',
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
                          updateMyAvatar({ modelType: 'streetwear-rpm', customModelUrl: '' })
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
                      👕 Cor da Jaqueta / Camisa 3D
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
                      👖 Cor da Calça / Traje Inferior 3D
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
