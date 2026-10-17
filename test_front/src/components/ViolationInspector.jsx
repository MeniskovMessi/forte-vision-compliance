import React, { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Play,
  ExternalLink,
  Scale,
  CheckSquare,
  Square,
  ZoomIn,
} from 'lucide-react'

export default function ViolationInspector({
  jobData,
  selectedViolation,
  onSelectViolation,
  onTriggerReplay,
  selectedForCompile,
  onToggleCompileSelection,
}) {
  const [modalImage, setModalImage] = useState(null)

  if (!jobData) return null

  const isViolation = jobData.verdict === 'violation'
  const violations = jobData.violations || []

  return (
    <div className="space-y-3">
      {/* Clean Linear Verdict Banner */}
      <div
        className={`px-4 py-3 rounded-lg border transition ${
          isViolation
            ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
            : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            {isViolation ? (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            )}
            <div>
              <h3
                className={`text-xs font-semibold uppercase tracking-wider ${
                  isViolation
                    ? 'text-rose-900 dark:text-rose-200'
                    : 'text-emerald-900 dark:text-emerald-200'
                }`}
              >
                {isViolation ? 'Зафиксированы нарушения' : 'Нарушений не обнаружено'}
              </h3>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                {isViolation
                  ? `Инцидентов: ${violations.length} • Время обработки: ${jobData.processing_time_sec || 0}с`
                  : `Все регламенты НБРК соблюдены • Время обработки: ${jobData.processing_time_sec || 0}с`}
              </p>
            </div>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-[#16191E] border border-gray-200 dark:border-[#22272E] text-gray-600 dark:text-gray-300">
            {jobData.video_metadata?.layout === 'B_left_laptop' ? 'Макет B' : 'Макет A'}
          </span>
        </div>
      </div>

      {/* Violations List */}
      {violations.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1 text-[11px] font-mono text-gray-400">
            <span>Список нарушений ({violations.length})</span>
            <span>Клик для повтора с T-5с</span>
          </div>

          {violations.map((v, idx) => {
            const isSelected = selectedViolation === v
            const isMarkedForCompile = selectedForCompile.includes(idx)
            const tc = v.relative_timecode_sec ?? v.timecode_sec ?? 0
            const reg = v.regulation_reference || {}

            return (
              <div
                key={idx}
                onClick={() => onSelectViolation(v)}
                className={`p-3.5 sm:p-4 rounded-xl border transition cursor-pointer text-xs ${
                  isSelected
                    ? 'bg-white dark:bg-[#16191E] border-rose-500 shadow-sm'
                    : 'bg-white dark:bg-[#16191E] border-gray-200 dark:border-[#22272E] hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleCompileSelection(idx)
                      }}
                      className="mt-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      title="Выбрать для объединенного видео"
                    >
                      {isMarkedForCompile ? (
                        <CheckSquare className="w-4 h-4 text-[#9D1D53]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          #{idx + 1}. {v.type}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {Math.floor(tc / 60)
                            .toString()
                            .padStart(2, '0')}
                          :{(tc % 60).toString().padStart(2, '0')} ({tc}с)
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectViolation(v)
                      onTriggerReplay()
                    }}
                    className="flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-mono bg-gray-100 hover:bg-gray-200 dark:bg-[#22272E] dark:hover:bg-[#2A313C] text-gray-700 dark:text-gray-200 transition"
                  >
                    <Play className="w-3 h-3 fill-gray-600 dark:fill-gray-300" />
                    <span>T-5с</span>
                  </button>
                </div>

                {/* Description */}
                <p className="mt-2 text-gray-600 dark:text-gray-300 leading-relaxed text-xs">
                  {v.description}
                </p>

                {/* Legal Citation */}
                {reg.doc_title && (
                  <div className="mt-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-[#0E1015] border border-gray-200 dark:border-[#22272E] text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        Основание: {reg.clause_ref}
                      </span>
                      {reg.adilet_url && (
                        <a
                          href={reg.adilet_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center space-x-1 text-[#9D1D53] hover:underline font-mono"
                        >
                          <span>adilet.zan.kz</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                    {reg.normative_text && (
                      <blockquote className="italic text-gray-500 dark:text-gray-400 border-l border-gray-300 dark:border-gray-700 pl-2">
                        «{reg.normative_text}»
                      </blockquote>
                    )}
                  </div>
                )}

                {/* 3 Evidence Frames */}
                {v.evidence_frames && v.evidence_frames.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-[#22272E]">
                    <div className="grid grid-cols-3 gap-1.5">
                      {v.evidence_frames.map((ef, efIdx) => {
                        const imgB64 = ef.image_base64?.startsWith('data:')
                          ? ef.image_base64
                          : `data:image/jpeg;base64,${ef.image_base64}`
                        return (
                          <div
                            key={efIdx}
                            onClick={(e) => {
                              e.stopPropagation()
                              setModalImage({
                                src: imgB64,
                                timestamp: ef.timestamp_sec,
                                label: v.type,
                              })
                            }}
                            className="relative group rounded overflow-hidden border border-gray-200 dark:border-[#22272E] aspect-video bg-black cursor-pointer"
                          >
                            <img
                              src={imgB64}
                              alt={`Evidence frame ${ef.timestamp_sec}s`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                              <ZoomIn className="w-4 h-4" />
                            </div>
                            <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-white text-[9px] font-mono">
                              {ef.timestamp_sec}с
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Enlarged Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalImage(null)}
        >
          <div
            className="max-w-3xl w-full bg-white dark:bg-[#16191E] rounded-xl overflow-hidden shadow-2xl border border-gray-200 dark:border-[#22272E]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-gray-200 dark:border-[#22272E] flex items-center justify-between text-xs">
              <span className="font-medium text-gray-900 dark:text-white">
                Кадр доказательства ({modalImage.timestamp}с) — {modalImage.label}
              </span>
              <button
                onClick={() => setModalImage(null)}
                className="text-gray-400 hover:text-gray-600 font-mono"
              >
                Закрыть [ESC]
              </button>
            </div>
            <div className="p-2 bg-black flex items-center justify-center">
              <img
                src={modalImage.src}
                alt="Enlarged"
                className="max-h-[75vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
