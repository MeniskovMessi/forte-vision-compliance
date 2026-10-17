import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react'

export default function Timeline({
  duration = 0,
  currentTime = 0,
  onSeek,
  detections = [],
  trimStart: externalTrimStart,
  trimEnd: externalTrimEnd,
  onTrimChange,
  isPlaying = false,
  onTogglePlay,
  onPrevCheckpoint,
  onNextCheckpoint,
  playbackRate = 1,
  onChangePlaybackRate,
  darkMode,
}) {
  const trackRef = useRef(null)

  // Local trim state (defaults to [0, duration])
  const [internalTrimStart, setInternalTrimStart] = useState(0)
  const [internalTrimEnd, setInternalTrimEnd] = useState(duration || 30)

  const trimStart = externalTrimStart !== undefined ? externalTrimStart : internalTrimStart
  const trimEnd = externalTrimEnd !== undefined ? externalTrimEnd : internalTrimEnd

  // Sync trimEnd with duration on video load if needed
  useEffect(() => {
    if (duration > 0 && (trimEnd === 0 || trimEnd > duration)) {
      setInternalTrimEnd(duration)
      if (onTrimChange) onTrimChange(trimStart, duration)
    }
  }, [duration])

  // Scrubbing & dragging states
  // dragTarget: 'time' (playhead) | 'trimStart' (left handle) | 'trimEnd' (right handle) | 'trimRange' (shift whole red bar)
  const [dragTarget, setDragTarget] = useState(null)
  const dragStartRef = useRef({ startX: 0, initialTrimStart: 0, initialTrimEnd: 0 })

  // Detection hover tooltip
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

  // Convert mouse clientX to seconds along track width
  const getTimeFromClientX = useCallback(
    (clientX) => {
      if (!trackRef.current || !duration || duration <= 0) return 0
      const rect = trackRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
      return (x / rect.width) * duration
    },
    [duration]
  )

  // 1. Time Indicator (Playhead) Scrubbing in the UPPER GRAY TIMELINE REGION
  const handleTimeIndicatorMouseDown = (e) => {
    e.stopPropagation()
    setDragTarget('time')
    const t = getTimeFromClientX(e.clientX)
    if (onSeek) onSeek(t)
  }

  // 2. Trimmer Handle (Left) Mouse Down
  const handleTrimStartMouseDown = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setDragTarget('trimStart')
    dragStartRef.current = { startX: e.clientX, initialTrimStart: trimStart, initialTrimEnd: trimEnd }
  }

  // 3. Trimmer Handle (Right) Mouse Down
  const handleTrimEndMouseDown = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setDragTarget('trimEnd')
    dragStartRef.current = { startX: e.clientX, initialTrimStart: trimStart, initialTrimEnd: trimEnd }
  }

  // 4. Trimmer Body (Red horizontal line) Mouse Down - shifts the entire trim segment
  const handleTrimRangeMouseDown = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setDragTarget('trimRange')
    dragStartRef.current = { startX: e.clientX, initialTrimStart: trimStart, initialTrimEnd: trimEnd }
  }

  // Global Dragging Listener
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragTarget || !duration || duration <= 0) return

      if (dragTarget === 'time') {
        // Scrubbing time indicator (playhead)
        const t = getTimeFromClientX(e.clientX)
        if (onSeek) onSeek(t)
      } else if (dragTarget === 'trimStart') {
        // Dragging left trimmer handle
        const rawTime = getTimeFromClientX(e.clientX)
        const clampedStart = Math.max(0, Math.min(trimEnd - 0.4, rawTime))
        setInternalTrimStart(clampedStart)
        if (onTrimChange) onTrimChange(clampedStart, trimEnd)
      } else if (dragTarget === 'trimEnd') {
        // Dragging right trimmer handle
        const rawTime = getTimeFromClientX(e.clientX)
        const clampedEnd = Math.min(duration, Math.max(trimStart + 0.4, rawTime))
        setInternalTrimEnd(clampedEnd)
        if (onTrimChange) onTrimChange(trimStart, clampedEnd)
      } else if (dragTarget === 'trimRange') {
        // Dragging the whole red trimmer segment
        if (!trackRef.current) return
        const rect = trackRef.current.getBoundingClientRect()
        const deltaX = e.clientX - dragStartRef.current.startX
        const deltaTime = (deltaX / rect.width) * duration
        const span = dragStartRef.current.initialTrimEnd - dragStartRef.current.initialTrimStart

        let newStart = dragStartRef.current.initialTrimStart + deltaTime
        let newEnd = newStart + span

        if (newStart < 0) {
          newStart = 0
          newEnd = span
        } else if (newEnd > duration) {
          newEnd = duration
          newStart = Math.max(0, duration - span)
        }

        setInternalTrimStart(newStart)
        setInternalTrimEnd(newEnd)
        if (onTrimChange) onTrimChange(newStart, newEnd)
      }
    }

    const handleMouseUp = () => {
      if (dragTarget) setDragTarget(null)
    }

    if (dragTarget) {
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
  }, [dragTarget, duration, trimStart, trimEnd, getTimeFromClientX, onSeek, onTrimChange])

  // Build ticks for top ruler line
  const tickCount = 20
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const percent = (i / tickCount) * 100
    const time = (i / tickCount) * duration
    const isMajor = i % 4 === 0
    return { percent, time, isMajor }
  })

  const trimStartPct = getPercent(trimStart)
  const trimEndPct = getPercent(trimEnd)
  const trimWidthPct = Math.max(0, trimEndPct - trimStartPct)

  return (
    <div className="w-full flex flex-col select-none px-6 pt-3 pb-3">
      {/* 
        Timeline Interaction Container
      */}
      <div
        ref={trackRef}
        className="relative w-full py-1 overflow-visible"
      >
        {/* ========================================================================= */}
        {/* 1. UPPER GRAY TIMELINE REGION:                                            */}
        {/*    Clicking or dragging HERE affects the TIME INDICATOR (Playhead)        */}
        {/* ========================================================================= */}
        <div
          onMouseDown={handleTimeIndicatorMouseDown}
          className="relative w-full h-8 mb-1.5 cursor-pointer group/gray"
          title="Кликните на серой шкале времени для перемещения указателя времени"
        >
          {/* Main Horizontal Timeline Gray Line */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-300 dark:bg-zinc-700 transition-colors group-hover/gray:bg-gray-400 dark:group-hover/gray:bg-zinc-600" />

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
                className="absolute top-3 bottom-[-1px] -translate-x-1/2 z-20 w-3 flex flex-col items-center cursor-pointer group/det"
              >
                {/* Clean vertical blue detection line (Linear flat style, compact height) */}
                <div className="w-[2px] group-hover/det:w-[3px] h-full bg-sky-500 dark:bg-sky-400 transition-all" />
              </div>
            )
          })}
        </div>

        {/* ========================================================================= */}
        {/* 2. LOWER RED TRIMMER REGION:                                              */}
        {/*    Clicking or dragging HERE ONLY affects the TRIMMER, NOT time indicator */}
        {/* ========================================================================= */}
        <div className="relative w-full h-7">
          {/* Subtle inactive guide track underneath */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gray-200/50 dark:bg-zinc-800/40" />

          {/* Active Red Trimmer Line between trimStart and trimEnd (Flat line, no glow) */}
          <div
            onMouseDown={handleTrimRangeMouseDown}
            style={{
              left: `${trimStartPct}%`,
              width: `${trimWidthPct}%`,
            }}
            className="absolute top-0 h-[2px] bg-red-500 cursor-grab active:cursor-grabbing group/trimline"
            title="Перетащите красный отрезок для смещения зоны анализа"
          >
            {/* 
              LEFT TRIMMER HANDLE: Directed downwards at left end (⎾)
              Seamlessly connected to horizontal red line with zero gap
            */}
            <div
              onMouseDown={handleTrimStartMouseDown}
              className="absolute -top-1 -left-2.5 w-6 h-8 cursor-ew-resize group/lhandle z-20 select-none"
              title={`Начало обрезки: ${formatTimecode(trimStart)} (потяните для изменения)`}
            >
              <svg
                width="16"
                height="20"
                viewBox="0 0 16 20"
                fill="none"
                style={{ position: 'absolute', left: '10px', top: '4px' }}
                className="text-red-500 group-hover/lhandle:text-red-400 transition-colors pointer-events-none"
              >
                {/* Continuous corner and downward bracket leg */}
                <path
                  d="M10 1 L 1 1 V 15 H 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Tactile grip ticks on the downward handle */}
                <line x1="1" y1="6" x2="6" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="1" y1="10.5" x2="6.25" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* 
              RIGHT TRIMMER HANDLE: Directed downwards at right end (⏋)
              Seamlessly connected to horizontal red line with zero gap
            */}
            <div
              onMouseDown={handleTrimEndMouseDown}
              className="absolute -top-1 -right-2.5 w-6 h-8 cursor-ew-resize group/rhandle z-20 select-none"
              title={`Конец обрезки: ${formatTimecode(trimEnd)} (потяните для изменения)`}
            >
              <svg
                width="16"
                height="20"
                viewBox="0 0 16 20"
                fill="none"
                style={{ position: 'absolute', right: '10px', top: '4px' }}
                className="text-red-500 group-hover/rhandle:text-red-400 transition-colors pointer-events-none"
              >
                {/* Continuous corner and downward bracket leg */}
                <path
                  d="M6 1 L 15 1 V 15 H 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Tactile grip ticks on the downward handle */}
                <line x1="15" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="15" y1="10.5" x2="10" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. TIME INDICATOR (PLAYHEAD NEEDLE):                                      */}
        {/*    Crosses vertically across both lines, moves ONLY with video playback   */}
        {/*    or when scrubbing the upper gray timeline                              */}
        {/* ========================================================================= */}
        <div
          style={{ left: `${getPercent(currentTime)}%` }}
          className="absolute top-1.5 bottom-2.5 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center"
        >
          {/* Top Diamond Pointer (compact) */}
          <div className="w-2 h-2 bg-red-500 rotate-45 rounded-[1px] transform -translate-y-0.5" />
          {/* Vertical Playhead Needle Line (Flat line, compact height) */}
          <div className="w-[1.5px] flex-1 bg-red-500" />
        </div>
      </div>

      {/* 
        =========================================================================
        INTEGRATED CONTROLS ROW:
        Moved up directly to the timeline section — no separation, no borders
        =========================================================================
      */}
      <div className="w-full mt-3 flex items-center justify-between select-none">
        {/* Left: Digital Timecode Counter */}
        <div className="flex items-center space-x-3">
          <div className="flex items-baseline space-x-1 font-mono text-xs">
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatTimecode(currentTime)}
            </span>
            <span className="text-gray-400 dark:text-zinc-600">/</span>
            <span className="text-gray-500 dark:text-zinc-400 text-[11px]">
              {formatTimecode(duration)}
            </span>
          </div>

          {detections.length > 0 && (
            <span className="hidden sm:inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>Нарушений: {detections.length}</span>
            </span>
          )}
        </div>

        {/* Center: Move Left, Play/Pause, Move Right Buttons */}
        <div className="flex items-center space-x-1.5">
          {/* Move Left: to previous detected checkpoint or to the beginning */}
          <button
            onClick={onPrevCheckpoint}
            className="p-1.5 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-[#1E232B] hover:text-gray-900 dark:hover:text-white transition active:scale-95"
            title="Перейти к предыдущему нарушению или в начало (Стрелка влево)"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Play/Pause Button (Flat Linear style) */}
          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-md bg-[#9D1D53] hover:bg-[#861846] text-white flex items-center justify-center transition active:scale-95"
            title={isPlaying ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-white" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-white translate-x-0.5" />
            )}
          </button>

          {/* Move Right: to next detected checkpoint or to the end */}
          <button
            onClick={onNextCheckpoint}
            className="p-1.5 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-[#1E232B] hover:text-gray-900 dark:hover:text-white transition active:scale-95"
            title="Перейти к следующему нарушению или в конец (Стрелка вправо)"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Playback Speed Toggle */}
        <div className="flex items-center space-x-2">
          {onChangePlaybackRate && (
            <button
              onClick={() => {
                const rates = [1, 1.5, 2]
                const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length
                onChangePlaybackRate(rates[nextIdx])
              }}
              className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-[#1E232B] border border-gray-200/60 dark:border-[#22272E] transition"
              title="Скорость воспроизведения"
            >
              <Gauge className="w-3 h-3" />
              <span>{playbackRate}x</span>
            </button>
          )}
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
          className="z-50 pointer-events-none px-2.5 py-1.5 rounded-md text-xs font-sans shadow-lg border bg-zinc-950 text-white border-zinc-800 dark:bg-zinc-900 dark:border-zinc-750 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
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
