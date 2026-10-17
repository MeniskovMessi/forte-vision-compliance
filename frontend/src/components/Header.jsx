import React from 'react'
import { Sun, Moon, Play } from 'lucide-react'

export default function Header({ darkMode, onToggleTheme, onReplayIntro }) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/40 dark:border-white/[0.04] bg-white/95 dark:bg-[#0D0F12]/95 backdrop-blur-sm transition-colors shrink-0">
      <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <span className="font-semibold tracking-[0.2em] text-sm sm:text-base font-sans text-gray-900 dark:text-white">
            PRISM
          </span>
          <span className="text-gray-300 dark:text-gray-700">/</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            ForteBank • Контроль кассовой зоны
          </span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Replay Screensaver */}
          <button
            onClick={onReplayIntro}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1C2028] transition"
            title="Запустить заставку Prism"
          >
            <Play className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Заставка</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1C2028] transition"
            title={darkMode ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </header>
  )
}
