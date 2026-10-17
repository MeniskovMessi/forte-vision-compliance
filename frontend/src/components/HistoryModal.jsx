import React, { useState, useEffect, useMemo } from 'react'
import {
  History,
  Search,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileVideo,
  Download,
  ExternalLink,
  Scale,
  Eye,
  Maximize2,
} from 'lucide-react'
import { fetchJobsList, pollJobDetailed } from '../services/api'

function formatMMSS(seconds = 0) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function formatDateTime(isoString) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return isoString
  }
}

const VERDICT_FILTERS = [
  { id: 'ALL', label: 'Все проверки' },
  { id: 'violation', label: 'Нарушения' },
  { id: 'no_violation', label: 'Без нарушений' },
]

export default function HistoryModal({ isOpen, onClose }) {
  const [jobs, setJobs] = useState([])
  const [summary, setSummary] = useState(null)
  const [loadingList, setLoadingList] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [detailedJob, setDetailedJob] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [verdictFilter, setVerdictFilter] = useState('ALL')
  const [previewFrame, setPreviewFrame] = useState(null)

  const loadJobs = () => {
    setLoadingList(true)
    fetchJobsList(100)
      .then((data) => {
        const list = Array.isArray(data?.jobs) ? data.jobs : []
        setJobs(list)
        setSummary(data?.summary || null)
        if (list.length > 0 && !selectedJobId) {
          setSelectedJobId(list[0].job_id)
        }
      })
      .catch((err) => {
        console.error('Failed to load jobs history:', err)
      })
      .finally(() => setLoadingList(false))
  }

  useEffect(() => {
    if (!isOpen) return
    loadJobs()
  }, [isOpen])

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return jobs.filter((j) => {
      if (verdictFilter !== 'ALL' && j.verdict !== verdictFilter) return false
      if (!q) return true
      return (
        j.filename?.toLowerCase().includes(q) ||
        j.job_id?.toLowerCase().includes(q) ||
        j.verdict?.toLowerCase().includes(q)
      )
    })
  }, [jobs, searchQuery, verdictFilter])

  const activeJobSummary = useMemo(() => {
    return (
      filteredJobs.find((j) => j.job_id === selectedJobId) ||
      filteredJobs[0] ||
      null
    )
  }, [filteredJobs, selectedJobId])

  // Load detailed job record whenever activeJobSummary changes
  useEffect(() => {
    if (!isOpen || !activeJobSummary?.job_id) {
      setDetailedJob(null)
      return
    }
    let cancelled = false
    setLoadingDetail(true)
    pollJobDetailed(activeJobSummary.job_id)
      .then((detail) => {
        if (!cancelled) setDetailedJob(detail)
      })
      .catch(() => {
        if (!cancelled) setDetailedJob(activeJobSummary)
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, activeJobSummary?.job_id])

  // Keyboard navigation (Escape, ArrowUp, ArrowDown)
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (previewFrame) {
          setPreviewFrame(null)
        } else {
          onClose()
        }
      } else if (e.key === 'ArrowDown' && filteredJobs.length > 0 && !previewFrame) {
        e.preventDefault()
        const idx = filteredJobs.findIndex((j) => j.job_id === activeJobSummary?.job_id)
        const next = filteredJobs[(idx + 1) % filteredJobs.length]
        if (next) setSelectedJobId(next.job_id)
      } else if (e.key === 'ArrowUp' && filteredJobs.length > 0 && !previewFrame) {
        e.preventDefault()
        const idx = filteredJobs.findIndex((j) => j.job_id === activeJobSummary?.job_id)
        const prev = filteredJobs[(idx - 1 + filteredJobs.length) % filteredJobs.length]
        if (prev) setSelectedJobId(prev.job_id)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredJobs, activeJobSummary, previewFrame, onClose])

  if (!isOpen) return null

  const activeData = detailedJob || activeJobSummary
  const violations = Array.isArray(activeData?.violations) ? activeData.violations : []
  const isViolation = activeData?.verdict === 'violation' || violations.length > 0

  const handleExportJson = () => {
    if (!activeData) return
    const payload = {
      job_id: activeData.job_id,
      filename: activeData.filename,
      status: activeData.status,
      verdict: activeData.verdict,
      created_at: activeData.created_at,
      processing_time_sec: activeData.processing_time_sec,
      violations: violations.map((v) => ({
        type: v.type,
        timecode_sec: v.timecode_sec,
        description: v.description,
        rule_code: v.rule_code,
        confidence: v.confidence,
        regulation_reference: v.regulation_reference,
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_${activeData.filename || activeData.job_id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      {/* Strict Line-Design Modal Frame */}
      <div
        className="w-full max-w-6xl h-[82vh] max-h-[760px] bg-white dark:bg-[#0D0F12] border border-gray-200 dark:border-[#1C2029] rounded-md shadow-2xl flex flex-col overflow-hidden text-gray-900 dark:text-[#EDEDEF]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header Bar (h-10, crisp hairline bottom border) */}
        <div className="h-10 px-4 border-b border-gray-200/70 dark:border-[#1C2029] bg-gray-50/70 dark:bg-[#0B0D10] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <History className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-400 shrink-0" />
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-gray-800 dark:text-zinc-200 font-semibold truncate">
              Журнал проверок видеозаписей
            </span>
            <span className="text-gray-300 dark:text-zinc-700 font-mono text-xs">/</span>
            <span className="text-[11px] font-mono text-gray-500 dark:text-zinc-400 tabular-nums">
              PostgreSQL • Всего: {summary?.total_jobs ?? jobs.length}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadJobs}
              className="px-2 py-1 rounded-sm text-[10px] font-mono text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-200/50 dark:hover:bg-[#161A22] transition flex items-center space-x-1"
              title="Обновить журнал"
            >
              <RefreshCw className={`w-3 h-3 ${loadingList ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Обновить</span>
            </button>
            <div className="h-3.5 w-[1px] bg-gray-200 dark:bg-[#1C2029]" />
            <button
              onClick={onClose}
              className="p-1 rounded text-gray-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-gray-200/50 dark:hover:bg-[#161A22] transition"
              title="Закрыть (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Sub-Toolbar: Search Input + Verdict Filter Strip (Hairline Grid) */}
        <div className="border-b border-gray-200/70 dark:border-[#1C2029] bg-white dark:bg-[#0D0F12] flex flex-col sm:flex-row sm:items-center justify-between shrink-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-200/70 dark:divide-[#1C2029]">
          {/* Search Box */}
          <div className="relative sm:w-80 lg:w-96 shrink-0">
            <Search className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени файла или ID проверки..."
              className="w-full h-9 pl-9 pr-7 bg-transparent text-xs text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Verdict Filter Tabs */}
          <div className="flex-1 flex items-center justify-between px-2.5 h-9 overflow-x-auto no-scrollbar">
            <div className="flex items-center space-x-1">
              {VERDICT_FILTERS.map((tab) => {
                const active = verdictFilter === tab.id
                const count =
                  tab.id === 'ALL'
                    ? jobs.length
                    : jobs.filter((j) => j.verdict === tab.id).length
                return (
                  <button
                    key={tab.id}
                    onClick={() => setVerdictFilter(tab.id)}
                    className={`px-2.5 h-6 rounded-sm text-[11px] font-mono whitespace-nowrap transition flex items-center space-x-1.5 ${
                      active
                        ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium'
                        : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-[#161A22]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] tabular-nums ${
                        active
                          ? 'text-gray-300 dark:text-zinc-600'
                          : 'text-gray-400 dark:text-zinc-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <span className="hidden lg:inline text-[10px] font-mono text-gray-400 dark:text-zinc-500">
              ↑↓ выбор записи • ESC закрыть
            </span>
          </div>
        </div>

        {/* Main Split Body: Left Job List + Right Audit Inspection Pane */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left Column: Hairline Job History List */}
          <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-gray-200/70 dark:border-[#1C2029] flex flex-col min-h-0 bg-gray-50/30 dark:bg-[#0B0D10]/60 shrink-0">
            <div className="px-3.5 py-2 border-b border-gray-200/60 dark:border-[#1C2029] flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500">
              <span>Записи журнала ({filteredJobs.length})</span>
              <span>Статус / Время</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-200/50 dark:divide-[#1C2029]">
              {loadingList && jobs.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-xs font-mono text-gray-400 dark:text-zinc-500">
                    Загрузка журнала проверок...
                  </p>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-xs font-mono text-gray-400 dark:text-zinc-500">
                    Записи не найдены
                  </p>
                </div>
              ) : (
                filteredJobs.map((job, idx) => {
                  const isSelected = activeJobSummary?.job_id === job.job_id
                  const hasViolation = job.verdict === 'violation'
                  const vCount = job.violations_count ?? 0

                  return (
                    <button
                      key={job.job_id}
                      onClick={() => setSelectedJobId(job.job_id)}
                      className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-start space-x-2.5 border-l-2 ${
                        isSelected
                          ? 'bg-white dark:bg-[#141820] border-l-gray-900 dark:border-l-zinc-100'
                          : 'border-l-transparent hover:bg-gray-100/60 dark:hover:bg-[#11141B]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                          hasViolation ? 'bg-red-500' : 'bg-emerald-500'
                        }`}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs truncate ${
                              isSelected
                                ? 'text-gray-900 dark:text-white font-semibold'
                                : 'text-gray-800 dark:text-zinc-200 font-medium'
                            }`}
                          >
                            {job.filename || `Видео #${idx + 1}`}
                          </span>
                          <span
                            className={`text-[10px] font-mono shrink-0 tabular-nums ${
                              hasViolation
                                ? 'text-red-600 dark:text-red-400 font-semibold'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {hasViolation ? `Нарушений: ${vCount || 1}` : 'Норма'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-gray-400 dark:text-zinc-500">
                          <span>ID: {job.job_id}</span>
                          <span className="tabular-nums">{formatDateTime(job.created_at)}</span>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Full-Width Line-Design Audit Report View */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-white dark:bg-[#0D0F12] divide-y divide-gray-200/60 dark:divide-[#1C2029]">
            {!activeData ? (
              <div className="h-full flex items-center justify-center p-8 text-xs font-mono text-gray-400 dark:text-zinc-500">
                Выберите запись в журнале слева для просмотра отчёта
              </div>
            ) : (
              <>
                {/* 1. Top Verdict & Export Bar */}
                <div className="px-5 py-3 bg-gray-50/40 dark:bg-[#0B0D10]/50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    {isViolation ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                    <span
                      className={`text-xs font-semibold ${
                        isViolation
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isViolation
                        ? 'Обнаружены признаки возможных нарушений'
                        : 'Нарушение не обнаружено'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleExportJson}
                      className="px-2.5 py-1 rounded-sm border border-gray-200 dark:border-[#1C2029] text-[11px] font-mono text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-[#161A22] transition flex items-center space-x-1.5"
                      title="Скачать JSON отчёт проверки"
                    >
                      <Download className="w-3 h-3" />
                      <span>Экспорт JSON</span>
                    </button>
                  </div>
                </div>

                {/* 2. 4-Cell Hairline Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-200/60 dark:divide-[#1C2029]">
                  <div className="px-4 py-2.5 space-y-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500 block">
                      Видеофайл
                    </span>
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <FileVideo className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="text-xs font-medium text-gray-900 dark:text-zinc-100 truncate">
                        {activeData.filename || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 space-y-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500 block">
                      Job ID
                    </span>
                    <span className="text-xs font-mono text-gray-800 dark:text-zinc-200 block truncate">
                      {activeData.job_id}
                    </span>
                  </div>

                  <div className="px-4 py-2.5 space-y-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500 block">
                      Время обработки
                    </span>
                    <span className="text-xs font-mono tabular-nums text-gray-800 dark:text-zinc-200 block">
                      {activeData.processing_time_sec != null
                        ? `${Number(activeData.processing_time_sec).toFixed(2)} сек`
                        : '—'}
                    </span>
                  </div>

                  <div className="px-4 py-2.5 space-y-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500 block">
                      Дата проверки
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-gray-700 dark:text-zinc-300 block truncate">
                      {formatDateTime(activeData.created_at)}
                    </span>
                  </div>
                </div>

                {/* 3. Violations List or Clean Status */}
                {loadingDetail ? (
                  <div className="p-8 text-center text-xs font-mono text-gray-400 dark:text-zinc-500">
                    Загрузка деталей отчёта...
                  </div>
                ) : violations.length === 0 ? (
                  <div className="px-5 py-10 text-center space-y-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                    <p className="text-xs font-medium text-gray-800 dark:text-zinc-200">
                      Нарушений кассовой дисциплины на видеозаписи не выявлено
                    </p>
                    <p className="text-[11px] font-mono text-gray-400 dark:text-zinc-500">
                      Все действия кассира соответствуют требованиям НБ РК (adilet.zan.kz)
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200/60 dark:divide-[#1C2029]">
                    {violations.map((v, vIdx) => {
                      const reg = v.regulation_reference || {}
                      const frames = Array.isArray(v.evidence_frames) ? v.evidence_frames : []

                      return (
                        <div
                          key={vIdx}
                          className="divide-y divide-gray-200/40 dark:divide-[#1C2029]/70"
                        >
                          {/* Incident Header */}
                          <div className="px-5 py-3 bg-gray-50/25 dark:bg-[#0B0D10]/30 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center space-x-2 min-w-0">
                              <span className="text-[11px] font-mono font-semibold text-red-600 dark:text-red-400 tabular-nums">
                                ЭПИЗОД #{String(vIdx + 1).padStart(2, '0')}
                              </span>
                              <span className="text-gray-300 dark:text-zinc-700">•</span>
                              <span className="text-[11px] font-mono text-gray-500 dark:text-zinc-400 truncate">
                                {v.rule_code || 'NBRK_CASH_RULE'}
                              </span>
                            </div>

                            <div className="flex items-center space-x-3 text-[11px] font-mono tabular-nums">
                              <span className="flex items-center space-x-1 text-gray-700 dark:text-zinc-300">
                                <Clock className="w-3 h-3 text-gray-400" />
                                <span>
                                  Таймкод: {formatMMSS(v.timecode_sec)} ({v.timecode_sec}с)
                                </span>
                              </span>
                              {v.confidence != null && (
                                <span className="text-gray-400 dark:text-zinc-500">
                                  Conf: {Math.round(Number(v.confidence) * 100)}%
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Incident Type & Observation */}
                          <div className="px-5 py-3.5 space-y-2">
                            <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-zinc-100 leading-snug">
                              {v.type}
                            </h4>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-1 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500">
                                <Eye className="w-3 h-3" />
                                <span>Визуальное наблюдение и обоснование</span>
                              </div>
                              <p className="text-xs text-gray-700 dark:text-zinc-300 leading-relaxed">
                                {v.description}
                              </p>
                            </div>
                          </div>

                          {/* Evidence Frames (1-3 base64 frames) */}
                          {frames.length > 0 && (
                            <div className="px-5 py-3.5 space-y-2">
                              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500 block">
                                Подтверждающие стоп-кадры ({frames.length})
                              </span>
                              <div className="grid grid-cols-3 gap-2">
                                {frames.map((ef, fIdx) => {
                                  const rawB64 =
                                    typeof ef === 'string'
                                      ? ef
                                      : ef?.image_base64 || ef?.base64 || ef?.data || ''
                                  if (!rawB64 || typeof rawB64 !== 'string') return null
                                  const src = rawB64.startsWith('data:')
                                    ? rawB64
                                    : `data:image/jpeg;base64,${rawB64}`
                                  const frameTc =
                                    typeof ef === 'object' && ef?.timestamp_sec != null
                                      ? ef.timestamp_sec
                                      : v.timecode_sec
                                  return (
                                    <button
                                      key={fIdx}
                                      onClick={() =>
                                        setPreviewFrame({
                                          src,
                                          title: `${v.type || 'Нарушение'} — Кадр #${
                                            fIdx + 1
                                          } (${formatMMSS(frameTc)})`,
                                        })
                                      }
                                      className="group relative aspect-video bg-black rounded-sm overflow-hidden border border-gray-200 dark:border-[#1C2029]"
                                    >
                                      <img
                                        src={src}
                                        alt={`Evidence frame ${fIdx + 1}`}
                                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                                      />
                                      <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded-sm bg-black/75 text-[9px] font-mono text-zinc-200 tabular-nums">
                                        {formatMMSS(frameTc)}
                                      </span>
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                                        <Maximize2 className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition" />
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Legal Grounding Row */}
                          {(reg.doc_title || reg.adilet_url) && (
                            <div className="px-5 py-3 bg-gray-50/30 dark:bg-[#0B0D10]/40 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center space-x-1 text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500">
                                  <Scale className="w-3 h-3" />
                                  <span>Нормативное основание РК • {reg.clause_ref}</span>
                                </span>
                                {reg.adilet_url && (
                                  <a
                                    href={reg.adilet_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-mono text-gray-900 dark:text-zinc-200 hover:underline flex items-center space-x-1 shrink-0"
                                  >
                                    <span>Открыть в Әділет (adilet.zan.kz)</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-600 dark:text-zinc-400 leading-relaxed">
                                {reg.doc_title}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bottom Status Footer Bar */}
        <div className="h-8 px-4 border-t border-gray-200/70 dark:border-[#1C2029] bg-gray-50/70 dark:bg-[#0B0D10] flex items-center justify-between text-[10px] font-mono text-gray-400 dark:text-zinc-500 shrink-0">
          <span>
            Локальное хранилище аудита: PostgreSQL (analysis_jobs, detected_violations)
          </span>
          <span className="hidden sm:inline">
            100% локальная обработка • Без биометрии
          </span>
        </div>
      </div>

      {/* Lightbox Modal for Evidence Frame Inspection */}
      {previewFrame && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewFrame(null)}
        >
          <div
            className="max-w-4xl w-full bg-[#0D0F12] border border-[#1C2029] rounded-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-9 px-4 border-b border-[#1C2029] flex items-center justify-between text-xs font-mono text-zinc-300">
              <span className="truncate">{previewFrame.title}</span>
              <button
                onClick={() => setPreviewFrame(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <img
              src={previewFrame.src}
              alt={previewFrame.title}
              className="w-full max-h-[75vh] object-contain bg-black"
            />
          </div>
        </div>
      )}
    </div>
  )
}
