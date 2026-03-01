'use client'

import { useState, useRef, Suspense, lazy } from 'react'
import type { Application } from '@splinetool/runtime'

const Spline = lazy(() => import('@splinetool/react-spline'))

const SCENE_URL = 'https://prod.spline.design/gmN5Qk3WgMVQCDOO/scene.splinecode'

// Robot recoloring: map each object to the correct material layer + target color
const ROBOT_COLORS: { name: string; layer: number; color: string }[] = [
  // Body panels (color in layer 1) → Indigo-400
  { name: 'Head_1', layer: 1, color: '#818CF8' },
  { name: 'Body', layer: 1, color: '#818CF8' },
  { name: 'Arm_R', layer: 1, color: '#818CF8' },
  { name: 'Arm_L', layer: 1, color: '#818CF8' },
  { name: 'Shoulder_R', layer: 1, color: '#818CF8' },
  { name: 'Shoulder_L', layer: 1, color: '#818CF8' },
  { name: 'Cylinder', layer: 1, color: '#818CF8' },

  // Joints & dark parts (color in layer 1) → Deep indigo-900
  { name: 'Head_2', layer: 1, color: '#312E81' },
  { name: 'Body Circle_2', layer: 1, color: '#312E81' },
  { name: 'Neck', layer: 1, color: '#312E81' },
  { name: 'Forearm_R', layer: 1, color: '#312E81' },
  { name: 'Forearm_L', layer: 1, color: '#312E81' },
  { name: 'HAND_R', layer: 1, color: '#312E81' },
  { name: 'Hand_L', layer: 1, color: '#312E81' },
  { name: 'Cylinder002', layer: 1, color: '#312E81' },

  // Accents (color in layer 0) → Teal
  { name: 'Eyes', layer: 0, color: '#14B8A6' },
  { name: 'Mouth', layer: 0, color: '#14B8A6' },

  // Accents (color in layer 2) → Cyan
  { name: 'Ears', layer: 2, color: '#22D3EE' },
  { name: 'Body Circle_1', layer: 2, color: '#06B6D4' },
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
            <div className="w-16 h-16 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
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
