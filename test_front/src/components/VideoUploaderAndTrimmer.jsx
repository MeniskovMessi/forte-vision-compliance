import React, { useState, useRef } from 'react'
import { UploadCloud, Scissors, Play, AlertCircle, FileVideo, CheckCircle2, RefreshCw } from 'lucide-react'
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
  const [isInspecting, setIsInspecting] = useState(false)
  const [enableTrimming, setEnableTrimming] = useState(false)
  const [startSec, setStartSec] = useState(0)
  const [endSec, setEndSec] = useState(0)
  const [saveTrimmedOnly, setSaveTrimmedOnly] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileChange = async (file) => {
    if (!file) return
    setCurrentFile(file)
    setIsInspecting(true)

    try {
      const info = await inspectVideoFile(file)
      setVideoMetadata(info)
      setStartSec(0)
      setEndSec(info.duration_sec ? Math.round(info.duration_sec * 10) / 10 : 30)
    } catch (err) {
      console.warn('Backend inspect fallback to local metadata:', err)
      // Fallback: extract duration locally via temporary HTML video element
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
          preview_thumbnails: [],
        })
        setStartSec(0)
        setEndSec(dur)
      }
      tempVideo.src = URL.createObjectURL(file)
    } finally {
      setIsInspecting(false)
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

  const handleStartSubmit = () => {
    if (!currentFile) return
    onAnalyze({
      file: currentFile,
      startSec: enableTrimming ? Number(startSec) : null,
      endSec: enableTrimming ? Number(endSec) : null,
      saveTrimmedOnly,
    })
  }

  return (
    <div className="bg-white dark:bg-[#111625] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Загрузка и Инспекция Видеозаписи
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              CCTV видео кассового узла (.mov / .mp4) с опциональной нарезкой интервала
            </p>
          </div>
        </div>

        {videoMetadata && (
          <button
            onClick={() => {
              setCurrentFile(null)
              setVideoMetadata(null)
              setEnableTrimming(false)
            }}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center space-x-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Сбросить</span>
          </button>
        )}
      </div>

      {/* Dropzone */}
      {!currentFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 scale-[0.99]'
              : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mov,.mp4,video/*"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <FileVideo className="w-6 h-6 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Перетащите видеофайл сюда или <span className="text-rose-600 dark:text-rose-400">выберите с диска</span>
              </p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Поддерживаются форматы .mov, .mp4 (QuickTime, H.264/H.265)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* File & Metadata Info Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm">
                <FileVideo className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md font-mono">
                  {currentFile.name}
                </p>
                <div className="flex items-center space-x-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <span>{(currentFile.size / (1024 * 1024)).toFixed(1)} МБ</span>
                  {videoMetadata && (
                    <>
                      <span>•</span>
                      <span>{videoMetadata.duration_sec?.toFixed(1)}с</span>
                      <span>•</span>
                      <span>{videoMetadata.fps?.toFixed(1)} FPS</span>
                      <span>•</span>
                      <span>
                        {videoMetadata.width}×{videoMetadata.height}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setEnableTrimming(!enableTrimming)}
              className={`flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                enableTrimming
                  ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>{enableTrimming ? 'Интервал активен' : 'Обрезать интервал (CCTV)'}</span>
            </button>
          </div>

          {/* Interactive Range Trimmer Bar */}
          {enableTrimming && videoMetadata && (
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-rose-700 dark:text-rose-300 font-medium flex items-center space-x-1">
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Нарезка интервала анализа:</span>
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {formatSec(startSec)} ({startSec}с) → {formatSec(endSec)} ({endSec}с) •{' '}
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    Итого: {Math.max(0, endSec - startSec).toFixed(1)} сек
                  </span>
                </span>
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block mb-1">
                    Начало интервала: {startSec}с
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0, endSec - 1)}
                    step="0.5"
                    value={startSec}
                    onChange={(e) => setStartSec(parseFloat(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block mb-1">
                    Конец интервала: {endSec}с
                  </label>
                  <input
                    type="range"
                    min={startSec + 1}
                    max={videoMetadata.duration_sec || 60}
                    step="0.5"
                    value={endSec}
                    onChange={(e) => setEndSec(parseFloat(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Physical trim toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-rose-200/50 dark:border-rose-900/30 text-xs">
                <label className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveTrimmedOnly}
                    onChange={(e) => setSaveTrimmedOnly(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>Физически нарезать файл на сервере (ffmpeg copy) и освободить диск</span>
                </label>
                <button
                  onClick={() => {
                    setStartSec(0)
                    setEndSec(videoMetadata.duration_sec || 30)
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline font-mono"
                >
                  Сбросить на 100%
                </button>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleStartSubmit}
              disabled={isAnalyzing}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-medium text-sm text-white shadow-sm transition ${
                isAnalyzing
                  ? 'bg-rose-400 cursor-not-allowed'
                  : 'bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 shadow-rose-600/20'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Идёт локальный AI-анализ 4 стадий...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>
                    Запустить AI-Анализ кассовой дисциплины{' '}
                    {enableTrimming ? `(${Math.max(0, endSec - startSec).toFixed(1)}с)` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
