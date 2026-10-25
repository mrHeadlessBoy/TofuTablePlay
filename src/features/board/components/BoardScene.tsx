'use client'

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import * as THREE from 'three'
import { MapControls } from 'three/addons/controls/MapControls.js'
import { tileIndex, tileTopY } from '../lib/maps'
import type { BoardMap, MapTheme, Point, PropKind, TerrainKind, Tile, Token } from '../lib/types'

export type BoardSceneHandle = {
  zoomBy: (factor: number) => void
  fit: () => void
  focus: (point: Point) => void
}

type SceneEvents = {
  onTileClick: (point: Point) => void
  onTokenClick: (id: string) => void
  onHoverTile: (point: Point | null) => void
  onZoomChange: (percent: number) => void
}

/** Screen space covered by HUD panels, in pixels. The board is framed inside what is left. */
export type SceneInsets = { top: number; right: number; bottom: number; left: number }

const NO_INSETS: SceneInsets = { top: 0, right: 0, bottom: 0, left: 0 }

type BoardSceneProps = SceneEvents & {
  map: BoardMap
  tokens: Token[]
  selectedId: string | null
  /** Tile index -> feet, for the selected token. */
  reachable: Map<number, number>
  insets?: SceneInsets
  ref?: Ref<BoardSceneHandle>
}

// ---------- look ----------

type ThemeLook = {
  terrain: Record<TerrainKind, [string, string]>
  body: string
  foliage: string[]
  wall: string
  sky: number
  ground: number
  sun: number
  sunIntensity: number
  ambient: number
}

const LOOKS: Record<MapTheme, ThemeLook> = {
  forest: {
    terrain: {
      grass: ['#8c9440', '#a9a44a'],
      path: ['#b39762', '#c4a770'],
      water: ['#2a6f86', '#3586a0'],
      bridge: ['#7b5a3a', '#8d6a45'],
      stone: ['#86837a', '#9b988e'],
      asphalt: ['#3a3d41', '#45484d'],
      rubble: ['#6b665c', '#7a7469'],
      void: ['#000000', '#000000'],
    },
    body: '#4f3f2c',
    foliage: ['#c9552a', '#dc8530', '#b13b2b', '#e0a53c', '#8e9a3c'],
    wall: '#8a8478',
    sky: 0xffe9c9,
    ground: 0x2b2417,
    sun: 0xfff0d4,
    sunIntensity: 2.6,
    ambient: 0.95,
  },
  ruins: {
    terrain: {
      grass: ['#5c673c', '#6b7645'],
      path: ['#6f6a5c', '#7c7767'],
      water: ['#27505a', '#30606b'],
      bridge: ['#5d4a36', '#6a5540'],
      stone: ['#74777a', '#84878a'],
      asphalt: ['#2f3236', '#3a3d42'],
      rubble: ['#57524a', '#676158'],
      void: ['#000000', '#000000'],
    },
    body: '#232528',
    foliage: ['#4d463c', '#5a5146', '#463f37'],
    wall: '#6e675f',
    sky: 0xcfd8dc,
    ground: 0x1c1d1f,
    sun: 0xe6edf2,
    sunIntensity: 2.1,
    ambient: 0.85,
  },
  dungeon: {
    terrain: {
      grass: ['#3f4a3a', '#48543f'],
      path: ['#4d4a45', '#59554f'],
      water: ['#1d3f55', '#245066'],
      bridge: ['#6a4d32', '#7a5a3b'],
      stone: ['#474c59', '#555b6a'],
      asphalt: ['#33363d', '#3d4048'],
      rubble: ['#3a3d46', '#454954'],
      void: ['#000000', '#000000'],
    },
    body: '#1f222a',
    foliage: ['#3c4a36'],
    wall: '#2f333d',
    sky: 0x8fa3c8,
    ground: 0x0d0e12,
    sun: 0xb9c8e6,
    sunIntensity: 1.3,
    ambient: 0.75,
  },
}

const KIND_RING: Record<Token['kind'], string> = { hero: '#f59e0b', enemy: '#ef4444', npc: '#94a3b8' }
const KIND_HEAD: Record<Token['kind'], string> = { hero: '#f0d2ae', enemy: '#b6c0a0', npc: '#dcc7a8' }

const CAMERA_FOV = 32
const CAMERA_DIRECTION = new THREE.Vector3(0.36, 0.92, 0.8).normalize()
const LABEL_PIXELS = 24
const TOKEN_SCALE = 1.3

function mix(a: string, b: string, t: number): THREE.Color {
  return new THREE.Color(a).lerp(new THREE.Color(b), t)
}

function tileWorld(map: BoardMap, x: number, y: number): { wx: number; wz: number } {
  return { wx: x - map.cols / 2 + 0.5, wz: y - map.rows / 2 + 0.5 }
}

function castShadows(object: THREE.Object3D) {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
}

function buildProp(kind: PropKind, tile: Tile, look: ThemeLook, theme: MapTheme): THREE.Group {
  const group = new THREE.Group()
  const flat = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra })
  const n = tile.noise

  if (kind === 'tree') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 6), flat('#5a4130'))
    trunk.position.y = 0.25
    group.add(trunk)
    if (theme === 'ruins') {
      // Dead tree: bare trunk with two branches.
      trunk.scale.y = 1.9
      trunk.position.y = 0.47
      for (const side of [-1, 1]) {
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.42, 5), flat('#4a3a2e'))
        branch.position.set(side * 0.13, 0.72 + side * 0.08, 0)
        branch.rotation.z = -side * 0.9
        group.add(branch)
      }
    } else {
      const colour = look.foliage[Math.floor(n * look.foliage.length) % look.foliage.length]
      const tiers = [
        [0.44, 0.6, 0.62],
        [0.34, 0.52, 0.95],
        [0.22, 0.42, 1.24],
      ]
      for (const [radius, height, y] of tiers) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), flat(colour))
        cone.position.y = y
        group.add(cone)
      }
      group.scale.setScalar(0.85 + n * 0.45)
    }
  } else if (kind === 'rock') {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0), flat(theme === 'dungeon' ? '#565b68' : '#8b877e'))
    rock.scale.set(1 + n * 0.3, 0.6 + n * 0.4, 0.9)
    rock.position.y = 0.14
    group.add(rock)
  } else if (kind === 'bush') {
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), flat(n > 0.5 ? '#7d8a36' : '#c06a2c'))
    bush.scale.y = 0.7
    bush.position.y = 0.14
    group.add(bush)
  } else if (kind === 'pillar') {
    const height = 0.7 + n * 0.9
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.44, height, 0.44), flat(look.wall))
    shaft.position.y = height / 2
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), flat(look.wall))
    foot.position.y = 0.06
    group.add(shaft, foot)
  } else if (kind === 'wall') {
    const height = theme === 'dungeon' ? 1.25 : 0.6 + n * 1.1
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.94, height, 0.94), flat(mix(look.wall, '#000000', n * 0.18)))
    wall.position.y = height / 2
    group.add(wall)
  } else if (kind === 'crate') {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), flat('#7a5a38'))
    crate.position.y = 0.25
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.07, 0.53), flat('#59401f'))
    band.position.y = 0.25
    group.add(crate, band)
  } else if (kind === 'wreck') {
    const paint = ['#7c3b2f', '#3d5a6c', '#6c6a48', '#4b4d52'][Math.floor(n * 4) % 4]
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.26, 0.5), flat(paint, { roughness: 0.6 }))
    hull.position.y = 0.2
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.44), flat('#23282d', { roughness: 0.4 }))
    cabin.position.set(-0.05, 0.42, 0)
    group.add(hull, cabin)
    for (const [wx, wz] of [[0.28, 0.25], [-0.28, 0.25], [0.28, -0.25], [-0.28, -0.25]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 10), flat('#15171a'))
      wheel.rotation.x = Math.PI / 2
      wheel.position.set(wx, 0.1, wz)
      group.add(wheel)
    }
  } else if (kind === 'campfire') {
    for (let i = 0; i < 6; i++) {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), flat('#77736b'))
      const angle = (i / 6) * Math.PI * 2
      stone.position.set(Math.cos(angle) * 0.24, 0.05, Math.sin(angle) * 0.24)
      group.add(stone)
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.36, 6),
      new THREE.MeshBasicMaterial({ color: '#ffb347' })
    )
    flame.position.y = 0.22
    flame.name = 'flame'
    group.add(flame)
  }

  if (kind !== 'wall' && kind !== 'pillar' && kind !== 'campfire') group.rotation.y = n * Math.PI * 2
  if (kind === 'wreck') group.rotation.y = n > 0.5 ? 0.15 : Math.PI / 2 + 0.2
  return group
}

function drawLabel(canvas: HTMLCanvasElement, token: Token) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)

  ctx.font = '600 30px system-ui, "Leelawadee UI", Tahoma, sans-serif'
  const name = token.name.length > 16 ? `${token.name.slice(0, 15)}…` : token.name
  const textWidth = Math.min(width - 28, ctx.measureText(name).width)
  const pillWidth = Math.max(120, textWidth + 36)
  const left = (width - pillWidth) / 2

  ctx.fillStyle = 'rgba(6, 8, 12, 0.78)'
  ctx.beginPath()
  ctx.roundRect(left, 6, pillWidth, 46, 12)
  ctx.fill()
  ctx.strokeStyle = token.kind === 'enemy' ? 'rgba(239, 68, 68, 0.75)' : 'rgba(255, 255, 255, 0.28)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, width / 2, 30, width - 28)

  // HP bar
  const ratio = token.maxHp > 0 ? Math.max(0, Math.min(1, token.hp / token.maxHp)) : 0
  ctx.fillStyle = 'rgba(6, 8, 12, 0.85)'
  ctx.beginPath()
  ctx.roundRect(left, 58, pillWidth, 10, 5)
  ctx.fill()
  ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#fbbf24' : '#f87171'
  ctx.beginPath()
  ctx.roundRect(left, 58, Math.max(6, pillWidth * ratio), 10, 5)
  ctx.fill()
}

type TokenView = {
  group: THREE.Group
  ring: THREE.Mesh
  arrow: THREE.Mesh
  label: THREE.Sprite
  canvas: HTMLCanvasElement
  texture: THREE.CanvasTexture
  labelKey: string
  from: THREE.Vector3
  to: THREE.Vector3
  progress: number
}

function buildToken(token: Token): TokenView {
  const group = new THREE.Group()
  const ringColour = KIND_RING[token.kind]

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.36, 0.07, 28),
    new THREE.MeshStandardMaterial({ color: ringColour, roughness: 0.5, emissive: ringColour, emissiveIntensity: 0.25 })
  )
  base.position.y = 0.035
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.27, 0.075, 28),
    new THREE.MeshStandardMaterial({ color: '#14161b', roughness: 0.8 })
  )
  plate.position.y = 0.04

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: token.color, roughness: 0.65, flatShading: true })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.21, 0.46, 10), bodyMaterial)
  body.position.y = 0.31
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), bodyMaterial)
  shoulders.scale.set(1.25, 0.6, 1)
  shoulders.position.y = 0.53
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 14, 10),
    new THREE.MeshStandardMaterial({ color: KIND_HEAD[token.kind], roughness: 0.8 })
  )
  head.position.y = 0.7
  group.add(base, plate, body, shoulders, head)
  castShadows(group)
  group.traverse((child) => {
    child.userData.tokenId = token.id
  })

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.5, 40),
    new THREE.MeshBasicMaterial({ color: '#fde68a', transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.02
  ring.visible = false

  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 4), new THREE.MeshBasicMaterial({ color: '#fde68a' }))
  arrow.rotation.x = Math.PI
  arrow.visible = false
  group.add(ring, arrow)

  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 76
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, sizeAttenuation: false })
  )
  label.position.y = 1.12
  label.renderOrder = 10
  group.add(label)
  group.scale.setScalar(TOKEN_SCALE)

  return { group, ring, arrow, label, canvas, texture, labelKey: '', from: new THREE.Vector3(), to: new THREE.Vector3(), progress: 1 }
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    mesh.geometry?.dispose()
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    for (const entry of Array.isArray(material) ? material : material ? [material] : []) {
      const map = (entry as THREE.SpriteMaterial).map
      map?.dispose()
      entry.dispose()
    }
  })
}

// ---------- stage ----------

function createStage(container: HTMLDivElement, map: BoardMap, events: { current: SceneEvents }, insets: SceneInsets) {
  const look = LOOKS[map.theme]
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.touchAction = 'none'
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x05070a, 34, 78)
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 220)

  scene.add(new THREE.HemisphereLight(look.sky, look.ground, look.ambient))
  const sun = new THREE.DirectionalLight(look.sun, look.sunIntensity)
  sun.position.set(-9, 16, 7)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.02
  const reach = Math.max(map.cols, map.rows) * 0.75
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 60 })
  scene.add(sun)

  // --- tiles: one instanced body and one instanced cap for the whole board
  const count = map.cols * map.rows
  const box = new THREE.BoxGeometry(1, 1, 1)
  const bodies = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), count)
  const caps = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.92, flatShading: true }), count)
  bodies.receiveShadow = caps.receiveShadow = true
  bodies.castShadow = caps.castShadow = true

  const dummy = new THREE.Object3D()
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  const flames: THREE.Object3D[] = []
  const props = new THREE.Group()
  const FLOOR = -0.75
  const CAP = 0.07
  let fireLights = 0

  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      const index = tileIndex(map, x, y)
      const tile = map.tiles[index]
      if (tile.terrain === 'void') {
        bodies.setMatrixAt(index, zero)
        caps.setMatrixAt(index, zero)
        continue
      }
      const { wx, wz } = tileWorld(map, x, y)
      const top = tileTopY(tile)
      const bodyHeight = top - CAP - FLOOR

      dummy.position.set(wx, FLOOR + bodyHeight / 2, wz)
      dummy.scale.set(0.95, bodyHeight, 0.95)
      dummy.updateMatrix()
      bodies.setMatrixAt(index, dummy.matrix)
      bodies.setColorAt(index, mix(look.body, '#000000', tile.noise * 0.25))

      dummy.position.set(wx, top - CAP / 2, wz)
      dummy.scale.set(0.95, CAP, 0.95)
      dummy.updateMatrix()
      caps.setMatrixAt(index, dummy.matrix)
      const [dark, light] = look.terrain[tile.terrain]
      caps.setColorAt(index, mix(dark, light, tile.noise))

      if (tile.prop) {
        const prop = buildProp(tile.prop, tile, look, map.theme)
        prop.position.set(wx, top, wz)
        castShadows(prop)
        props.add(prop)
        const flame = prop.getObjectByName('flame')
        if (flame) {
          flame.castShadow = false
          flames.push(flame)
          if (fireLights < 3) {
            const fire = new THREE.PointLight(0xff8a3a, 9, 7.5, 1.6)
            fire.position.set(wx, top + 0.6, wz)
            scene.add(fire)
            fireLights++
          }
        }
      }
    }
  }
  bodies.instanceMatrix.needsUpdate = true
  caps.instanceMatrix.needsUpdate = true
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true
  if (caps.instanceColor) caps.instanceColor.needsUpdate = true
  scene.add(bodies, caps, props)

  // --- overlays
  const plane = new THREE.PlaneGeometry(0.9, 0.9)
  plane.rotateX(-Math.PI / 2)
  const reachMesh = new THREE.InstancedMesh(
    plane,
    new THREE.MeshBasicMaterial({ color: '#38a8ff', transparent: true, opacity: 0.45, depthWrite: false }),
    count
  )
  for (let i = 0; i < count; i++) reachMesh.setMatrixAt(i, zero)
  reachMesh.renderOrder = 2
  scene.add(reachMesh)

  const hover = new THREE.Group()
  const hoverFill = new THREE.Mesh(
    plane,
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, depthWrite: false })
  )
  const hoverEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(plane),
    new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 })
  )
  hover.add(hoverFill, hoverEdge)
  hover.visible = false
  hover.renderOrder = 3
  scene.add(hover)

  // --- camera controls: wheel zooms, left drag pans, right drag rotates
  const controls = new MapControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.12
  controls.screenSpacePanning = false
  controls.zoomToCursor = true
  controls.minPolarAngle = 0.3
  controls.maxPolarAngle = 1.2
  controls.minDistance = 4.5

  let fitDistance = 30
  let lastPercent = -1
  // Visible area in normalised device coordinates once the HUD panels are subtracted.
  const viewFrame = { minX: -1, maxX: 1, minY: -1, maxY: 1 }
  const halfCols = map.cols / 2
  const halfRows = map.rows / 2
  const corners = [-1, 1].flatMap((sx) =>
    [-1, 1].flatMap((sz) => [-0.4, 1.7].map((y) => new THREE.Vector3(sx * halfCols, y, sz * halfRows)))
  )
  const fitTarget = new THREE.Vector3(0, 0, 0)
  const probe = new THREE.Vector3()

  const applyInsets = (width: number, height: number) => {
    const usableWidth = width - insets.left - insets.right
    const usableHeight = height - insets.top - insets.bottom
    if (usableWidth < 280 || usableHeight < 200) {
      camera.clearViewOffset()
      Object.assign(viewFrame, { minX: -1, maxX: 1, minY: -1, maxY: 1 })
      return
    }
    // Shift the optical centre so the point the camera looks at sits in the middle of the free area.
    camera.setViewOffset(width, height, (insets.right - insets.left) / 2, (insets.bottom - insets.top) / 2, width, height)
    Object.assign(viewFrame, {
      minX: -1 + (2 * insets.left) / width,
      maxX: 1 - (2 * insets.right) / width,
      minY: -1 + (2 * insets.bottom) / height,
      maxY: 1 - (2 * insets.top) / height,
    })
  }

  const insideFrame = (point: THREE.Vector3, margin = 0) => {
    probe.copy(point).project(camera)
    return (
      probe.x >= viewFrame.minX + margin && probe.x <= viewFrame.maxX - margin && probe.y >= viewFrame.minY + margin && probe.y <= viewFrame.maxY - margin
    )
  }

  /** Smallest camera distance at which every corner of the board is inside the free area. */
  const computeFit = () => {
    const savedPosition = camera.position.clone()
    const savedRotation = camera.quaternion.clone()
    let near = 4
    let far = 160
    for (let i = 0; i < 18; i++) {
      const distance = (near + far) / 2
      camera.position.copy(fitTarget).addScaledVector(CAMERA_DIRECTION, distance)
      camera.lookAt(fitTarget)
      camera.updateMatrixWorld()
      if (corners.every((corner) => insideFrame(corner))) far = distance
      else near = distance
    }
    camera.position.copy(savedPosition)
    camera.quaternion.copy(savedRotation)
    camera.updateMatrixWorld()
    fitDistance = far
    controls.maxDistance = fitDistance * 1.5
  }
  const fit = () => {
    computeFit()
    controls.target.copy(fitTarget)
    camera.position.copy(fitTarget).addScaledVector(CAMERA_DIRECTION, fitDistance)
    controls.update()
  }

  const boundX = map.cols / 2
  const boundZ = map.rows / 2
  const clamped = new THREE.Vector3()
  controls.addEventListener('change', () => {
    // Keep the board on screen: clamp the pivot and carry the camera with it.
    clamped.copy(controls.target)
    clamped.x = THREE.MathUtils.clamp(clamped.x, -boundX, boundX)
    clamped.z = THREE.MathUtils.clamp(clamped.z, -boundZ, boundZ)
    clamped.y = THREE.MathUtils.clamp(clamped.y, -0.5, 1)
    if (!clamped.equals(controls.target)) {
      camera.position.add(clamped.clone().sub(controls.target))
      controls.target.copy(clamped)
    }
    const percent = Math.round((fitDistance / camera.position.distanceTo(controls.target)) * 100)
    if (percent !== lastPercent) {
      lastPercent = percent
      events.current.onZoomChange(percent)
    }
  })

  // --- tokens
  const tokenViews = new Map<string, TokenView>()
  const labelScale = new THREE.Vector3(0.1, 0.02, 1)
  const updateLabelScale = (viewportHeight: number) => {
    // Sprites without size attenuation are sized as a fraction of the viewport, so labels stay readable at any zoom.
    const height = (LABEL_PIXELS / viewportHeight) * 2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2))
    labelScale.set((height * 320) / 76 / TOKEN_SCALE, height / TOKEN_SCALE, 1)
    for (const view of tokenViews.values()) view.label.scale.copy(labelScale)
  }
  const tokenLayer = new THREE.Group()
  scene.add(tokenLayer)
  let selectedId: string | null = null

  const standPosition = (token: Pick<Token, 'x' | 'y'>, out: THREE.Vector3) => {
    const tile = map.tiles[tileIndex(map, token.x, token.y)]
    const { wx, wz } = tileWorld(map, token.x, token.y)
    return out.set(wx, tile ? tileTopY(tile) : 0, wz)
  }

  const syncTokens = (tokens: Token[], selected: string | null) => {
    selectedId = selected
    const alive = new Set(tokens.map((token) => token.id))
    for (const [id, view] of tokenViews) {
      if (alive.has(id)) continue
      tokenLayer.remove(view.group)
      disposeObject(view.group)
      tokenViews.delete(id)
    }
    for (const token of tokens) {
      let view = tokenViews.get(token.id)
      if (!view) {
        view = buildToken(token)
        view.label.scale.copy(labelScale)
        standPosition(token, view.to)
        view.group.position.copy(view.to)
        tokenViews.set(token.id, view)
        tokenLayer.add(view.group)
      }
      const target = standPosition(token, new THREE.Vector3())
      if (!target.equals(view.to)) {
        view.from.copy(view.group.position)
        view.to.copy(target)
        view.progress = 0
      }
      const labelKey = `${token.name}|${token.hp}|${token.maxHp}|${token.kind}`
      if (labelKey !== view.labelKey) {
        view.labelKey = labelKey
        drawLabel(view.canvas, token)
        view.texture.needsUpdate = true
      }
      view.ring.visible = view.arrow.visible = token.id === selected
    }
  }

  const setReachable = (reachable: Map<number, number>) => {
    for (let i = 0; i < count; i++) {
      if (!reachable.has(i)) {
        reachMesh.setMatrixAt(i, zero)
        continue
      }
      const x = i % map.cols
      const y = Math.floor(i / map.cols)
      const { wx, wz } = tileWorld(map, x, y)
      dummy.position.set(wx, tileTopY(map.tiles[i]) + 0.012, wz)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      reachMesh.setMatrixAt(i, dummy.matrix)
    }
    reachMesh.instanceMatrix.needsUpdate = true
  }

  // --- picking
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const down = { x: 0, y: 0, button: -1, dragging: false }
  let hoverIndex = -1

  const pick = (event: PointerEvent): { tokenId?: string; tile?: Point } => {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const tokenHit = raycaster.intersectObjects(tokenLayer.children, true).find((hit) => hit.object.userData.tokenId)
    if (tokenHit) return { tokenId: tokenHit.object.userData.tokenId as string }
    const tileHit = raycaster.intersectObject(caps, false)[0]
    if (tileHit && tileHit.instanceId !== undefined) {
      return { tile: { x: tileHit.instanceId % map.cols, y: Math.floor(tileHit.instanceId / map.cols) } }
    }
    return {}
  }

  const setHover = (tile: Point | null) => {
    const index = tile ? tileIndex(map, tile.x, tile.y) : -1
    if (index === hoverIndex) return
    hoverIndex = index
    hover.visible = tile !== null
    if (tile) {
      const { wx, wz } = tileWorld(map, tile.x, tile.y)
      hover.position.set(wx, tileTopY(map.tiles[index]) + 0.02, wz)
    }
    events.current.onHoverTile(tile)
  }

  const onPointerDown = (event: PointerEvent) => {
    Object.assign(down, { x: event.clientX, y: event.clientY, button: event.button, dragging: false })
  }
  const onPointerMove = (event: PointerEvent) => {
    if (down.button !== -1 && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) down.dragging = true
    if (down.button !== -1 && down.dragging) return
    const hit = pick(event)
    setHover(hit.tile ?? null)
    renderer.domElement.style.cursor = hit.tokenId ? 'pointer' : 'grab'
  }
  const onPointerUp = (event: PointerEvent) => {
    const wasClick = down.button === 0 && !down.dragging
    down.button = -1
    if (!wasClick) return
    const hit = pick(event)
    if (hit.tokenId) events.current.onTokenClick(hit.tokenId)
    else if (hit.tile) events.current.onTileClick(hit.tile)
  }
  const onPointerLeave = () => setHover(null)
  const onContextMenu = (event: Event) => event.preventDefault()

  const element = renderer.domElement
  element.addEventListener('pointerdown', onPointerDown)
  element.addEventListener('pointermove', onPointerMove)
  element.addEventListener('pointerup', onPointerUp)
  element.addEventListener('pointerleave', onPointerLeave)
  element.addEventListener('contextmenu', onContextMenu)

  // --- sizing and render loop
  let firstLayout = true
  const resize = () => {
    const width = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return
    renderer.setSize(width, height, false)
    element.style.width = '100%'
    element.style.height = '100%'
    camera.aspect = width / height
    applyInsets(width, height)
    camera.updateProjectionMatrix()
    updateLabelScale(height)
    if (firstLayout) {
      firstLayout = false
      fit()
    } else {
      computeFit()
    }
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  const focusTween = { active: false, to: new THREE.Vector3() }
  const timer = new THREE.Timer()
  let frame = 0
  const tick = (timestamp?: number) => {
    frame = requestAnimationFrame(tick)
    timer.update(timestamp)
    const delta = Math.min(timer.getDelta(), 0.05)
    const time = timer.getElapsed()

    if (focusTween.active) {
      const step = focusTween.to.clone().sub(controls.target).multiplyScalar(Math.min(1, delta * 6))
      controls.target.add(step)
      camera.position.add(step)
      if (step.lengthSq() < 0.00001) focusTween.active = false
    }
    controls.update()

    for (const [id, view] of tokenViews) {
      if (view.progress < 1) {
        view.progress = Math.min(1, view.progress + delta / 0.38)
        const eased = view.progress * view.progress * (3 - 2 * view.progress)
        view.group.position.lerpVectors(view.from, view.to, eased)
        view.group.position.y += Math.sin(Math.PI * view.progress) * 0.38
      }
      if (id === selectedId) {
        const pulse = 1 + Math.sin(time * 4) * 0.06
        view.ring.scale.set(pulse, pulse, 1)
        view.arrow.position.y = 1.02 + Math.sin(time * 3.2) * 0.05
        view.arrow.rotation.y = time * 1.5
      }
    }
    for (const flame of flames) {
      const flicker = 1 + Math.sin(time * 11 + flame.id) * 0.12
      flame.scale.set(flicker, 1 + Math.sin(time * 7 + flame.id) * 0.2, flicker)
    }
    renderer.render(scene, camera)
  }
  tick()

  return {
    syncTokens,
    setReachable,
    fit,
    zoomBy: (factor: number) => {
      const offset = camera.position.clone().sub(controls.target)
      const distance = THREE.MathUtils.clamp(offset.length() / factor, controls.minDistance, controls.maxDistance)
      camera.position.copy(controls.target).add(offset.setLength(distance))
      controls.update()
    },
    focus: (point: Point) => {
      standPosition(point, focusTween.to)
      // Only pan when the tile is off screen or hugging the edge: no camera jumps for tokens already in view.
      if (insideFrame(focusTween.to, 0.18)) return
      focusTween.to.y = 0
      focusTween.active = true
    },
    dispose: () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('pointerleave', onPointerLeave)
      element.removeEventListener('contextmenu', onContextMenu)
      controls.dispose()
      disposeObject(scene)
      renderer.dispose()
      element.remove()
    },
  }
}

type Stage = ReturnType<typeof createStage>

// ---------- component ----------

export default function BoardScene({
  map,
  tokens,
  selectedId,
  reachable,
  onTileClick,
  onTokenClick,
  onHoverTile,
  onZoomChange,
  insets = NO_INSETS,
  ref,
}: BoardSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Stage | null>(null)
  const eventsRef = useRef<SceneEvents>({ onTileClick, onTokenClick, onHoverTile, onZoomChange })

  // The stage keeps one long-lived set of listeners, so it reads the newest handlers from a ref.
  useEffect(() => {
    eventsRef.current = { onTileClick, onTokenClick, onHoverTile, onZoomChange }
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const stage = createStage(container, map, eventsRef, insets)
    stageRef.current = stage
    return () => {
      stageRef.current = null
      stage.dispose()
    }
  }, [map, insets])

  useEffect(() => {
    stageRef.current?.syncTokens(tokens, selectedId)
  }, [map, tokens, selectedId])

  useEffect(() => {
    stageRef.current?.setReachable(reachable)
  }, [map, reachable])

  useImperativeHandle(
    ref,
    () => ({
      zoomBy: (factor) => stageRef.current?.zoomBy(factor),
      fit: () => stageRef.current?.fit(),
      focus: (point) => stageRef.current?.focus(point),
    }),
    []
  )

  return <div ref={containerRef} className="absolute inset-0" />
}
