'use client'

import { useState, useRef, Suspense, lazy } from 'react'
import type { Application } from '@splinetool/runtime'

const Spline = lazy(() => import('@splinetool/react-spline'))

const SCENE_URL = 'https://prod.spline.design/gmN5Qk3WgMVQCDOO/scene.splinecode'

// Robot recoloring: map each object to the correct material layer + target color
// Colors matched to landing page brand palette (teal primary + amber accent)
const ROBOT_COLORS: { name: string; layer: number; color: string }[] = [
  // Body panels (color in layer 1) → Teal-600 (matches bot avatar, check icons)
  { name: 'Head_1', layer: 1, color: '#0D9488' },
  { name: 'Body', layer: 1, color: '#0D9488' },
  { name: 'Arm_R', layer: 1, color: '#0D9488' },
  { name: 'Arm_L', layer: 1, color: '#0D9488' },
  { name: 'Shoulder_R', layer: 1, color: '#0D9488' },
  { name: 'Shoulder_L', layer: 1, color: '#0D9488' },
  { name: 'Cylinder', layer: 1, color: '#0D9488' },

  // Joints & dark parts (color in layer 1) → Teal-900 (deep teal for contrast)
  { name: 'Head_2', layer: 1, color: '#134E4A' },
  { name: 'Body Circle_2', layer: 1, color: '#134E4A' },
  { name: 'Neck', layer: 1, color: '#134E4A' },
  { name: 'Forearm_R', layer: 1, color: '#134E4A' },
  { name: 'Forearm_L', layer: 1, color: '#134E4A' },
  { name: 'HAND_R', layer: 1, color: '#134E4A' },
  { name: 'Hand_L', layer: 1, color: '#134E4A' },
  { name: 'Cylinder002', layer: 1, color: '#134E4A' },

  // Accents (color in layer 0) → Amber-500 (warm pop, matches amber feature card)
  { name: 'Eyes', layer: 0, color: '#F59E0B' },
  { name: 'Mouth', layer: 0, color: '#F59E0B' },

  // Accents (color in layer 2) → Teal-300 / Teal-700 (lighter/darker teal accents)
  { name: 'Ears', layer: 2, color: '#5EEAD4' },
  { name: 'Body Circle_1', layer: 2, color: '#0F766E' },
]

export function SplineScene() {
  const [loaded, setLoaded] = useState(false)
  const splineRef = useRef<Application | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function onLoad(spline: Application) {
    splineRef.current = spline
    setLoaded(true)

    // Set scene background to match page background
    try {
      spline.setBackgroundColor('#FAFAF7')
    } catch {}

    // Hide "Built with Spline" watermark via render pipeline
    try {
      const renderer = (spline as any)?._renderer
      if (renderer && renderer.pipeline && 'logoOverlayPass' in renderer.pipeline && renderer.pipeline.logoOverlayPass) {
        renderer.pipeline.logoOverlayPass.enabled = false
      }
    } catch {}

    // Fix overflow:hidden on Spline's internal wrapper divs + canvas bg
    if (containerRef.current) {
      const canvas = containerRef.current.querySelector('canvas')
      if (canvas) {
        canvas.style.background = '#FAFAF7'
        let el: HTMLElement | null = canvas.parentElement
        while (el && el !== containerRef.current) {
          el.style.overflow = 'visible'
          el = el.parentElement
        }
      }
    }

    // Recolor robot by targeting each object's correct material layer
    const recolor = () => {
      for (const { name, layer, color } of ROBOT_COLORS) {
        try {
          const obj = spline.findObjectByName(name)
          if (obj?.material?.layers?.[layer]) {
            (obj.material.layers[layer] as any).color = color
          }
        } catch {}
      }
    }
    recolor()
    setTimeout(recolor, 500)
    setTimeout(recolor, 1500)
  }

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ overflow: 'visible' }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-teal-500/20 border-t-teal-500 animate-spin" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-b-teal-400/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
        </div>
      )}

      <div
        className="w-full h-full [&_canvas]:!bg-[#FAFAF7] [&_div]:!overflow-visible"
        style={{
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'visible',
        }}
      >
        <Suspense fallback={null}>
          <Spline
            scene={SCENE_URL}
            onLoad={onLoad}
            style={{ width: '100%', height: '100%', background: '#FAFAF7', overflow: 'visible' }}
          />
        </Suspense>
      </div>
    </div>
  )
}
