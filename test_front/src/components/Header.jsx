import React from 'react'
import { Sun, Moon, Sparkles, BookOpen, Clock, Activity, ShieldCheck, Play } from 'lucide-react'

export default function Header({
  darkMode,
  setDarkMode,
  onReplayIntro,
  onOpenRegulations,
  onOpenHistory,
  health,
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#090D16]/80 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-[#9D1D53] flex items-center justify-center text-white shadow-sm shadow-rose-500/20">
              <span className="font-bold text-sm tracking-wider">P</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-[0.16em] text-lg font-sans text-slate-900 dark:text-white">
                  PRISM
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-900/50">
                  ForteBank
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden sm:block">
                Cash Discipline Vision AI Platform
              </p>
            </div>
          </div>
        </div>

        {/* Center / Status */}
        <div className="hidden md:flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                health?.status === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>
              {health?.status === 'ok' ? '100% Local Pipeline Ready' : 'Connecting Engine...'}
            </span>
          </div>

          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
            <span>Adilet NBRK Grounding</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Regulations Knowledge Base */}
          <button
            onClick={onOpenRegulations}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Republic of Kazakhstan Banking Regulations"
          >
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Нормативы РК</span>
          </button>

          {/* Audit History */}
          <button
            onClick={onOpenHistory}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Analysis History & Metrics"
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">История</span>
          </button>

          {/* Replay Screensaver */}
          <button
            onClick={onReplayIntro}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Повторить заставку Prism"
          >
            <Play className="w-4 h-4" />
          </button>

          {/* Theme Toggle (Light Main / Dark Alternative) */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
            title={darkMode ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </div>
    </header>
  )
}
