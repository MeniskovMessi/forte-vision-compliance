import React, { useState, useEffect } from 'react'
import { BookOpen, ExternalLink, Search, X, Scale } from 'lucide-react'
import { fetchRegulations } from '../services/api'

export default function RegulationsModal({ isOpen, onClose }) {
  const [regulations, setRegulations] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetchRegulations()
      .then((data) => setRegulations(data.regulations || []))
      .catch((err) => console.error('Failed to load regulations:', err))
      .finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  const filtered = regulations.filter((r) => {
    const q = search.toLowerCase()
    return (
      r.rule_code?.toLowerCase().includes(q) ||
      r.violation_type?.toLowerCase().includes(q) ||
      r.normative_text?.toLowerCase().includes(q) ||
      r.clause_ref?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-4xl w-full max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Нормативно-Правовая База РК (adilet.zan.kz)
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                16 правил Национального Банка РК для обоснования в pgvector RAG
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по нормативам (сейф, ноутбук, инкассатор, пересчет, adilet)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        {/* Regulations List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {loading ? (
            <p className="text-xs text-slate-400 font-mono text-center py-8">
              Загрузка нормативных актов из PostgreSQL...
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-slate-400 font-mono text-center py-8">
              Ничего не найдено по запросу «{search}»
            </p>
          ) : (
            filtered.map((r, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {r.rule_code}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {r.violation_type}
                    </span>
                  </div>
                  {r.adilet_url && (
                    <a
                      href={r.adilet_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center space-x-1 text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-mono whitespace-nowrap"
                    >
                      <span>{r.clause_ref || 'adilet.zan.kz'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {r.doc_title}
                </p>
                <blockquote className="text-slate-700 dark:text-slate-300 italic border-l-2 border-rose-500 pl-2 text-[11px]">
                  «{r.normative_text}»
                </blockquote>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
