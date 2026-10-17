import React, { useRef, useState, useEffect } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Crosshair,
  Sparkles,
  FastForward,
  Flag,
} from 'lucide-react'

export default function CCTVPlayer({
  videoSrc,
  jobData,
  selectedViolation,
  onSelectViolation,
  replayTrigger,
}) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(true)
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0)
  const [showOverlay, setShowOverlay] = useState(true)
  const [isReplayingPreRoll, setIsReplayingPreRoll] = useState(false)
  const [targetStopTime, setTargetStopTime] = useState(null)

  // Handle pre-roll replay: Seek to T-5s and play until T, then auto-pause
  useEffect(() => {
    if (!selectedViolation || !videoRef.current) return
    const v = videoRef.current
    const tc = selectedViolation.relative_timecode_sec ?? selectedViolation.timecode_sec ?? 0
    const startT = Math.max(0, tc - 5.0)

    v.currentTime = startT
    setTargetStopTime(tc)
    setIsReplayingPreRoll(true)
    v.play()
      .then(() => setIsPlaying(true))
      .catch((e) => console.log('Autoplay prevented:', e))
  }, [selectedViolation, replayTrigger])

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const cur = videoRef.current.currentTime
    setCurrentTime(cur)

    // Check if we reached the target stop point of the pre-roll replay
    if (isReplayingPreRoll && targetStopTime !== null) {
      if (cur >= targetStopTime) {
        videoRef.current.pause()
        videoRef.current.currentTime = targetStopTime
        setIsPlaying(false)
        setIsReplayingPreRoll(false)
        setTargetStopTime(null)
      }
    }
  }

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
      setIsReplayingPreRoll(false)
    } else {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleSeek = (e) => {
    if (!videoRef.current) return
    const newT = parseFloat(e.target.value)
    videoRef.current.currentTime = newT
    setCurrentTime(newT)
    setIsReplayingPreRoll(false)
  }

  const changeSpeed = () => {
    const speeds = [0.5, 1.0, 1.5, 2.0]
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length
    const next = speeds[nextIdx]
    setPlaybackSpeed(next)
    if (videoRef.current) videoRef.current.playbackRate = next
  }

  const formatTime = (sec) => {
    const s = Math.max(0, Math.round(sec))
    const m = Math.floor(s / 60)
    const rem = s % 60
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`
  }

  // Active bounding box to display
  let activeBbox = null
  let activeLabel = ''

  if (showOverlay && selectedViolation?.evidence_bbox) {
    const tc = selectedViolation.relative_timecode_sec ?? selectedViolation.timecode_sec ?? 0
    // Show overlay if video is paused near the violation moment (within +-1.5s)
    if (Math.abs(currentTime - tc) <= 1.5 || !isPlaying) {
      activeBbox = selectedViolation.evidence_bbox.bbox_norm
      activeLabel = selectedViolation.evidence_bbox.label
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-md flex flex-col group select-none"
    >
      {/* Video Canvas Container */}
      <div className="relative w-full aspect-video flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          muted={isMuted}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onClick={togglePlay}
        />

        {/* Bounding Box Targeting Overlay */}
        {activeBbox && activeBbox.length === 4 && (
          <div
            className="absolute pointer-events-none transition-all duration-150 border-2 border-rose-500 rounded-sm shadow-[0_0_15px_rgba(244,63,94,0.6)]"
            style={{
              left: `${activeBbox[0] * 100}%`,
              top: `${activeBbox[1] * 100}%`,
              width: `${(activeBbox[2] - activeBbox[0]) * 100}%`,
              height: `${(activeBbox[3] - activeBbox[1]) * 100}%`,
            }}
          >
            {/* Reticle Corner Brackets */}
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white" />
            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white" />

            {/* Label Badge */}
            <div className="absolute -top-7 left-0 px-2 py-0.5 rounded bg-rose-600 text-white font-mono text-[10px] uppercase font-semibold tracking-wider whitespace-nowrap shadow-sm flex items-center space-x-1">
              <Crosshair className="w-2.5 h-2.5" />
              <span>{activeLabel || 'Зона нарушения'}</span>
            </div>
          </div>
        )}

        {/* Pre-roll active banner */}
        {isReplayingPreRoll && (
          <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-mono backdrop-blur-md animate-pulse shadow-md">
            <Play className="w-3 h-3 fill-white" />
            <span>
              ВОСПРОИЗВЕДЕНИЕ T-5с (ДО {targetStopTime?.toFixed(1)}с)
            </span>
          </div>
        )}
      </div>

      {/* Timeline Scrubber Bar with Violation Pins */}
      <div className="relative w-full bg-slate-900 px-4 pt-3 pb-2">
        <div className="relative w-full flex items-center">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
          />

          {/* Violation Heatmap Pins pinned on seekbar */}
          {duration > 0 &&
            jobData?.violations?.map((v, idx) => {
              const tc = v.relative_timecode_sec ?? v.timecode_sec ?? 0
              const leftPct = (tc / duration) * 100
              const isSelected = selectedViolation === v
              return (
                <button
                  key={idx}
                  onClick={() => onSelectViolation(v)}
                  title={`Перейти к нарушению #${idx + 1} (${tc}с)`}
                  style={{ left: `${leftPct}%` }}
                  className={`absolute -top-1.5 transform -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    isSelected
                      ? 'bg-rose-500 border-white scale-125 z-20 shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                      : 'bg-amber-400 border-slate-900 hover:scale-125 z-10'
                  }`}
                />
              )
            })}
        </div>

        {/* Playback Controls Row */}
        <div className="flex items-center justify-between text-white text-xs font-mono mt-2">
          {/* Left Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-white transition"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            <button
              onClick={() => {
                if (!videoRef.current) return
                videoRef.current.currentTime = Math.max(0, currentTime - 5)
              }}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title="-5 секунд"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="text-[11px] text-slate-300">
              <span>{formatTime(currentTime)}</span>
              <span className="text-slate-600 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-3">
            {/* Speed Button */}
            <button
              onClick={changeSpeed}
              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white text-[11px] transition"
            >
              {playbackSpeed}x
            </button>

            {/* Mute Button */}
            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = !isMuted
                  setIsMuted(!isMuted)
                }
              }}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* AI Bounding Box Overlay Toggle */}
            <button
              onClick={() => setShowOverlay(!showOverlay)}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono border transition ${
                showOverlay
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
              title="Переключить рамку AI-таргета"
            >
              <Crosshair className="w-3 h-3" />
              <span className="hidden sm:inline">HUD Рамка</span>
            </button>

            {/* Fullscreen */}
            <button
              onClick={() => {
                if (!containerRef.current) return
                if (document.fullscreenElement) {
                  document.exitFullscreen()
                } else {
                  containerRef.current.requestFullscreen()
                }
              }}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
