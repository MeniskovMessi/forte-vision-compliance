import React, { useState, useEffect, useMemo } from 'react'
import {
  BookOpen,
  ExternalLink,
  Search,
  X,
  ChevronRight,
  Copy,
  Check,
  Scale,
  ShieldCheck,
} from 'lucide-react'
import { fetchRegulations } from '../services/api'

export default function RegulationsModal({ isOpen, onClose }) {
  const [regulations, setRegulations] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fetch regulations from backend when modal opens
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetchRegulations()
      .then((data) => {
        setRegulations(data.regulations || [])
        setSelectedIdx(0)
      })
      .catch((err) => console.error('Failed to load regulations:', err))
      .finally(() => setLoading(false))
  }, [isOpen])

  // Escape key listener to close modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Category definitions for Republic of Kazakhstan banking regulations
  const categories = [
    { id: 'all', label: 'Все правила' },
    { id: 'safe', label: 'Сейф и ценности' },
    { id: 'cash', label: 'Касса и пересчет' },
    { id: 'door', label: 'Помещение и доступ' },
    { id: 'security', label: 'Безопасность и ПК' },
  ]

  // Filter regulations based on search query and category
  const filtered = useMemo(() => {
    return regulations.filter((r) => {
      const q = search.trim().toLowerCase()
      const matchesQuery =
        !q ||
        r.rule_code?.toLowerCase().includes(q) ||
        r.violation_type?.toLowerCase().includes(q) ||
        r.normative_text?.toLowerCase().includes(q) ||
        r.clause_ref?.toLowerCase().includes(q)

      if (!matchesQuery) return false

      if (category === 'safe') {
        return (
          r.rule_code?.includes('SAFE') ||
          r.rule_code?.includes('VALUABLE') ||
          r.rule_code?.includes('KEY')
        )
      }
      if (category === 'cash') {
        return (
          r.rule_code?.includes('CASH') ||
          r.rule_code?.includes('COUNT') ||
          r.rule_code?.includes('CLIENT') ||
          r.rule_code?.includes('SORT')
        )
      }
      if (category === 'door') {
        return (
          r.rule_code?.includes('DOOR') ||
          r.rule_code?.includes('BARRIER') ||
          r.rule_code?.includes('ROOM') ||
          r.rule_code?.includes('BAG') ||
          r.rule_code?.includes('INKASS')
        )
      }
      if (category === 'security') {
        return (
          r.rule_code?.includes('LAPTOP') ||
          r.rule_code?.includes('PHONE') ||
          r.rule_code?.includes('SMOK') ||
          r.rule_code?.includes('SECURITY')
        )
      }

      return true
    })
  }, [regulations, search, category])

  const currentRule = filtered[selectedIdx] || filtered[0] || null

  // Copy citation to clipboard
  const handleCopyCitation = () => {
    if (!currentRule) return
    const citation = `${currentRule.doc_title} (${currentRule.clause_ref}): «${currentRule.normative_text}» [Источник: ${currentRule.adilet_url}]`
    navigator.clipboard.writeText(citation)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-150"
    >
      {/* Modal Dialog Window */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl h-[620px] max-h-[92vh] bg-white dark:bg-[#0D0F13] rounded-xl border border-gray-200/80 dark:border-[#1E232B] shadow-2xl flex flex-col overflow-hidden text-gray-900 dark:text-gray-100"
      >
        {/* ========================================================================= */}
        {/* MODAL HEADER: Clean hairline divider, minimal gray icon & esc hint       */}
        {/* ========================================================================= */}
        <div className="h-12 px-5 border-b border-gray-200/40 dark:border-[#1A1E26] bg-gray-50/50 dark:bg-[#0E1116] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <Scale className="w-4 h-4 text-gray-400 dark:text-zinc-500 shrink-0" />
            <span className="font-semibold text-xs uppercase tracking-wider text-gray-800 dark:text-gray-200 font-mono">
              Нормативная база Республики Казахстан
            </span>
            <span className="text-gray-300 dark:text-zinc-700">|</span>
            <span className="text-[11px] text-gray-400 dark:text-zinc-500 font-mono">
              НБРК • adilet.zan.kz ({regulations.length} норм)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-[#161920] border border-gray-200 dark:border-zinc-800 rounded">
              ESC
            </kbd>
            <button
              onClick={onClose}
              className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-[#1A1E26] transition"
              title="Закрыть окно (Escape)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL BODY: Two-Column Master-Detail Studio Layout                        */}
        {/* ========================================================================= */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* 
            LEFT COLUMN: Directory & Filter (w-80 sm:w-88)
            Hairline borders, no floating nested cards
          */}
          <div className="w-80 sm:w-88 shrink-0 border-r border-gray-200/40 dark:border-[#1A1E26] flex flex-col bg-gray-50/30 dark:bg-[#0B0D11]">
            {/* Search Input */}
            <div className="p-3 border-b border-gray-200/40 dark:border-[#1A1E26]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                <input
                  type="text"
                  placeholder="Поиск по статьям и нормам..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setSelectedIdx(0)
                  }}
                  className="w-full pl-9 pr-7 py-1.5 rounded-md text-xs bg-white dark:bg-[#13161D] border border-gray-200/80 dark:border-[#202530] placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-gray-400 dark:focus:border-zinc-500 transition text-gray-900 dark:text-gray-100"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Category Filter Pills (hairline line design) */}
              <div className="flex flex-wrap gap-1 mt-2.5">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.id)
                      setSelectedIdx(0)
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                      category === cat.id
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-950 font-semibold'
                        : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-[#161920]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Regulations */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-200/30 dark:divide-[#161922]">
              {loading ? (
                <div className="p-8 text-center text-xs text-gray-400 font-mono">
                  Загрузка регламентов НБРК...
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  По запросу «{search}» ничего не найдено
                </div>
              ) : (
                filtered.map((r, idx) => {
                  const isSelected = (filtered[selectedIdx] || filtered[0]) === r
                  return (
                    <button
                      key={r.id || idx}
                      onClick={() => setSelectedIdx(idx)}
                      className={`w-full text-left px-4 py-3 transition flex items-center justify-between text-xs border-l-2 ${
                        isSelected
                          ? 'bg-white dark:bg-[#14171E] font-medium text-gray-900 dark:text-white border-[#9D1D53]'
                          : 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-[#11141A]'
                      }`}
                    >
                      <div className="truncate pr-2 space-y-0.5">
                        <div className="flex items-center space-x-2 text-[10px] font-mono text-gray-400 dark:text-zinc-500">
                          <span className="truncate">{r.clause_ref || 'НПА РК'}</span>
                        </div>
                        <div className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                          {r.violation_type}
                        </div>
                        <div className="text-[10px] font-mono text-gray-400 dark:text-zinc-500 truncate">
                          {r.rule_code}
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-600 shrink-0" />
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* 
            RIGHT COLUMN: Regulation Detail Inspector
            Clear typographic hierarchy, hairline dividers
          */}
          <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-[#0D0F13] flex flex-col justify-between">
            {currentRule ? (
              <div className="space-y-5 max-w-3xl">
                {/* Rule Header Bar */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-200/40 dark:border-[#1A1E26]">
                  <div className="space-y-1">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-gray-100 dark:bg-[#181B24] text-gray-600 dark:text-zinc-300 border border-gray-200/60 dark:border-[#22272E]">
                      {currentRule.rule_code}
                    </span>
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white leading-snug pt-1">
                      {currentRule.violation_type}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={handleCopyCitation}
                      className="flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] font-mono text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1C2028] border border-gray-200/80 dark:border-[#22272E] transition"
                      title="Скопировать цитату и ссылку в буфер обмена"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500">Скопировано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-gray-400" />
                          <span>Цитата</span>
                        </>
                      )}
                    </button>

                    {currentRule.adilet_url && (
                      <a
                        href={currentRule.adilet_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] font-mono text-[#9D1D53] dark:text-[#E05285] hover:bg-[#9D1D53]/10 border border-[#9D1D53]/30 transition"
                        title="Открыть официальный документ на портале adilet.zan.kz"
                      >
                        <span>adilet.zan.kz</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Document & Clause Source */}
                <div className="p-3.5 rounded-lg border border-gray-200/50 dark:border-[#1E232B] bg-gray-50/40 dark:bg-[#101319] space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-gray-800 dark:text-gray-200">
                    <span className="font-mono text-[#9D1D53] dark:text-[#E05285]">
                      {currentRule.clause_ref}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500">
                      Нормативный правовой акт РК
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-sans">
                    {currentRule.doc_title}
                  </p>
                </div>

                {/* Normative Text Requirement */}
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 font-mono">
                    Нормативное требование закона:
                  </div>
                  <blockquote className="p-3.5 rounded-lg border-l-2 border-[#9D1D53] bg-gray-50/50 dark:bg-[#101319] text-xs text-gray-800 dark:text-gray-200 leading-relaxed italic">
                    «{currentRule.normative_text}»
                  </blockquote>
                </div>

                {/* Visual Pattern / AI Perception Trigger */}
                {currentRule.visual_pattern && (
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 font-mono">
                      <ShieldCheck className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                      <span>Логика детекции компьютерным зрением (PRISM AI):</span>
                    </div>
                    <div className="p-3 rounded-lg border border-gray-200/40 dark:border-[#1E232B] bg-gray-50/20 dark:bg-[#0B0D11] text-[11px] font-mono text-gray-600 dark:text-gray-400 leading-relaxed">
                      {currentRule.visual_pattern}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400 font-mono">
                Выберите норматив из списка слева
              </div>
            )}

            {/* Bottom Status Footnote */}
            <div className="pt-4 mt-6 border-t border-gray-200/30 dark:border-[#1A1E26] flex items-center justify-between text-[10px] font-mono text-gray-400 dark:text-zinc-500">
              <span>Синхронизировано с базой adilet.zan.kz и pgvector</span>
              <span>PRISM Compliance v1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
