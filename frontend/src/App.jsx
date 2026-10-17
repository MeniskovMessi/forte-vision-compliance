import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import Screensaver from './components/Screensaver'
import UploadDropzone from './components/UploadDropzone'
import VideoEditor from './components/VideoEditor'

export default function App() {
  // Theme state: read from localStorage, default to 'light'
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('prism-theme')
      return saved === 'dark'
    } catch (e) {
      return false
    }
  })

  // Screensaver state & main page reveal coordination
  const [showScreensaver, setShowScreensaver] = useState(true)
  const [isManualScreensaver, setIsManualScreensaver] = useState(false)
  const [screensaverKey, setScreensaverKey] = useState(0)
  const [contentRevealed, setContentRevealed] = useState(false)

  // Uploaded video state
  const [uploadedVideo, setUploadedVideo] = useState(null)

  // Persist theme to localStorage and sync 'dark' class on html
  useEffect(() => {
    try {
      if (darkMode) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('prism-theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('prism-theme', 'light')
      }
    } catch (e) {}
  }, [darkMode])

  const toggleTheme = () => {
    setDarkMode((prev) => !prev)
  }

  const handleReplayIntro = () => {
    setContentRevealed(false)
    setIsManualScreensaver(true)
    setScreensaverKey((prev) => prev + 1)
    setShowScreensaver(true)
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0D0F12] text-[#111827] dark:text-[#EDEDEF] transition-colors flex flex-col font-sans overflow-x-hidden">
      {/* Screensaver Overlay (Auto on first visit, interactive on demand) */}
      {showScreensaver && (
        <Screensaver
          key={screensaverKey}
          darkMode={darkMode}
          manualDismiss={isManualScreensaver}
          onStartExit={() => setContentRevealed(true)}
          onComplete={() => {
            setShowScreensaver(false)
            setIsManualScreensaver(false)
          }}
          isReplaying={screensaverKey}
        />
      )}

      {/* Main Page Content (Coordinated smooth blur & fade-in reveal into sharp focus) */}
      <div
        style={{
          transition: 'opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1), filter 0.65s cubic-bezier(0.16, 1, 0.3, 1), transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'opacity, filter, transform',
          opacity: contentRevealed ? 1 : 0,
          filter: contentRevealed ? 'blur(0px)' : 'blur(14px)',
          transform: contentRevealed ? 'scale(1)' : 'scale(0.992)',
        }}
        className="flex-1 flex flex-col h-screen overflow-hidden"
      >
        {/* Main Header */}
        <Header
          darkMode={darkMode}
          onToggleTheme={toggleTheme}
          onReplayIntro={handleReplayIntro}
        />

        {/* View Switcher: Upload Dropzone vs Unscrollable Editor UI */}
        {!uploadedVideo ? (
          <>
            <main className="flex-1 flex flex-col items-center justify-center overflow-y-auto">
              <UploadDropzone
                onVideoSelect={(data) => setUploadedVideo(data)}
                darkMode={darkMode}
              />
            </main>

            {/* Footer on upload view */}
            <footer className="border-t border-gray-200 dark:border-[#22272E] py-3 px-6 text-center text-xs font-mono text-gray-400">
              <p>PRISM • ForteBank Кассовый контроль • Нормативная база adilet.zan.kz</p>
            </footer>
          </>
        ) : (
          <VideoEditor
            videoData={uploadedVideo}
            onBack={() => setUploadedVideo(null)}
            darkMode={darkMode}
          />
        )}
      </div>
    </div>
  )
}
