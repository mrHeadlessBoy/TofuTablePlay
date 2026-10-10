'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { DieSides } from './dice'

/** How long the die tumbles after a roll. The number on top settles at the same moment. */
export const ROLL_ANIMATION_MS = 850

type Die3DProps = {
  sides: DieSides
  /** Change this value to make the die spin again (the id of the latest roll works well). */
  rollId: string | null
  /** Colour of the edges, any CSS colour. */
  tone?: string
  /** Width and height in pixels. */
  size?: number
}

function dieGeometry(sides: DieSides): THREE.BufferGeometry[] {
  switch (sides) {
    case 4:
      return [new THREE.TetrahedronGeometry(1.05)]
    case 6:
      return [new THREE.BoxGeometry(1.25, 1.25, 1.25)]
    case 8:
      return [new THREE.OctahedronGeometry(1.05)]
    case 12:
      return [new THREE.DodecahedronGeometry(1)]
    case 20:
      return [new THREE.IcosahedronGeometry(1.05)]
    default: {
      // d10 and d100: a ten-sided bipyramid made of two five-sided cones.
      const upper = new THREE.ConeGeometry(0.95, 0.95, 5)
      upper.translate(0, 0.475, 0)
      const lower = new THREE.ConeGeometry(0.95, 0.95, 5)
      lower.rotateX(Math.PI)
      lower.rotateY(Math.PI / 5)
      lower.translate(0, -0.475, 0)
      return [upper, lower]
    }
  }
}

/** A small tumbling 3D die. It spins hard whenever `rollId` changes, then settles. */
export default function Die3D({ sides, rollId, tone = '#f59e0b', size = 132 }: Die3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const spinRef = useRef(0)
  const toneRef = useRef(tone)

  useEffect(() => {
    toneRef.current = tone
  }, [tone])

  useEffect(() => {
    if (rollId) spinRef.current = 1
  }, [rollId])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(size, size)
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20)
    camera.position.set(0, 0, 4.6)
    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const key = new THREE.DirectionalLight(0xffffff, 2.4)
    key.position.set(2, 3, 4)
    scene.add(key)

    const die = new THREE.Group()
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#1a1d25', metalness: 0.35, roughness: 0.35, flatShading: true })
    const edgeMaterial = new THREE.LineBasicMaterial({ color: toneRef.current })
    const geometries = dieGeometry(sides)
    const edges = geometries.map((geometry) => new THREE.EdgesGeometry(geometry, 1))
    geometries.forEach((geometry, index) => {
      die.add(new THREE.Mesh(geometry, bodyMaterial), new THREE.LineSegments(edges[index], edgeMaterial))
    })
    die.rotation.set(0.5, 0.6, 0.1)
    scene.add(die)

    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const delta = Math.min((now - previous) / 1000, 0.05)
      previous = now
      spinRef.current = Math.max(0, spinRef.current - delta / (ROLL_ANIMATION_MS / 1000))
      const speed = 0.35 + spinRef.current * spinRef.current * 16
      die.rotation.x += delta * speed
      die.rotation.y += delta * speed * 1.3
      die.rotation.z += delta * speed * 0.4
      edgeMaterial.color.set(toneRef.current)
      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      for (const geometry of [...geometries, ...edges]) geometry.dispose()
      bodyMaterial.dispose()
      edgeMaterial.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [sides, size])

  return <div ref={hostRef} style={{ width: size, height: size }} />
}
