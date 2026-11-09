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

function createCharacterHeadTexture(avatarUrl: string, username: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  const drawFace = (img?: HTMLImageElement) => {
    ctx.fillStyle = '#27272a'
    ctx.fillRect(0, 0, 512, 512)

    if (img) {
      ctx.drawImage(img, 0, 0, 512, 512)
    } else {
      ctx.fillStyle = '#f59e0b'
      ctx.fillRect(40, 40, 432, 432)
    }

    // Thick cartoon border
    ctx.strokeStyle = '#18181b'
    ctx.lineWidth = 22
    ctx.strokeRect(11, 11, 490, 490)

    // Bottom name tag bar on forehead/chin
    ctx.fillStyle = 'rgba(0,0,0,0.72)'
    ctx.fillRect(0, 420, 512, 92)
    ctx.fillStyle = '#ffffff'
    ctx.font = '900 44px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(username.slice(0, 14), 256, 480)
  }

  drawFace()
  const tex = new THREE.CanvasTexture(canvas)

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
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, 512, 256)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 18
  ctx.strokeRect(9, 9, 494, 238)

  ctx.fillStyle = textColor
  ctx.font = '900 56px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(line1, 256, 115)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 42px sans-serif'
  ctx.fillText(line2, 256, 190)

  return new THREE.CanvasTexture(canvas)
}

interface Humanoid3D {
  root: THREE.Group
  head: THREE.Mesh
  torso: THREE.Mesh
  leftArmPivot: THREE.Group
  rightArmPivot: THREE.Group
  leftLegPivot: THREE.Group
  rightLegPivot: THREE.Group
}

function buildHumanoid3D(
  avatarUrl: string,
  username: string,
  shirtColor: number,
  pantsColor = 0x1e293b
): Humanoid3D {
  const root = new THREE.Group()

  // Head with Discord Avatar on front & back
  const headTex = createCharacterHeadTexture(avatarUrl, username)
  const headSideMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.6 })
  const headFaceMat = new THREE.MeshStandardMaterial({ map: headTex, roughness: 0.3 })
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.35, 1.35), [
    headSideMat,
    headSideMat,
    headSideMat,
    headSideMat,
    headFaceMat,
    headFaceMat,
  ])
  head.position.y = 2.55
  head.castShadow = true
  root.add(head)

  // Torso
  const torsoMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.6 })
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.45, 0.7), torsoMat)
  torso.position.y = 1.15
  torso.castShadow = true
  root.add(torso)

  // Left Arm
  const armMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.6 })
  const leftArmPivot = new THREE.Group()
  leftArmPivot.position.set(-0.85, 1.75, 0)
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.3, 0.42), armMat)
  leftArm.position.y = -0.55
  leftArm.castShadow = true
  leftArmPivot.add(leftArm)
  root.add(leftArmPivot)

  // Right Arm
  const rightArmPivot = new THREE.Group()
  rightArmPivot.position.set(0.85, 1.75, 0)
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.3, 0.42), armMat)
  rightArm.position.y = -0.55
  rightArm.castShadow = true
  rightArmPivot.add(rightArm)
  root.add(rightArmPivot)

  // Left Leg
  const legMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 })
  const leftLegPivot = new THREE.Group()
  leftLegPivot.position.set(-0.34, 0.45, 0)
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.2, 0.5), legMat)
  leftLeg.position.y = -0.55
  leftLeg.castShadow = true
  leftLegPivot.add(leftLeg)
  root.add(leftLegPivot)

  // Right Leg
  const rightLegPivot = new THREE.Group()
  rightLegPivot.position.set(0.34, 0.45, 0)
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.2, 0.5), legMat)
  rightLeg.position.y = -0.55
  rightLeg.castShadow = true
  rightLegPivot.add(rightLeg)
  root.add(rightLegPivot)

  return {
    root,
    head,
    torso,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
  }
}

interface PrankStageOverlayProps {
  activePrank: PrankEvent | null
  onComplete: () => void
}

export function PrankStageOverlay({ activePrank, onComplete }: PrankStageOverlayProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [comicSubtitle, setComicSubtitle] = useState<string>('')

  useEffect(() => {
    if (!activePrank || !mountRef.current) return

    const container = mountRef.current
    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || 520

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x090a0f, 0.025)

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 120)
    const baseCamPos = new THREE.Vector3(0, 4.4, 11.2)
    camera.position.copy(baseCamPos)
    camera.lookAt(0, 1.3, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.85))
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.4)
    sunLight.position.set(6, 12, 8)
    sunLight.castShadow = true
    scene.add(sunLight)

    const rimLight = new THREE.PointLight(
      activePrank.type === 'reaper'
        ? 0xa855f7
        : activePrank.type === 'water'
        ? 0x38bdf8
        : 0xf59e0b,
      5,
      22
    )
    rimLight.position.set(0, 4, 4)
    scene.add(rimLight)

    // Ground stage island
    const groundMat = new THREE.MeshStandardMaterial({
      color:
        activePrank.type === 'water'
          ? 0x0f172a
          : activePrank.type === 'reaper'
          ? 0x1e1035
          : 0x3b2313,
      roughness: 0.9,
    })
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 8.2, 0.8, 36), groundMat)
    ground.position.y = -0.4
    ground.receiveShadow = true
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
      0xdc2626 // Red shirt for victim
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

    // =========================================================================
    // SETUP 1: BURY ("Enterrar na Cova")
    // Story: Victim stands in front of open grave -> Attacker kicks/shoves victim into pit ->
    // Attacker uses shovel in right hand to throw dirt clods -> Dirt mound buries victim -> Tombstone drops!
    // =========================================================================
    if (activePrank.type === 'bury') {
      // Dark grave hole in the center
      const holeMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.75, 1.75, 0.85, 28),
        new THREE.MeshBasicMaterial({ color: 0x050302 })
      )
      holeMesh.position.set(0.4, -0.35, 0)
      scene.add(holeMesh)

      // Attacker on the left holding a 3D Shovel in right hand
      attacker.root.position.set(-2.6, 0, 0.3)
      attacker.root.rotation.y = 0.45

      const shovel = new THREE.Group()
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 2.5, 10),
        new THREE.MeshStandardMaterial({ color: 0x92400e })
      )
      handle.position.y = -0.6
      shovel.add(handle)
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.8, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7, roughness: 0.3 })
      )
      blade.position.y = -1.85
      shovel.add(blade)
      shovel.rotation.x = Math.PI / 2.2
      attacker.rightArmPivot.add(shovel)

      // Victim starts standing right at the edge of the grave
      victim.root.position.set(0.4, 0, 0)

      // Rising dirt mound
      dirtMound = new THREE.Mesh(
        new THREE.SphereGeometry(1.95, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x452711, roughness: 1 })
      )
      dirtMound.position.set(0.4, -0.05, 0)
      dirtMound.scale.set(1, 0.001, 1)
      scene.add(dirtMound)

      // Flying dirt clods thrown from attacker's shovel into the pit
      const clodGeo = new THREE.DodecahedronGeometry(0.26, 0)
      const clodMat = new THREE.MeshStandardMaterial({ color: 0x5c3417, roughness: 0.95 })
      for (let i = 0; i < 28; i++) {
        const mesh = new THREE.Mesh(clodGeo, clodMat)
        mesh.visible = false
        scene.add(mesh)
        dirtClods.push({
          mesh,
          progress: (i / 28) * 1.0,
          speed: 1.4 + Math.random() * 0.6,
          offsetZ: (Math.random() - 0.5) * 1.1,
        })
      }

      // Giant R.I.P. Tombstone ready to fall from the sky
      const ripTex = createTextBoardTexture(
        'R.I.P. SECO',
        activePrank.targetUser.username.slice(0, 14),
        '#52525b',
        '#27272a',
        '#fef08a'
      )
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.85 })
      tombstone = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 0.55), [
        stoneMat,
        stoneMat,
        stoneMat,
        stoneMat,
        new THREE.MeshStandardMaterial({ map: ripTex, roughness: 0.5 }),
        stoneMat,
      ])
      tombstone.position.set(0.4, 12, -1.3)
      scene.add(tombstone)

      // Funny wooden sign "TERRA ↓"
      woodenSign = new THREE.Group()
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x78350f })
      )
      post.position.y = 1.1
      woodenSign.add(post)
      const boardTex = createTextBoardTexture('TERRA ↓', '100% ENTERRADO', '#78350f', '#451a03')
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 1.05, 0.14),
        new THREE.MeshStandardMaterial({ map: boardTex })
      )
      board.position.y = 1.85
      woodenSign.add(board)
      woodenSign.position.set(2.4, 10, 0.6)
      woodenSign.rotation.y = -0.35
      scene.add(woodenSign)
    }

    // =========================================================================
    // SETUP 2: COFFIN ("Trancar no Caixão")
    // Story: Standing wooden coffin in center -> Attacker shoves victim backwards into coffin ->
    // Attacker slams the wooden lid shut -> Attacker hammers nails into the lid -> Coffin spins into the abyss!
    // =========================================================================
    if (activePrank.type === 'coffin') {
      coffinGroup = new THREE.Group()
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2511, roughness: 0.75 })
      const innerMat = new THREE.MeshStandardMaterial({ color: 0x1a0b05, roughness: 0.9 })

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

      // Hinged Door Lid
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
        new THREE.MeshStandardMaterial({ map: lidTex, roughness: 0.6 })
      )
      lidMesh.position.set(-1.25, 0, 0)
      coffinLidPivot.add(lidMesh)
      coffinLidPivot.rotation.y = Math.PI * 0.75
      coffinGroup.add(coffinLidPivot)

      coffinGroup.position.set(0.6, 0, -0.4)
      scene.add(coffinGroup)

      // Victim starts in front of the open coffin
      victim.root.position.set(0.6, 0, 1.3)

      // Attacker on the left with a giant 3D Hammer
      attacker.root.position.set(-2.5, 0, 0.8)
      attacker.root.rotation.y = 0.55

      hammerGroup = new THREE.Group()
      const hStick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1.8, 10),
        new THREE.MeshStandardMaterial({ color: 0x92400e })
      )
      hStick.position.y = -0.6
      hammerGroup.add(hStick)
      const hHead = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.45, 0.45),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 })
      )
      hHead.position.y = -1.45
      hammerGroup.add(hHead)
      hammerGroup.rotation.x = Math.PI / 2
      attacker.rightArmPivot.add(hammerGroup)
    }

    // =========================================================================
    // SETUP 3: REAPER ("Ceifador da Secura")
    // Story: Attacker wears a dark Reaper hood & giant glowing Scythe -> Dashes across & slashes victim ->
    // Victim's physical body collapses flat on the ground while a translucent purple Ghost Soul rises out of the body waving goodbye!
    // =========================================================================
    if (activePrank.type === 'reaper') {
      // Give attacker a dark reaper cloak cone
      reaperCloak = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 2.6, 16),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })
      )
      reaperCloak.position.y = 1.3
      attacker.root.add(reaperCloak)

      // Giant Glowing Scythe in Attacker's hand
      scytheWeapon = new THREE.Group()
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 3.8, 12),
        new THREE.MeshStandardMaterial({ color: 0x1f2937 })
      )
      pole.position.y = -0.8
      scytheWeapon.add(pole)

      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 2.3, 4),
        new THREE.MeshStandardMaterial({
          color: 0xe9d5ff,
          emissive: 0x9333ea,
          emissiveIntensity: 0.8,
          metalness: 0.8,
          roughness: 0.2,
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

      // Create the translucent Ghost Soul copy of the victim!
      ghostVictim = buildHumanoid3D(
        activePrank.targetUser.avatar_url,
        activePrank.targetUser.username,
        0xa855f7,
        0x7e22ce
      )
      ghostVictim.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh
          if (Array.isArray(m.material)) {
            m.material = m.material.map((mat) => {
              const cloned = mat.clone()
              cloned.transparent = true
              cloned.opacity = 0.68
              return cloned
            })
          } else {
            const cloned = m.material.clone()
            cloned.transparent = true
            cloned.opacity = 0.68
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
    // Story: Attacker stands on a platform above victim tipping a giant 3D Metal Bucket ->
    // Waterfall of 3D water spheres pours onto victim -> A 3D glass water tank fills up submerging the victim!
    // =========================================================================
    if (activePrank.type === 'water') {
      attacker.root.position.set(-2.5, 1.4, 0)
      attacker.root.rotation.y = 0.45

      // Platform under attacker
      const stepBox = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.4, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x334155 })
      )
      stepBox.position.set(-2.5, 0.7, 0)
      scene.add(stepBox)

      // Giant Bucket held by attacker
      waterBucket = new THREE.Group()
      const bucketCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.62, 1.45, 24),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 })
      )
      waterBucket.add(bucketCyl)
      waterBucket.position.set(-0.9, 3.6, 0)
      scene.add(waterBucket)

      victim.root.position.set(0.7, 0, 0)

      // Rising translucent 3D Water Tank around the victim
      aquariumTank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.85, 1.85, 3.8, 28),
        new THREE.MeshStandardMaterial({
          color: 0x0ea5e9,
          transparent: true,
          opacity: 0.42,
          roughness: 0.1,
        })
      )
      aquariumTank.position.set(0.7, 0.01, 0)
      aquariumTank.scale.set(1, 0.01, 1)
      scene.add(aquariumTank)

      waterPuddle = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 3.2, 0.08, 32),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.15 })
      )
      waterPuddle.position.set(0.7, 0.04, 0)
      waterPuddle.scale.set(0.01, 1, 0.01)
      scene.add(waterPuddle)

      const dropGeo = new THREE.SphereGeometry(0.22, 10, 10)
      const dropMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1 })
      for (let i = 0; i < 65; i++) {
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
          vy: -(0.12 + Math.random() * 0.1),
          vx: 0.02 + (Math.random() - 0.5) * 0.04,
          vz: (Math.random() - 0.5) * 0.04,
        })
      }
    }

    // =========================================================================
    // STORYBOARD ANIMATION LOOP
    // =========================================================================
    let frameId = 0
    const startTime = performance.now()
    let currentSubtitle = ''

    const updateSubtitle = (text: string) => {
      if (text !== currentSubtitle) {
        currentSubtitle = text
        setComicSubtitle(text)
      }
    }

    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000
      let shakeIntensity = 0

      if (activePrank.type === 'bury') {
        if (elapsed < 1.1) {
          // ACT 1: Attacker runs up and kicks/shoves victim into the open grave!
          updateSubtitle(`${activePrank.fromUser.username} empurrou ${activePrank.targetUser.username} direto na cova!`)
          const t = elapsed / 1.1
          attacker.root.position.x = -2.6 + t * 1.35
          attacker.leftLegPivot.rotation.x = -Math.sin(t * Math.PI) * 1.2
          attacker.rightArmPivot.rotation.x = -Math.sin(t * Math.PI) * 0.9

          if (elapsed > 0.45) {
            const fallT = (elapsed - 0.45) / 0.65
            victim.root.position.y = -fallT * 2.15
            victim.root.rotation.z = -fallT * 0.35
            victim.leftArmPivot.rotation.z = 2.6
            victim.rightArmPivot.rotation.z = -2.6
          }
        } else if (elapsed < 3.6) {
          // ACT 2: Victim panics inside pit while Attacker furiously shovels 3D dirt clods!
          updateSubtitle(`Jogando terra por cima de ${activePrank.targetUser.username}...`)
          victim.root.position.y = -2.15 - (elapsed - 1.1) * 0.35
          victim.leftArmPivot.rotation.x = Math.sin(elapsed * 22) * 0.9
          victim.rightArmPivot.rotation.x = -Math.sin(elapsed * 22) * 0.9
          victim.head.rotation.y = Math.sin(elapsed * 16) * 0.45

          // Shovel digging motion
          attacker.rightArmPivot.rotation.x = -0.8 + Math.sin(elapsed * 14) * 0.85
          attacker.torso.rotation.y = Math.sin(elapsed * 14) * 0.25

          // Parabolic dirt clods flying from shovel (-1.1, 1.4) to grave pit (0.4, 0)
          dirtClods.forEach((c) => {
            c.mesh.visible = true
            c.progress = (c.progress + 0.025 * c.speed) % 1
            const p = c.progress
            c.mesh.position.x = -1.0 + p * 1.55
            c.mesh.position.y = 1.2 + Math.sin(p * Math.PI) * 1.9 - p * 1.4
            c.mesh.position.z = c.offsetZ
            c.mesh.rotation.x += 0.12
            c.mesh.rotation.y += 0.12
          })

          if (dirtMound) {
            const moundProgress = Math.min(1, (elapsed - 1.1) / 2.3)
            dirtMound.scale.set(1, moundProgress * 0.95, 1)
          }
        } else {
          // ACT 3: Giant R.I.P. Tombstone & "TERRA ↓" sign slam down from the sky!
          updateSubtitle(`🪦 R.I.P. ${activePrank.targetUser.username} — SOTERRADO COM SUCESSO!`)
          dirtClods.forEach((c) => (c.mesh.visible = false))
          victim.root.visible = false

          if (tombstone) {
            if (tombstone.position.y > 1.55) {
              tombstone.position.y = Math.max(1.55, tombstone.position.y - 0.85)
              if (tombstone.position.y <= 1.6) shakeIntensity = 0.35
            }
          }
          if (woodenSign) {
            woodenSign.position.y = Math.max(0, woodenSign.position.y - 0.75)
          }
          // Attacker celebrates jumping
          attacker.root.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.45
          attacker.leftArmPivot.rotation.z = 2.5
          attacker.rightArmPivot.rotation.z = -2.5
        }
      } else if (activePrank.type === 'coffin') {
        if (elapsed < 1.2) {
          // ACT 1: Attacker shoves victim backwards into the open wooden coffin!
          updateSubtitle(`${activePrank.fromUser.username} jogou ${activePrank.targetUser.username} dentro do caixão!`)
          const t = Math.min(1, elapsed / 0.9)
          attacker.root.position.x = -2.5 + t * 1.3
          attacker.leftArmPivot.rotation.x = -Math.PI / 2

          victim.root.position.z = 1.3 - t * 1.65
          victim.root.position.y = 0.25 * Math.sin(t * Math.PI)
          victim.leftArmPivot.rotation.z = 2.2
          victim.rightArmPivot.rotation.z = -2.2
          victim.head.rotation.y = Math.sin(elapsed * 20) * 0.4
        } else if (elapsed < 2.3) {
          // ACT 2: Slam the coffin lid shut!
          updateSubtitle(`TRANCANDO A TAMPA DO CAIXÃO!`)
          if (coffinLidPivot) {
            coffinLidPivot.rotation.y = Math.max(0, coffinLidPivot.rotation.y - 0.18)
            if (coffinLidPivot.rotation.y === 0 && elapsed < 1.55) {
              shakeIntensity = 0.3
            }
          }
          if (coffinLidPivot && coffinLidPivot.rotation.y < 0.2) {
            victim.root.visible = false
          }
        } else if (elapsed < 3.7) {
          // ACT 3: Attacker hammers nails into the coffin lid while coffin shakes from victim banging inside!
          updateSubtitle(`Pregando a tampa! ${activePrank.targetUser.username} está batendo lá dentro!`)
          attacker.rightArmPivot.rotation.x = -0.6 + Math.sin(elapsed * 24) * 0.95
          if (coffinGroup) {
            coffinGroup.rotation.z = Math.sin(elapsed * 30) * 0.06
            coffinGroup.position.x = 0.6 + Math.cos(elapsed * 28) * 0.05
          }
          shakeIntensity = 0.08
        } else {
          // ACT 4: Coffin spins and sinks into the underground!
          updateSubtitle(`⚰️ ${activePrank.targetUser.username} FOI ENCOMENDADO PRO ALÉM!`)
          if (coffinGroup) {
            coffinGroup.rotation.y += 0.14
            coffinGroup.position.y -= 0.08
          }
          attacker.root.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.4
        }
      } else if (activePrank.type === 'reaper') {
        if (elapsed < 1.35) {
          // ACT 1: Grim Reaper dashes toward victim and swings the glowing scythe!
          updateSubtitle(`💀 O Ceifador ${activePrank.fromUser.username} veio buscar a alma de ${activePrank.targetUser.username}!`)
          const t = Math.min(1, elapsed / 1.1)
          attacker.root.position.x = -4.2 + t * 3.4
          attacker.rightArmPivot.rotation.y = -1.5 + t * 3.2
          attacker.rightArmPivot.rotation.x = -0.7

          victim.leftArmPivot.rotation.z = 2.5
          victim.rightArmPivot.rotation.z = -2.5
          victim.head.rotation.z = Math.sin(elapsed * 25) * 0.25
        } else {
          // ACT 2: Slash impact! Physical body falls flat on the ground while translucent Ghost Soul floats up to heaven!
          updateSubtitle(`👻 A ALMA DE ${activePrank.targetUser.username.toUpperCase()} SAIU DO CORPO!`)
          if (elapsed < 1.6) shakeIntensity = 0.32

          // Physical body collapses flat onto the floor
          victim.root.rotation.x = Math.min(Math.PI / 2, victim.root.rotation.x + 0.14)
          victim.root.position.y = Math.max(0.25, victim.root.position.y - 0.05)

          // Ghost soul rises out of the fallen body waving goodbye!
          if (ghostVictim) {
            ghostVictim.root.visible = true
            ghostVictim.root.position.y += 0.032
            ghostVictim.root.position.x = 0.8 + Math.sin(elapsed * 4) * 0.45
            ghostVictim.root.rotation.y = Math.sin(elapsed * 3) * 0.45
            ghostVictim.leftArmPivot.rotation.z = 2.4 + Math.sin(elapsed * 14) * 0.4
            ghostVictim.rightArmPivot.rotation.z = -2.4 - Math.sin(elapsed * 14) * 0.4
          }
        }
      } else if (activePrank.type === 'water') {
        if (elapsed < 0.9) {
          // ACT 1: Attacker tilts the giant metal bucket over victim's head
          updateSubtitle(`${activePrank.fromUser.username} virou o balde d'água gelada em ${activePrank.targetUser.username}!`)
          const t = elapsed / 0.9
          if (waterBucket) {
            waterBucket.rotation.z = -t * 2.15
          }
          attacker.rightArmPivot.rotation.x = -t * 1.2
        } else {
          // ACT 2: Giant waterfall + Glass Aquarium Tank fills up submerging the victim swimming inside!
          updateSubtitle(`🪣 ${activePrank.targetUser.username} ESTÁ AFOGADO TENTANDO NADAR!`)
          waterDrops.forEach((d) => {
            d.mesh.visible = true
            d.mesh.position.x += d.vx
            d.mesh.position.y += d.vy
            d.mesh.position.z += d.vz
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

          // Victim floats up inside the water tank flailing arms & legs like swimming!
          victim.root.position.y = fillProgress * 0.9 + Math.sin(elapsed * 8) * 0.18
          victim.root.rotation.y = Math.sin(elapsed * 5) * 0.5
          victim.root.rotation.z = Math.cos(elapsed * 6) * 0.2
          victim.leftArmPivot.rotation.x = Math.sin(elapsed * 18) * 1.3
          victim.rightArmPivot.rotation.x = -Math.sin(elapsed * 18) * 1.3
          victim.leftLegPivot.rotation.x = Math.cos(elapsed * 18) * 0.8
          victim.rightLegPivot.rotation.x = -Math.cos(elapsed * 18) * 0.8
        }
      }

      // Apply camera impact shake when heavy props slam
      if (shakeIntensity > 0) {
        camera.position.set(
          baseCamPos.x + (Math.random() - 0.5) * shakeIntensity,
          baseCamPos.y + (Math.random() - 0.5) * shakeIntensity,
          baseCamPos.z
        )
      } else {
        camera.position.lerp(baseCamPos, 0.15)
      }
      camera.lookAt(0, 1.3, 0)

      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)

    const timer = setTimeout(() => {
      onComplete()
    }, 5600)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frameId)
      renderer.dispose()
    }
  }, [activePrank, onComplete])

  if (!activePrank) return null

  const prankMeta = PRANK_OPTIONS.find((p) => p.type === activePrank.type)

  return (
    <div
      onClick={onComplete}
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-between bg-black/85 p-5 backdrop-blur-xs select-none"
    >
      {/* Top Header Banner */}
      <div className="z-10 flex flex-col items-center gap-1 rounded-2xl border border-white/15 bg-[#111214]/95 px-6 py-3 text-center shadow-2xl">
        <div className="text-sm font-extrabold text-white">
          <span className="text-amber-400">{activePrank.fromUser.username}</span>{' '}
          {activePrank.type === 'bury' && 'enterrou na cova:'}
          {activePrank.type === 'coffin' && 'trancou no caixão:'}
          {activePrank.type === 'reaper' && 'ceifou a alma de:'}
          {activePrank.type === 'water' && 'jogou um balde d’água em:'}{' '}
          <span className="text-emerald-400">{activePrank.targetUser.username}</span>!
        </div>
        {prankMeta && (
          <div className="text-xs font-bold text-amber-300">
            🎙️ Efeito na Voz Ativado: {prankMeta.voiceEffectLabel}
          </div>
        )}
      </div>

      {/* Three.js 3D Stage */}
      <div ref={mountRef} className="h-[480px] w-full max-w-4xl flex-1" />

      {/* Live Story Subtitle & Dismiss Hint */}
      <div className="z-10 flex flex-col items-center gap-2">
        {comicSubtitle && (
          <div className="rounded-xl border border-amber-400/40 bg-[#18191c] px-5 py-2 text-sm font-black tracking-wide text-amber-300 shadow-lg">
            {comicSubtitle}
          </div>
        )}
        <div className="rounded-full bg-[#1e1f22] px-4 py-1 text-xs font-semibold text-zinc-400">
          Clique em qualquer lugar para fechar a cena 3D (o efeito na voz dura 15s)
        </div>
      </div>
    </div>
  )
}
