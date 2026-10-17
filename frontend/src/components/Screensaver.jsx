import React, { useEffect, useState, useRef } from 'react'

export default function Screensaver({ onStartExit, onComplete, isReplaying, darkMode, manualDismiss = false }) {
  const [stage, setStage] = useState('active') // 'active' | 'exiting' | 'hidden'
  const exitingRef = useRef(false)
  const mountTimeRef = useRef(Date.now())

  const exitScreensaver = () => {
    if (Date.now() - mountTimeRef.current < 150) return
    if (exitingRef.current) return
    exitingRef.current = true
    setStage('exiting')
    if (onStartExit) onStartExit()

    // 0.95s fadeout completes at 950ms
    setTimeout(() => {
      setStage('hidden')
      if (onComplete) onComplete()
    }, 950)
  }

  useEffect(() => {
    exitingRef.current = false
    mountTimeRef.current = Date.now()
    setStage('active')

    if (manualDismiss) {
      // In manual screensaver mode: do not transition automatically.
      // Wait until the user clicks with the mouse or presses any key.
      const handleUserActivity = () => {
        exitScreensaver()
      }

      const initTimer = setTimeout(() => {
        window.addEventListener('pointerdown', handleUserActivity, { once: true })
        window.addEventListener('keydown', handleUserActivity, { once: true })
      }, 150)

      return () => {
        clearTimeout(initTimer)
        window.removeEventListener('pointerdown', handleUserActivity)
        window.removeEventListener('keydown', handleUserActivity)
      }
    } else {
      // Automatic 1.0s intro on initial page load
      const timer1 = setTimeout(() => {
        exitScreensaver()
      }, 1000)

      return () => {
        clearTimeout(timer1)
      }
    }
  }, [isReplaying, manualDismiss])

  if (stage === 'hidden') return null

  const isExiting = stage === 'exiting'

  return (
    <div
      onClick={manualDismiss ? exitScreensaver : undefined}
      style={{
        pointerEvents: isExiting ? 'none' : 'auto',
      }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden ${
        manualDismiss && !isExiting ? 'cursor-pointer' : ''
      }`}
    >
      {/* 
        Full-bleed solid background: Only transitions opacity (NO blur).
        This guarantees perfectly flat, edge-to-edge borders without any inward-curving rounded corners.
      */}
      <div
        style={{
          transition: 'opacity 0.95s cubic-bezier(0.2, 0, 0, 1)',
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
          transition: 'opacity 0.95s cubic-bezier(0.2, 0, 0, 1), filter 0.95s cubic-bezier(0.2, 0, 0, 1), transform 0.95s cubic-bezier(0.2, 0, 0, 1)',
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

        {/* Interactive manual dismiss hint */}
        {manualDismiss && (
          <div
            className={`mt-8 text-[10px] tracking-[0.25em] uppercase font-mono select-none transition-opacity duration-300 ${
              darkMode ? 'text-zinc-500' : 'text-gray-400'
            }`}
          >
            [ нажмите в любом месте для продолжения ]
          </div>
        )}
      </div>
    </div>
  )
}
