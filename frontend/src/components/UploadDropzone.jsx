import React, { useState, useRef } from 'react'
import { Upload, FolderOpen } from 'lucide-react'

export default function UploadDropzone({ onVideoSelect, darkMode }) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(file.name)) {
        processFile(file)
      } else {
        alert('Пожалуйста, загрузите видеофайл (.mp4, .mov, .avi, .mkv)')
      }
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0])
    }
  }

  const processFile = (file) => {
    const videoUrl = URL.createObjectURL(file)
    onVideoSelect({
      file,
      url: videoUrl,
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
    })
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 w-full max-w-4xl mx-auto">
      {/* 
        Hidden file input:
        Explicitly specify extensions (.mov,.mp4,.avi,.mkv) FIRST so Windows File Dialog 
        immediately displays .mov and video files without requiring "All Files (*.*)".
      */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mov,.mp4,.avi,.mkv,.webm,.m4v,video/*,video/mp4,video/quicktime,video/x-msvideo"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main Drag & Drop Surface */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full relative group cursor-pointer rounded-2xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-300 flex flex-col items-center justify-center select-none ${
          isDragging
            ? 'border-[#9D1D53] bg-[#9D1D53]/5 dark:bg-[#9D1D53]/10 scale-[1.01] shadow-lg shadow-[#9D1D53]/10'
            : darkMode
            ? 'border-[#22272E] bg-[#12151B] hover:border-gray-600 hover:bg-[#161920]'
            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50/70 shadow-sm'
        }`}
      >
        {/* Optical Glow Icon */}
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110 ${
            isDragging
              ? 'bg-[#9D1D53] text-white'
              : darkMode
              ? 'bg-[#1C2028] text-gray-300 border border-[#2D333F]'
              : 'bg-gray-100 text-gray-700 border border-gray-200'
          }`}
        >
          <Upload className="w-8 h-8" />
        </div>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
          Загрузка видеозаписи кассовой зоны
        </h2>

        {/* Subtitle */}
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6 leading-relaxed">
          Перетащите файл видеозаписи сюда или нажмите для выбора с диска
        </p>

        {/* Action Button */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-medium tracking-wide uppercase font-mono bg-[#9D1D53] hover:bg-[#861846] text-white shadow-sm transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Выбрать видео</span>
          </button>
        </div>

        {/* Format Hints */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-gray-400 dark:text-zinc-500">
          <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-[#1A1E26] border border-gray-200 dark:border-[#262C36]">
            MOV
          </span>
          <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-[#1A1E26] border border-gray-200 dark:border-[#262C36]">
            MP4
          </span>
          <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-[#1A1E26] border border-gray-200 dark:border-[#262C36]">
            AVI
          </span>
          <span>•</span>
          <span>До 500 МБ</span>
          <span>•</span>
          <span>Кассовая зона ForteBank</span>
        </div>
      </div>

      {/* Subtitle explaining what the system does */}
      <div className="mt-8 max-w-2xl text-center px-4 space-y-2.5">
        <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 leading-relaxed font-sans">
          Автоматический видеоконтроль кассовой дисциплины ForteBank: обнаружение оставления наличных денег и открытого сейфа без присмотра, фиксация посторонних лиц и нарушений регламента с привязкой к нормативным актам НБРК.
        </p>
        <div className="flex items-center justify-center space-x-2 text-[11px] font-mono text-gray-400 dark:text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9D1D53]" />
          <span>Локальный анализ нейросетями • adilet.zan.kz • Формирование отчёта жюри</span>
        </div>
      </div>
    </div>
  )
}
