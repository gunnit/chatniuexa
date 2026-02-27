'use client'

import { useState, useRef, Suspense, lazy } from 'react'
import type { Application } from '@splinetool/runtime'

const Spline = lazy(() => import('@splinetool/react-spline'))

const SCENE_URL = 'https://prod.spline.design/gmN5Qk3WgMVQCDOO/scene.splinecode'

// Robot recoloring: map object names to palette colors
const ROBOT_COLORS: Record<string, string> = {
  // Body panels → Indigo-400
  Head_1: '#818CF8',
  Body: '#818CF8',
  Arm_R: '#818CF8',
  Arm_L: '#818CF8',
  Shoulder_R: '#818CF8',
  Shoulder_L: '#818CF8',
  Cylinder: '#818CF8',

  // Joints & dark parts → Deep indigo-900
  Head_2: '#312E81',
  'Body Circle_2': '#312E81',
  Neck: '#312E81',
  Forearm_R: '#312E81',
  Forearm_L: '#312E81',
  HAND_R: '#312E81',
  Hand_L: '#312E81',
  Cylinder002: '#312E81',
  'Hand Down': '#312E81',

  // Accents → Teal / Cyan
  Eyes: '#14B8A6',
  Mouth: '#14B8A6',
  Ears: '#22D3EE',
  'Body Circle_1': '#06B6D4',
}

export function SplineScene() {
  const [loaded, setLoaded] = useState(false)
  const splineRef = useRef<Application | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function onLoad(spline: Application) {
    splineRef.current = spline
    setLoaded(true)

    // Set scene background to match page background color
    try {
      spline.setBackgroundColor('#FAFAF7')
    } catch {}

    // Fix all overflow:hidden on Spline wrapper divs + set canvas bg
    if (containerRef.current) {
      const canvas = containerRef.current.querySelector('canvas')
      if (canvas) {
        canvas.style.background = '#FAFAF7'
        // Remove overflow:hidden from Spline's own wrapper divs
        let el: HTMLElement | null = canvas.parentElement
        while (el && el !== containerRef.current) {
          el.style.overflow = 'visible'
          el = el.parentElement
        }
      }
    }

    // Recolor robot objects to match project palette
    const recolor = () => {
      for (const [name, color] of Object.entries(ROBOT_COLORS)) {
        try {
          const obj = spline.findObjectByName(name)
          if (obj) {
            ;(obj as any).color = color
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
