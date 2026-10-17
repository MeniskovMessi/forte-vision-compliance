import React, { useRef, useState, useCallback, useEffect } from 'react'

export default function Timeline({
  duration = 0,
  currentTime = 0,
  onSeek,
  detections = [],
  darkMode,
}) {
  const trackRef = useRef(null)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [hoveredDetection, setHoveredDetection] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Format seconds to mm:ss.ms
  const formatTimecode = (sec) => {
    if (isNaN(sec) || sec < 0) return '00:00.0'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    const ms = Math.floor((sec % 1) * 10)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`
  }

  // Calculate percentage along timeline
  const getPercent = (time) => {
    if (!duration || duration <= 0) return 0
    return Math.min(100, Math.max(0, (time / duration) * 100))
  }

  // Handle click / drag to scrub
  const handleScrub = useCallback(
    (e) => {
      if (!trackRef.current || !duration || duration <= 0) return
      const rect = trackRef.current.getBoundingClientRect()
      const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
      const targetTime = (x / rect.width) * duration
      if (onSeek) onSeek(targetTime)
    },
    [duration, onSeek]
  )

  const handleMouseDown = (e) => {
    setIsScrubbing(true)
    handleScrub(e)
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isScrubbing) handleScrub(e)
    }
    const handleMouseUp = () => {
      if (isScrubbing) setIsScrubbing(false)
    }

    if (isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchmove', handleMouseMove)
      window.addEventListener('touchend', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleMouseMove)
      window.removeEventListener('touchend', handleMouseUp)
    }
  }, [isScrubbing, handleScrub])

  // Build ticks for top ruler line
  const tickCount = 20
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const percent = (i / tickCount) * 100
    const time = (i / tickCount) * duration
    const isMajor = i % 4 === 0
    return { percent, time, isMajor }
  })

  return (
    <div className="w-full flex flex-col select-none px-4 pt-2 pb-1">
      {/* 
        1. Top Timeline Ruler (as drawn in sketch: horizontal line with ticks above the red region)
      */}
      <div className="relative h-5 w-full flex items-end pb-1 border-b border-gray-300/30 dark:border-zinc-800/80">
        {ticks.map((tick, idx) => (
          <div
            key={idx}
            className="absolute bottom-0 flex flex-col items-center -translate-x-1/2 pointer-events-none"
            style={{ left: `${tick.percent}%` }}
          >
            {tick.isMajor && (
              <span className="text-[9px] font-mono text-gray-500 dark:text-zinc-400 mb-0.5 leading-none select-none">
                {formatTimecode(tick.time)}
              </span>
            )}
            <div
              className={`w-[1px] ${
                tick.isMajor
                  ? 'h-2 bg-gray-600 dark:bg-zinc-400'
                  : 'h-1.5 bg-gray-400/50 dark:bg-zinc-700/60'
              }`}
            />
          </div>
        ))}
      </div>

      {/* 
        2. Middle Red-Trim Region Track (as drawn in sketch: red boundary with [ and ] trim handles)
      */}
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        className="relative h-11 mt-1 rounded cursor-pointer overflow-visible group"
      >
        {/* Red Trim Container Box (Sketched in red outline) */}
        <div className="absolute inset-0 border-2 border-red-500/85 dark:border-red-500/90 rounded bg-red-500/[0.04] dark:bg-red-500/[0.07] pointer-events-none">
          {/* Left Trim Handle bracket '[' */}
          <div className="absolute top-0 bottom-0 left-0 w-3 bg-red-600/90 dark:bg-red-500/90 rounded-l flex flex-col items-center justify-center pointer-events-none shadow-sm">
            <div className="w-[1.5px] h-3 bg-white/80 rounded-full my-0.5" />
            <div className="w-[1.5px] h-3 bg-white/80 rounded-full my-0.5" />
          </div>

          {/* Right Trim Handle bracket ']' */}
          <div className="absolute top-0 bottom-0 right-0 w-3 bg-red-600/90 dark:bg-red-500/90 rounded-r flex flex-col items-center justify-center pointer-events-none shadow-sm">
            <div className="w-[1.5px] h-3 bg-white/80 rounded-full my-0.5" />
            <div className="w-[1.5px] h-3 bg-white/80 rounded-full my-0.5" />
          </div>

          {/* Filmstrip inner subtle strip markings */}
          <div className="absolute inset-x-3 inset-y-0 flex items-center justify-between px-2 opacity-15 dark:opacity-20 pointer-events-none">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="w-1.5 h-6 rounded-sm bg-gray-400 dark:bg-zinc-300" />
            ))}
          </div>
        </div>

        {/* 
          3. Blue Detection Markers (as drawn in sketch: vertical blue lines that appear once analyzed)
        */}
        {detections.map((det) => {
          const leftPct = getPercent(det.timecode)
          return (
            <div
              key={det.id}
              onClick={(e) => {
                e.stopPropagation()
                if (onSeek) onSeek(det.timecode)
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top })
                setHoveredDetection(det)
              }}
              onMouseLeave={() => setHoveredDetection(null)}
              style={{ left: `${leftPct}%` }}
              className="absolute top-0 bottom-0 -translate-x-1/2 z-20 w-3 flex flex-col items-center cursor-pointer group/det"
            >
              {/* Blue top pin head */}
              <div className="w-2.5 h-2.5 rounded-sm bg-sky-400 dark:bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] transform -translate-y-1 transition-transform group-hover/det:scale-125" />

              {/* Blue solid detection bar running through track */}
              <div className="w-[3px] flex-1 bg-sky-400 dark:bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />

              {/* Blue bottom cap */}
              <div className="w-2 h-1 bg-sky-400 rounded-b-sm" />
            </div>
          )
        })}

        {/* 
          4. Playhead Scrubber Needle
        */}
        <div
          style={{ left: `${getPercent(currentTime)}%` }}
          className="absolute top-[-6px] bottom-[-4px] -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center"
        >
          {/* Needle Head Pointer */}
          <div className="w-3.5 h-3.5 bg-red-600 dark:bg-red-500 rounded-sm shadow-md transform rotate-45 -mb-1" />
          {/* Vertical Needle Line */}
          <div className="w-[2px] flex-1 bg-red-600 dark:bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
        </div>
      </div>

      {/* Floating Detection Tooltip on Hover */}
      {hoveredDetection && (
        <div
          style={{
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 65}px`,
            transform: 'translateX(-50%)',
          }}
          className="z-50 pointer-events-none px-2.5 py-1.5 rounded-md text-xs font-sans shadow-xl border bg-gray-900 text-white border-gray-700 dark:bg-[#1C2028] dark:border-sky-500/40 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center space-x-1.5 text-sky-400 text-[10px] font-mono uppercase font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span>Нарушение: {formatTimecode(hoveredDetection.timecode)}</span>
          </div>
          <div className="text-[11px] font-medium text-gray-200 mt-0.5">
            {hoveredDetection.label}
          </div>
          <div className="text-[9px] font-mono text-gray-400 mt-0.5">
            Кликните для перехода к таймкоду
          </div>
        </div>
      )}
    </div>
  )
}
