'use client'

/**
 * AnimatedBackground Component
 *
 * Creates a modern animated gradient background with floating orbs.
 * Animated gradient background with floating orbs.
 */
export function AnimatedBackground() {
  return (
    <div className="animated-bg">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="orb orb-4" />
      <div className="grid-overlay" />
      <style jsx>{`
        .animated-bg {
          position: fixed;
          inset: 0;
          overflow: hidden;
          z-index: -1;
          background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #2d3561 100%);
        }

        .animated-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background: url('/images/hero-bg.png') center center / cover no-repeat;
          opacity: 0.4;
          mix-blend-mode: screen;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.5;
          animation: float 20s ease-in-out infinite;
        }

        .orb-1 {
          width: 600px;
          height: 600px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          top: -200px;
          left: -100px;
          animation-delay: 0s;
        }

        .orb-2 {
          width: 500px;
          height: 500px;
          background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
          top: 60%;
          right: -150px;
          animation-delay: -5s;
          animation-duration: 25s;
        }

        .orb-3 {
          width: 400px;
          height: 400px;
          background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
          bottom: -100px;
          left: 30%;
          animation-delay: -10s;
          animation-duration: 22s;
        }

        .orb-4 {
          width: 300px;
          height: 300px;
          background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
          top: 40%;
          left: 10%;
          animation-delay: -15s;
          animation-duration: 28s;
          opacity: 0.3;
        }

        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(30px, -30px) scale(1.05);
          }
          50% {
            transform: translate(-20px, 20px) scale(0.95);
          }
          75% {
            transform: translate(-30px, -20px) scale(1.02);
          }
        }
      `}</style>
    </div>
  )
}
