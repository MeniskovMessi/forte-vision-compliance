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
    <div className="w-full flex flex-col select-none px-6 pt-2 pb-1">
      {/* 
        Timeline Interaction Container:
        Encompasses both the top timeline line and the parallel red trimmer underneath
      */}
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        className="relative w-full cursor-pointer py-2 overflow-visible"
      >
        {/* ========================================================================= */}
        {/* 1. TOP TIMELINE LINE WITH VERTICAL TICK MARKS & TIMECODES ON TOP           */}
        {/* ========================================================================= */}
        <div className="relative w-full h-8 mb-2">
          {/* Main Horizontal Timeline Line */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-300 dark:bg-zinc-700" />

          {/* Vertical tick marks on top of the line with small text */}
          {ticks.map((tick, idx) => (
            <div
              key={idx}
              className="absolute bottom-0 flex flex-col items-center -translate-x-1/2 pointer-events-none"
              style={{ left: `${tick.percent}%` }}
            >
              {tick.isMajor && (
                <span className="text-[9px] font-mono text-gray-400 dark:text-zinc-500 mb-1 leading-none select-none">
                  {formatTimecode(tick.time)}
                </span>
              )}
              {/* Vertical tick rising upwards from line */}
              <div
                className={`w-[1px] ${
                  tick.isMajor
                    ? 'h-2.5 bg-gray-500 dark:bg-zinc-400'
                    : 'h-1.5 bg-gray-300 dark:bg-zinc-600'
                }`}
              />
            </div>
          ))}

          {/* Blue Detection Markers (Vertical lines on the timeline as in sketch) */}
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
                className="absolute top-2 bottom-[-6px] -translate-x-1/2 z-20 w-3 flex flex-col items-center cursor-pointer group/det"
              >
                {/* Blue top pin */}
                <div className="w-2.5 h-2.5 rounded-sm bg-sky-400 dark:bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] transform transition-transform group-hover/det:scale-125" />
                {/* Blue vertical line crossing through the timeline */}
                <div className="w-[3px] flex-1 bg-sky-400 dark:bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              </div>
            )
          })}
        </div>

        {/* ========================================================================= */}
        {/* 2. PARALLEL RED TRIMMER LINE WITH 2 END HANDLES DIRECTED DOWNWARDS         */}
        {/* ========================================================================= */}
        <div className="relative w-full h-6 pointer-events-none">
          {/* Parallel Red Horizontal Line */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />

          {/* Left Trimmer Handle (directed downwards at left end) */}
          <div className="absolute top-0 left-0 -translate-x-[1px]">
            <svg
              width="14"
              height="22"
              viewBox="0 0 14 22"
              fill="none"
              className="text-red-500 filter drop-shadow-sm"
            >
              {/* Vertical drop leg going downwards with bottom foot pointing inwards */}
              <path
                d="M1.5 0V18H10"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Tactile grip ticks on the downward handle */}
              <line x1="1.5" y1="6" x2="6.5" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="1.5" y1="12" x2="6.5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Right Trimmer Handle (directed downwards at right end) */}
          <div className="absolute top-0 right-0 translate-x-[1px]">
            <svg
              width="14"
              height="22"
              viewBox="0 0 14 22"
              fill="none"
              className="text-red-500 filter drop-shadow-sm"
            >
              {/* Vertical drop leg going downwards with bottom foot pointing inwards */}
              <path
                d="M12.5 0V18H4"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Tactile grip ticks on the downward handle */}
              <line x1="12.5" y1="6" x2="7.5" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12.5" y1="12" x2="7.5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. PLAYHEAD SCRUBBER NEEDLE (Crosses vertically across both lines)        */}
        {/* ========================================================================= */}
        <div
          style={{ left: `${getPercent(currentTime)}%` }}
          className="absolute top-0 bottom-0 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center"
        >
          {/* Top Diamond Head */}
          <div className="w-2.5 h-2.5 bg-red-500 rotate-45 rounded-[1px] shadow-sm transform -translate-y-0.5" />
          {/* Needle Line spanning across timeline and trimmer */}
          <div className="w-[2px] flex-1 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
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
