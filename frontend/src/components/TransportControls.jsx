import React from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Gauge,
} from 'lucide-react'

export default function TransportControls({
  isPlaying,
  onTogglePlay,
  onPrevCheckpoint,
  onNextCheckpoint,
  onJumpToStart,
  onJumpToEnd,
  currentTime = 0,
  duration = 0,
  playbackRate = 1,
  onChangePlaybackRate,
  detectionsCount = 0,
  darkMode,
}) {
  const formatTime = (sec) => {
    if (isNaN(sec) || sec < 0) return '00:00.00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    const ms = Math.floor((sec % 1) * 100)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  const cyclePlaybackRate = () => {
    const rates = [1, 1.5, 2]
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length
    onChangePlaybackRate(rates[nextIdx])
  }

  return (
    <div className="w-full px-4 py-2 border-t border-gray-200 dark:border-[#22272E] bg-white/70 dark:bg-[#12151B]/90 flex items-center justify-between select-none">
      {/* Left: Digital Timecode Counter */}
      <div className="flex items-center space-x-3">
        <div className="flex items-baseline space-x-1 font-mono text-sm">
          <span className="font-semibold text-gray-900 dark:text-white">
            {formatTime(currentTime)}
          </span>
          <span className="text-gray-400 dark:text-zinc-600">/</span>
          <span className="text-gray-500 dark:text-zinc-400 text-xs">
            {formatTime(duration)}
          </span>
        </div>

        {detectionsCount > 0 && (
          <span className="hidden sm:inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span>Нарушений: {detectionsCount}</span>
          </span>
        )}
      </div>

      {/* Center: Play/Pause and Step Buttons (Matching User Request) */}
      <div className="flex items-center space-x-1 sm:space-x-1.5">
        {/* Jump to Beginning */}
        <button
          onClick={onJumpToStart}
          className="p-1.5 sm:p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E232B] hover:text-gray-900 dark:hover:text-white transition"
          title="В начало видео (00:00)"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Move Left to Previous Checkpoint (or start) */}
        <button
          onClick={onPrevCheckpoint}
          className="flex items-center space-x-0.5 px-2 py-1.5 sm:py-2 rounded-md text-xs font-mono text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1E232B] transition border border-transparent hover:border-gray-200 dark:hover:border-[#2A313D]"
          title="Предыдущее нарушение / контрольная точка"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden md:inline text-[11px]">Назад</span>
        </button>

        {/* Big Main Play/Pause Button */}
        <button
          onClick={onTogglePlay}
          className="mx-1 px-4 py-2 rounded-lg bg-[#9D1D53] hover:bg-[#861846] text-white shadow-sm flex items-center justify-center transition-transform active:scale-95"
          title={isPlaying ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-white" />
          ) : (
            <Play className="w-4 h-4 fill-white translate-x-0.5" />
          )}
        </button>

        {/* Move Right to Next Checkpoint (or end) */}
        <button
          onClick={onNextCheckpoint}
          className="flex items-center space-x-0.5 px-2 py-1.5 sm:py-2 rounded-md text-xs font-mono text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1E232B] transition border border-transparent hover:border-gray-200 dark:hover:border-[#2A313D]"
          title="Следующее нарушение / контрольная точка"
        >
          <span className="hidden md:inline text-[11px]">Вперёд</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Jump to End */}
        <button
          onClick={onJumpToEnd}
          className="p-1.5 sm:p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E232B] hover:text-gray-900 dark:hover:text-white transition"
          title="В конец видео"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Playback Speed Selector */}
      <div className="flex items-center space-x-2">
        <button
          onClick={cyclePlaybackRate}
          className="flex items-center space-x-1 px-2 py-1 rounded text-xs font-mono text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E232B] border border-gray-200 dark:border-[#22272E] transition"
          title="Скорость воспроизведения"
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>{playbackRate}x</span>
        </button>
      </div>
    </div>
  )
}
