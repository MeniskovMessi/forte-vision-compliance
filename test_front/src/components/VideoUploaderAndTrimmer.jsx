import React, { useState, useRef } from 'react'
import { UploadCloud, Scissors, Play, FileVideo, RefreshCw } from 'lucide-react'
import { inspectVideoFile } from '../services/api'

export default function VideoUploaderAndTrimmer({
  onAnalyze,
  isAnalyzing,
  currentFile,
  setCurrentFile,
  videoMetadata,
  setVideoMetadata,
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [enableTrimming, setEnableTrimming] = useState(false)
  const [startSec, setStartSec] = useState(0)
  const [endSec, setEndSec] = useState(0)
  const [saveTrimmedOnly, setSaveTrimmedOnly] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileChange = async (file) => {
    if (!file) return
    setCurrentFile(file)

    try {
      const info = await inspectVideoFile(file)
      setVideoMetadata(info)
      setStartSec(0)
      setEndSec(info.duration_sec ? Math.round(info.duration_sec * 10) / 10 : 30)
    } catch (err) {
      // Local fallback
      const tempVideo = document.createElement('video')
      tempVideo.preload = 'metadata'
      tempVideo.onloadedmetadata = () => {
        window.URL.revokeObjectURL(tempVideo.src)
        const dur = Math.round(tempVideo.duration * 10) / 10 || 30
        setVideoMetadata({
          filename: file.name,
          duration_sec: dur,
          fps: 30,
          width: tempVideo.videoWidth || 1920,
          height: tempVideo.videoHeight || 1080,
        })
        setStartSec(0)
        setEndSec(dur)
      }
      tempVideo.src = URL.createObjectURL(file)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFileChange(file)
  }

  const formatSec = (sec) => {
    const s = Math.max(0, Math.round(sec))
    const m = Math.floor(s / 60)
    const rem = s % 60
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`
  }

  const handleSubmit = () => {
    if (!currentFile) return
    onAnalyze({
      file: currentFile,
      startSec: enableTrimming ? Number(startSec) : null,
      endSec: enableTrimming ? Number(endSec) : null,
      saveTrimmedOnly,
    })
  }

  const effectiveDuration = enableTrimming
    ? Math.max(0, endSec - startSec).toFixed(1)
    : (videoMetadata?.duration_sec?.toFixed(1) || '0')

  return (
    <div className="bg-white dark:bg-[#16191E] rounded-xl border border-gray-200 dark:border-[#22272E] p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          Загрузка видеозаписи
        </h2>
        {currentFile && (
          <button
            onClick={() => {
              setCurrentFile(null)
              setVideoMetadata(null)
              setEnableTrimming(false)
            }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center space-x-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Выбрать другое видео</span>
          </button>
        )}
      </div>

      {!currentFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition ${
            isDragging
              ? 'border-[#9D1D53] bg-rose-50/40 dark:bg-rose-950/20'
              : 'border-gray-300 dark:border-[#2E3440] hover:border-gray-400 dark:hover:border-gray-600'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mov,.mp4,video/*"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />
          <div className="flex flex-col items-center justify-center space-y-2">
            <UploadCloud className="w-6 h-6 text-gray-400" />
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Перетащите видеозапись кассы сюда или <span className="text-[#9D1D53] underline">выберите файл</span>
            </p>
            <p className="text-[11px] text-gray-400 font-mono">
              Поддерживаются форматы QuickTime (.mov) и MPEG-4 (.mp4)
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* File row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-[#0E1015] border border-gray-200 dark:border-[#22272E] gap-2">
            <div className="flex items-center space-x-2.5">
              <FileVideo className="w-5 h-5 text-[#9D1D53] flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white font-mono truncate max-w-xs sm:max-w-md">
                  {currentFile.name}
                </p>
                <div className="flex items-center space-x-2 text-[11px] text-gray-500 font-mono mt-0.5">
                  <span>{(currentFile.size / (1024 * 1024)).toFixed(1)} МБ</span>
                  {videoMetadata && (
                    <>
                      <span>•</span>
                      <span>{videoMetadata.duration_sec?.toFixed(1)}с</span>
                      <span>•</span>
                      <span>{videoMetadata.fps?.toFixed(0)} FPS</span>
                      <span>•</span>
                      <span>{videoMetadata.width}×{videoMetadata.height}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setEnableTrimming(!enableTrimming)}
              className={`flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition ${
                enableTrimming
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-transparent'
                  : 'bg-white dark:bg-[#16191E] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#22272E] hover:bg-gray-100'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>{enableTrimming ? 'Интервал задан' : 'Обрезать интервал'}</span>
            </button>
          </div>

          {/* Trimmer controls */}
          {enableTrimming && videoMetadata && (
            <div className="p-3.5 rounded-lg border border-gray-200 dark:border-[#22272E] bg-gray-50/50 dark:bg-[#0E1015]/60 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-gray-600 dark:text-gray-300">
                <span>Интервал проверки:</span>
                <span>
                  {formatSec(startSec)} ({startSec}с) → {formatSec(endSec)} ({endSec}с) •{' '}
                  <strong className="text-gray-900 dark:text-white font-semibold">
                    {Math.max(0, endSec - startSec).toFixed(1)}с
                  </strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-gray-400 block mb-1">
                    Начало: {startSec}с
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0, endSec - 1)}
                    step="0.5"
                    value={startSec}
                    onChange={(e) => setStartSec(parseFloat(e.target.value))}
                    className="w-full accent-[#9D1D53] cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-gray-400 block mb-1">
                    Конец: {endSec}с
                  </label>
                  <input
                    type="range"
                    min={startSec + 1}
                    max={videoMetadata.duration_sec || 60}
                    step="0.5"
                    value={endSec}
                    onChange={(e) => setEndSec(parseFloat(e.target.value))}
                    className="w-full accent-[#9D1D53] cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[11px] text-gray-500 font-mono">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveTrimmedOnly}
                    onChange={(e) => setSaveTrimmedOnly(e.target.checked)}
                    className="rounded text-[#9D1D53] focus:ring-0 cursor-pointer"
                  />
                  <span>Сохранять только обрезанный файл (ffmpeg copy)</span>
                </label>
                <button
                  onClick={() => {
                    setStartSec(0)
                    setEndSec(videoMetadata.duration_sec || 30)
                  }}
                  className="hover:underline text-gray-400"
                >
                  Сбросить
                </button>
              </div>
            </div>
          )}

          {/* Submit CTA */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSubmit}
              disabled={isAnalyzing}
              className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-medium text-white transition ${
                isAnalyzing
                  ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'
                  : 'bg-[#9D1D53] hover:bg-[#831644]'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Проверка видеозаписи...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Проверить запись ({effectiveDuration}с)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
