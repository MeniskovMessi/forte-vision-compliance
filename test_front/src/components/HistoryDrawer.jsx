import React, { useState, useEffect } from 'react'
import { Clock, X, AlertTriangle, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react'
import { listJobs, pollJobDetailed } from '../services/api'

export default function HistoryDrawer({ isOpen, onClose, onSelectJob }) {
  const [jobs, setJobs] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    listJobs(40)
      .then((data) => {
        setJobs(data.jobs || [])
        setSummary(data.summary)
      })
      .catch((err) => console.error('Failed to load history:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen])

  if (!isOpen) return null

  const handleJobClick = async (jobId) => {
    try {
      const detailed = await pollJobDetailed(jobId)
      onSelectJob(detailed)
      onClose()
    } catch (e) {
      alert(`Не удалось загрузить задачу ${jobId}: ${e.message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Журнал Аудитов
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                История видеоанализов в PostgreSQL
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={load}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Обновить"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary metrics pills */}
        {summary && (
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30 grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 block">Всего</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {summary.total_jobs}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
              <span className="text-[10px] text-rose-600 dark:text-rose-400 block">Нарушений</span>
              <span className="font-bold text-rose-700 dark:text-rose-300">
                {summary.violation_videos}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">Норма</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                {summary.compliant_videos}
              </span>
            </div>
          </div>
        )}

        {/* Jobs List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading && jobs.length === 0 ? (
            <p className="text-xs text-slate-400 font-mono text-center py-8">
              Загрузка истории...
            </p>
          ) : jobs.length === 0 ? (
            <p className="text-xs text-slate-400 font-mono text-center py-8">
              История пока пуста. Запустите анализ первого видео!
            </p>
          ) : (
            jobs.map((j) => {
              const isViol = j.verdict === 'violation'
              return (
                <div
                  key={j.job_id}
                  onClick={() => handleJobClick(j.job_id)}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isViol
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {isViol ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white font-mono truncate max-w-[180px]">
                        {j.filename || j.job_id}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {j.created_at ? new Date(j.created_at).toLocaleTimeString() : ''} • ID:{' '}
                        {j.job_id}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
