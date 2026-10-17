import React, { useRef, useState, useEffect, useCallback } from 'react'
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
  const [videoContentBox, setVideoContentBox] = useState(null)
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

  // Bounding box toggle and auto-stop checkpoint ref
  const [showBoundingBox, setShowBoundingBox] = useState(false)
  const lastStoppedCheckpointRef = useRef(null)
  const prevTimeRef = useRef(0)

  // Compute exact rendered video image rectangle inside the preview container (accounting for object-contain)
  const updateVideoContentBox = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const elW = video.clientWidth
    const elH = video.clientHeight
    if (!elW || !elH) return

    const vw = video.videoWidth || elW
    const vh = video.videoHeight || elH
    const videoAspect = vw / vh
    const elAspect = elW / elH

    let renderW = elW
    let renderH = elH
    let offsetX = video.offsetLeft
    let offsetY = video.offsetTop

    if (elAspect > videoAspect) {
      renderW = elH * videoAspect
      offsetX += (elW - renderW) / 2
    } else {
      renderH = elW / videoAspect
      offsetY += (elH - renderH) / 2
    }

    setVideoContentBox({
      left: Math.round(offsetX),
      top: Math.round(offsetY),
      width: Math.round(renderW),
      height: Math.round(renderH),
    })
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    updateVideoContentBox()
    const ro = new ResizeObserver(() => updateVideoContentBox())
    ro.observe(video)
    if (video.parentElement) ro.observe(video.parentElement)
    window.addEventListener('resize', updateVideoContentBox)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateVideoContentBox)
    }
  }, [updateVideoContentBox, videoResolution])

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
      setTimeout(updateVideoContentBox, 30)
    }
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const cur = videoRef.current.currentTime || 0
    const prev = prevTimeRef.current
    prevTimeRef.current = cur
    setCurrentTime(cur)

    // Clear lastStoppedCheckpointRef once playback moves past that checkpoint by > 0.55s
    if (lastStoppedCheckpointRef.current !== null && detections.length > 0) {
      const stoppedDet = detections.find((d) => d.id === lastStoppedCheckpointRef.current)
      if (!stoppedDet || Math.abs(cur - stoppedDet.timecode) > 0.55) {
        lastStoppedCheckpointRef.current = null
      }
    }

    // When B-Box is enabled, automatically pause playback when reaching any violation checkpoint
    if (showBoundingBox && isPlaying && detections.length > 0) {
      for (const det of detections) {
        const crossed = prev < det.timecode && cur >= det.timecode && cur - prev < 1.2
        const diff = Math.abs(cur - det.timecode)
        if ((crossed || diff <= 0.28) && lastStoppedCheckpointRef.current !== det.id) {
          lastStoppedCheckpointRef.current = det.id
          videoRef.current.pause()
          videoRef.current.currentTime = det.timecode
          prevTimeRef.current = det.timecode
          setCurrentTime(det.timecode)
          setIsPlaying(false)
          break
        }
      }
    }
  }

  const handlePlayPauseToggle = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      // Do NOT clear lastStoppedCheckpointRef here if we are currently sitting on that checkpoint,
      // so resuming playback can move past it smoothly without immediately re-pausing
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  // Seek handler from timeline click/scrub
  const handleSeek = (targetTime) => {
    if (!videoRef.current) return
    const clamped = Math.max(0, Math.min(duration, targetTime))
    const matchingDet = detections.find((d) => Math.abs(clamped - d.timecode) <= 0.35)
    lastStoppedCheckpointRef.current = matchingDet ? matchingDet.id : null
    prevTimeRef.current = clamped
    videoRef.current.currentTime = clamped
    setCurrentTime(clamped)
  }

  // Jump to start
  const handleJumpToStart = () => {
    lastStoppedCheckpointRef.current = null
    handleSeek(0)
  }

  // Jump to end
  const handleJumpToEnd = () => {
    lastStoppedCheckpointRef.current = null
    handleSeek(duration)
  }

  // Move left to previous detected checkpoint (or beginning if none)
  const handlePrevCheckpoint = () => {
    lastStoppedCheckpointRef.current = null
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
    lastStoppedCheckpointRef.current = null
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
          bboxLabel: det.bboxLabel || det.label,
          bboxNorm: det.bboxNorm,
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
          ? selectedIntervals.map((inv) => {
              const matchingDet = detections.find((d) => d.id === inv.detectionId)
              return {
                timecode: inv.timecode !== undefined ? inv.timecode : (inv.start + inv.end) / 2,
                label: inv.label || matchingDet?.label || 'Нарушение кассовой дисциплины',
                bboxLabel: inv.bboxLabel || matchingDet?.bboxLabel || inv.label || matchingDet?.label,
                bboxNorm: inv.bboxNorm || matchingDet?.bboxNorm,
              }
            })
          : [
              {
                timecode: currentTime,
                label: currentActiveViolation?.label || detections[0]?.label || 'Кассовая зона',
                bboxLabel:
                  currentActiveViolation?.bboxLabel ||
                  currentActiveViolation?.label ||
                  detections[0]?.bboxLabel ||
                  detections[0]?.label ||
                  'Кассовая зона',
                bboxNorm: currentActiveViolation?.bboxNorm || detections[0]?.bboxNorm,
              },
            ]

      const liveVideo = videoRef.current
      const canUseLiveDirect =
        targets.length === 1 &&
        liveVideo &&
        liveVideo.readyState >= 2 &&
        Math.abs((liveVideo.currentTime || 0) - targets[0].timecode) < 0.08

      let offVideo = null
      if (!canUseLiveDirect) {
        offVideo = document.createElement('video')
        offVideo.crossOrigin = 'anonymous'
        offVideo.muted = true
        offVideo.playsInline = true
        offVideo.preload = 'auto'
        offVideo.src = videoData?.url

        await new Promise((resolve, reject) => {
          offVideo.onloadeddata = () => resolve()
          offVideo.onerror = (e) => reject(e)
          setTimeout(resolve, 3000)
        })
      }

      const sourceVideo = canUseLiveDirect ? liveVideo : offVideo
      const canvas = document.createElement('canvas')
      canvas.width = sourceVideo.videoWidth || videoResolution?.width || 1280
      canvas.height = sourceVideo.videoHeight || videoResolution?.height || 720
      const ctx = canvas.getContext('2d')

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i]
        if (!canUseLiveDirect && offVideo) {
          const clampedTc = Math.max(0, Math.min(duration || 30, target.timecode))
          if (Math.abs(offVideo.currentTime - clampedTc) > 0.02) {
            offVideo.currentTime = clampedTc
            await new Promise((resolve) => {
              const onSeeked = () => {
                offVideo.removeEventListener('seeked', onSeeked)
                resolve()
              }
              offVideo.addEventListener('seeked', onSeeked)
              setTimeout(resolve, 2000)
            })
          }
        }

        ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height)

        // Draw Bounding Box onto exported frame if showBoundingBox is enabled
        if (showBoundingBox) {
          const detMatch = detections.find(
            (d) => Math.abs(d.timecode - target.timecode) <= 2.0 && d.bboxNorm?.length === 4
          )
          const bbox =
            target.bboxNorm?.length === 4
              ? target.bboxNorm
              : detMatch?.bboxNorm?.length === 4
              ? detMatch.bboxNorm
              : [0.24, 0.40, 0.54, 0.53]

          if (bbox && bbox.length === 4) {
            const bx = Math.round(bbox[0] * canvas.width)
            const by = Math.round(bbox[1] * canvas.height)
            const bw = Math.round((bbox[2] - bbox[0]) * canvas.width)
            const bh = Math.round((bbox[3] - bbox[1]) * canvas.height)

            ctx.save()
            // Bounding box outline
            ctx.strokeStyle = '#F43F5E'
            ctx.lineWidth = Math.max(3, Math.round(canvas.width / 400))
            ctx.strokeRect(bx, by, bw, bh)

            // Semi-transparent highlight
            ctx.fillStyle = 'rgba(244, 63, 94, 0.12)'
            ctx.fillRect(bx, by, bw, bh)

            // Corner brackets
            const cLen = Math.max(10, Math.round(bw * 0.15))
            ctx.strokeStyle = '#FFFFFF'
            ctx.lineWidth = Math.max(2, Math.round(ctx.lineWidth * 0.8))
            ctx.beginPath()
            ctx.moveTo(bx, by + cLen); ctx.lineTo(bx, by); ctx.lineTo(bx + cLen, by)
            ctx.moveTo(bx + bw - cLen, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cLen)
            ctx.moveTo(bx, by + bh - cLen); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cLen, by + bh)
            ctx.moveTo(bx + bw - cLen, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cLen)
            ctx.stroke()

            // Tag badge
            const badgeTitle =
              target.bboxLabel ||
              detMatch?.bboxLabel ||
              detMatch?.label ||
              target.label ||
              'КАССОВАЯ ЗОНА'
            const labelText = `НАРУШЕНИЕ: ${badgeTitle}`
            const fontSize = Math.max(13, Math.round(canvas.width / 75))
            ctx.font = `bold ${fontSize}px sans-serif`
            const textWidth = ctx.measureText(labelText).width
            const bannerH = fontSize + 12
            const bannerY = Math.max(4, by - bannerH - 4)

            ctx.fillStyle = 'rgba(15, 17, 23, 0.92)'
            ctx.fillRect(bx, bannerY, textWidth + 18, bannerH)
            ctx.strokeStyle = '#F43F5E'
            ctx.lineWidth = 1.5
            ctx.strokeRect(bx, bannerY, textWidth + 18, bannerH)

            ctx.fillStyle = '#FFFFFF'
            ctx.textBaseline = 'middle'
            ctx.fillText(labelText, bx + 9, bannerY + bannerH / 2)
            ctx.restore()
          }
        }

        const dataUrl = canvas.toDataURL('image/png')
        const a = document.createElement('a')
        const baseName = videoData?.name ? videoData.name.replace(/\.[^/.]+$/, '') : 'frame'
        const tcFormatted = target.timecode.toFixed(2).replace('.', '_')
        a.download = `${baseName}_frame_${tcFormatted}s${showBoundingBox ? '_bbox' : ''}.png`
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
          ? selectedIntervals.map((inv) => {
              const matchingDet = detections.find((d) => d.id === inv.detectionId)
              return {
                start: inv.start,
                end: inv.end,
                peak_sec: inv.timecode || (inv.start + inv.end) / 2,
                bbox_norm: inv.bboxNorm || matchingDet?.bboxNorm || [0.24, 0.40, 0.54, 0.53],
              }
            })
          : [
              {
                start: trimRange[0],
                end: trimRange[1],
                peak_sec: detections.length > 0 ? detections[0].timecode : null,
                bbox_norm:
                  currentActiveViolation?.bboxNorm ||
                  detections[0]?.bboxNorm || [0.24, 0.40, 0.54, 0.53],
                events:
                  detections.length > 0
                    ? detections.map((d) => ({
                        peak_sec: d.timecode,
                        bbox_norm: d.bboxNorm || [0.24, 0.40, 0.54, 0.53],
                      }))
                    : undefined,
              },
            ]

      let fileToCompile = videoData?.file
      if (!fileToCompile && videoData?.url) {
        const resBlob = await fetch(videoData.url).then((r) => r.blob())
        fileToCompile = new File([resBlob], videoData.name || 'video.mp4', { type: 'video/mp4' })
      }

      if (!fileToCompile) {
        throw new Error('Видеофайл недоступен')
      }

      const blob = await compileVideoCuts(fileToCompile, cuts, showBoundingBox)
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const baseName = videoData?.name ? videoData.name.replace(/\.[^/.]+$/, '') : 'video'
      a.download = `${baseName}_violations_sequence_${cuts.length}cuts${showBoundingBox ? '_bbox' : ''}.mp4`
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
              const tc = v.timecode_sec ?? v.relative_timecode_sec ?? 0
              const bboxNorm =
                v.bbox_norm ||
                v.evidence_bbox?.bbox_norm ||
                v.evidence_frames?.[0]?.bbox_norm || [0.24, 0.40, 0.54, 0.53]
              const bboxLabel =
                v.bbox_label ||
                v.evidence_bbox?.label ||
                v.type ||
                'Зона нарушения'
              return {
                id: i + 1,
                timecode: parseFloat(Number(tc).toFixed(1)),
                label: v.type || 'Нарушение кассовой дисциплины',
                bboxLabel,
                lawRef: v.regulation_reference?.clause_ref || v.regulation_reference?.article || 'НБРК',
                confidence: v.confidence,
                ruleCode: v.rule_code,
                regulation: v.regulation_reference,
                bboxNorm,
                evidenceFrames: v.evidence_frames,
              }
            })

            setDetections(mapped)
            setAnalysisStatus('done')
            setIsAnalyzing(false)

            // If B-Box is already enabled when detections arrive and video is paused, seek to first violation
            if (showBoundingBox && mapped.length > 0 && videoRef.current && videoRef.current.paused) {
              handleSeek(mapped[0].timecode)
            }
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

  // Active violation at current time for B-Box rendering and auto-pause
  const currentActiveViolation = (() => {
    const matchDet = detections.find((d) => Math.abs(currentTime - d.timecode) <= 2.0)
    if (matchDet) {
      return {
        ...matchDet,
        bboxLabel: matchDet.bboxLabel || matchDet.label || 'Зона нарушения',
        bboxNorm:
          matchDet.bboxNorm && matchDet.bboxNorm.length === 4
            ? matchDet.bboxNorm
            : [0.24, 0.40, 0.54, 0.53],
      }
    }

    const activeInv = selectedIntervals.find((inv) => currentTime >= inv.start && currentTime <= inv.end)
    if (activeInv) {
      const parentDet = detections.find((d) => d.id === activeInv.detectionId)
      return {
        id: activeInv.id,
        label: activeInv.label || parentDet?.label || 'Зона нарушения',
        bboxLabel: activeInv.bboxLabel || parentDet?.bboxLabel || activeInv.label || 'Зона нарушения',
        bboxNorm: activeInv.bboxNorm || parentDet?.bboxNorm || [0.24, 0.40, 0.54, 0.53],
      }
    }

    return null
  })()

  const handleToggleBoundingBox = () => {
    setShowBoundingBox((prev) => {
      const next = !prev
      if (next && !isPlaying && !currentActiveViolation && detections.length > 0) {
        handleSeek(detections[0].timecode)
      }
      return next
    })
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

          {/* Pixel-exact Bounding Box Overlay aligned to rendered video content rectangle */}
          {showBoundingBox && currentActiveViolation && currentActiveViolation.bboxNorm && videoContentBox && (
            <div
              className="absolute pointer-events-none z-20"
              style={{
                left: `${videoContentBox.left}px`,
                top: `${videoContentBox.top}px`,
                width: `${videoContentBox.width}px`,
                height: `${videoContentBox.height}px`,
              }}
            >
              <div
                className="absolute pointer-events-none transition-all duration-100"
                style={{
                  left: `${currentActiveViolation.bboxNorm[0] * 100}%`,
                  top: `${currentActiveViolation.bboxNorm[1] * 100}%`,
                  width: `${(currentActiveViolation.bboxNorm[2] - currentActiveViolation.bboxNorm[0]) * 100}%`,
                  height: `${(currentActiveViolation.bboxNorm[3] - currentActiveViolation.bboxNorm[1]) * 100}%`,
                }}
              >
                {/* Outlined box with hairline corners */}
                <div className="absolute inset-0 border-2 border-rose-500 bg-rose-500/10 rounded-sm" />
                <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-rose-400" />
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-rose-400" />
                <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-rose-400" />
                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-rose-400" />

                {/* Badge Tag */}
                <div className="absolute -top-6 left-0 px-2 py-0.5 rounded bg-zinc-950/95 border border-rose-500/50 text-rose-300 font-mono text-[10px] tracking-wide whitespace-nowrap shadow-lg flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>{currentActiveViolation.bboxLabel || currentActiveViolation.label || 'Зона нарушения'}</span>
                </div>
              </div>
            </div>
          )}

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
            showBoundingBox={showBoundingBox}
            onToggleBoundingBox={handleToggleBoundingBox}
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
                  <div className="px-5 py-2.5 flex items-center justify-between text-[11px] font-mono text-gray-500 dark:text-zinc-400 uppercase tracking-wider border-b border-gray-200/30 dark:border-[#1A1E26] bg-gray-50/30 dark:bg-[#0E1116]/40">
                    <span>Обнаружено нарушений:</span>
                    <span className="text-sky-500 dark:text-sky-400 font-semibold">
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
