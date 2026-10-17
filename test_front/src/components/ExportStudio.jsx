import React, { useState } from 'react'
import { Download, Film, Image as ImageIcon, Scissors, CheckCircle2, RefreshCw } from 'lucide-react'
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
      setCompileError(err.message || 'Ошибка компиляции')
    } finally {
      setIsCompiling(false)
    }
  }

  return (
    <div className="bg-white dark:bg-[#16191E] rounded-xl border border-gray-200 dark:border-[#22272E] p-4 shadow-sm space-y-3.5 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Экспорт материалов инцидента
        </h3>

        <div className="flex items-center space-x-3 font-mono text-[11px] text-gray-500">
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeBbox}
              onChange={(e) => setIncludeBbox(e.target.checked)}
              className="rounded text-[#9D1D53] focus:ring-0 cursor-pointer"
            />
            <span>Наложить рамку</span>
          </label>

          <div className="flex items-center space-x-1">
            <span>Клип:</span>
            <select
              value={clipPadSec}
              onChange={(e) => setClipPadSec(parseFloat(e.target.value))}
              className="px-1.5 py-0.5 rounded bg-gray-50 dark:bg-[#0E1015] border border-gray-200 dark:border-[#22272E]"
            >
              <option value="2.0">±2с</option>
              <option value="3.0">±3с</option>
              <option value="5.0">±5с</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Single Item Export */}
        <div className="p-3 rounded-lg border border-gray-200 dark:border-[#22272E] bg-gray-50/50 dark:bg-[#0E1015]/60 flex items-center justify-between">
          <div className="pr-2">
            <span className="block font-medium text-gray-800 dark:text-gray-200 font-mono text-[11px]">
              Инцидент ({tc}с)
            </span>
            <span className="text-[10px] text-gray-400">Экспорт кадра или фрагмента</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <a
              href={getEvidenceFrameUrl(jobId, tc, includeBbox)}
              download={`evidence_${jobId}_${tc}s.jpg`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-white dark:bg-[#16191E] border border-gray-200 dark:border-[#22272E] hover:bg-gray-100 text-gray-700 dark:text-gray-200 text-xs transition"
            >
              <ImageIcon className="w-3 h-3 text-[#9D1D53]" />
              <span>.JPG</span>
            </a>

            <a
              href={getEvidenceClipUrl(jobId, tc, clipPadSec, includeBbox)}
              download={`clip_${jobId}_${tc}s.mp4`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-white dark:bg-[#16191E] border border-gray-200 dark:border-[#22272E] hover:bg-gray-100 text-gray-700 dark:text-gray-200 text-xs transition"
            >
              <Film className="w-3 h-3 text-[#9D1D53]" />
              <span>.MP4</span>
            </a>
          </div>
        </div>

        {/* Multi-cut compilation */}
        <div className="p-3 rounded-lg border border-gray-200 dark:border-[#22272E] bg-gray-50/50 dark:bg-[#0E1015]/60 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-800 dark:text-gray-200 font-mono text-[11px]">
                Склейка ({selectedForCompile.length} из {violations.length})
              </span>
              <button
                onClick={onSelectAllForCompile}
                className="text-[10px] text-[#9D1D53] hover:underline"
              >
                Все
              </button>
            </div>
            <span className="text-[10px] text-gray-400">Объединение всех нарезок в 1 файл</span>
          </div>

          <button
            onClick={handleCompile}
            disabled={isCompiling || selectedForCompile.length === 0}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium text-white transition ${
              isCompiling || selectedForCompile.length === 0
                ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'
                : 'bg-[#9D1D53] hover:bg-[#831644]'
            }`}
          >
            {isCompiling ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Scissors className="w-3 h-3" />
            )}
            <span>Объединить</span>
          </button>
        </div>
      </div>

      {/* Compiled video preview */}
      {compiledResult && (
        <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-mono text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              Склеено нарезок: {compiledResult.cuts_count} • Длительность: {compiledResult.total_duration_sec}с
            </span>
          </div>
          {compiledResult.download_url && (
            <a
              href={compiledResult.download_url}
              download={compiledResult.filename || 'compiled_evidence.mp4'}
              className="flex items-center space-x-1.5 px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-xs transition"
            >
              <Download className="w-3 h-3" />
              <span>Скачать .MP4</span>
            </a>
          )}
        </div>
      )}

      {compileError && <p className="text-xs text-rose-600 font-mono">{compileError}</p>}
    </div>
  )
}
