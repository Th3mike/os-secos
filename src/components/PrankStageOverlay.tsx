'use client'

import { useEffect, useRef } from 'react'
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
      // Custom SVG Shovel + Tombstone (never fails on Windows)
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <path d="M7 20h10" strokeLinecap="round" />
          <path d="M9 20v-8a3 3 0 0 1 6 0v8" />
          <path d="M12 11v3" strokeLinecap="round" />
          <path d="M10.5 12.5h3" strokeLinecap="round" />
        </svg>
      )
    case 'coffin':
      // Custom SVG Coffin
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <polygon points="8,3 16,3 19,9 15,21 9,21 5,9" />
          <path d="M12 7v6" strokeLinecap="round" />
          <path d="M9.5 9.5h5" strokeLinecap="round" />
        </svg>
      )
    case 'reaper':
      // Custom SVG Skull / Scythe
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
      // Custom SVG Water Droplet / Splash
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      )
  }
}

function createAvatarTexture(avatarUrl: string, username: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // Initial placeholder while image loads
  const drawFrame = (img?: HTMLImageElement) => {
    ctx.fillStyle = '#27272a'
    ctx.fillRect(0, 0, 512, 512)

    if (img) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(256, 210, 140, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(img, 116, 70, 280, 280)
      ctx.restore()
    } else {
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.arc(256, 210, 140, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.arc(256, 210, 140, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 42px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(username.slice(0, 16), 256, 420)

    ctx.fillStyle = '#f59e0b'
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText('OS SECOS', 256, 470)
  }

  drawFrame()
  const texture = new THREE.CanvasTexture(canvas)

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    drawFrame(img)
    texture.needsUpdate = true
  }
  img.src = avatarUrl

  return texture
}

function createSignTexture(text1: string, text2: string, bg = '#5c3a21'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 512, 256)
  ctx.strokeStyle = '#2b180a'
  ctx.lineWidth = 16
  ctx.strokeRect(8, 8, 496, 240)

  ctx.fillStyle = '#fef08a'
  ctx.font = '900 54px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(text1, 256, 115)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 40px sans-serif'
  ctx.fillText(text2, 256, 190)

  return new THREE.CanvasTexture(canvas)
}

interface PrankStageOverlayProps {
  activePrank: PrankEvent | null
  onComplete: () => void
}

export function PrankStageOverlay({ activePrank, onComplete }: PrankStageOverlayProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!activePrank || !mountRef.current) return

    const container = mountRef.current
    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x090a0f, 0.035)

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100)
    camera.position.set(0, 4.2, 9.5)
    camera.lookAt(0, 0.8, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Dramatic 3D Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffedd5, 2.2)
    dirLight.position.set(5, 10, 7)
    dirLight.castShadow = true
    scene.add(dirLight)

    const pointLight = new THREE.PointLight(
      activePrank.type === 'reaper'
        ? 0xa855f7
        : activePrank.type === 'water'
        ? 0x38bdf8
        : 0xf59e0b,
      4,
      18
    )
    pointLight.position.set(0, 3, 3)
    scene.add(pointLight)

    // 3D Ground Plane
    const groundGeo = new THREE.CylinderGeometry(7, 7, 0.5, 32)
    const groundMat = new THREE.MeshStandardMaterial({
      color: activePrank.type === 'water' ? 0x0c4a6e : 0x291d12,
      roughness: 0.9,
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.position.y = -1.25
    ground.receiveShadow = true
    scene.add(ground)

    // Victim 3D Character Head/Cube with Discord Avatar
    const avatarTex = createAvatarTexture(
      activePrank.targetUser.avatar_url,
      activePrank.targetUser.username
    )
    const victimGeo = new THREE.BoxGeometry(2.1, 2.1, 2.1)
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5 })
    const faceMat = new THREE.MeshStandardMaterial({ map: avatarTex, roughness: 0.3 })
    const victimMesh = new THREE.Mesh(victimGeo, [
      sideMat,
      sideMat,
      sideMat,
      sideMat,
      faceMat,
      faceMat,
    ])
    victimMesh.position.set(0, 1.2, 0)
    victimMesh.castShadow = true
    scene.add(victimMesh)

    // Scene-specific 3D Models & Particle Systems
    const particles: {
      mesh: THREE.Mesh
      vx: number
      vy: number
      vz: number
      rx: number
      ry: number
    }[] = []

    // 1. BURY SCENE: 3D Grave Hole + Shovel + Falling Dirt Clods + Tombstone + "TERRA ↓" Sign
    let tombstoneMesh: THREE.Mesh | null = null
    let shovelGroup: THREE.Group | null = null
    let dirtMoundMesh: THREE.Mesh | null = null

    if (activePrank.type === 'bury') {
      // Dark grave pit ring
      const pitGeo = new THREE.CylinderGeometry(1.9, 1.9, 0.55, 24)
      const pitMat = new THREE.MeshBasicMaterial({ color: 0x050403 })
      const pit = new THREE.Mesh(pitGeo, pitMat)
      pit.position.set(0, -0.98, 0)
      scene.add(pit)

      // 3D Tombstone behind the pit
      const stoneTex = createSignTexture('R.I.P.', activePrank.targetUser.username.slice(0, 14), '#52525b')
      const stoneGeo = new THREE.BoxGeometry(2.5, 3.0, 0.5)
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.8 })
      const stoneFrontMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.6 })
      tombstoneMesh = new THREE.Mesh(stoneGeo, [
        stoneMat,
        stoneMat,
        stoneMat,
        stoneMat,
        stoneFrontMat,
        stoneMat,
      ])
      tombstoneMesh.position.set(0, 8, -1.5)
      scene.add(tombstoneMesh)

      // Rising Dirt Mound + Wooden "TERRA ↓" Sign
      const moundGeo = new THREE.SphereGeometry(2.1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2)
      const moundMat = new THREE.MeshStandardMaterial({ color: 0x452711, roughness: 1 })
      dirtMoundMesh = new THREE.Mesh(moundGeo, moundMat)
      dirtMoundMesh.position.set(0, -1.0, 0)
      dirtMoundMesh.scale.set(1, 0.01, 1)
      scene.add(dirtMoundMesh)

      // 3D Shovel
      shovelGroup = new THREE.Group()
      const handleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.6, 12)
      const handleMat = new THREE.MeshStandardMaterial({ color: 0x854d0e })
      const handle = new THREE.Mesh(handleGeo, handleMat)
      handle.position.y = 1.3
      shovelGroup.add(handle)

      const bladeGeo = new THREE.BoxGeometry(0.7, 0.9, 0.08)
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x9ca3af,
        metalness: 0.7,
        roughness: 0.3,
      })
      const blade = new THREE.Mesh(bladeGeo, bladeMat)
      blade.position.y = -0.1
      shovelGroup.add(blade)

      shovelGroup.position.set(2.8, 1.5, 1.2)
      shovelGroup.rotation.z = 0.6
      scene.add(shovelGroup)

      // Dirt clod particles
      const dirtGeo = new THREE.DodecahedronGeometry(0.22, 0)
      const dirtMat = new THREE.MeshStandardMaterial({ color: 0x5c3417, roughness: 0.95 })
      for (let i = 0; i < 45; i++) {
        const p = new THREE.Mesh(dirtGeo, dirtMat)
        p.position.set(
          (Math.random() - 0.5) * 3.2,
          3.5 + Math.random() * 5,
          (Math.random() - 0.5) * 2.2
        )
        scene.add(p)
        particles.push({
          mesh: p,
          vx: (Math.random() - 0.5) * 0.04,
          vy: -(0.06 + Math.random() * 0.08),
          vz: (Math.random() - 0.5) * 0.04,
          rx: Math.random() * 0.1,
          ry: Math.random() * 0.1,
        })
      }
    }

    // 2. COFFIN SCENE: 3D Wooden Coffin Box + Slamming Lid + Spinning Chains
    let coffinGroup: THREE.Group | null = null
    let coffinLidPivot: THREE.Group | null = null

    if (activePrank.type === 'coffin') {
      coffinGroup = new THREE.Group()
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2511, roughness: 0.75 })
      const innerMat = new THREE.MeshStandardMaterial({ color: 0x1a0b05, roughness: 0.9 })

      const backWall = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.8, 0.25), woodMat)
      backWall.position.z = -1.2
      coffinGroup.add(backWall)

      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.8, 2.4), woodMat)
      leftWall.position.x = -1.3
      coffinGroup.add(leftWall)

      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.8, 2.4), woodMat)
      rightWall.position.x = 1.3
      coffinGroup.add(rightWall)

      const bottomWall = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 2.4), innerMat)
      bottomWall.position.y = -1.8
      coffinGroup.add(bottomWall)

      const topWall = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 2.4), innerMat)
      topWall.position.y = 1.8
      coffinGroup.add(topWall)

      // Hinged 3D Lid with Cross
      coffinLidPivot = new THREE.Group()
      coffinLidPivot.position.set(-1.35, 0, 1.2)

      const lidTex = createSignTexture('⚰️ OS SECOS', activePrank.targetUser.username.slice(0, 14), '#3b1d0d')
      const lidMesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 3.8, 0.25),
        new THREE.MeshStandardMaterial({ map: lidTex, roughness: 0.65 })
      )
      lidMesh.position.set(1.35, 0, 0)
      coffinLidPivot.add(lidMesh)
      coffinLidPivot.rotation.y = -Math.PI * 0.72

      coffinGroup.add(coffinLidPivot)
      coffinGroup.position.y = 1.0
      scene.add(coffinGroup)
    }

    // 3. REAPER SCENE: 3D Rotating Scythe + Soul Vortex Particles
    let scytheGroup: THREE.Group | null = null
    if (activePrank.type === 'reaper') {
      scytheGroup = new THREE.Group()
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 4.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x1f2937 })
      )
      scytheGroup.add(pole)

      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 2.4, 4),
        new THREE.MeshStandardMaterial({
          color: 0xe5e7eb,
          metalness: 0.85,
          roughness: 0.2,
          emissive: 0x581c87,
          emissiveIntensity: 0.4,
        })
      )
      blade.rotation.z = Math.PI / 2.2
      blade.position.set(1.0, 2.0, 0)
      scytheGroup.add(blade)

      scytheGroup.position.set(-3.2, 2.0, 1.5)
      scene.add(scytheGroup)

      const soulGeo = new THREE.SphereGeometry(0.16, 8, 8)
      const soulMat = new THREE.MeshBasicMaterial({ color: 0xc084fc })
      for (let i = 0; i < 40; i++) {
        const p = new THREE.Mesh(soulGeo, soulMat)
        const angle = (i / 40) * Math.PI * 2
        p.position.set(Math.cos(angle) * 2.2, (Math.random() - 0.5) * 3, Math.sin(angle) * 2.2)
        scene.add(p)
        particles.push({
          mesh: p,
          vx: angle,
          vy: 0.03 + Math.random() * 0.04,
          vz: 2.2,
          rx: 0,
          ry: 0,
        })
      }
    }

    // 4. WATER BUCKET SCENE: 3D Tilting Metal Bucket + Waterfall Particles
    let bucketMesh: THREE.Mesh | null = null
    if (activePrank.type === 'water') {
      const bucketGeo = new THREE.CylinderGeometry(0.9, 0.65, 1.5, 24)
      const bucketMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        metalness: 0.75,
        roughness: 0.25,
      })
      bucketMesh = new THREE.Mesh(bucketGeo, bucketMat)
      bucketMesh.position.set(1.6, 3.8, 0)
      scene.add(bucketMesh)

      const dropGeo = new THREE.SphereGeometry(0.22, 10, 10)
      const dropMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.1,
        metalness: 0.1,
      })
      for (let i = 0; i < 65; i++) {
        const p = new THREE.Mesh(dropGeo, dropMat)
        p.position.set(
          (Math.random() - 0.5) * 1.4,
          3.4 + Math.random() * 4,
          (Math.random() - 0.5) * 1.4
        )
        scene.add(p)
        particles.push({
          mesh: p,
          vx: (Math.random() - 0.5) * 0.06,
          vy: -(0.1 + Math.random() * 0.12),
          vz: (Math.random() - 0.5) * 0.06,
          rx: 0,
          ry: 0,
        })
      }
    }

    // Animation Loop
    let frameId = 0
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000

      if (activePrank.type === 'bury') {
        // Victim sinks into the 3D grave while spinning
        victimMesh.rotation.y += 0.06
        victimMesh.rotation.z = Math.sin(elapsed * 8) * 0.15
        if (elapsed > 0.3 && victimMesh.position.y > -2.3) {
          victimMesh.position.y -= 0.028
        }
        // Shovel digs and throws dirt
        if (shovelGroup) {
          shovelGroup.rotation.z = 0.4 + Math.sin(elapsed * 9) * 0.55
          shovelGroup.position.x = 2.2 + Math.cos(elapsed * 9) * 0.4
        }
        // Tombstone slams down
        if (tombstoneMesh && elapsed > 0.5) {
          tombstoneMesh.position.y = Math.max(0.4, tombstoneMesh.position.y - 0.38)
        }
        // Dirt mound grows over victim
        if (dirtMoundMesh && elapsed > 0.8) {
          const s = Math.min(1, (elapsed - 0.8) * 0.55)
          dirtMoundMesh.scale.set(1, s, 1)
        }
        // Falling dirt clods
        particles.forEach((p) => {
          p.mesh.position.x += p.vx
          p.mesh.position.y += p.vy
          p.mesh.position.z += p.vz
          p.mesh.rotation.x += p.rx
          p.mesh.rotation.y += p.ry
          if (p.mesh.position.y < -0.9) {
            p.mesh.position.y = 3.5 + Math.random() * 2
            p.mesh.position.x = (Math.random() - 0.5) * 2.2
          }
        })
      } else if (activePrank.type === 'coffin') {
        victimMesh.position.y = 1.0
        victimMesh.rotation.y = Math.sin(elapsed * 5) * 0.35
        // Slam lid shut at 1.1s
        if (coffinLidPivot && elapsed > 0.9) {
          coffinLidPivot.rotation.y = Math.min(0, coffinLidPivot.rotation.y + 0.14)
        }
        // Shake & spin coffin after lid slams
        if (coffinGroup && elapsed > 1.6) {
          coffinGroup.rotation.y += 0.04
          coffinGroup.rotation.z = Math.sin(elapsed * 18) * 0.06
          victimMesh.visible = coffinLidPivot ? coffinLidPivot.rotation.y < -0.1 : true
        }
      } else if (activePrank.type === 'reaper') {
        if (scytheGroup) {
          scytheGroup.position.x = Math.min(0.8, -3.2 + elapsed * 3.5)
          scytheGroup.rotation.z = -elapsed * 4.5
        }
        if (elapsed > 0.6) {
          victimMesh.position.y += 0.035
          victimMesh.rotation.y += 0.18
          victimMesh.scale.multiplyScalar(0.992)
        }
        particles.forEach((p) => {
          p.vx += 0.08
          p.mesh.position.x = Math.cos(p.vx) * p.vz
          p.mesh.position.z = Math.sin(p.vx) * p.vz
          p.mesh.position.y += p.vy
          if (p.mesh.position.y > 3.5) p.mesh.position.y = -1.0
        })
      } else if (activePrank.type === 'water') {
        if (bucketMesh) {
          bucketMesh.rotation.z = Math.min(2.2, elapsed * 2.5)
        }
        victimMesh.rotation.y += 0.09
        victimMesh.position.y = 1.0 + Math.sin(elapsed * 14) * 0.18
        particles.forEach((p) => {
          if (elapsed > 0.35) {
            p.mesh.position.x += p.vx
            p.mesh.position.y += p.vy
            p.mesh.position.z += p.vz
            if (p.mesh.position.y < -0.9) {
              p.mesh.position.y = 3.2
              p.mesh.position.x = (Math.random() - 0.5) * 1.1
              p.mesh.position.z = (Math.random() - 0.5) * 1.1
            }
          }
        })
      }

      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)

    const timer = setTimeout(() => {
      onComplete()
    }, 5500)

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
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-between bg-black/85 p-6 backdrop-blur-xs select-none"
    >
      {/* Top Info Pill */}
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
            🎙️ Efeito de Voz Ativado: {prankMeta.voiceEffectLabel}
          </div>
        )}
      </div>

      {/* Three.js Real 3D WebGL Canvas */}
      <div ref={mountRef} className="h-[460px] w-full max-w-3xl flex-1" />

      <div className="z-10 rounded-full bg-[#1e1f22] px-4 py-1.5 text-xs font-semibold text-zinc-300">
        Clique em qualquer lugar para fechar a cena 3D (o efeito na voz dura 15s)
      </div>
    </div>
  )
}
