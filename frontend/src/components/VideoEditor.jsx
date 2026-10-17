import React, { useRef, useState, useEffect } from 'react'
import {
  ArrowLeft,
  FileVideo,
  Sparkles,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'
import Timeline from './Timeline'
import { submitVideoAnalysis, pollJobDetailed, compileVideoCuts } from '../services/api'

export default function VideoEditor({ videoData, onBack, darkMode }) {
  const videoRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [videoResolution, setVideoResolution] = useState(null)
  const [trimRange, setTrimRange] = useState([0, 0])

  // Real backend AI analysis state
  const [detections, setDetections] = useState([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState('idle') // 'idle' | 'analyzing' | 'done' | 'error'
  const [analysisError, setAnalysisError] = useState(null)
  const [jobId, setJobId] = useState(null)
  const [jobData, setJobData] = useState(null)

  // Selected violation intervals for export (CapCut / Premiere style tracks)
  const [selectedIntervals, setSelectedIntervals] = useState([])
  const [isExportingFrame, setIsExportingFrame] = useState(false)
  const [isExportingSequence, setIsExportingSequence] = useState(false)

  // Listen to video events
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration || 0
      setDuration(dur)
      setTrimRange([0, dur])
      setVideoResolution({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      })
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime || 0)
    }
  }

  const handlePlayPauseToggle = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  // Seek handler from timeline click/scrub
  const handleSeek = (targetTime) => {
    if (!videoRef.current) return
    const clamped = Math.max(0, Math.min(duration, targetTime))
    videoRef.current.currentTime = clamped
    setCurrentTime(clamped)
  }

  // Jump to start
  const handleJumpToStart = () => {
    handleSeek(0)
  }

  // Jump to end
  const handleJumpToEnd = () => {
    handleSeek(duration)
  }

  // Move left to previous detected checkpoint (or beginning if none)
  const handlePrevCheckpoint = () => {
    if (!detections || detections.length === 0) {
      handleJumpToStart()
      return
    }
    const prevs = detections
      .map((d) => d.timecode)
      .filter((t) => t < currentTime - 0.25)
      .sort((a, b) => b - a)

    if (prevs.length > 0) {
      handleSeek(prevs[0])
    } else {
      handleJumpToStart()
    }
  }

  // Move right to next detected checkpoint (or end if none)
  const handleNextCheckpoint = () => {
    if (!detections || detections.length === 0) {
      handleJumpToEnd()
      return
    }
    const nexts = detections
      .map((d) => d.timecode)
      .filter((t) => t > currentTime + 0.25)
      .sort((a, b) => a - b)

    if (nexts.length > 0) {
      handleSeek(nexts[0])
    } else {
      handleJumpToEnd()
    }
  }

  // Change playback speed
  const handleChangePlaybackRate = (rate) => {
    setPlaybackRate(rate)
    if (videoRef.current) {
      videoRef.current.playbackRate = rate
    }
  }

  // Toggle selection for a violation detection marker
  const handleToggleDetectionSelection = (det) => {
    setSelectedIntervals((prev) => {
      const exists = prev.some((inv) => inv.detectionId === det.id)
      if (exists) {
        // Deselect and remove interval from export
        return prev.filter((inv) => inv.detectionId !== det.id)
      } else {
        // Select and create new interval ±3 seconds
        const halfSpan = 3.0
        const dur = duration || 30
        const s = Math.max(0, parseFloat((det.timecode - halfSpan).toFixed(2)))
        const e = Math.min(dur, parseFloat((det.timecode + halfSpan).toFixed(2)))
        const newInterval = {
          id: `inv_${det.id}_${Date.now()}`,
          detectionId: det.id,
          label: det.label,
          timecode: det.timecode,
          start: s,
          end: e,
        }
        return [...prev, newInterval]
      }
    })
  }

  // Update start and end time of an interval (drag adjustment)
  const handleUpdateInterval = (id, newStart, newEnd) => {
    setSelectedIntervals((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, start: newStart, end: newEnd } : inv))
    )
  }

  // Remove interval directly
  const handleRemoveInterval = (id) => {
    setSelectedIntervals((prev) => prev.filter((inv) => inv.id !== id))
  }

  // Export frame(s) as PNG
  const handleExportFrame = async () => {
    if (isExportingFrame) return
    setIsExportingFrame(true)
    try {
      const targets =
        selectedIntervals.length > 0
          ? selectedIntervals.map((inv) => ({
              timecode: inv.timecode !== undefined ? inv.timecode : (inv.start + inv.end) / 2,
              label: inv.label || 'violation',
            }))
          : [{ timecode: currentTime, label: 'frame' }]

      const offVideo = document.createElement('video')
      offVideo.crossOrigin = 'anonymous'
      offVideo.muted = true
      offVideo.src = videoData?.url

      await new Promise((resolve, reject) => {
        offVideo.onloadedmetadata = () => resolve()
        offVideo.onerror = (e) => reject(e)
        setTimeout(resolve, 3000)
      })

      const canvas = document.createElement('canvas')
      canvas.width = offVideo.videoWidth || videoResolution?.width || 1280
      canvas.height = offVideo.videoHeight || videoResolution?.height || 720
      const ctx = canvas.getContext('2d')

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i]
        offVideo.currentTime = Math.max(0, Math.min(duration || 30, target.timecode))
        await new Promise((resolve) => {
          const onSeeked = () => {
            offVideo.removeEventListener('seeked', onSeeked)
            resolve()
          }
          offVideo.addEventListener('seeked', onSeeked)
          setTimeout(resolve, 500)
        })

        ctx.drawImage(offVideo, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/png')
        const a = document.createElement('a')
        const baseName = videoData?.name ? videoData.name.replace(/\.[^/.]+$/, '') : 'frame'
        const tcFormatted = target.timecode.toFixed(2).replace('.', '_')
        a.download = `${baseName}_frame_${tcFormatted}s.png`
        a.href = dataUrl
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        if (targets.length > 1) {
          await new Promise((r) => setTimeout(r, 250))
        }
      }
    } catch (err) {
      console.error('Frame export failed:', err)
      alert(`Не удалось экспортировать кадр: ${err.message || err}`)
    } finally {
      setIsExportingFrame(false)
    }
  }

  // Export sequence: compiles selected intervals and merges into 1 video via backend
  const handleExportSequence = async () => {
    if (isExportingSequence) return
    setIsExportingSequence(true)
    try {
      const cuts =
        selectedIntervals.length > 0
          ? selectedIntervals.map((inv) => ({
              start: inv.start,
              end: inv.end,
            }))
          : [{ start: trimRange[0], end: trimRange[1] }]

      let fileToCompile = videoData?.file
      if (!fileToCompile && videoData?.url) {
        const resBlob = await fetch(videoData.url).then((r) => r.blob())
        fileToCompile = new File([resBlob], videoData.name || 'video.mp4', { type: 'video/mp4' })
      }

      if (!fileToCompile) {
        throw new Error('Видеофайл недоступен')
      }

      const blob = await compileVideoCuts(fileToCompile, cuts, true)
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const baseName = videoData?.name ? videoData.name.replace(/\.[^/.]+$/, '') : 'video'
      a.download = `${baseName}_violations_sequence_${cuts.length}cuts.mp4`
      a.href = downloadUrl
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error('Sequence export failed:', err)
      alert(`Не удалось экспортировать нарезку: ${err.message || err}`)
    } finally {
      setIsExportingSequence(false)
    }
  }

  // Keyboard shortcut: Space for play/pause, Arrows for step
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        handlePlayPauseToggle()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        handlePrevCheckpoint()
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        handleNextCheckpoint()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, currentTime, duration, detections])

  // Trigger real video analysis through the backend AI pipeline
  const handleAnalyze = async () => {
    if (isAnalyzing) return
    setIsAnalyzing(true)
    setAnalysisStatus('analyzing')
    setAnalysisError(null)

    try {
      let fileToAnalyze = videoData?.file
      if (!fileToAnalyze && videoData?.url) {
        const resBlob = await fetch(videoData.url).then((r) => r.blob())
        fileToAnalyze = new File([resBlob], videoData.name || 'cctv_video.mp4', { type: 'video/mp4' })
      }

      if (!fileToAnalyze) {
        throw new Error('Видеофайл не найден для анализа')
      }

      // If user selected a custom trimmed interval, pass it to backend
      const startSec = trimRange[0] > 0 ? trimRange[0] : undefined
      const endSec = trimRange[1] > 0 && trimRange[1] < duration ? trimRange[1] : undefined

      const submitRes = await submitVideoAnalysis(fileToAnalyze, {
        startSec,
        endSec,
      })

      const submittedJobId = submitRes.job_id
      setJobId(submittedJobId)

      // Poll until backend completes video inspection, YOLO, and legal RAG
      let attempts = 0
      const pollInterval = setInterval(async () => {
        attempts++
        try {
          const detailed = await pollJobDetailed(submittedJobId)
          if (detailed.status === 'done') {
            clearInterval(pollInterval)
            setJobData(detailed)

            const rawViolations = detailed.violations || []
            const mapped = rawViolations.map((v, i) => {
              const tc = v.relative_timecode_sec ?? v.timecode_sec ?? 0
              return {
                id: i + 1,
                timecode: parseFloat(Number(tc).toFixed(1)),
                label: v.type || 'Нарушение кассовой дисциплины',
                lawRef: v.regulation_reference?.clause_ref || v.regulation_reference?.article || 'НБРК',
                confidence: v.confidence,
                ruleCode: v.rule_code,
                regulation: v.regulation_reference,
                bboxNorm: v.bbox_norm,
                evidenceFrames: v.evidence_frames,
              }
            })

            setDetections(mapped)
            setAnalysisStatus('done')
            setIsAnalyzing(false)
          } else if (detailed.status === 'failed') {
            clearInterval(pollInterval)
            setAnalysisError(detailed.error_message || 'Анализ завершился с ошибкой')
            setAnalysisStatus('error')
            setIsAnalyzing(false)
          }
        } catch (pollErr) {
          console.warn('Poll error:', pollErr)
        }

        if (attempts > 140) {
          clearInterval(pollInterval)
          setAnalysisError('Таймаут ожидания анализа видео (превышено 70 секунд)')
          setAnalysisStatus('error')
          setIsAnalyzing(false)
        }
      }, 500)
    } catch (e) {
      console.error('Analysis failed:', e)
      setAnalysisError(e.message || 'Ошибка соединения с сервером AI')
      setAnalysisStatus('error')
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="flex-1 min-h-0 w-full h-full flex flex-col md:flex-row overflow-hidden select-none bg-white dark:bg-[#0D0F12]">
      {/* 
        ========================================================================
        LEFT COLUMN: Video Preview (70%) + Timeline & Transport (30%)
        ========================================================================
      */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden border-r border-gray-200/40 dark:border-[#1A1E26]">
        {/* Top Mini-Toolbar (Seamless, flush) */}
        <div className="h-9 px-4 border-b border-gray-200/30 dark:border-[#1A1E26] bg-gray-50/40 dark:bg-[#0E1116] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={onBack}
              className="flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-mono text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
              title="Загрузить другое видео"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>К загрузке</span>
            </button>
            <span className="text-gray-300 dark:text-zinc-700">|</span>
            <div className="flex items-center space-x-1.5 text-xs font-medium text-gray-800 dark:text-gray-200 truncate max-w-[200px] sm:max-w-xs">
              <FileVideo className="w-3.5 h-3.5 text-[#9D1D53] shrink-0" />
              <span className="truncate">{videoData?.name}</span>
            </div>
          </div>
        </div>

        {/* 
          Video Preview Container:
          Dynamically fills available space above the timeline (theme-adaptive canvas)
        */}
        <div
          onClick={handlePlayPauseToggle}
          className="flex-1 min-h-0 bg-gray-100 dark:bg-[#07080B] relative flex items-center justify-center p-3 sm:p-4 overflow-hidden cursor-pointer group transition-colors"
        >
          <video
            ref={videoRef}
            src={videoData?.url}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            playsInline
            className="max-h-full max-w-full object-contain rounded border border-black/5 dark:border-white/5 pointer-events-none"
          />

          {/* Quick resolution badge (theme-adaptive) */}
          {videoResolution && (
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono bg-white/80 dark:bg-black/60 text-gray-700 dark:text-gray-300 border border-gray-200/80 dark:border-white/10 pointer-events-none">
              {videoResolution.width} × {videoResolution.height}
            </div>
          )}
        </div>

        {/* 
          Unified Timeline & Transport Control Section:
          No separate bottom bar or internal borders — perfectly flush and visible
        */}
        <div className="shrink-0 border-t border-gray-200/40 dark:border-[#1A1E26] bg-gray-50/20 dark:bg-[#0A0D12]">
          <Timeline
            duration={duration}
            currentTime={currentTime}
            onSeek={handleSeek}
            detections={detections}
            trimStart={trimRange[0]}
            trimEnd={trimRange[1]}
            onTrimChange={(start, end) => setTrimRange([start, end])}
            isPlaying={isPlaying}
            onTogglePlay={handlePlayPauseToggle}
            onPrevCheckpoint={handlePrevCheckpoint}
            onNextCheckpoint={handleNextCheckpoint}
            playbackRate={playbackRate}
            onChangePlaybackRate={handleChangePlaybackRate}
            darkMode={darkMode}
            selectedIntervals={selectedIntervals}
            onToggleDetectionSelection={handleToggleDetectionSelection}
            onUpdateInterval={handleUpdateInterval}
            onRemoveInterval={handleRemoveInterval}
            onExportFrame={handleExportFrame}
            onExportSequence={handleExportSequence}
            isExportingFrame={isExportingFrame}
            isExportingSequence={isExportingSequence}
          />
        </div>
      </div>

      {/* 
        ========================================================================
        RIGHT COLUMN: Seamless Session Inspector (No nested card boxes)
        ========================================================================
      */}
      <div className="w-full md:w-80 lg:w-88 shrink-0 h-full flex flex-col justify-between bg-white dark:bg-[#0D0F12] overflow-y-auto">
        <div className="flex flex-col">
          {/* Section Header: Инструменты */}
          <div className="h-9 px-5 border-b border-gray-200/30 dark:border-[#1A1E26] bg-gray-50/40 dark:bg-[#0E1116] flex items-center justify-between shrink-0">
            <span className="text-[11px] font-mono uppercase tracking-[0.15em] font-semibold text-gray-500 dark:text-zinc-400">
              Инструменты
            </span>
          </div>

          {/* Seamless Metadata Rows (No nested cards, clean tabular layout) */}
          <div className="px-5 py-4 space-y-3 border-b border-gray-200/30 dark:border-[#1A1E26]">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400 dark:text-zinc-500">Файл</span>
              <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[170px]" title={videoData?.name}>
                {videoData?.name}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400 dark:text-zinc-500">Длительность</span>
              <span className="text-gray-800 dark:text-gray-200">
                {duration ? `${duration.toFixed(1)} с` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400 dark:text-zinc-500">Зона обрезки</span>
              <span className="text-gray-800 dark:text-gray-200 text-[11px]">
                {trimRange[1] > 0
                  ? `${trimRange[0].toFixed(1)} с — ${trimRange[1].toFixed(1)} с`
                  : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400 dark:text-zinc-500">Выбрано зон</span>
              <span className="text-gray-800 dark:text-gray-200">
                {selectedIntervals.length > 0 ? (
                  <span className="text-sky-500 dark:text-sky-400 font-semibold">{selectedIntervals.length} шт.</span>
                ) : (
                  '—'
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400 dark:text-zinc-500">Разрешение</span>
              <span className="text-gray-800 dark:text-gray-200">
                {videoResolution ? `${videoResolution.width} × ${videoResolution.height}` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400 dark:text-zinc-500">Размер</span>
              <span className="text-gray-800 dark:text-gray-200">{videoData?.size || '—'}</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400 dark:text-zinc-500">Статус</span>
              <span className="text-gray-800 dark:text-gray-200">
                {analysisStatus === 'done'
                  ? 'Завершён'
                  : analysisStatus === 'analyzing'
                  ? 'Анализ нейросетью...'
                  : analysisStatus === 'error'
                  ? 'Ошибка'
                  : 'Готов к анализу'}
              </span>
            </div>
          </div>

          {/* Selected Export Intervals in Side Panel if any */}
          {selectedIntervals.length > 0 && (
            <div className="px-5 py-3 border-b border-gray-200/30 dark:border-[#1A1E26] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                <span>Зоны для нарезки:</span>
                <span className="text-sky-500 font-semibold">{selectedIntervals.length}</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {selectedIntervals.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-[#14171E] border border-gray-200/40 dark:border-[#1F242E] text-xs font-mono"
                  >
                    <div className="truncate max-w-[190px]">
                      <div className="text-sky-600 dark:text-sky-400 font-semibold text-[11px]">
                        {inv.start.toFixed(1)}с — {inv.end.toFixed(1)}с
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">
                        {inv.label}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveInterval(inv.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition"
                      title="Удалить из экспорта"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* State Content */}
          {analysisStatus === 'idle' && (
            <div className="px-5 py-6 text-center space-y-1.5">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Видео готово к обработке
              </div>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 leading-relaxed font-sans max-w-xs mx-auto">
                Запустите локальные модели YOLO и нормативную базу НБРК (adilet.zan.kz) для поиска нарушений.
              </p>
            </div>
          )}

          {analysisStatus === 'analyzing' && (
            <div className="px-5 py-6 text-center space-y-2">
              <Loader2 className="w-5 h-5 mx-auto text-[#9D1D53] animate-spin" />
              <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
                Анализ видеопотока через AI...
              </div>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 font-sans">
                Детекция позы кассира, сейфа, кассового узла и поиск статей НБРК в pgvector
              </p>
              {jobId && (
                <div className="text-[10px] font-mono text-gray-400 dark:text-zinc-500">
                  ID задачи: {jobId}
                </div>
              )}
            </div>
          )}

          {analysisStatus === 'error' && (
            <div className="px-5 py-6 text-center space-y-2">
              <AlertTriangle className="w-5 h-5 mx-auto text-amber-500" />
              <div className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Ошибка анализа
              </div>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 font-sans">
                {analysisError || 'Не удалось выполнить анализ на сервере'}
              </p>
            </div>
          )}

          {analysisStatus === 'done' && (
            <div>
              {detections.length === 0 ? (
                <div className="px-5 py-4">
                  <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-start space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                        Нарушений не обнаружено
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-sans">
                        Видео полностью соответствует правилам кассовой дисциплины НБРК.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  {/* Full-width header banner */}
                  <div className="px-5 py-3 flex items-center justify-between text-[11px] font-mono text-gray-500 dark:text-zinc-400 uppercase tracking-wider border-b border-gray-200/30 dark:border-[#1A1E26] bg-gray-50/30 dark:bg-[#0E1116]/40">
                    <span>Обнаружено нарушений:</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-500 dark:text-sky-400 border border-sky-500/20 font-semibold">
                      {detections.length}
                    </span>
                  </div>

                  {/* Full-width violation rows (no card boxes, edge-to-edge flush layout) */}
                  <div className="divide-y divide-gray-200/30 dark:divide-[#1A1E26] border-b border-gray-200/30 dark:border-[#1A1E26]">
                    {detections.map((d) => {
                      const isSelected = selectedIntervals.some((i) => i.detectionId === d.id)
                      return (
                        <div
                          key={d.id}
                          onClick={() => handleSeek(d.timecode)}
                          className={`w-full px-5 py-3.5 cursor-pointer transition-colors relative border-l-2 group ${
                            isSelected
                              ? 'border-sky-400 bg-sky-500/5 dark:bg-sky-400/5'
                              : 'border-transparent hover:border-gray-400 dark:hover:border-zinc-600 hover:bg-gray-50/60 dark:hover:bg-[#14171E]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-sky-500 dark:text-sky-400 font-semibold">{d.timecode.toFixed(1)} с</span>
                            <span className="text-gray-400 dark:text-zinc-500 text-[10px] truncate max-w-[170px]" title={d.lawRef}>
                              {d.lawRef}
                            </span>
                          </div>

                          <div className="text-xs text-gray-800 dark:text-gray-200 font-medium group-hover:text-sky-500 dark:group-hover:text-sky-400 transition-colors mt-1 leading-snug">
                            {d.label}
                          </div>

                          <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono text-gray-400 dark:text-zinc-500">
                            {d.confidence ? (
                              <span>Уверенность: {Math.round(d.confidence * 100)}%</span>
                            ) : (
                              <span />
                            )}
                            <span className={isSelected ? 'text-sky-500 dark:text-sky-400 font-medium' : ''}>
                              {isSelected ? '✓ Выбрано для экспорта' : 'Нажмите маркер на шкале для выбора'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 
          BOTTOM: Primary Action - Analyze Button (Seamless footer)
        */}
        <div className="p-5 border-t border-gray-200/30 dark:border-[#1A1E26]">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className={`w-full py-3 px-4 rounded-lg font-medium text-xs tracking-wider uppercase font-mono shadow-sm flex items-center justify-center space-x-2 transition-all ${
              isAnalyzing
                ? 'bg-gray-400 dark:bg-zinc-700 text-white cursor-not-allowed'
                : 'bg-[#9D1D53] hover:bg-[#861846] text-white active:scale-[0.99]'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Анализ видеопотока...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{analysisStatus === 'done' ? 'Повторить анализ' : 'Анализировать видео'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
