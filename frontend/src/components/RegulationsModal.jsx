import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Scale,
  Search,
  X,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  ShieldCheck,
  FileText,
  Eye,
  ChevronLeft,
  Loader2,
} from 'lucide-react'
import { fetchRegulations } from '../services/api'

export default function RegulationsModal({ isOpen, onClose }) {
  const [regulations, setRegulations] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fetch regulations on open
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetchRegulations()
      .then((data) => {
        const regs = data.regulations || []
        setRegulations(regs)
        setSelectedIdx(0)
      })
      .catch((err) => {
        console.error('Failed to load regulations:', err)
      })
      .finally(() => setLoading(false))
  }, [isOpen])

  // Category definitions tailored to RK banking regulations
  const categories = [
    { id: 'all', label: 'Все нормативы' },
    { id: 'safe', label: 'Сейф и ключи' },
    { id: 'cash', label: 'Кассовый узел и деньги' },
    { id: 'terminal', label: 'Терминал и ПО' },
    { id: 'security', label: 'Доступ и охрана' },
  ]

  // Filter regulations by search query and category
  const filteredRegulations = useMemo(() => {
    return regulations.filter((r) => {
      const q = search.trim().toLowerCase()
      const matchesSearch =
        !q ||
        r.rule_code?.toLowerCase().includes(q) ||
        r.violation_type?.toLowerCase().includes(q) ||
        r.normative_text?.toLowerCase().includes(q) ||
        r.clause_ref?.toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (activeCategory === 'safe') {
        return (
          r.rule_code?.includes('SAFE') ||
          r.rule_code?.includes('KEY') ||
          r.violation_type?.toLowerCase().includes('сейф') ||
          r.violation_type?.toLowerCase().includes('ключ')
        )
      }
      if (activeCategory === 'cash') {
        return (
          r.rule_code?.includes('CASH') ||
          r.rule_code?.includes('COUNT') ||
          r.violation_type?.toLowerCase().includes('наличн') ||
          r.violation_type?.toLowerCase().includes('денег') ||
          r.violation_type?.toLowerCase().includes('пересчет')
        )
      }
      if (activeCategory === 'terminal') {
        return (
          r.rule_code?.includes('TERMINAL') ||
          r.rule_code?.includes('SCREEN') ||
          r.rule_code?.includes('PHONE') ||
          r.violation_type?.toLowerCase().includes('терминал') ||
          r.violation_type?.toLowerCase().includes('телефон')
        )
      }
      if (activeCategory === 'security') {
        return (
          r.rule_code?.includes('DOOR') ||
          r.rule_code?.includes('BARRIER') ||
          r.rule_code?.includes('SMOK') ||
          r.violation_type?.toLowerCase().includes('двер') ||
          r.violation_type?.toLowerCase().includes('клиент') ||
          r.violation_type?.toLowerCase().includes('барьер')
        )
      }

      return true
    })
  }, [regulations, search, activeCategory])

  const currentRule = filteredRegulations[selectedIdx] || filteredRegulations[0] || null

  // Keyboard navigation: Escape to close, Up/Down arrows to step through items
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((prev) => Math.min(filteredRegulations.length - 1, prev + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((prev) => Math.max(0, prev - 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredRegulations.length, onClose])

  // Copy legal excerpt to clipboard
  const handleCopyCitation = useCallback(() => {
    if (!currentRule) return
    const textToCopy = `[${currentRule.clause_ref}] ${currentRule.doc_title}\n«${currentRule.normative_text}»\nИсточник: ${currentRule.adilet_url || 'adilet.zan.kz'}`
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [currentRule])

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 transition-all duration-150 animate-in fade-in"
    >
      {/* Modal Dialog Window */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl h-[88vh] max-h-[720px] min-h-[500px] bg-white dark:bg-[#0D0F13] rounded-xl border border-gray-200/80 dark:border-[#1E232B] shadow-2xl flex flex-col overflow-hidden text-gray-900 dark:text-gray-100 select-none animate-in zoom-in-[0.98] duration-150"
      >
        {/* ========================================================================= */}
        {/* 1. MODAL TOP HEADER: Understated studio aesthetic                         */}
        {/* ========================================================================= */}
        <div className="h-12 px-5 border-b border-gray-200/50 dark:border-[#1A1E26] bg-gray-50/50 dark:bg-[#090B0E] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            {/* Gray Scale Icon */}
            <Scale className="w-4 h-4 text-gray-400 dark:text-zinc-500 shrink-0" />
            <span className="font-semibold text-xs uppercase tracking-wider text-gray-900 dark:text-white font-mono">
              Нормативная база РК
            </span>
            <span className="text-gray-300 dark:text-zinc-700">/</span>
            <span className="text-[11px] font-mono text-gray-500 dark:text-zinc-400">
              Национальный Банк Республики Казахстан
            </span>
            <span className="hidden md:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-200/50 dark:bg-[#161922] text-gray-600 dark:text-zinc-400">
              adilet.zan.kz
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-800 text-gray-400 dark:text-zinc-500">
              ESC
            </kbd>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#181C24] transition"
              title="Закрыть окно (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. SEARCH & CATEGORY FILTER STRIP                                         */}
        {/* ========================================================================= */}
        <div className="px-5 py-2.5 border-b border-gray-200/40 dark:border-[#1A1E26] bg-white dark:bg-[#0D0F13] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Поиск по нормативам..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSelectedIdx(0)
              }}
              className="w-full pl-8 pr-7 py-1 text-xs bg-gray-50/70 dark:bg-[#14171E] border border-gray-200/70 dark:border-[#222730] rounded-md placeholder-gray-400 dark:placeholder-zinc-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-zinc-600 font-mono transition"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('')
                  setSelectedIdx(0)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Category Filter Pills (Minimalist Linear style, no neon) */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 sm:pb-0">
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id)
                    setSelectedIdx(0)
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition whitespace-nowrap ${
                    isActive
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
                      : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#161922]'
                  }`}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. SPLIT PANE MASTER-DETAIL BODY                                          */}
        {/* ========================================================================= */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* ----------------------------------------------------------------------- */}
          {/* LEFT COLUMN: Clean Master List (360px)                                  */}
          {/* ----------------------------------------------------------------------- */}
          <div className="w-full sm:w-80 md:w-92 shrink-0 border-r border-gray-200/40 dark:border-[#1A1E26] bg-gray-50/20 dark:bg-[#0A0D11] flex flex-col overflow-y-auto divide-y divide-gray-200/30 dark:divide-[#151922]">
            {loading ? (
              <div className="p-8 flex flex-col items-center justify-center space-y-2 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="text-xs font-mono">Загрузка регламентов...</span>
              </div>
            ) : filteredRegulations.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-gray-400">
                Нормативы не найдены
              </div>
            ) : (
              filteredRegulations.map((rule, idx) => {
                const isSelected = (filteredRegulations[selectedIdx] || filteredRegulations[0])?.id === rule.id
                return (
                  <button
                    key={rule.id || idx}
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full text-left px-4 py-3 transition flex items-center justify-between text-xs relative ${
                      isSelected
                        ? 'bg-white dark:bg-[#131720] border-l-2 border-[#9D1D53] text-gray-900 dark:text-white font-medium'
                        : 'border-l-2 border-transparent text-gray-600 dark:text-zinc-400 hover:bg-gray-100/60 dark:hover:bg-[#11141B]'
                    }`}
                  >
                    <div className="truncate pr-2 space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-semibold truncate max-w-[150px]">
                          {rule.clause_ref}
                        </span>
                        <span className="text-[9px] font-mono text-gray-400 dark:text-zinc-500 uppercase truncate">
                          #{rule.id}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2 leading-snug">
                        {rule.violation_type}
                      </div>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${isSelected ? 'text-[#9D1D53] translate-x-0.5' : 'text-gray-300 dark:text-zinc-600'}`} />
                  </button>
                )
              })
            )}
          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* RIGHT COLUMN: Rule Detail Inspector Pane                                */}
          {/* ----------------------------------------------------------------------- */}
          <div className="flex-1 min-w-0 bg-white dark:bg-[#0D0F13] p-6 sm:p-7 overflow-y-auto flex flex-col justify-between">
            {currentRule ? (
              <div className="space-y-5 max-w-2xl">
                {/* Meta Bar */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-gray-200/30 dark:border-[#1A1E26]">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-gray-100 dark:bg-[#161922] text-gray-600 dark:text-zinc-400 border border-gray-200/50 dark:border-[#202530]">
                    {currentRule.rule_code}
                  </span>

                  <div className="flex items-center space-x-2">
                    {/* Copy Citation Button */}
                    <button
                      onClick={handleCopyCitation}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#161922] transition"
                      title="Скопировать нормативную цитату"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500">Скопировано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Копировать</span>
                        </>
                      )}
                    </button>

                    {/* Open adilet.zan.kz */}
                    {currentRule.adilet_url && (
                      <a
                        href={currentRule.adilet_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono text-[#9D1D53] dark:text-[#E05285] hover:underline"
                        title="Открыть первоисточник в Эталонном контрольном банке НПА РК"
                      >
                        <span>adilet.zan.kz</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Primary Violation Type Heading */}
                <div>
                  <div className="text-[11px] font-mono text-sky-600 dark:text-sky-400 font-semibold mb-1">
                    {currentRule.clause_ref}
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white leading-snug">
                    {currentRule.violation_type}
                  </h2>
                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1 font-mono">
                    {currentRule.doc_title}
                  </div>
                </div>

                {/* Official Legal Excerpt Callout */}
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-zinc-500 font-semibold">
                    <FileText className="w-3 h-3" />
                    <span>Официальное требование регламента (НБРК)</span>
                  </div>
                  <div className="p-4 rounded-lg border-l-2 border-[#9D1D53] bg-gray-50 dark:bg-[#12151D] text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-sans">
                    «{currentRule.normative_text}»
                  </div>
                </div>

                {/* Visual Pattern for AI / CCTV Detection */}
                {currentRule.visual_pattern && (
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-zinc-500 font-semibold">
                      <Eye className="w-3 h-3" />
                      <span>Паттерн контроля компьютерным зрением (CCTV)</span>
                    </div>
                    <div className="p-3.5 rounded-lg border border-gray-200/50 dark:border-[#1E232B] bg-gray-50/50 dark:bg-[#0E1116] text-xs text-gray-600 dark:text-zinc-400 leading-relaxed font-mono">
                      {currentRule.visual_pattern}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400 font-mono">
                Выберите норматив в списке слева
              </div>
            )}

            {/* Stepper Navigation Footer */}
            {filteredRegulations.length > 1 && (
              <div className="pt-4 mt-6 border-t border-gray-200/40 dark:border-[#1A1E26] flex items-center justify-between text-xs font-mono text-gray-400 dark:text-zinc-500">
                <div className="flex items-center space-x-1">
                  <span>Правило {selectedIdx + 1} из {filteredRegulations.length}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setSelectedIdx((prev) => Math.max(0, prev - 1))}
                    disabled={selectedIdx === 0}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#181C24] disabled:opacity-30 disabled:pointer-events-none transition"
                    title="Предыдущее правило"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedIdx((prev) => Math.min(filteredRegulations.length - 1, prev + 1))}
                    disabled={selectedIdx === filteredRegulations.length - 1}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#181C24] disabled:opacity-30 disabled:pointer-events-none transition"
                    title="Следующее правило"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
