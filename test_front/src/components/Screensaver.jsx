import React, { useEffect, useState } from 'react'

export default function Screensaver({ onComplete, isReplaying, darkMode = true }) {
  const [stage, setStage] = useState('active')

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setStage('exiting')
    }, 1500)

    const timer2 = setTimeout(() => {
      setStage('hidden')
      if (onComplete) onComplete()
    }, 5300)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [isReplaying])

  if (stage === 'hidden') return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none overflow-hidden screensaver-overlay ${
        darkMode ? 'bg-[#0D0F12] text-white' : 'bg-[#F9FAFB] text-[#111827]'
      } ${stage === 'exiting' ? 'screensaver-exiting' : 'opacity-100'}`}
    >
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-5xl w-full">
        <div className="mb-8 flex items-center space-x-2.5">
          <div className="w-8 h-[1.5px] bg-[#9D1D53]" />
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              darkMode ? 'bg-white/80' : 'bg-[#111827]/80'
            }`}
          />
          <div className="w-8 h-[1.5px] bg-[#9D1D53]" />
        </div>

        <div className="relative inline-block my-2">
          <h1
            className={`text-7xl sm:text-8xl md:text-9xl font-bold tracking-[0.32em] font-sans select-none pl-[0.32em] leading-none ${
              darkMode ? 'text-white' : 'text-[#0D0F12]'
            }`}
          >
            PRISM
          </h1>

          <div
            aria-hidden="true"
            className={`absolute top-[-10%] bottom-[-10%] left-[23%] right-[23%] rounded-xl overflow-hidden pointer-events-none transition-all ${
              darkMode ? 'glass-slab-dark' : 'glass-slab-light'
            }`}
          >
            <div className="absolute inset-0 backdrop-blur-[12px] -webkit-backdrop-blur-[12px]" />
            <div className="absolute inset-0 fluted-lines opacity-25 mix-blend-overlay pointer-events-none" />
            <div className="absolute inset-0 grain-stipple opacity-30 mix-blend-multiply dark:mix-blend-overlay pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-white/70 dark:bg-white/25 pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/20 dark:bg-black/60 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-12 sm:w-16 h-10 sm:h-12 rounded-tl-2xl bg-gradient-to-tl from-black/15 to-transparent dark:from-black/40 pointer-events-none" />
          </div>
        </div>

        <div
          className={`mt-8 flex items-center space-x-2.5 text-[11px] sm:text-xs tracking-[0.28em] uppercase font-mono ${
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
