import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { Play, Pause, SkipBack, SkipForward, Gauge, Camera, Film, Loader2, Scan } from 'lucide-react'

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
  // Multi-track violation selection & export props
  selectedIntervals = [],
  onToggleDetectionSelection,
  onUpdateInterval,
  onRemoveInterval,
  onExportFrame,
  onExportSequence,
  isExportingFrame = false,
  isExportingSequence = false,
  // Bounding box toggle
  showBoundingBox = false,
  onToggleBoundingBox,
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
  // dragTarget: 'time' | 'trimStart' | 'trimEnd' | 'trimRange' | 'intervalStart:<id>' | 'intervalEnd:<id>' | 'intervalRange:<id>'
  const [dragTarget, setDragTarget] = useState(null)
  const dragStartRef = useRef({ startX: 0, initialTrimStart: 0, initialTrimEnd: 0, initialStart: 0, initialEnd: 0 })

  // Keep a fresh ref to selectedIntervals to avoid stale closures in window mouse listeners
  const selectedIntervalsRef = useRef(selectedIntervals)
  useEffect(() => {
    selectedIntervalsRef.current = selectedIntervals
  }, [selectedIntervals])

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

  // ---------------------------------------------------------------------------
  // NLE Multi-Track Layout: CapCut / Premiere Pro track stacking algorithm
  // When intervals overlap in time, the conflicting interval drops down to Track 2, Track 3, etc.
  // ---------------------------------------------------------------------------
  const placedIntervals = useMemo(() => {
    if (!selectedIntervals || selectedIntervals.length === 0) return []
    const sorted = [...selectedIntervals].sort((a, b) => a.start - b.start)
    const trackEndTimes = []

    return sorted.map((inv) => {
      let trackIndex = -1
      for (let t = 0; t < trackEndTimes.length; t++) {
        if (inv.start >= trackEndTimes[t] - 0.1) {
          trackIndex = t
          trackEndTimes[t] = inv.end
          break
        }
      }
      if (trackIndex === -1) {
        trackIndex = trackEndTimes.length
        trackEndTimes.push(inv.end)
      }
      return { ...inv, trackIndex }
    })
  }, [selectedIntervals])

  const totalTracks = useMemo(() => {
    return placedIntervals.reduce((max, inv) => Math.max(max, inv.trackIndex + 1), 0)
  }, [placedIntervals])

  // 1. Time Indicator (Playhead) Scrubbing in UPPER GRAY TIMELINE REGION
  const handleTimeIndicatorMouseDown = (e) => {
    e.stopPropagation()
    setDragTarget('time')
    const t = getTimeFromClientX(e.clientX)
    if (onSeek) onSeek(t)
  }

  // 2. Main Red Trimmer Handle (Left)
  const handleTrimStartMouseDown = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setDragTarget('trimStart')
    dragStartRef.current = { startX: e.clientX, initialTrimStart: trimStart, initialTrimEnd: trimEnd }
  }

  // 3. Main Red Trimmer Handle (Right)
  const handleTrimEndMouseDown = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setDragTarget('trimEnd')
    dragStartRef.current = { startX: e.clientX, initialTrimStart: trimStart, initialTrimEnd: trimEnd }
  }

  // 4. Main Red Trimmer Body (shifts the entire red range)
  const handleTrimRangeMouseDown = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setDragTarget('trimRange')
    dragStartRef.current = { startX: e.clientX, initialTrimStart: trimStart, initialTrimEnd: trimEnd }
  }

  // 5. Violation Interval Handle (Left)
  const handleIntervalStartMouseDown = (e, inv) => {
    e.stopPropagation()
    e.preventDefault()
    setDragTarget(`intervalStart:${inv.id}`)
    dragStartRef.current = {
      startX: e.clientX,
      initialStart: inv.start,
      initialEnd: inv.end,
      intervalId: inv.id,
    }
  }

  // 6. Violation Interval Handle (Right)
  const handleIntervalEndMouseDown = (e, inv) => {
    e.stopPropagation()
    e.preventDefault()
    setDragTarget(`intervalEnd:${inv.id}`)
    dragStartRef.current = {
      startX: e.clientX,
      initialStart: inv.start,
      initialEnd: inv.end,
      intervalId: inv.id,
    }
  }

  // 7. Violation Interval Body (shifts interval)
  const handleIntervalRangeMouseDown = (e, inv) => {
    e.stopPropagation()
    e.preventDefault()
    setDragTarget(`intervalRange:${inv.id}`)
    dragStartRef.current = {
      startX: e.clientX,
      initialStart: inv.start,
      initialEnd: inv.end,
      intervalId: inv.id,
    }
  }

  // Global Dragging Listener
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragTarget || !duration || duration <= 0) return

      if (dragTarget === 'time') {
        const t = getTimeFromClientX(e.clientX)
        if (onSeek) onSeek(t)
      } else if (dragTarget === 'trimStart') {
        const rawTime = getTimeFromClientX(e.clientX)
        const clampedStart = Math.max(0, Math.min(trimEnd - 0.4, rawTime))
        setInternalTrimStart(clampedStart)
        if (onTrimChange) onTrimChange(clampedStart, trimEnd)
      } else if (dragTarget === 'trimEnd') {
        const rawTime = getTimeFromClientX(e.clientX)
        const clampedEnd = Math.min(duration, Math.max(trimStart + 0.4, rawTime))
        setInternalTrimEnd(clampedEnd)
        if (onTrimChange) onTrimChange(trimStart, clampedEnd)
      } else if (dragTarget === 'trimRange') {
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
      } else if (dragTarget.startsWith('intervalStart:')) {
        const id = dragTarget.split(':')[1]
        const rawTime = getTimeFromClientX(e.clientX)
        const currentInv = selectedIntervalsRef.current.find((i) => i.id === id)
        if (currentInv && onUpdateInterval) {
          const clampedStart = Math.max(0, Math.min(currentInv.end - 0.2, rawTime))
          onUpdateInterval(id, clampedStart, currentInv.end)
        }
      } else if (dragTarget.startsWith('intervalEnd:')) {
        const id = dragTarget.split(':')[1]
        const rawTime = getTimeFromClientX(e.clientX)
        const currentInv = selectedIntervalsRef.current.find((i) => i.id === id)
        if (currentInv && onUpdateInterval) {
          const clampedEnd = Math.min(duration, Math.max(currentInv.start + 0.2, rawTime))
          onUpdateInterval(id, currentInv.start, clampedEnd)
        }
      } else if (dragTarget.startsWith('intervalRange:')) {
        const id = dragTarget.split(':')[1]
        if (!trackRef.current) return
        const rect = trackRef.current.getBoundingClientRect()
        const deltaX = e.clientX - dragStartRef.current.startX
        const deltaTime = (deltaX / rect.width) * duration
        const span = dragStartRef.current.initialEnd - dragStartRef.current.initialStart

        let newStart = dragStartRef.current.initialStart + deltaTime
        let newEnd = newStart + span

        if (newStart < 0) {
          newStart = 0
          newEnd = span
        } else if (newEnd > duration) {
          newEnd = duration
          newStart = Math.max(0, duration - span)
        }

        if (onUpdateInterval) {
          onUpdateInterval(id, newStart, newEnd)
        }
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
  }, [dragTarget, duration, trimStart, trimEnd, getTimeFromClientX, onSeek, onTrimChange, onUpdateInterval])

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

          {/* Blue Detection Markers (Vertical lines with circles on top) */}
          {detections.map((det) => {
            const leftPct = getPercent(det.timecode)
            const isSelected = selectedIntervals.some((inv) => inv.detectionId === det.id)
            return (
              <div
                key={det.id}
                onClick={(e) => {
                  e.stopPropagation()
                  if (onToggleDetectionSelection) {
                    onToggleDetectionSelection(det)
                  }
                  if (onSeek) onSeek(det.timecode)
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top })
                  setHoveredDetection(det)
                }}
                onMouseLeave={() => setHoveredDetection(null)}
                style={{ left: `${leftPct}%` }}
                className="absolute top-1.5 bottom-[-1px] -translate-x-1/2 z-20 w-4 flex flex-col items-center cursor-pointer group/det"
              >
                {/* Clean circle on top of detection line (Flat Linear style with active selection ring) */}
                <div
                  className={`rounded-full transition-all shrink-0 flex items-center justify-center ${
                    isSelected
                      ? 'w-2.5 h-2.5 bg-sky-400 ring-2 ring-sky-300 dark:ring-sky-500 shadow-sm scale-110'
                      : 'w-2 h-2 bg-sky-500 dark:bg-sky-400 group-hover/det:scale-125'
                  }`}
                >
                  {isSelected && <div className="w-1 h-1 rounded-full bg-black dark:bg-zinc-950" />}
                </div>
                {/* Vertical blue line dropping to timeline */}
                <div
                  className={`flex-1 transition-all ${
                    isSelected
                      ? 'w-[2px] bg-sky-400 dark:bg-sky-300'
                      : 'w-[1.5px] bg-sky-500 dark:bg-sky-400'
                  }`}
                />
              </div>
            )
          })}
        </div>

        {/* ========================================================================= */}
        {/* 2. LOWER RED TRIMMER REGION:                                              */}
        {/*    Clicking or dragging HERE ONLY affects the TRIMMER, NOT time indicator */}
        {/* ========================================================================= */}
        <div className="relative w-full h-6">
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
            {/* LEFT TRIMMER HANDLE: Directed downwards at left end (⎾) */}
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
                <path
                  d="M10 1 L 1 1 V 15 H 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line x1="1" y1="6" x2="6" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="1" y1="10.5" x2="6.25" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* RIGHT TRIMMER HANDLE: Directed downwards at right end (⏋) */}
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
                <path
                  d="M6 1 L 15 1 V 15 H 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line x1="15" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="15" y1="10.5" x2="10" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2B. VIOLATION INTERVAL TRACKS (Below red horizontal line)                 */}
        {/*     CapCut / Premiere Pro track stacking: when intervals cross/overlap,   */}
        {/*     conflicting intervals drop down to Track 2, Track 3, etc.             */}
        {/* ========================================================================= */}
        {totalTracks > 0 && (
          <div className="relative w-full flex flex-col space-y-1 mt-1 pt-1 border-t border-dashed border-gray-200/50 dark:border-zinc-800/60">
            {Array.from({ length: totalTracks }, (_, trackIdx) => {
              const trackIntervals = placedIntervals.filter((inv) => inv.trackIndex === trackIdx)
              return (
                <div key={trackIdx} className="relative w-full h-5 flex items-center">
                  {/* Subtle hairline track lane line */}
                  <div className="absolute inset-x-0 top-2 h-[1px] bg-sky-500/15 dark:bg-sky-400/15 pointer-events-none" />

                  {/* Render all intervals assigned to this track */}
                  {trackIntervals.map((inv) => {
                    const startPct = getPercent(inv.start)
                    const endPct = getPercent(inv.end)
                    const widthPct = Math.max(0.6, endPct - startPct)

                    return (
                      <div
                        key={inv.id}
                        style={{
                          left: `${startPct}%`,
                          width: `${widthPct}%`,
                        }}
                        className="absolute top-0 h-5 group/inv z-20"
                      >
                        {/* 
                          Horizontal Line in Violation Color (sky-400/sky-500)
                          Draggable body shifts entire interval in time
                        */}
                        <div
                          onMouseDown={(e) => handleIntervalRangeMouseDown(e, inv)}
                          className="absolute top-2 inset-x-0 h-[2.5px] bg-sky-500 dark:bg-sky-400 cursor-grab active:cursor-grabbing hover:h-[3.5px] transition-all"
                          title={`Отрезок нарушения (${formatTimecode(inv.start)} — ${formatTimecode(inv.end)}). Потяните для смещения.`}
                        />

                        {/* Left Bracket Handle (⎾) in Violation Color */}
                        <div
                          onMouseDown={(e) => handleIntervalStartMouseDown(e, inv)}
                          className="absolute -top-0.5 -left-2 w-4 h-6 cursor-ew-resize group/lihandle z-30 select-none flex items-center justify-center"
                          title={`Начало: ${formatTimecode(inv.start)} (потяните для изменения)`}
                        >
                          <svg
                            width="11"
                            height="15"
                            viewBox="0 0 11 15"
                            fill="none"
                            className="text-sky-500 dark:text-sky-400 group-hover/lihandle:text-sky-300 transition-colors pointer-events-none"
                          >
                            <path
                              d="M7 1 L 1 1 V 13 H 6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <line x1="1" y1="5" x2="4.5" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            <line x1="1" y1="9" x2="4.5" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </div>

                        {/* Right Bracket Handle (⏋) in Violation Color */}
                        <div
                          onMouseDown={(e) => handleIntervalEndMouseDown(e, inv)}
                          className="absolute -top-0.5 -right-2 w-4 h-6 cursor-ew-resize group/rihandle z-30 select-none flex items-center justify-center"
                          title={`Конец: ${formatTimecode(inv.end)} (потяните для изменения)`}
                        >
                          <svg
                            width="11"
                            height="15"
                            viewBox="0 0 11 15"
                            fill="none"
                            className="text-sky-500 dark:text-sky-400 group-hover/rihandle:text-sky-300 transition-colors pointer-events-none"
                          >
                            <path
                              d="M4 1 L 10 1 V 13 H 5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <line x1="10" y1="5" x2="6.5" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            <line x1="10" y1="9" x2="6.5" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </div>

                        {/* Hover Quick Badge: time span + remove button */}
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/inv:opacity-100 transition-opacity pointer-events-auto flex items-center space-x-1 px-1 py-0.2 rounded bg-zinc-950/90 border border-sky-500/40 text-[9px] font-mono text-sky-300 z-30 shadow-sm whitespace-nowrap">
                          <span>{(inv.end - inv.start).toFixed(1)}с</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onRemoveInterval) onRemoveInterval(inv.id)
                            }}
                            className="hover:text-red-400 font-bold ml-0.5"
                            title="Снять выбор экспорта"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. TIME INDICATOR (PLAYHEAD NEEDLE):                                      */}
        {/*    Crosses vertically across all lines (ruler, trimmer, violation tracks) */}
        {/* ========================================================================= */}
        <div
          style={{ left: `${getPercent(currentTime)}%` }}
          className="absolute top-1.5 bottom-0 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center"
        >
          {/* Top Diamond Pointer (compact) */}
          <div className="w-2 h-2 bg-red-500 rotate-45 rounded-[1px] transform -translate-y-0.5 shrink-0" />
          {/* Vertical Playhead Needle Line (Flat line, spans full tracks height) */}
          <div className="w-[1.5px] flex-1 bg-red-500" />
        </div>
      </div>

      {/* 
        =========================================================================
        INTEGRATED CONTROLS ROW:
        Directly inside timeline — center buttons mathematically anchored,
        Export buttons located on the right side of transport controls
        =========================================================================
      */}
      <div className="relative w-full mt-2.5 flex items-center justify-between select-none min-h-[32px]">
        {/* Left: Digital Timecode Counter */}
        <div className="flex items-center space-x-1 font-mono text-xs tabular-nums">
          <span className="font-semibold text-gray-900 dark:text-white">
            {formatTimecode(currentTime)}
          </span>
          <span className="text-gray-400 dark:text-zinc-600">/</span>
          <span className="text-gray-500 dark:text-zinc-400 text-[11px]">
            {formatTimecode(duration)}
          </span>
        </div>

        {/* Center: Move Left, Play/Pause, Move Right Buttons (Strictly anchored at exact center) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-1.5">
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

        {/* Right Side: Export Frame, Export Sequence, and Playback Speed */}
        <div className="flex items-center space-x-2">
          {/* Export Frame Button */}
          <button
            onClick={onExportFrame}
            disabled={isExportingFrame}
            className="h-7 px-2.5 rounded text-[11px] font-medium flex items-center space-x-1.5 border border-gray-200/80 dark:border-[#22272E] bg-white dark:bg-[#14171F] hover:bg-gray-100 dark:hover:bg-[#1C202A] text-gray-800 dark:text-gray-200 transition active:scale-95 disabled:opacity-50"
            title={
              selectedIntervals.length > 0
                ? `Сохранить кадры для ${selectedIntervals.length} выбранных меток как PNG`
                : `Сохранить текущий кадр (${formatTimecode(currentTime)}) как PNG`
            }
          >
            {isExportingFrame ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500 dark:text-sky-400" />
            ) : (
              <Camera className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            )}
            <span className="hidden sm:inline">Экспорт кадра</span>
            {selectedIntervals.length > 0 && (
              <span className="px-1 py-0.2 text-[10px] font-mono rounded bg-sky-500/15 text-sky-600 dark:text-sky-300 font-semibold">
                {selectedIntervals.length}
              </span>
            )}
          </button>

          {/* Export Sequence Button */}
          <button
            onClick={onExportSequence}
            disabled={isExportingSequence}
            className="h-7 px-2.5 rounded text-[11px] font-medium flex items-center space-x-1.5 border border-gray-200/80 dark:border-[#22272E] bg-white dark:bg-[#14171F] hover:bg-gray-100 dark:hover:bg-[#1C202A] text-gray-800 dark:text-gray-200 transition active:scale-95 disabled:opacity-50"
            title={
              selectedIntervals.length > 0
                ? `Экспортировать ${selectedIntervals.length} интервалов нарушений и объединить в 1 видео (.mp4)`
                : `Экспортировать текущий диапазон обрезки [${formatTimecode(trimStart)} - ${formatTimecode(trimEnd)}] в 1 видео (.mp4)`
            }
          >
            {isExportingSequence ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9D1D53]" />
            ) : (
              <Film className="w-3.5 h-3.5 text-[#9D1D53]" />
            )}
            <span className="hidden sm:inline">Экспорт нарезки</span>
            {selectedIntervals.length > 0 && (
              <span className="px-1 py-0.2 text-[10px] font-mono rounded bg-[#9D1D53]/15 text-[#9D1D53] dark:text-[#E05285] font-semibold">
                {selectedIntervals.length}
              </span>
            )}
          </button>

          {/* Bounding Box Toggle Button */}
          {onToggleBoundingBox && (
            <button
              onClick={onToggleBoundingBox}
              className={`h-7 px-2.5 rounded text-[11px] font-medium flex items-center space-x-1.5 border transition active:scale-95 ${
                showBoundingBox
                  ? 'bg-rose-500/15 border-rose-500/70 text-rose-600 dark:text-rose-400 font-semibold shadow-sm'
                  : 'border-gray-200/80 dark:border-[#22272E] bg-white dark:bg-[#14171F] hover:bg-gray-100 dark:hover:bg-[#1C202A] text-gray-700 dark:text-gray-300'
              }`}
              title={
                showBoundingBox
                  ? 'Рамка (B-Box) включена: видео останавливается на нарушении, экспорт кадра/нарезки с рамкой'
                  : 'Включить рамку (B-Box) для авто-остановки и экспорта с рамкой'
              }
            >
              <Scan className="w-3.5 h-3.5" />
              <span>B-Box</span>
            </button>
          )}

          {/* Playback Speed Toggle */}
          {onChangePlaybackRate && (
            <button
              onClick={() => {
                const rates = [1, 1.5, 2]
                const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length
                onChangePlaybackRate(rates[nextIdx])
              }}
              className="w-14 h-7 flex items-center justify-center space-x-1 px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-[#1E232B] border border-gray-200/60 dark:border-[#22272E] transition"
              title="Скорость воспроизведения"
            >
              <Gauge className="w-3 h-3 shrink-0" />
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
            top: `${tooltipPos.y - 72}px`,
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
            {selectedIntervals.some((i) => i.detectionId === hoveredDetection.id)
              ? '✓ Выбрано для экспорта • Кликните для отмены'
              : 'Кликните для выбора зоны экспорта (±3с)'}
          </div>
        </div>
      )}
    </div>
  )
}
