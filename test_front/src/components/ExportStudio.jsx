import React, { useState } from 'react'
import {
  Download,
  Film,
  Image as ImageIcon,
  Layers,
  Scissors,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import {
  getEvidenceFrameUrl,
  getEvidenceClipUrl,
  compileEvidenceCuts,
} from '../services/api'

export default function ExportStudio({
  jobId,
  selectedViolation,
  violations = [],
  selectedForCompile = [],
  onSelectAllForCompile,
  onClearCompileSelection,
}) {
  const [includeBbox, setIncludeBbox] = useState(true)
  const [clipPadSec, setClipPadSec] = useState(3.0)
  const [isCompiling, setIsCompiling] = useState(false)
  const [compiledResult, setCompiledResult] = useState(null)
  const [compileError, setCompileError] = useState(null)

  if (!jobId || violations.length === 0) return null

  const tc = selectedViolation?.relative_timecode_sec ?? selectedViolation?.timecode_sec ?? violations[0]?.timecode_sec ?? 0

  const handleCompile = async () => {
    if (selectedForCompile.length === 0) return
    setIsCompiling(true)
    setCompileError(null)

    try {
      const res = await compileEvidenceCuts(jobId, {
        violationIndices: selectedForCompile,
        drawBbox: includeBbox,
      })
      setCompiledResult(res)
    } catch (err) {
      setCompileError(err.message || 'Ошибка компиляции видео')
    } finally {
      setIsCompiling(false)
    }
  }

  return (
    <div className="bg-white dark:bg-[#111625] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-5">
      <div className="flex items-center space-x-2.5">
        <div className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Студия Экспорта Доказательств и Нарезок
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Выгрузка кадров, отдельных клипов ±N сек и объединение выбранных таймлайнов в единое видео
          </p>
        </div>
      </div>

      {/* Global export settings */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs font-mono">
        <label className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={includeBbox}
            onChange={(e) => setIncludeBbox(e.target.checked)}
            className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
          />
          <span>Вжигать рамку AI-таргета (evidence_bbox) в экспортируемое медиа</span>
        </label>

        <div className="flex items-center space-x-2">
          <span className="text-slate-500">Окно клипа:</span>
          <select
            value={clipPadSec}
            onChange={(e) => setClipPadSec(parseFloat(e.target.value))}
            className="px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="2.0">±2.0 сек</option>
            <option value="3.0">±3.0 сек (по умолч.)</option>
            <option value="5.0">±5.0 сек</option>
            <option value="8.0">±8.0 сек</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Section 1: Single Evidence Quick Export */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
              <Scissors className="w-3.5 h-3.5 text-rose-600" />
              <span>Экспорт выбранного инцидента ({tc}с)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Скачайте доказательство конкретного нарушения в один клик:
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <a
              href={getEvidenceFrameUrl(jobId, tc, includeBbox)}
              download={`evidence_${jobId}_${tc}s.jpg`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
            >
              <ImageIcon className="w-3.5 h-3.5 text-rose-600" />
              <span>Кадр .JPG ({tc}с)</span>
            </a>

            <a
              href={getEvidenceClipUrl(jobId, tc, clipPadSec, includeBbox)}
              download={`clip_${jobId}_${tc}s.mp4`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
            >
              <Film className="w-3.5 h-3.5 text-rose-600" />
              <span>Клип .MP4 (±{clipPadSec}с)</span>
            </a>
          </div>
        </div>

        {/* Section 2: Multi-Evidence Compilation */}
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-300 font-mono">
                <Film className="w-3.5 h-3.5 text-rose-600" />
                <span>Объединенное видео нарезок</span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-500">
                <button
                  onClick={onSelectAllForCompile}
                  className="hover:underline text-rose-600 dark:text-rose-400"
                >
                  Все ({violations.length})
                </button>
                <span>•</span>
                <button onClick={onClearCompileSelection} className="hover:underline">
                  Снять
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Выбрано инцидентов для склейки:{' '}
              <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                {selectedForCompile.length} из {violations.length}
              </span>
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleCompile}
              disabled={isCompiling || selectedForCompile.length === 0}
              className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium text-white shadow-sm transition ${
                isCompiling || selectedForCompile.length === 0
                  ? 'bg-rose-400 cursor-not-allowed'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
              }`}
            >
              {isCompiling ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Склейка выбранных интервалов...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    Скомпилировать выбранные нарезки ({selectedForCompile.length}) в одно видео
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Compilation Result Banner & Preview Player */}
      {compiledResult && (
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                Видео успешно скомпилировано! Нарезок: {compiledResult.cuts_count} •
                Длительность: {compiledResult.total_duration_sec}с
              </span>
            </div>
            {compiledResult.download_url && (
              <a
                href={compiledResult.download_url}
                download={compiledResult.filename || 'compiled_evidence.mp4'}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать итоговое видео (.mp4)</span>
              </a>
            )}
          </div>

          {/* Inline Video Player Preview of the compiled cuts */}
          {compiledResult.download_url && (
            <div className="rounded-xl overflow-hidden bg-black max-w-lg mx-auto aspect-video">
              <video
                src={compiledResult.download_url}
                controls
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>
      )}

      {compileError && (
        <p className="text-xs text-rose-600 dark:text-rose-400 font-mono">{compileError}</p>
      )}
    </div>
  )
}
