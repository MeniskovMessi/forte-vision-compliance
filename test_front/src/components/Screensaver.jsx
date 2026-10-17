import React, { useEffect, useState } from 'react'

export default function Screensaver({ onComplete, isReplaying }) {
  const [stage, setStage] = useState('active') // 'active' | 'exiting' | 'hidden'

  useEffect(() => {
    // Stage 1: Active for exactly 1.0s
    const timer1 = setTimeout(() => {
      setStage('exiting')
    }, 1000)

    // Stage 2: Fade & Blur transition completes after ~850ms
    const timer2 = setTimeout(() => {
      setStage('hidden')
      if (onComplete) onComplete()
    }, 1850)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [isReplaying])

  if (stage === 'hidden') return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#090D16] text-white overflow-hidden screensaver-overlay ${
        stage === 'exiting' ? 'screensaver-exiting' : 'opacity-100'
      }`}
    >
      {/* Subtle ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(157,29,83,0.18)_0%,transparent_70%)] pointer-events-none" />

      {/* Grid texture */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6">
        {/* Optical Geometric Symbol */}
        <div className="mb-6 relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-md flex items-center justify-center shadow-[0_0_40px_rgba(157,29,83,0.3)] animate-pulse">
            <div className="w-8 h-8 rounded-lg border-2 border-rose-500/80 rotate-45 transform" />
          </div>
        </div>

        {/* Huge Stylized Text PRISM */}
        <h1 className="text-7xl sm:text-9xl font-bold tracking-[0.28em] font-sans text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-400 select-none drop-shadow-[0_4px_30px_rgba(255,255,255,0.2)] pl-[0.28em]">
          PRISM
        </h1>

        {/* Subtitle / System Tagline */}
        <div className="mt-6 flex items-center space-x-3 text-xs tracking-[0.3em] uppercase text-slate-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>ForteBank Compliance Engine</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">Vision Intelligence</span>
        </div>
      </div>
    </div>
  )
}
