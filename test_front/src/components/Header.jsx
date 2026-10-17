import React from 'react'
import { Sun, Moon, BookOpen, Clock, Play } from 'lucide-react'

export default function Header({
  darkMode,
  setDarkMode,
  onReplayIntro,
  onOpenRegulations,
  onOpenHistory,
  health,
}) {
  const isServerOk = health?.status === 'ok'

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-[#22272E] bg-white/95 dark:bg-[#0D0F12]/95 backdrop-blur-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="font-semibold tracking-[0.2em] text-sm sm:text-base font-sans text-gray-900 dark:text-white">
              PRISM
            </span>
            <span className="text-gray-300 dark:text-gray-700">/</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              ForteBank • Контроль кассовой зоны
            </span>
          </div>
        </div>

        {/* Center / Status */}
        <div className="hidden md:flex items-center space-x-2 text-xs font-mono text-gray-500 dark:text-gray-400">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isServerOk ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span>{isServerOk ? 'Сервер активен' : 'Подключение...'}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Regulations Knowledge Base */}
          <button
            onClick={onOpenRegulations}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1C2028] transition"
            title="Нормативные акты НБРК"
          >
            <BookOpen className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden sm:inline">Нормативы РК</span>
          </button>

          {/* Audit History */}
          <button
            onClick={onOpenHistory}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1C2028] transition"
            title="Журнал проверок"
          >
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden sm:inline">Журнал</span>
          </button>

          {/* Replay Screensaver */}
          <button
            onClick={onReplayIntro}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1C2028] transition"
            title="Заставка Prism"
          >
            <Play className="w-3.5 h-3.5" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1C2028] transition"
            title={darkMode ? 'Светлая тема' : 'Тёмная тема'}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </header>
  )
}
