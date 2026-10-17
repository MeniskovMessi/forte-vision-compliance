import React, { useRef, useState, useEffect } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Crosshair,
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

  // Replay from T-5s to T, then pause automatically
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

  // Active bounding box
  let activeBbox = null
  let activeLabel = ''

  if (showOverlay && selectedViolation?.evidence_bbox) {
    const tc = selectedViolation.relative_timecode_sec ?? selectedViolation.timecode_sec ?? 0
    if (Math.abs(currentTime - tc) <= 1.5 || !isPlaying) {
      activeBbox = selectedViolation.evidence_bbox.bbox_norm
      activeLabel = selectedViolation.evidence_bbox.label
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl overflow-hidden bg-black border border-gray-200 dark:border-[#22272E] shadow-sm flex flex-col select-none"
    >
      {/* Video Viewport */}
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

        {/* Minimal Hairline Bounding Box Targeting Overlay */}
        {activeBbox && activeBbox.length === 4 && (
          <div
            className="absolute pointer-events-none transition-all duration-100 target-bbox rounded-sm"
            style={{
              left: `${activeBbox[0] * 100}%`,
              top: `${activeBbox[1] * 100}%`,
              width: `${(activeBbox[2] - activeBbox[0]) * 100}%`,
              height: `${(activeBbox[3] - activeBbox[1]) * 100}%`,
            }}
          >
            {/* Hairline Corner Brackets */}
            <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white" />
            <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-white" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-white" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white" />

            {/* Label badge */}
            <div className="absolute -top-6 left-0 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[10px] tracking-wide whitespace-nowrap border border-white/20">
              {activeLabel || 'Зона нарушения'}
            </div>
          </div>
        )}

        {/* Active Pre-Roll Pill */}
        {isReplayingPreRoll && (
          <div className="absolute top-3 left-3 z-20 flex items-center space-x-1.5 px-2.5 py-1 rounded bg-black/80 text-white text-[11px] font-mono border border-white/20 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>Контекст: T-5с → {targetStopTime?.toFixed(1)}с</span>
          </div>
        )}
      </div>

      {/* Scrubber & Heatmap Pins */}
      <div className="relative w-full bg-[#11141A] px-3.5 pt-2.5 pb-2 text-white">
        <div className="relative w-full flex items-center">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-[#9D1D53] cursor-pointer h-1 bg-gray-700 rounded-lg appearance-none"
          />

          {/* Timeline Incident Pins */}
          {duration > 0 &&
            jobData?.violations?.map((v, idx) => {
              const tc = v.relative_timecode_sec ?? v.timecode_sec ?? 0
              const leftPct = (tc / duration) * 100
              const isSelected = selectedViolation === v
              return (
                <button
                  key={idx}
                  onClick={() => onSelectViolation(v)}
                  title={`Инцидент #${idx + 1} (${tc}с)`}
                  style={{ left: `${leftPct}%` }}
                  className={`absolute -top-1.5 transform -translate-x-1/2 w-2.5 h-2.5 rounded-full transition-all ${
                    isSelected
                      ? 'bg-rose-500 ring-2 ring-white scale-125 z-20'
                      : 'bg-amber-400 hover:scale-125 z-10'
                  }`}
                />
              )
            })}
        </div>

        {/* Player Controls Bar */}
        <div className="flex items-center justify-between text-xs font-mono mt-2">
          {/* Left Controls */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={togglePlay}
              className="p-1 rounded hover:bg-gray-800 text-gray-200 hover:text-white transition"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
            </button>

            <button
              onClick={() => {
                if (!videoRef.current) return
                videoRef.current.currentTime = Math.max(0, currentTime - 5)
              }}
              className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition"
              title="-5 секунд"
            >
              <RotateCcw className="w-3 h-3" />
            </button>

            <div className="text-[11px] text-gray-400">
              <span className="text-gray-200">{formatTime(currentTime)}</span>
              <span className="text-gray-600 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={changeSpeed}
              className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 hover:text-white text-[10px] transition"
            >
              {playbackSpeed}x
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = !isMuted
                  setIsMuted(!isMuted)
                }
              }}
              className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setShowOverlay(!showOverlay)}
              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono border transition ${
                showOverlay
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800/80'
                  : 'bg-gray-800 text-gray-500 border-gray-700'
              }`}
              title="Переключить рамку таргета"
            >
              <Crosshair className="w-2.5 h-2.5" />
              <span>Рамка</span>
            </button>

            <button
              onClick={() => {
                if (!containerRef.current) return
                if (document.fullscreenElement) {
                  document.exitFullscreen()
                } else {
                  containerRef.current.requestFullscreen()
                }
              }}
              className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
