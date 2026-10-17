import React, { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Play,
  ExternalLink,
  ShieldAlert,
  Scale,
  Image as ImageIcon,
  CheckSquare,
  Square,
  ZoomIn,
  Sparkles,
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
    <div className="space-y-4">
      {/* Big Bold Verdict Banner */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          isViolation
            ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
            : 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div
              className={`p-3 rounded-xl ${
                isViolation
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  : 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              }`}
            >
              {isViolation ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3
                  className={`text-base font-bold tracking-tight uppercase ${
                    isViolation ? 'text-rose-950 dark:text-rose-200' : 'text-emerald-950 dark:text-emerald-200'
                  }`}
                >
                  {isViolation
                    ? 'Обнаружены признаки нарушений кассовой дисциплины'
                    : 'Нарушений кассовой дисциплины не выявлено'}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                {isViolation
                  ? `Зафиксировано инцидентов: ${violations.length} • Время обработки: ${jobData.processing_time_sec || 0}с`
                  : `Все кассовые регламенты НБРК соблюдены • Время обработки: ${jobData.processing_time_sec || 0}с`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              {jobData.video_metadata?.layout === 'B_left_laptop' ? 'Макет B (Ноутбук слева)' : 'Макет A (Ноутбук справа)'}
            </span>
          </div>
        </div>
      </div>

      {/* Violation Cards List */}
      {violations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
              Список выявленных инцидентов ({violations.length})
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">
              Нажмите карточку для воспроизведения с T-5с
            </span>
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
                className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-white dark:bg-slate-800/90 border-rose-500 shadow-md ring-1 ring-rose-500/30'
                    : 'bg-white dark:bg-[#111625] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Header row: Title + Timecode + Actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    {/* Multi-cut compilation checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleCompileSelection(idx)
                      }}
                      className="mt-0.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      title="Выбрать для объединенного видео нарезки"
                    >
                      {isMarkedForCompile ? (
                        <CheckSquare className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                      )}
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">
                          #{idx + 1}. {v.type}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-900/50">
                          {Math.floor(tc / 60)
                            .toString()
                            .padStart(2, '0')}
                          :{(tc % 60).toString().padStart(2, '0')} ({tc}с)
                        </span>
                        {v.confidence && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Уверенность: {Math.round(v.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Play T-5s button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectViolation(v)
                      onTriggerReplay()
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition whitespace-nowrap shadow-sm"
                  >
                    <Play className="w-3 h-3 fill-rose-600 text-rose-600" />
                    <span>T-5с Повтор</span>
                  </button>
                </div>

                {/* Description */}
                <p className="mt-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {v.description}
                </p>

                {/* Legal Grounding Box (Republic of Kazakhstan NBRK Regulations) */}
                {reg.doc_title && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                        <Scale className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        <span>Правовое основание РК ({reg.clause_ref})</span>
                      </div>
                      {reg.adilet_url && (
                        <a
                          href={reg.adilet_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center space-x-1 text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-mono"
                        >
                          <span>adilet.zan.kz</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono leading-tight">
                      {reg.doc_title}
                    </p>
                    {reg.normative_text && (
                      <blockquote className="text-[11px] italic text-slate-600 dark:text-slate-300 border-l-2 border-rose-500/60 pl-2 mt-1">
                        «{reg.normative_text}»
                      </blockquote>
                    )}
                  </div>
                )}

                {/* 3-Keyframe Evidence Gallery Strip */}
                {v.evidence_frames && v.evidence_frames.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400 mb-2">
                      <ImageIcon className="w-3 h-3" />
                      <span>Кадры видеодоказательства (T-1с, T, T+1с):</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
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
                            className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 aspect-video bg-black cursor-pointer hover:ring-2 hover:ring-rose-500 transition"
                          >
                            <img
                              src={imgB64}
                              alt={`Evidence frame ${ef.timestamp_sec}s`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                              <ZoomIn className="w-5 h-5" />
                            </div>
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-mono">
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

      {/* Enlarged Image Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalImage(null)}
        >
          <div
            className="max-w-3xl w-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Кадр видеодоказательства ({modalImage.timestamp}с)
                </p>
                <p className="text-xs text-slate-500 font-mono">{modalImage.label}</p>
              </div>
              <button
                onClick={() => setModalImage(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-mono px-2 py-1"
              >
                Закрыть [ESC]
              </button>
            </div>
            <div className="p-2 bg-black flex items-center justify-center">
              <img
                src={modalImage.src}
                alt="Enlarged evidence"
                className="max-h-[75vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
