'use client'

import { useState, useRef, Suspense, lazy } from 'react'
import type { Application } from '@splinetool/runtime'

const Spline = lazy(() => import('@splinetool/react-spline'))

const SCENE_URL = 'https://prod.spline.design/gmN5Qk3WgMVQCDOO/scene.splinecode'

export function SplineScene() {
  const [loaded, setLoaded] = useState(false)
  const splineRef = useRef<Application | null>(null)

  function onLoad(spline: Application) {
    splineRef.current = spline
    setLoaded(true)
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-teal-500/20 border-t-teal-500 animate-spin" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-b-teal-400/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
        </div>
      )}

      <div
        className="w-full h-full"
        style={{
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <Suspense fallback={null}>
          <Spline
            scene={SCENE_URL}
            onLoad={onLoad}
            style={{ width: '100%', height: '100%' }}
          />
        </Suspense>
      </div>
    </div>
  )
}
