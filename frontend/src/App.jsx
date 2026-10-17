import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import Screensaver from './components/Screensaver'

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
        className="flex-1 flex flex-col min-h-screen"
      >
        {/* Main Header */}
        <Header
          darkMode={darkMode}
          onToggleTheme={toggleTheme}
          onReplayIntro={handleReplayIntro}
        />

      {/* Main Workspace (Clean foundation for step-by-step feature development) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col items-center justify-center text-center">
        <div className="max-w-xl p-8 rounded-xl border border-gray-200 dark:border-[#22272E] bg-white dark:bg-[#16191E] shadow-sm space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#9D1D53]" />
            <span className="font-semibold tracking-[0.2em] text-sm uppercase">PRISM</span>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Система видеоконтроля кассовой зоны
          </h2>

          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-sans">
            Главный экран инициализирован в стиле Linear. Текущая тема:{' '}
            <strong className="text-gray-800 dark:text-gray-200 font-mono">
              {darkMode ? 'Тёмная' : 'Светлая'}
            </strong>{' '}
            (сохраняется в памяти браузера).
          </p>

          <div className="pt-2 flex items-center justify-center space-x-3 text-xs font-mono text-gray-400">
            <span className="px-2 py-1 rounded bg-gray-100 dark:bg-[#0E1015] border border-gray-200 dark:border-[#22272E]">
              frontend/
            </span>
            <span>•</span>
            <span className="px-2 py-1 rounded bg-gray-100 dark:bg-[#0E1015] border border-gray-200 dark:border-[#22272E]">
              Linear High-Density
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-[#22272E] py-3.5 px-6 text-center text-xs font-mono text-gray-400">
        <p>PRISM • ForteBank Кассовый контроль • Нормативная база НБРК</p>
      </footer>
      </div>
    </div>
  )
}
