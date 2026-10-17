import React, { useEffect, useState } from 'react'

export default function Screensaver({ onComplete, isReplaying, darkMode }) {
  const [stage, setStage] = useState('active') // 'active' | 'exiting' | 'hidden'

  useEffect(() => {
    // Stage 1: Active hold for 1.0s
    const timer1 = setTimeout(() => {
      setStage('exiting')
    }, 1000)

    // Stage 2: Fast & crisp 1.2s fadeout completes at 1000ms + 1200ms = 2200ms
    const timer2 = setTimeout(() => {
      setStage('hidden')
      if (onComplete) onComplete()
    }, 2200)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [isReplaying])

  if (stage === 'hidden') return null

  const isExiting = stage === 'exiting'

  return (
    <div
      style={{
        pointerEvents: isExiting ? 'none' : 'auto',
      }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* 
        Full-bleed solid background: Only transitions opacity (NO blur).
        This guarantees perfectly flat, edge-to-edge borders without any inward-curving rounded corners.
      */}
      <div
        style={{
          transition: 'opacity 1.2s cubic-bezier(0.2, 0, 0, 1)',
          willChange: 'opacity',
          opacity: isExiting ? 0 : 1,
        }}
        className={`absolute inset-0 ${
          darkMode ? 'bg-[#0D0F12]' : 'bg-[#F9FAFB]'
        }`}
      />

      {/* 
        Foreground Typography & Identity:
        Soft optical blur dissolve + subtle scale, contained entirely within the canvas.
      */}
      <div
        style={{
          transition: 'opacity 1.2s cubic-bezier(0.2, 0, 0, 1), filter 1.2s cubic-bezier(0.2, 0, 0, 1), transform 1.2s cubic-bezier(0.2, 0, 0, 1)',
          willChange: 'opacity, filter, transform',
          opacity: isExiting ? 0 : 1,
          filter: isExiting ? 'blur(28px)' : 'blur(0px)',
          transform: isExiting ? 'scale(1.03)' : 'scale(1)',
        }}
        className={`relative z-10 flex flex-col items-center text-center px-6 ${
          darkMode ? 'text-white' : 'text-[#111827]'
        }`}
      >
        {/* Optical hairline mark */}
        <div className="mb-6 flex items-center space-x-2">
          <div className="w-6 h-[1.5px] bg-[#9D1D53]" />
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              darkMode ? 'bg-white/80' : 'bg-[#111827]/80'
            }`}
          />
          <div className="w-6 h-[1.5px] bg-[#9D1D53]" />
        </div>

        {/* Centered Huge Stylized PRISM Typography */}
        <h1
          className={`text-6xl sm:text-8xl md:text-9xl font-semibold tracking-[0.35em] font-sans select-none pl-[0.35em] drop-shadow-sm ${
            darkMode ? 'text-white' : 'text-[#111827]'
          }`}
        >
          PRISM
        </h1>

        {/* Minimal Subtext */}
        <div
          className={`mt-6 flex items-center space-x-2.5 text-[11px] tracking-[0.25em] uppercase font-mono ${
            darkMode ? 'text-zinc-400' : 'text-gray-500'
          }`}
        >
          <span>FORTEBANK</span>
          <span className={darkMode ? 'text-zinc-600' : 'text-gray-300'}>•</span>
          <span>КАССОВЫЙ КОНТРОЛЬ</span>
        </div>
      </div>
    </div>
  )
}
