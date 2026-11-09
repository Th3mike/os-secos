'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { PrankEvent, PrankType } from '@/types/community'

export const PRANK_OPTIONS: {
  type: PrankType
  label: string
  shortLabel: string
  voiceEffectLabel: string
  color: string
}[] = [
  {
    type: 'bed',
    label: 'Mandar para a Cama',
    shortLabel: 'Ninar',
    voiceEffectLabel: 'Voz Sonolenta Bocejando sob o Cobertor (15s)',
    color: '#6366f1',
  },
  {
    type: 'bury',
    label: 'Enterrar na Cova',
    shortLabel: 'Enterrar',
    voiceEffectLabel: 'Voz Abafada Debaixo da Terra (15s)',
    color: '#a16207',
  },
  {
    type: 'coffin',
    label: 'Trancar no Caixão',
    shortLabel: 'Caixão',
    voiceEffectLabel: 'Voz Presa na Caixa de Madeira (15s)',
    color: '#b45309',
  },
  {
    type: 'reaper',
    label: 'Ceifador da Secura',
    shortLabel: 'Ceifar',
    voiceEffectLabel: 'Voz Fantasma do Além (15s)',
    color: '#7e22ce',
  },
  {
    type: 'water',
    label: 'Jogar Balde d’Água',
    shortLabel: 'Hidratar',
    voiceEffectLabel: 'Voz Afogada Borbulhando (15s)',
    color: '#0284c7',
  },
]

export function PrankIcon({ type, className = 'h-4 w-4' }: { type: PrankType; className?: string }) {
  switch (type) {
    case 'bed':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <path d="M2 4v16" strokeLinecap="round" />
          <path d="M2 8h18a2 2 0 0 1 2 2v10" strokeLinecap="round" />
          <path d="M2 17h20" strokeLinecap="round" />
          <path d="M6 8v9" strokeLinecap="round" />
          <circle cx="9.5" cy="11.5" r="1.5" />
        </svg>
      )
    case 'bury':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <path d="M7 20h10" strokeLinecap="round" />
          <path d="M9 20v-8a3 3 0 0 1 6 0v8" />
          <path d="M12 11v3" strokeLinecap="round" />
          <path d="M10.5 12.5h3" strokeLinecap="round" />
        </svg>
      )
    case 'coffin':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <polygon points="8,3 16,3 19,9 15,21 9,21 5,9" />
          <path d="M12 7v6" strokeLinecap="round" />
          <path d="M9.5 9.5h5" strokeLinecap="round" />
        </svg>
      )
    case 'reaper':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <circle cx="12" cy="10" r="6" />
          <circle cx="10" cy="9.5" r="1" fill="currentColor" />
          <circle cx="14" cy="9.5" r="1" fill="currentColor" />
          <path d="M9 16v3h6v-3" />
          <path d="M11 16v3M13 16v3" />
        </svg>
      )
    case 'water':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      )
  }
}

// Singleton WebGLRenderer so we NEVER recreate/destroy GPU contexts while a 60/120fps WebRTC video stream is active!
// Recreating WebGL contexts and shadow maps in Chromium freezes GPU hardware video decoding & WGC screen capture.
let sharedRenderer: THREE.WebGLRenderer | null = null

function getSharedRenderer(width: number, height: number): THREE.WebGLRenderer {
  if (!sharedRenderer) {
    sharedRenderer = new THREE.WebGLRenderer({
      antialias: false, // Prevents multi-sample framebuffer contention with WebRTC hardware video decoder
      alpha: true,
      powerPreference: 'low-power',
      precision: 'mediump',
    })
    sharedRenderer.shadowMap.enabled = false // Zero shadow-map passes = zero GPU stalls on live streams
  }
  sharedRenderer.setPixelRatio(1)
  sharedRenderer.setSize(width, height)
  return sharedRenderer
}

function disposeSceneResources(scene: THREE.Scene) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry) {
      mesh.geometry.dispose()
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((mat) => {
        const stdMat = mat as THREE.MeshStandardMaterial
        if (stdMat.map) stdMat.map.dispose()
        mat.dispose()
      })
    }
  })
}

function createCharacterHeadTexture(avatarUrl: string, username: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  const drawFace = (img?: HTMLImageElement) => {
    ctx.fillStyle = '#27272a'
    ctx.fillRect(0, 0, 256, 256)

    if (img) {
      ctx.drawImage(img, 0, 0, 256, 256)
    } else {
      ctx.fillStyle = '#f59e0b'
      ctx.fillRect(20, 20, 216, 216)
    }

    // Thick cartoon border
    ctx.strokeStyle = '#18181b'
    ctx.lineWidth = 12
    ctx.strokeRect(6, 6, 244, 244)

    // Bottom name tag bar
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillRect(0, 208, 256, 48)
    ctx.fillStyle = '#ffffff'
    ctx.font = '900 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(username.slice(0, 14), 128, 240)
  }

  drawFace()
  const tex = new THREE.CanvasTexture(canvas)
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    drawFace(img)
    tex.needsUpdate = true
  }
  img.src = avatarUrl

  return tex
}

function createTextBoardTexture(
  line1: string,
  line2: string,
  bgColor = '#52525b',
  borderColor = '#27272a',
  textColor = '#fef08a'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, 256, 128)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 10
  ctx.strokeRect(5, 5, 246, 118)

  ctx.fillStyle = textColor
  ctx.font = '900 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(line1, 128, 56)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 21px sans-serif'
  ctx.fillText(line2, 128, 96)

  const tex = new THREE.CanvasTexture(canvas)
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  return tex
}

interface Humanoid3D {
  root: THREE.Group
  head: THREE.Mesh
  torso: THREE.Mesh
  leftArmPivot: THREE.Group
  rightArmPivot: THREE.Group
  leftLegPivot: THREE.Group
  rightLegPivot: THREE.Group
  shadowBlob: THREE.Mesh
}

function buildHumanoid3D(
  avatarUrl: string,
  username: string,
  shirtColor: number,
  pantsColor = 0x1e293b
): Humanoid3D {
  const root = new THREE.Group()

  // Lightweight contact shadow disc on the ground (replaces expensive WebGL shadow maps)
  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
  )
  shadowBlob.rotation.x = -Math.PI / 2
  shadowBlob.position.y = 0.02
  root.add(shadowBlob)

  // Head with Discord Avatar on front & back
  const headTex = createCharacterHeadTexture(avatarUrl, username)
  const headSideMat = new THREE.MeshLambertMaterial({ color: 0x3f3f46 })
  const headFaceMat = new THREE.MeshLambertMaterial({ map: headTex })
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.35, 1.35), [
    headSideMat,
    headSideMat,
    headSideMat,
    headSideMat,
    headFaceMat,
    headFaceMat,
  ])
  head.position.y = 2.55
  root.add(head)

  // Torso
  const torsoMat = new THREE.MeshLambertMaterial({ color: shirtColor })
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.45, 0.7), torsoMat)
  torso.position.y = 1.15
  root.add(torso)

  // Left Arm + Hand
  const armMat = new THREE.MeshLambertMaterial({ color: shirtColor })
  const handMat = new THREE.MeshLambertMaterial({ color: 0xfbbf24 })
  const leftArmPivot = new THREE.Group()
  leftArmPivot.position.set(-0.85, 1.75, 0)
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.25, 0.42), armMat)
  leftArm.position.y = -0.52
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), handMat)
  leftHand.position.y = -1.2
  leftArmPivot.add(leftArm, leftHand)
  root.add(leftArmPivot)

  // Right Arm + Hand
  const rightArmPivot = new THREE.Group()
  rightArmPivot.position.set(0.85, 1.75, 0)
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.25, 0.42), armMat)
  rightArm.position.y = -0.52
  const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), handMat)
  rightHand.position.y = -1.2
  rightArmPivot.add(rightArm, rightHand)
  root.add(rightArmPivot)

  // Left Leg + Shoe
  const legMat = new THREE.MeshLambertMaterial({ color: pantsColor })
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0x09090b })
  const leftLegPivot = new THREE.Group()
  leftLegPivot.position.set(-0.34, 0.45, 0)
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.15, 0.5), legMat)
  leftLeg.position.y = -0.52
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.25, 0.72), shoeMat)
  leftShoe.position.set(0, -1.05, 0.1)
  leftLegPivot.add(leftLeg, leftShoe)
  root.add(leftLegPivot)

  // Right Leg + Shoe
  const rightLegPivot = new THREE.Group()
  rightLegPivot.position.set(0.34, 0.45, 0)
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.15, 0.5), legMat)
  rightLeg.position.y = -0.52
  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.25, 0.72), shoeMat)
  rightShoe.position.set(0, -1.05, 0.1)
  rightLegPivot.add(rightLeg, rightShoe)
  root.add(rightLegPivot)

  return {
    root,
    head,
    torso,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    shadowBlob,
  }
}

interface PrankStageOverlayProps {
  activePrank: PrankEvent | null
  onComplete: () => void
}

export function PrankStageOverlay({ activePrank, onComplete }: PrankStageOverlayProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const onCompleteRef = useRef(onComplete)
  const [comicSubtitle, setComicSubtitle] = useState<string>('')
  const [expanded, setExpanded] = useState<boolean>(false)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!activePrank || !mountRef.current) return

    const container = mountRef.current
    const width = container.clientWidth || 360
    const height = container.clientHeight || 225

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x090a0f, 0.022)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 90)
    const baseCamPos = new THREE.Vector3(0, 4.3, 11.0)
    camera.position.copy(baseCamPos)
    camera.lookAt(0, 1.3, 0)

    const renderer = getSharedRenderer(width, height)
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Ultra-fast hemisphere + directional lighting (no shadow map passes)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1e1b4b, 1.15))
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.65)
    sunLight.position.set(5, 10, 7)
    scene.add(sunLight)

    // Ground stage island
    const groundMat = new THREE.MeshLambertMaterial({
      color:
        activePrank.type === 'water'
          ? 0x0f172a
          : activePrank.type === 'reaper'
          ? 0x1e1035
          : activePrank.type === 'bed'
          ? 0x1e1b4b
          : 0x3b2313,
    })
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.8, 0.8, 24), groundMat)
    ground.position.y = -0.4
    scene.add(ground)

    // Build BOTH 3D Characters: Attacker (fromUser) & Victim (targetUser)
    const attacker = buildHumanoid3D(
      activePrank.fromUser.avatar_url,
      activePrank.fromUser.username,
      0x2563eb // Blue shirt for attacker
    )
    const victim = buildHumanoid3D(
      activePrank.targetUser.avatar_url,
      activePrank.targetUser.username,
      activePrank.type === 'bed' ? 0xec4899 : 0xdc2626 // Pink pajamas for bed prank!
    )
    scene.add(attacker.root)
    scene.add(victim.root)

    // Scene props
    const dirtClods: { mesh: THREE.Mesh; progress: number; speed: number; offsetZ: number }[] = []
    let dirtMound: THREE.Mesh | null = null
    let tombstone: THREE.Mesh | null = null
    let woodenSign: THREE.Group | null = null

    let coffinGroup: THREE.Group | null = null
    let coffinLidPivot: THREE.Group | null = null
    let hammerGroup: THREE.Group | null = null

    let reaperCloak: THREE.Mesh | null = null
    let scytheWeapon: THREE.Group | null = null
    let ghostVictim: Humanoid3D | null = null

    let waterBucket: THREE.Group | null = null
    let aquariumTank: THREE.Mesh | null = null
    let waterPuddle: THREE.Mesh | null = null
    const waterDrops: { mesh: THREE.Mesh; vy: number; vx: number; vz: number }[] = []

    // BED ("Mandar para a Cama") props
    let bedGroup: THREE.Group | null = null
    let blanketMesh: THREE.Mesh | null = null
    let nightcapGroup: THREE.Group | null = null
    let moonGroup: THREE.Group | null = null
    const zzzSprites: { mesh: THREE.Mesh; offset: number }[] = []

    // =========================================================================
    // SETUP 0: BED ("Mandar para a Cama")
    // Story: Cozy 3D wooden bed with pillow & blanket -> Attacker carries victim horizontally in arms ->
    // Attacker lays victim onto the mattress, puts a cute nightcap on their head, pulls the blanket up to their chin,
    // pats their head while floating "Zzz" & glowing crescent moon appear!
    // =========================================================================
    if (activePrank.type === 'bed') {
      bedGroup = new THREE.Group()
      const woodMat = new THREE.MeshLambertMaterial({ color: 0x78350f })
      const mattressMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc })
      const pillowMat = new THREE.MeshLambertMaterial({ color: 0xe0e7ff })

      // Bed frame base
      const frame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.45, 2.5), woodMat)
      frame.position.set(0, 0.55, 0)
      bedGroup.add(frame)

      // 4 bed legs
      const legGeo = new THREE.BoxGeometry(0.28, 0.65, 0.28)
      const legPositions = [
        [-2.1, 0.32, -1.05],
        [2.1, 0.32, -1.05],
        [-2.1, 0.32, 1.05],
        [2.1, 0.32, 1.05],
      ]
      legPositions.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, woodMat)
        leg.position.set(lx, ly, lz)
        bedGroup!.add(leg)
      })

      // Tall wooden headboard with sign "HORA DE MIMIR"
      const headboardTex = createTextBoardTexture(
        '💤 A MIMIR',
        activePrank.targetUser.username.slice(0, 14),
        '#4338ca',
        '#312e81',
        '#fde047'
      )
      const headboard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.3, 2.5), [
        new THREE.MeshLambertMaterial({ map: headboardTex }),
        woodMat,
        woodMat,
        woodMat,
        woodMat,
        woodMat,
      ])
      headboard.position.set(2.15, 1.5, 0)
      bedGroup.add(headboard)

      // Footboard
      const footboard = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 2.5), woodMat)
      footboard.position.set(-2.18, 0.95, 0)
      bedGroup.add(footboard)

      // Soft white mattress
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.45, 2.25), mattressMat)
      mattress.position.set(0, 0.95, 0)
      bedGroup.add(mattress)

      // Fluffy pillow on the right side (near headboard)
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 1.55), pillowMat)
      pillow.position.set(1.45, 1.28, 0)
      pillow.rotation.z = 0.12
      bedGroup.add(pillow)

      // Cozy Indigo/Starry Blanket (starts folded at the foot of the bed, then slides over victim!)
      const blanketTex = createTextBoardTexture(
        '🌙 BONS SONHOS',
        'NANA NENÉM',
        '#4f46e5',
        '#3730a3',
        '#fef08a'
      )
      blanketMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.1, 0.55, 2.34),
        new THREE.MeshLambertMaterial({ map: blanketTex })
      )
      blanketMesh.position.set(-1.35, 1.28, 0)
      blanketMesh.scale.set(0.22, 1, 1)
      bedGroup.add(blanketMesh)

      bedGroup.position.set(0.85, 0, -0.25)
      scene.add(bedGroup)

      // Cute sleeping nightcap (touca de dormir) attached to victim's head
      nightcapGroup = new THREE.Group()
      const capCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.68, 1.25, 12),
        new THREE.MeshLambertMaterial({ color: 0x6366f1 })
      )
      capCone.position.set(0, 1.1, 0)
      capCone.rotation.z = -0.35
      const pomPom = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshLambertMaterial({ color: 0xffffff })
      )
      pomPom.position.set(0.25, 1.68, 0)
      nightcapGroup.add(capCone, pomPom)
      nightcapGroup.visible = false
      victim.head.add(nightcapGroup)

      // Glowing yellow Crescent Moon in the sky
      moonGroup = new THREE.Group()
      const moonSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      )
      moonGroup.add(moonSphere)
      moonGroup.position.set(3.4, 4.3, -2.5)
      scene.add(moonGroup)

      // Floating "Zzz" sleep boards rising from the pillow
      for (let i = 0; i < 3; i++) {
        const zTex = createTextBoardTexture(
          i === 0 ? 'Zzz...' : i === 1 ? '💤 ZZZ' : 'MIMINDO',
          '',
          '#312e81',
          '#6366f1',
          '#fef08a'
        )
        const zMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 0.48, 0.06),
          new THREE.MeshBasicMaterial({ map: zTex })
        )
        zMesh.visible = false
        scene.add(zMesh)
        zzzSprites.push({ mesh: zMesh, offset: i * 0.33 })
      }

      // Initial positions: Attacker carries victim from the left toward the bed
      attacker.root.position.set(-4.2, 0, 0.4)
      attacker.root.rotation.y = 0.35
      victim.root.position.set(-3.4, 1.45, 0.9)
      victim.root.rotation.z = -Math.PI / 2.2
    }

    // =========================================================================
    // SETUP 1: BURY ("Enterrar na Cova")
    // =========================================================================
    if (activePrank.type === 'bury') {
      const holeMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.75, 1.75, 0.85, 20),
        new THREE.MeshBasicMaterial({ color: 0x050302 })
      )
      holeMesh.position.set(0.4, -0.35, 0)
      scene.add(holeMesh)

      attacker.root.position.set(-2.6, 0, 0.3)
      attacker.root.rotation.y = 0.45

      const shovel = new THREE.Group()
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 2.5, 8),
        new THREE.MeshLambertMaterial({ color: 0x92400e })
      )
      handle.position.y = -0.6
      shovel.add(handle)
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.8, 0.08),
        new THREE.MeshLambertMaterial({ color: 0x9ca3af })
      )
      blade.position.y = -1.85
      shovel.add(blade)
      shovel.rotation.x = Math.PI / 2.2
      attacker.rightArmPivot.add(shovel)

      victim.root.position.set(0.4, 0, 0)

      dirtMound = new THREE.Mesh(
        new THREE.SphereGeometry(1.95, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: 0x452711 })
      )
      dirtMound.position.set(0.4, -0.05, 0)
      dirtMound.scale.set(1, 0.001, 1)
      scene.add(dirtMound)

      const clodGeo = new THREE.DodecahedronGeometry(0.26, 0)
      const clodMat = new THREE.MeshLambertMaterial({ color: 0x5c3417 })
      for (let i = 0; i < 18; i++) {
        const mesh = new THREE.Mesh(clodGeo, clodMat)
        mesh.visible = false
        scene.add(mesh)
        dirtClods.push({
          mesh,
          progress: (i / 18) * 1.0,
          speed: 1.4 + Math.random() * 0.6,
          offsetZ: (Math.random() - 0.5) * 1.1,
        })
      }

      const ripTex = createTextBoardTexture(
        'R.I.P. SECO',
        activePrank.targetUser.username.slice(0, 14),
        '#52525b',
        '#27272a',
        '#fef08a'
      )
      const stoneMat = new THREE.MeshLambertMaterial({ color: 0x71717a })
      tombstone = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 0.55), [
        stoneMat,
        stoneMat,
        stoneMat,
        stoneMat,
        new THREE.MeshLambertMaterial({ map: ripTex }),
        stoneMat,
      ])
      tombstone.position.set(0.4, 12, -1.3)
      scene.add(tombstone)

      woodenSign = new THREE.Group()
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8),
        new THREE.MeshLambertMaterial({ color: 0x78350f })
      )
      post.position.y = 1.1
      woodenSign.add(post)
      const boardTex = createTextBoardTexture('TERRA ↓', '100% ENTERRADO', '#78350f', '#451a03')
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 1.05, 0.14),
        new THREE.MeshLambertMaterial({ map: boardTex })
      )
      board.position.y = 1.85
      woodenSign.add(board)
      woodenSign.position.set(2.4, 10, 0.6)
      woodenSign.rotation.y = -0.35
      scene.add(woodenSign)
    }

    // =========================================================================
    // SETUP 2: COFFIN ("Trancar no Caixão")
    // =========================================================================
    if (activePrank.type === 'coffin') {
      coffinGroup = new THREE.Group()
      const woodMat = new THREE.MeshLambertMaterial({ color: 0x4a2511 })
      const innerMat = new THREE.MeshLambertMaterial({ color: 0x1a0b05 })

      const backWall = new THREE.Mesh(new THREE.BoxGeometry(2.5, 4.2, 0.25), woodMat)
      backWall.position.set(0, 2.1, -0.95)
      coffinGroup.add(backWall)

      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.2, 1.9), woodMat)
      leftWall.position.set(-1.15, 2.1, 0)
      coffinGroup.add(leftWall)

      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.2, 1.9), woodMat)
      rightWall.position.set(1.15, 2.1, 0)
      coffinGroup.add(rightWall)

      const bottomWall = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.25, 1.9), innerMat)
      bottomWall.position.set(0, 0.1, 0)
      coffinGroup.add(bottomWall)

      const topWall = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.25, 1.9), innerMat)
      topWall.position.set(0, 4.1, 0)
      coffinGroup.add(topWall)

      coffinLidPivot = new THREE.Group()
      coffinLidPivot.position.set(1.25, 2.1, 0.95)
      const lidTex = createTextBoardTexture(
        '⚰️ DESCANSE',
        activePrank.targetUser.username.slice(0, 14),
        '#3b1d0d',
        '#1a0b05'
      )
      const lidMesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 4.2, 0.22),
        new THREE.MeshLambertMaterial({ map: lidTex })
      )
      lidMesh.position.set(-1.25, 0, 0)
      coffinLidPivot.add(lidMesh)
      coffinLidPivot.rotation.y = Math.PI * 0.75
      coffinGroup.add(coffinLidPivot)

      coffinGroup.position.set(0.6, 0, -0.4)
      scene.add(coffinGroup)

      victim.root.position.set(0.6, 0, 1.3)

      attacker.root.position.set(-2.5, 0, 0.8)
      attacker.root.rotation.y = 0.55

      hammerGroup = new THREE.Group()
      const hStick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8),
        new THREE.MeshLambertMaterial({ color: 0x92400e })
      )
      hStick.position.y = -0.6
      hammerGroup.add(hStick)
      const hHead = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.45, 0.45),
        new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
      )
      hHead.position.y = -1.45
      hammerGroup.add(hHead)
      hammerGroup.rotation.x = Math.PI / 2
      attacker.rightArmPivot.add(hammerGroup)
    }

    // =========================================================================
    // SETUP 3: REAPER ("Ceifador da Secura")
    // =========================================================================
    if (activePrank.type === 'reaper') {
      reaperCloak = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 2.6, 12),
        new THREE.MeshLambertMaterial({ color: 0x111827 })
      )
      reaperCloak.position.y = 1.3
      attacker.root.add(reaperCloak)

      scytheWeapon = new THREE.Group()
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 3.8, 8),
        new THREE.MeshLambertMaterial({ color: 0x1f2937 })
      )
      pole.position.y = -0.8
      scytheWeapon.add(pole)

      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 2.3, 4),
        new THREE.MeshLambertMaterial({
          color: 0xe9d5ff,
          emissive: 0x9333ea,
          emissiveIntensity: 0.7,
        })
      )
      blade.rotation.z = Math.PI / 2.1
      blade.position.set(1.0, -2.4, 0)
      scytheWeapon.add(blade)
      scytheWeapon.rotation.x = Math.PI / 2
      attacker.rightArmPivot.add(scytheWeapon)

      attacker.root.position.set(-4.2, 0, 0.6)
      attacker.root.rotation.y = 0.5
      victim.root.position.set(0.8, 0, 0)

      ghostVictim = buildHumanoid3D(
        activePrank.targetUser.avatar_url,
        activePrank.targetUser.username,
        0xa855f7,
        0x7e22ce
      )
      ghostVictim.shadowBlob.visible = false
      ghostVictim.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh
          if (Array.isArray(m.material)) {
            m.material = m.material.map((mat) => {
              const cloned = mat.clone()
              cloned.transparent = true
              cloned.opacity = 0.65
              return cloned
            })
          } else {
            const cloned = m.material.clone()
            cloned.transparent = true
            cloned.opacity = 0.65
            m.material = cloned
          }
        }
      })
      ghostVictim.root.position.set(0.8, 0, 0)
      ghostVictim.root.visible = false
      scene.add(ghostVictim.root)
    }

    // =========================================================================
    // SETUP 4: WATER ("Hidratar o Seco")
    // =========================================================================
    if (activePrank.type === 'water') {
      attacker.root.position.set(-2.5, 1.4, 0)
      attacker.root.rotation.y = 0.45

      const stepBox = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.4, 1.8),
        new THREE.MeshLambertMaterial({ color: 0x334155 })
      )
      stepBox.position.set(-2.5, 0.7, 0)
      scene.add(stepBox)

      waterBucket = new THREE.Group()
      const bucketCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.62, 1.45, 16),
        new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
      )
      waterBucket.add(bucketCyl)
      waterBucket.position.set(-0.9, 3.6, 0)
      scene.add(waterBucket)

      victim.root.position.set(0.7, 0, 0)

      aquariumTank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.85, 1.85, 3.8, 20),
        new THREE.MeshLambertMaterial({
          color: 0x0ea5e9,
          transparent: true,
          opacity: 0.42,
        })
      )
      aquariumTank.position.set(0.7, 0.01, 0)
      aquariumTank.scale.set(1, 0.01, 1)
      scene.add(aquariumTank)

      waterPuddle = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 3.2, 0.08, 20),
        new THREE.MeshLambertMaterial({ color: 0x0284c7 })
      )
      waterPuddle.position.set(0.7, 0.04, 0)
      waterPuddle.scale.set(0.01, 1, 0.01)
      scene.add(waterPuddle)

      const dropGeo = new THREE.SphereGeometry(0.22, 8, 8)
      const dropMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 })
      for (let i = 0; i < 36; i++) {
        const mesh = new THREE.Mesh(dropGeo, dropMat)
        mesh.position.set(
          0.1 + (Math.random() - 0.5) * 1.1,
          3.4 + Math.random() * 3.5,
          (Math.random() - 0.5) * 1.1
        )
        mesh.visible = false
        scene.add(mesh)
        waterDrops.push({
          mesh,
          vy: -(0.14 + Math.random() * 0.1),
          vx: 0.02 + (Math.random() - 0.5) * 0.04,
          vz: (Math.random() - 0.5) * 0.04,
        })
      }
    }

    // =========================================================================
    // STORYBOARD ANIMATION LOOP (Throttled to 30 FPS so live streams never stutter!)
    // =========================================================================
    let frameId = 0
    const startTime = performance.now()
    let lastRenderTime = 0
    let currentSubtitle = ''

    const updateSubtitle = (text: string) => {
      if (text !== currentSubtitle) {
        currentSubtitle = text
        setComicSubtitle(text)
      }
    }

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate)

      // Cap 3D prank rendering at ~30 FPS (33ms) so the GPU stays 100% free for 60/120fps WebRTC video!
      if (now - lastRenderTime < 32) return
      lastRenderTime = now

      const elapsed = (now - startTime) / 1000
      let shakeIntensity = 0

      if (activePrank.type === 'bed') {
        if (elapsed < 1.35) {
          // ACT 1: Attacker carries victim in their arms walking to the cozy bed
          updateSubtitle(
            `${activePrank.fromUser.username} está levando ${activePrank.targetUser.username} no colo para a cama!`
          )
          const t = Math.min(1, elapsed / 1.35)
          const walkBob = Math.abs(Math.sin(elapsed * 14)) * 0.22
          attacker.root.position.set(-4.2 + t * 3.1, walkBob, 0.85)
          attacker.leftLegPivot.rotation.x = Math.sin(elapsed * 14) * 0.8
          attacker.rightLegPivot.rotation.x = -Math.sin(elapsed * 14) * 0.8
          attacker.leftArmPivot.rotation.x = -1.35
          attacker.rightArmPivot.rotation.x = -1.35

          // Victim carried horizontally in attacker's arms kicking feet playfully
          victim.shadowBlob.visible = false
          victim.root.position.set(attacker.root.position.x + 0.9, 1.5 + walkBob, 1.1)
          victim.root.rotation.set(0, 0, -Math.PI / 2.15)
          victim.leftLegPivot.rotation.x = Math.sin(elapsed * 20) * 0.5
          victim.rightLegPivot.rotation.x = -Math.sin(elapsed * 20) * 0.5
        } else if (elapsed < 2.65) {
          // ACT 2: Attacker gently lays victim onto the mattress & puts nightcap on head
          updateSubtitle(
            `Colocando ${activePrank.targetUser.username} no travesseiro e puxando o cobertor...`
          )
          const t = Math.min(1, (elapsed - 1.35) / 1.2)
          if (nightcapGroup) nightcapGroup.visible = true

          // Victim settles onto the bed with head on the right pillow
          victim.root.position.set(-0.6 + t * 0.35, 1.55 - t * 0.15, 0.85 - t * 1.05)
          victim.root.rotation.set(0, 0, -Math.PI / 2)
          victim.leftLegPivot.rotation.x = 0
          victim.rightLegPivot.rotation.x = 0
          victim.leftArmPivot.rotation.x = 0
          victim.rightArmPivot.rotation.x = 0

          // Attacker leans over the bed pulling the blanket from foot to chin
          attacker.root.position.set(-1.1 + t * 1.4, 0, 1.05)
          attacker.root.rotation.y = 2.6
          attacker.leftArmPivot.rotation.x = -0.9 + Math.sin(elapsed * 14) * 0.35
          attacker.rightArmPivot.rotation.x = -0.9 - Math.sin(elapsed * 14) * 0.35

          if (blanketMesh) {
            const bScale = 0.22 + t * 0.78
            blanketMesh.scale.set(bScale, 1, 1)
            blanketMesh.position.x = -1.35 + t * 1.05
          }
        } else {
          // ACT 3: Victim is tucked in snoring with floating "Zzz" & attacker pats their head ("Nana neném")!
          updateSubtitle(
            `🛌 BONS SONHOS! ${activePrank.targetUser.username.toUpperCase()} FOI MANDADO PRA CAMA!`
          )
          // Attacker stands next to the pillow patting victim's head gently
          attacker.root.position.set(1.55, 0, 1.15)
          attacker.root.rotation.y = 2.85
          attacker.rightArmPivot.rotation.x = -1.15 + Math.sin(elapsed * 12) * 0.32
          attacker.leftArmPivot.rotation.x = -0.3

          // Blanket breathes up and down as victim snores
          if (blanketMesh) {
            blanketMesh.scale.set(1, 1 + Math.sin(elapsed * 5) * 0.12, 1)
          }

          // Moon gently rocks
          if (moonGroup) {
            moonGroup.position.y = 4.3 + Math.sin(elapsed * 3) * 0.2
          }

          // Floating Zzz bubbles rising above victim's head
          zzzSprites.forEach((z) => {
            z.mesh.visible = true
            const cycle = ((elapsed - 2.65) * 0.55 + z.offset) % 1
            z.mesh.position.set(
              1.9 + Math.sin(cycle * Math.PI * 2) * 0.35,
              1.9 + cycle * 2.6,
              0
            )
            const s = 0.65 + Math.sin(cycle * Math.PI) * 0.5
            z.mesh.scale.set(s, s, s)
          })
        }
      } else if (activePrank.type === 'bury') {
        if (elapsed < 1.1) {
          updateSubtitle(
            `${activePrank.fromUser.username} empurrou ${activePrank.targetUser.username} direto na cova!`
          )
          const t = elapsed / 1.1
          attacker.root.position.x = -2.6 + t * 1.35
          attacker.leftLegPivot.rotation.x = -Math.sin(t * Math.PI) * 1.3
          attacker.rightArmPivot.rotation.x = -Math.sin(t * Math.PI) * 1.0

          if (elapsed > 0.42) {
            const fallT = (elapsed - 0.42) / 0.68
            victim.shadowBlob.visible = false
            victim.root.position.y = -fallT * 2.15
            victim.root.rotation.z = -fallT * 0.35
            victim.leftArmPivot.rotation.z = 2.6
            victim.rightArmPivot.rotation.z = -2.6
          }
        } else if (elapsed < 3.6) {
          updateSubtitle(`Jogando terra por cima de ${activePrank.targetUser.username}...`)
          victim.root.position.y = -2.15 - (elapsed - 1.1) * 0.35
          victim.leftArmPivot.rotation.x = Math.sin(elapsed * 22) * 0.9
          victim.rightArmPivot.rotation.x = -Math.sin(elapsed * 22) * 0.9
          victim.head.rotation.y = Math.sin(elapsed * 16) * 0.45

          attacker.rightArmPivot.rotation.x = -0.8 + Math.sin(elapsed * 14) * 0.85
          attacker.torso.rotation.y = Math.sin(elapsed * 14) * 0.25

          dirtClods.forEach((c) => {
            c.mesh.visible = true
            c.progress = (c.progress + 0.045 * c.speed) % 1
            const p = c.progress
            c.mesh.position.x = -1.0 + p * 1.55
            c.mesh.position.y = 1.2 + Math.sin(p * Math.PI) * 1.9 - p * 1.4
            c.mesh.position.z = c.offsetZ
            c.mesh.rotation.x += 0.2
            c.mesh.rotation.y += 0.2
          })

          if (dirtMound) {
            const moundProgress = Math.min(1, (elapsed - 1.1) / 2.3)
            dirtMound.scale.set(1, moundProgress * 0.95, 1)
          }
        } else {
          updateSubtitle(`🪦 R.I.P. ${activePrank.targetUser.username} — SOTERRADO COM SUCESSO!`)
          dirtClods.forEach((c) => (c.mesh.visible = false))
          victim.root.visible = false

          if (tombstone) {
            if (tombstone.position.y > 1.55) {
              tombstone.position.y = Math.max(1.55, tombstone.position.y - 1.35)
              if (tombstone.position.y <= 1.6) shakeIntensity = 0.35
            }
          }
          if (woodenSign) {
            woodenSign.position.y = Math.max(0, woodenSign.position.y - 1.2)
          }
          attacker.root.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.45
          attacker.leftArmPivot.rotation.z = 2.5
          attacker.rightArmPivot.rotation.z = -2.5
        }
      } else if (activePrank.type === 'coffin') {
        if (elapsed < 1.2) {
          updateSubtitle(
            `${activePrank.fromUser.username} jogou ${activePrank.targetUser.username} dentro do caixão!`
          )
          const t = Math.min(1, elapsed / 0.9)
          attacker.root.position.x = -2.5 + t * 1.3
          attacker.leftArmPivot.rotation.x = -Math.PI / 2

          victim.root.position.z = 1.3 - t * 1.65
          victim.root.position.y = 0.25 * Math.sin(t * Math.PI)
          victim.leftArmPivot.rotation.z = 2.2
          victim.rightArmPivot.rotation.z = -2.2
          victim.head.rotation.y = Math.sin(elapsed * 20) * 0.4
        } else if (elapsed < 2.3) {
          updateSubtitle(`TRANCANDO A TAMPA DO CAIXÃO!`)
          if (coffinLidPivot) {
            coffinLidPivot.rotation.y = Math.max(0, coffinLidPivot.rotation.y - 0.28)
            if (coffinLidPivot.rotation.y === 0 && elapsed < 1.55) {
              shakeIntensity = 0.3
            }
          }
          if (coffinLidPivot && coffinLidPivot.rotation.y < 0.2) {
            victim.root.visible = false
          }
        } else if (elapsed < 3.7) {
          updateSubtitle(
            `Pregando a tampa! ${activePrank.targetUser.username} está batendo lá dentro!`
          )
          attacker.rightArmPivot.rotation.x = -0.6 + Math.sin(elapsed * 24) * 0.95
          if (coffinGroup) {
            coffinGroup.rotation.z = Math.sin(elapsed * 30) * 0.06
            coffinGroup.position.x = 0.6 + Math.cos(elapsed * 28) * 0.05
          }
          shakeIntensity = 0.08
        } else {
          updateSubtitle(`⚰️ ${activePrank.targetUser.username} FOI ENCOMENDADO PRO ALÉM!`)
          if (coffinGroup) {
            coffinGroup.rotation.y += 0.22
            coffinGroup.position.y -= 0.14
          }
          attacker.root.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.4
        }
      } else if (activePrank.type === 'reaper') {
        if (elapsed < 1.35) {
          updateSubtitle(
            `💀 O Ceifador ${activePrank.fromUser.username} veio buscar a alma de ${activePrank.targetUser.username}!`
          )
          const t = Math.min(1, elapsed / 1.1)
          attacker.root.position.x = -4.2 + t * 3.4
          attacker.rightArmPivot.rotation.y = -1.5 + t * 3.2
          attacker.rightArmPivot.rotation.x = -0.7

          victim.leftArmPivot.rotation.z = 2.5
          victim.rightArmPivot.rotation.z = -2.5
          victim.head.rotation.z = Math.sin(elapsed * 25) * 0.25
        } else {
          updateSubtitle(`👻 A ALMA DE ${activePrank.targetUser.username.toUpperCase()} SAIU DO CORPO!`)
          if (elapsed < 1.6) shakeIntensity = 0.32

          victim.shadowBlob.visible = false
          victim.root.rotation.x = Math.min(Math.PI / 2, victim.root.rotation.x + 0.22)
          victim.root.position.y = Math.max(0.25, victim.root.position.y - 0.08)

          if (ghostVictim) {
            ghostVictim.root.visible = true
            ghostVictim.root.position.y += 0.055
            ghostVictim.root.position.x = 0.8 + Math.sin(elapsed * 4) * 0.45
            ghostVictim.root.rotation.y = Math.sin(elapsed * 3) * 0.45
            ghostVictim.leftArmPivot.rotation.z = 2.4 + Math.sin(elapsed * 14) * 0.4
            ghostVictim.rightArmPivot.rotation.z = -2.4 - Math.sin(elapsed * 14) * 0.4
          }
        }
      } else if (activePrank.type === 'water') {
        if (elapsed < 0.9) {
          updateSubtitle(
            `${activePrank.fromUser.username} virou o balde d'água gelada em ${activePrank.targetUser.username}!`
          )
          const t = elapsed / 0.9
          if (waterBucket) {
            waterBucket.rotation.z = -t * 2.15
          }
          attacker.rightArmPivot.rotation.x = -t * 1.2
        } else {
          updateSubtitle(`🪣 ${activePrank.targetUser.username} ESTÁ AFOGADO TENTANDO NADAR!`)
          waterDrops.forEach((d) => {
            d.mesh.visible = true
            d.mesh.position.x += d.vx * 1.6
            d.mesh.position.y += d.vy * 1.6
            d.mesh.position.z += d.vz * 1.6
            if (d.mesh.position.y < 0.2) {
              d.mesh.position.set(
                0.5 + (Math.random() - 0.5) * 0.9,
                3.3 + Math.random() * 0.5,
                (Math.random() - 0.5) * 0.9
              )
            }
          })

          const fillProgress = Math.min(1, (elapsed - 0.9) / 2.6)
          if (aquariumTank) {
            aquariumTank.scale.set(1, fillProgress, 1)
            aquariumTank.position.y = (fillProgress * 3.8) / 2
          }
          if (waterPuddle) {
            waterPuddle.scale.set(fillProgress, 1, fillProgress)
          }

          victim.shadowBlob.visible = false
          victim.root.position.y = fillProgress * 0.9 + Math.sin(elapsed * 8) * 0.18
          victim.root.rotation.y = Math.sin(elapsed * 5) * 0.5
          victim.root.rotation.z = Math.cos(elapsed * 6) * 0.2
          victim.leftArmPivot.rotation.x = Math.sin(elapsed * 18) * 1.3
          victim.rightArmPivot.rotation.x = -Math.sin(elapsed * 18) * 1.3
          victim.leftLegPivot.rotation.x = Math.cos(elapsed * 18) * 0.8
          victim.rightLegPivot.rotation.x = -Math.cos(elapsed * 18) * 0.8
        }
      }

      if (shakeIntensity > 0) {
        camera.position.set(
          baseCamPos.x + (Math.random() - 0.5) * shakeIntensity,
          baseCamPos.y + (Math.random() - 0.5) * shakeIntensity,
          baseCamPos.z
        )
      } else {
        camera.position.lerp(baseCamPos, 0.2)
      }
      camera.lookAt(0, 1.3, 0)

      renderer.render(scene, camera)
    }

    frameId = requestAnimationFrame(animate)

    const timer = setTimeout(() => {
      onCompleteRef.current()
    }, 5600)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frameId)
      disposeSceneResources(scene)
    }
    // IMPORTANT: Do NOT include inline `onComplete` in dependency array!
    // Otherwise every speaking-state or presence re-render in CommunityHub restarts the 3D WebGL scene!
  }, [activePrank, expanded])

  if (!activePrank) return null

  const prankMeta = PRANK_OPTIONS.find((p) => p.type === activePrank.type)

  return (
    <div
      className={`fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-amber-500/40 bg-[#111214] shadow-2xl transition-all select-none ${
        expanded
          ? 'right-6 bottom-20 h-[440px] w-[620px] max-w-[92vw]'
          : 'right-4 bottom-20 w-[360px] max-w-[90vw]'
      }`}
    >
      {/* Compact Top Header Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#18191c] px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-extrabold text-white">
            <span className="text-amber-400">{activePrank.fromUser.username}</span>{' '}
            {activePrank.type === 'bed' && 'mandou para a cama'}
            {activePrank.type === 'bury' && 'enterrou'}
            {activePrank.type === 'coffin' && 'trancou no caixão'}
            {activePrank.type === 'reaper' && 'ceifou'}
            {activePrank.type === 'water' && 'hidratou'}{' '}
            <span className="text-emerald-400">{activePrank.targetUser.username}</span>!
          </div>
          {prankMeta && (
            <div className="truncate text-[10px] font-bold text-amber-300">
              🎙️ {prankMeta.voiceEffectLabel}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="cursor-pointer rounded bg-[#2b2d31] px-2 py-0.5 text-[10px] font-bold text-zinc-300 hover:bg-[#35373c] hover:text-white"
            title={expanded ? 'Reduzir tamanho' : 'Aumentar tamanho'}
          >
            {expanded ? 'Menor' : 'Maior'}
          </button>
          <button
            type="button"
            onClick={onComplete}
            className="cursor-pointer rounded bg-[#da373c]/20 px-2 py-0.5 text-[10px] font-bold text-[#da373c] hover:bg-[#da373c] hover:text-white"
            title="Fechar animação 3D"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Three.js 3D Stage in Corner Picture-in-Picture */}
      <div
        ref={mountRef}
        className={`w-full bg-[#090a0f] ${expanded ? 'h-[330px]' : 'h-[215px]'}`}
      />

      {/* Live Story Subtitle Bar */}
      {comicSubtitle && (
        <div className="border-t border-white/10 bg-[#18191c] px-3 py-1.5 text-center text-[11px] font-extrabold text-amber-300">
          {comicSubtitle}
        </div>
      )}
    </div>
  )
}
