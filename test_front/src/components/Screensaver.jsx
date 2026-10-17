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
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 sm:p-6 screensaver-overlay select-none overflow-hidden ${
        darkMode ? 'bg-[#0D0F12]' : 'bg-[#ECEEF2]'
      } ${stage === 'exiting' ? 'screensaver-exiting' : 'opacity-100'}`}
    >
      <svg className="absolute w-0 h-0 pointer-events-none opacity-0 overflow-hidden" aria-hidden="true">
        <defs>
          <filter id="prism-glass-refract" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.75" numOctaves="3" result="flutedNoise" />
            <feDisplacementMap in="SourceGraphic" in2="flutedNoise" scale="12" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feGaussianBlur in="displaced" stdDeviation="1.5" result="blurred" />
            <feMerge>
              <feMergeNode in="blurred" />
              <feMergeNode in="displaced" opacity="0.65" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <div
        className={`relative w-full max-w-4xl py-16 sm:py-24 px-6 sm:px-12 rounded-2xl flex flex-col items-center justify-center screensaver-card ${
          darkMode
            ? 'bg-[#13161C] border border-white/[0.08] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.85)]'
            : 'bg-white border border-black/[0.05] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.08)]'
        }`}
      >
        <div className="relative flex items-center justify-center font-sans font-bold leading-none tracking-[0.2em] text-6xl sm:text-8xl md:text-9xl">
          <div className="relative inline-flex items-center">
            <span className={darkMode ? 'text-white' : 'text-[#0D0F12]'}>P</span>
            <span
              aria-hidden="true"
              className={`absolute top-0 left-0 pointer-events-none opacity-40 select-none ${
                darkMode ? 'text-white' : 'text-[#0D0F12]'
              }`}
              style={{
                filter: 'blur(3.5px)',
                transform: 'translateX(8px) scaleX(1.25)',
                clipPath: 'inset(0 0 0 35%)',
                maskImage: 'linear-gradient(to right, transparent, black)'
              }}
            >
              P
            </span>
          </div>

          <div
            className={`relative mx-1 sm:mx-2 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-center rounded-sm overflow-hidden glass-slab-lens ${
              darkMode ? 'glass-slab-dark' : 'glass-slab-light'
            }`}
          >
            <div
              className={`relative flex items-center tracking-[0.2em] refracted-letters ${
                darkMode ? 'text-white/85' : 'text-[#0D0F12]/85'
              }`}
            >
              <span>R</span>
              <span>I</span>
              <span>S</span>
            </div>

            <div className="absolute inset-0 pointer-events-none fluted-lines opacity-35 mix-blend-overlay" />
            <div className="absolute inset-0 pointer-events-none grain-stipple opacity-45 mix-blend-multiply dark:mix-blend-overlay" />

            <svg
              className="absolute bottom-0 right-0 w-28 sm:w-36 h-16 sm:h-20 pointer-events-none opacity-50 dark:opacity-75"
              viewBox="0 0 140 80"
              fill="none"
            >
              <path
                d="M140 10 C110 50, 70 76, 5 78 L140 78 Z"
                fill="url(#lens-meniscus-fill-test)"
              />
              <path
                d="M140 10 C110 50, 70 76, 5 78"
                stroke={darkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.35)'}
                strokeWidth="1.5"
              />
              <defs>
                <linearGradient id="lens-meniscus-fill-test" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="100%" stopColor={darkMode ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.25)'} />
                </linearGradient>
              </defs>
            </svg>

            <div className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none bg-white/80 dark:bg-white/20" />
            <div className="absolute bottom-0 left-0 right-0 h-[3px] pointer-events-none bg-black/45 dark:bg-black/90" />
          </div>

          <div className="relative inline-flex items-center">
            <span className={darkMode ? 'text-white' : 'text-[#0D0F12]'}>M</span>
            <span
              aria-hidden="true"
              className={`absolute top-0 left-0 pointer-events-none opacity-40 select-none ${
                darkMode ? 'text-white' : 'text-[#0D0F12]'
              }`}
              style={{
                filter: 'blur(3.5px)',
                transform: 'translateX(-8px) scaleX(1.25)',
                clipPath: 'inset(0 35% 0 0)',
                maskImage: 'linear-gradient(to left, transparent, black)'
              }}
            >
              M
            </span>
          </div>
        </div>

        <div
          className={`mt-10 sm:mt-12 flex items-center space-x-3 text-[10px] sm:text-[11px] tracking-[0.3em] uppercase font-mono ${
            darkMode ? 'text-zinc-500' : 'text-gray-400'
          }`}
        >
          <span>FORTEBANK</span>
          <span className="w-1 h-1 rounded-full bg-[#9D1D53]" />
          <span>КАССОВЫЙ КОНТРОЛЬ</span>
        </div>
      </div>
    </div>
  )
}
