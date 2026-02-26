'use client'

import { useState } from 'react'

export function SplineScene() {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Loading state */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-b-indigo-500/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
        </div>
      )}
      <iframe
        src="https://my.spline.design/genkubgreetingrobot-pEmY1hpJlG4TSqHlw1hwkoKX/"
        frameBorder={0}
        width="100%"
        height="100%"
        className="rounded-2xl"
        style={{
          border: 'none',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onLoad={() => setLoaded(true)}
        allow="autoplay"
        loading="eager"
      />
      {/* Cover Spline watermark */}
      <div className="absolute bottom-0 right-0 w-48 h-12 bg-[#030014] pointer-events-none" />
    </div>
  )
}
