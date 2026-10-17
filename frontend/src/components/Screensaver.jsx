import React, { useEffect, useState } from 'react'

export default function Screensaver({ onComplete, isReplaying, darkMode }) {
  const [stage, setStage] = useState('active') // 'active' | 'exiting' | 'hidden'

  useEffect(() => {
    // Stage 1: Active for exactly 1.0s
    const timer1 = setTimeout(() => {
      setStage('exiting')
    }, 1000)

    // Stage 2: 50px blur fadeout completes after 800ms
    const timer2 = setTimeout(() => {
      setStage('hidden')
      if (onComplete) onComplete()
    }, 1800)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [isReplaying])

  if (stage === 'hidden') return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden screensaver-overlay ${
        darkMode ? 'bg-[#0D0F12] text-white' : 'bg-[#F9FAFB] text-[#111827]'
      } ${stage === 'exiting' ? 'screensaver-exiting' : 'opacity-100'}`}
    >
      <div className="relative z-10 flex flex-col items-center text-center px-6">
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
