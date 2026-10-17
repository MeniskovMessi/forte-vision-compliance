import React, { useState, useEffect } from 'react'
import { BookOpen, ExternalLink, Search, X, ChevronRight, Scale, ShieldCheck } from 'lucide-react'
import { fetchRegulations } from '../services/api'

export default function RegulationsModal({ isOpen, onClose }) {
  const [regulations, setRegulations] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(false)

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

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const categories = [
    { id: 'all', label: 'Все нормативы' },
    { id: 'safe', label: 'Сейф' },
    { id: 'cash', label: 'Пересчет и касса' },
    { id: 'laptop', label: 'Ноутбук и экран' },
    { id: 'security', label: 'Безопасность и доступ' },
    { id: 'inkass', label: 'Инкассация' },
  ]

  const filtered = regulations.filter((r) => {
    const q = search.toLowerCase()
    const matchesQuery =
      !q ||
      r.rule_code?.toLowerCase().includes(q) ||
      r.violation_type?.toLowerCase().includes(q) ||
      r.normative_text?.toLowerCase().includes(q) ||
      r.clause_ref?.toLowerCase().includes(q)

    if (!matchesQuery) return false

    if (category === 'safe') return r.rule_code?.includes('SAFE')
    if (category === 'cash') return r.rule_code?.includes('CASH') || r.rule_code?.includes('COUNT')
    if (category === 'laptop') return r.rule_code?.includes('LAPTOP')
    if (category === 'security') return r.rule_code?.includes('SECURITY') || r.rule_code?.includes('DOOR') || r.rule_code?.includes('PHONE')
    if (category === 'inkass') return r.rule_code?.includes('BAG') || r.rule_code?.includes('INKASS')

    return true
  })

  const currentRule = filtered[selectedIdx] || filtered[0] || null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-5xl w-full h-[620px] max-h-[90vh] bg-white dark:bg-[#0E1116] rounded-xl border border-gray-200/80 dark:border-[#1E232B] shadow-2xl flex flex-col overflow-hidden text-gray-900 dark:text-gray-100"
      >
        {/* Modal Header */}
        <div className="h-12 px-5 border-b border-gray-200/50 dark:border-[#1E232B] bg-gray-50/40 dark:bg-[#0A0D12] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <Scale className="w-4 h-4 text-[#9D1D53]" />
            <span className="font-semibold text-xs uppercase tracking-wider font-mono">
              Нормативная база НБРК (Республика Казахстан)
            </span>
            <span className="text-[11px] text-gray-400 font-mono">
              ({regulations.length} регламентов • adilet.zan.kz)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-[#1C2028] transition"
            title="Закрыть (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Master-Detail Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Column: Search & Regulations List (340px) */}
          <div className="w-80 sm:w-88 shrink-0 border-r border-gray-200/50 dark:border-[#1E232B] flex flex-col bg-gray-50/30 dark:bg-[#0A0D12]/60">
            {/* Search Input & Category Chips */}
            <div className="p-3 border-b border-gray-200/50 dark:border-[#1E232B] space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск регламента или статьи..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setSelectedIdx(0)
                  }}
                  className="w-full pl-8 pr-3 py-1.5 rounded text-xs bg-white dark:bg-[#14171E] border border-gray-200/80 dark:border-[#22272E] text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#9D1D53]"
                />
              </div>

              {/* Category Filter Chips */}
              <div className="flex flex-wrap gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.id)
                      setSelectedIdx(0)
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                      category === cat.id
                        ? 'bg-[#9D1D53] text-white'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-[#1C2028]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Regulations List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-200/30 dark:divide-[#1A1E26]">
              {loading ? (
                <p className="p-4 text-xs text-gray-400 font-mono text-center">Загрузка базы НБРК...</p>
              ) : filtered.length === 0 ? (
                <p className="p-4 text-xs text-gray-400 text-center py-8">Нормативы не найдены</p>
              ) : (
                filtered.map((r, idx) => {
                  const isSelected = (filtered[selectedIdx] || filtered[0]) === r
                  return (
                    <button
                      key={r.id || idx}
                      onClick={() => setSelectedIdx(idx)}
                      className={`w-full text-left px-3.5 py-2.5 transition flex items-center justify-between text-xs group ${
                        isSelected
                          ? 'bg-white dark:bg-[#14171E] font-medium text-gray-900 dark:text-white border-l-2 border-[#9D1D53]'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-[#14171E]/60'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="block font-mono text-[9px] text-[#9D1D53] dark:text-[#E05285] font-semibold uppercase">
                          {r.rule_code}
                        </span>
                        <span className="truncate block mt-0.5 text-xs text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white">
                          {r.violation_type}
                        </span>
                        <span className="block text-[10px] text-gray-400 dark:text-zinc-500 font-mono mt-0.5">
                          {r.clause_ref}
                        </span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 shrink-0" />
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed Regulation View */}
          <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-[#0E1116]">
            {currentRule ? (
              <div className="space-y-4 max-w-2xl">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-gray-100 dark:bg-[#161920] text-[#9D1D53] dark:text-[#E05285] font-semibold border border-gray-200/60 dark:border-[#22272E]">
                    {currentRule.rule_code}
                  </span>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mt-1.5 leading-snug">
                    {currentRule.violation_type}
                  </h3>
                </div>

                {/* Metadata Card: Clause & Official Source Link */}
                <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-[#12151B] border border-gray-200/50 dark:border-[#1E232B] space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-gray-800 dark:text-gray-200">
                    <span className="font-mono text-sky-600 dark:text-sky-400 font-semibold">
                      Пункт регламента: {currentRule.clause_ref}
                    </span>
                    {currentRule.adilet_url && (
                      <a
                        href={currentRule.adilet_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center space-x-1 text-[#9D1D53] dark:text-[#E05285] hover:underline font-mono text-[11px]"
                      >
                        <span>adilet.zan.kz</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed font-sans">
                    {currentRule.doc_title}
                  </p>
                </div>

                {/* Legal Requirement Text */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-gray-400 font-mono block mb-1.5">
                    Нормативное требование закона:
                  </label>
                  <blockquote className="p-3.5 rounded-lg border-l-2 border-[#9D1D53] bg-gray-50 dark:bg-[#12151B] text-xs text-gray-700 dark:text-gray-300 leading-relaxed italic">
                    «{currentRule.normative_text}»
                  </blockquote>
                </div>

                {/* Visual Pattern Description */}
                {currentRule.visual_pattern && (
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-gray-400 font-mono block mb-1.5">
                      Визуальный паттерн детекции AI:
                    </label>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#12151B] border border-gray-200/50 dark:border-[#1E232B] text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
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
          </div>
        </div>
      </div>
    </div>
  )
}
