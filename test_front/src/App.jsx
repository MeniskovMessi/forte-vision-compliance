import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import Screensaver from './components/Screensaver'
import VideoUploaderAndTrimmer from './components/VideoUploaderAndTrimmer'
import CCTVPlayer from './components/CCTVPlayer'
import ViolationInspector from './components/ViolationInspector'
import ExportStudio from './components/ExportStudio'
import RegulationsModal from './components/RegulationsModal'
import HistoryDrawer from './components/HistoryDrawer'
import {
  checkHealth,
  submitVideoAnalysis,
  pollJobDetailed,
  getVideoStreamUrl,
} from './services/api'
import { Play, Sparkles, AlertCircle, ShieldCheck } from 'lucide-react'

export default function App() {
  // Theme state: Light theme by default (main), dark theme as alternative
  const [darkMode, setDarkMode] = useState(false)

  // Screensaver state
  const [showScreensaver, setShowScreensaver] = useState(true)
  const [screensaverKey, setScreensaverKey] = useState(0)

  // System & Health
  const [health, setHealth] = useState(null)

  // Video & Analysis State
  const [currentFile, setCurrentFile] = useState(null)
  const [videoSrc, setVideoSrc] = useState(null)
  const [videoMetadata, setVideoMetadata] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [jobId, setJobId] = useState(null)
  const [jobData, setJobData] = useState(null)
  const [analysisError, setAnalysisError] = useState(null)

  // Interaction State
  const [selectedViolation, setSelectedViolation] = useState(null)
  const [replayTrigger, setReplayTrigger] = useState(0)
  const [selectedForCompile, setSelectedForCompile] = useState([])

  // Modals
  const [isRegulationsOpen, setIsRegulationsOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  // Sync dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  // Initial health check
  useEffect(() => {
    checkHealth()
      .then(setHealth)
      .catch((e) => console.warn('Health check warning:', e))
  }, [])

  // When a local file is picked, set object URL for instant smooth video playback
  useEffect(() => {
    if (currentFile) {
      const url = URL.createObjectURL(currentFile)
      setVideoSrc(url)
      return () => URL.revokeObjectURL(url)
    } else if (jobId) {
      setVideoSrc(getVideoStreamUrl(jobId))
    } else {
      setVideoSrc(null)
    }
  }, [currentFile, jobId])

  // Trigger screensaver replay
  const handleReplayIntro = () => {
    setScreensaverKey((prev) => prev + 1)
    setShowScreensaver(true)
  }

  // Handle Video Analysis Submission
  const handleAnalyze = async ({ file, startSec, endSec, saveTrimmedOnly }) => {
    setIsAnalyzing(true)
    setAnalysisError(null)
    setJobData(null)
    setSelectedViolation(null)
    setSelectedForCompile([])

    try {
      const res = await submitVideoAnalysis(file, {
        startSec,
        endSec,
        saveTrimmedOnly,
      })
      const submittedJobId = res.job_id
      setJobId(submittedJobId)

      // Poll until completed
      let attempts = 0
      const pollInterval = setInterval(async () => {
        attempts++
        try {
          const detailed = await pollJobDetailed(submittedJobId)
          if (detailed.status === 'done') {
            clearInterval(pollInterval)
            setJobData(detailed)
            setIsAnalyzing(false)
            if (detailed.violations?.length > 0) {
              setSelectedViolation(detailed.violations[0])
              // Select all violations for compilation by default
              setSelectedForCompile(detailed.violations.map((_, i) => i))
            }
          } else if (detailed.status === 'failed') {
            clearInterval(pollInterval)
            setAnalysisError(detailed.error_message || 'Анализ завершился с ошибкой')
            setIsAnalyzing(false)
          }
        } catch (pollErr) {
          console.warn('Poll error:', pollErr)
        }

        if (attempts > 120) {
          clearInterval(pollInterval)
          setAnalysisError('Таймаут ожидания анализа видео (превышено 60 секунд)')
          setIsAnalyzing(false)
        }
      }, 500)
    } catch (err) {
      setAnalysisError(err.message || 'Ошибка отправки видео')
      setIsAnalyzing(false)
    }
  }

  // Multi-cut compile toggles
  const handleToggleCompileSelection = (idx) => {
    setSelectedForCompile((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    )
  }

  const handleSelectAllForCompile = () => {
    if (jobData?.violations) {
      setSelectedForCompile(jobData.violations.map((_, i) => i))
    }
  }

  const handleClearCompileSelection = () => {
    setSelectedForCompile([])
  }

  // Re-load a past job from history
  const handleSelectJobFromHistory = (loadedJob) => {
    setJobId(loadedJob.job_id)
    setJobData(loadedJob)
    setCurrentFile(null)
    setVideoSrc(getVideoStreamUrl(loadedJob.job_id))
    if (loadedJob.violations?.length > 0) {
      setSelectedViolation(loadedJob.violations[0])
      setSelectedForCompile(loadedJob.violations.map((_, i) => i))
    } else {
      setSelectedViolation(null)
      setSelectedForCompile([])
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 transition-colors flex flex-col font-sans">
      {/* 1-Second Screensaver Overlay */}
      {showScreensaver && (
        <Screensaver
          key={screensaverKey}
          onComplete={() => setShowScreensaver(false)}
          isReplaying={screensaverKey}
        />
      )}

      {/* Main Header */}
      <Header
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onReplayIntro={handleReplayIntro}
        onOpenRegulations={() => setIsRegulationsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        health={health}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Upload & Range Trimmer Section */}
        <VideoUploaderAndTrimmer
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
          currentFile={currentFile}
          setCurrentFile={setCurrentFile}
          videoMetadata={videoMetadata}
          setVideoMetadata={setVideoMetadata}
        />

        {/* Error Alert */}
        {analysisError && (
          <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 flex items-center space-x-2 text-xs font-mono">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{analysisError}</span>
          </div>
        )}

        {/* Video Player & Violation Inspector Workspace (Rendered when video is ready or analysis done) */}
        {(videoSrc || jobData) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: CCTV Cinema Player */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  CCTV Видеоплеер с T-5с авто-повтором
                </span>
                {selectedViolation && (
                  <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400">
                    Таргет: #{selectedViolation.relative_timecode_sec ?? selectedViolation.timecode_sec}с
                  </span>
                )}
              </div>

              <CCTVPlayer
                videoSrc={videoSrc}
                jobData={jobData}
                selectedViolation={selectedViolation}
                onSelectViolation={setSelectedViolation}
                replayTrigger={replayTrigger}
              />

              {/* Export Studio below player */}
              {jobData && jobData.violations?.length > 0 && (
                <ExportStudio
                  jobId={jobId}
                  selectedViolation={selectedViolation}
                  violations={jobData.violations}
                  selectedForCompile={selectedForCompile}
                  onSelectAllForCompile={handleSelectAllForCompile}
                  onClearCompileSelection={handleClearCompileSelection}
                />
              )}
            </div>

            {/* Right 5 Columns: Verdict & Legal Violation Inspector */}
            <div className="lg:col-span-5 space-y-4">
              <ViolationInspector
                jobData={jobData}
                selectedViolation={selectedViolation}
                onSelectViolation={setSelectedViolation}
                onTriggerReplay={() => setReplayTrigger((prev) => prev + 1)}
                selectedForCompile={selectedForCompile}
                onToggleCompileSelection={handleToggleCompileSelection}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-4 px-6 text-center text-xs font-mono text-slate-500 dark:text-slate-400 mt-12">
        <p>
          PRISM • ForteBank AI Vision Compliance Platform • 100% Local Execution • NBRK Regulations
          (adilet.zan.kz)
        </p>
      </footer>

      {/* Modals */}
      <RegulationsModal
        isOpen={isRegulationsOpen}
        onClose={() => setIsRegulationsOpen(false)}
      />
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectJob={handleSelectJobFromHistory}
      />
    </div>
  )
}
