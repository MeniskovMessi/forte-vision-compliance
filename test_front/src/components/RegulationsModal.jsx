import React, { useState, useEffect } from 'react'
import { BookOpen, ExternalLink, Search, X, ChevronRight } from 'lucide-react'
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

  if (!isOpen) return null

  const categories = [
    { id: 'all', label: 'Все нормативы' },
    { id: 'safe', label: 'Сейф' },
    { id: 'laptop', label: 'Ноутбук' },
    { id: 'cash', label: 'Пересчет денег' },
    { id: 'inkass', label: 'Инкассация' },
    { id: 'door', label: 'Доступ и дверь' },
  ]

  const filtered = regulations.filter((r) => {
    const q = search.toLowerCase()
    const matchesQuery =
      !q ||
      r.rule_code?.toLowerCase().includes(q) ||
      r.violation_type?.toLowerCase().includes(q) ||
      r.normative_text?.toLowerCase().includes(q)

    if (!matchesQuery) return false

    if (category === 'safe') return r.rule_code?.includes('SAFE')
    if (category === 'laptop') return r.rule_code?.includes('LAPTOP')
    if (category === 'cash') return r.rule_code?.includes('CASH') || r.rule_code?.includes('COUNT')
    if (category === 'inkass') return r.rule_code?.includes('BAG') || r.rule_code?.includes('INKASS')
    if (category === 'door') return r.rule_code?.includes('DOOR') || r.rule_code?.includes('PARTY')

    return true
  })

  const currentRule = filtered[selectedIdx] || filtered[0] || null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-5xl w-full h-[620px] bg-white dark:bg-[#12151B] rounded-xl border border-gray-200 dark:border-[#22272E] shadow-xl flex flex-col overflow-hidden text-gray-900 dark:text-gray-100">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-gray-200 dark:border-[#22272E] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-[#9D1D53]" />
            <span className="font-semibold text-sm">Нормативная база НБРК</span>
            <span className="text-xs text-gray-400 font-mono">({regulations.length} правил)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1C2028]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Master-Detail Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Filter & List (320px) */}
          <div className="w-80 border-r border-gray-200 dark:border-[#22272E] flex flex-col bg-gray-50/50 dark:bg-[#0E1015]">
            {/* Search Input */}
            <div className="p-3 border-b border-gray-200 dark:border-[#22272E]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по нормативам..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setSelectedIdx(0)
                  }}
                  className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs bg-white dark:bg-[#16191E] border border-gray-200 dark:border-[#22272E] placeholder-gray-400 focus:outline-none focus:border-[#9D1D53]"
                />
              </div>

              {/* Category Chips */}
              <div className="flex flex-wrap gap-1 mt-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.id)
                      setSelectedIdx(0)
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                      category === cat.id
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-[#1C2028]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-[#1C2028]">
              {loading ? (
                <p className="p-4 text-xs text-gray-400 font-mono text-center">Загрузка...</p>
              ) : filtered.length === 0 ? (
                <p className="p-4 text-xs text-gray-400 text-center">Ничего не найдено</p>
              ) : (
                filtered.map((r, idx) => {
                  const isSelected = (filtered[selectedIdx] || filtered[0]) === r
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedIdx(idx)}
                      className={`w-full text-left px-3.5 py-2.5 transition flex items-center justify-between text-xs ${
                        isSelected
                          ? 'bg-white dark:bg-[#16191E] font-medium text-gray-900 dark:text-white border-l-2 border-[#9D1D53]'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-[#16191E]/60'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="block font-mono text-[10px] text-gray-400 uppercase">
                          {r.rule_code}
                        </span>
                        <span className="truncate block mt-0.5">{r.violation_type}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Rule Detail Pane */}
          <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-[#12151B]">
            {currentRule ? (
              <div className="space-y-4 max-w-2xl">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-gray-100 dark:bg-[#1C2028] text-gray-600 dark:text-gray-300">
                    {currentRule.rule_code}
                  </span>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mt-1.5">
                    {currentRule.violation_type}
                  </h3>
                </div>

                <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-[#0E1015] border border-gray-200 dark:border-[#22272E] space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300">
                    <span>Пункт регламента: {currentRule.clause_ref}</span>
                    {currentRule.adilet_url && (
                      <a
                        href={currentRule.adilet_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center space-x-1 text-[#9D1D53] hover:underline font-mono text-[11px]"
                      >
                        <span>Открыть adilet.zan.kz</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-mono">
                    {currentRule.doc_title}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-gray-400 font-mono block mb-1.5">
                    Нормативное требование закона:
                  </label>
                  <blockquote className="p-3.5 rounded-lg border-l-2 border-[#9D1D53] bg-gray-50 dark:bg-[#0E1015] text-xs text-gray-700 dark:text-gray-300 leading-relaxed italic">
                    «{currentRule.normative_text}»
                  </blockquote>
                </div>
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
