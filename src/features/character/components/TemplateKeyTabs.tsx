'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, Copy } from 'lucide-react'
import { encodeTemplateKey, type CharacterTemplate } from '../template'

// Export tab: encodes the working template into a shareable CST key and copies it
export function TemplateExportTab({ template }: { template: CharacterTemplate }) {
  const [exportKey, setExportKey] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Regenerate the key whenever the tab opens or the template changes
  useEffect(() => {
    Promise.resolve().then(() => setIsExporting(true))
    encodeTemplateKey(template)
      .then((key) => {
        setExportKey(key)
      })
      .catch((err) => {
        setExportKey(err instanceof Error ? err.message : 'Error generating key')
      })
      .finally(() => setIsExporting(false))
  }, [template])

  const handleCopyKey = async () => {
    if (!exportKey) return
    try {
      await navigator.clipboard.writeText(exportKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200/90 leading-relaxed">
        คัดลอกรหัส Share Key นี้เพื่อส่งให้เพื่อนหรือบันทึกเก็บไว้และใช้ Import
      </div>

      <div className="relative">
        <textarea
          readOnly
          rows={6}
          value={isExporting ? 'กำลังสร้างรหัส Share Key...' : exportKey}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 font-mono text-[11px] text-amber-300 outline-none select-all break-all"
        />
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[11px] text-zinc-500 font-mono">
          {exportKey ? `${exportKey.length} ตัวอักษร` : ''}
        </span>

        <button
          type="button"
          onClick={handleCopyKey}
          disabled={!exportKey || isExporting}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
          {copied ? 'คัดลอกรหัสแล้ว!' : 'คัดลอก Template Key'}
        </button>
      </div>
    </div>
  )
}

type TemplateImportTabProps = {
  input: string
  error: string | null
  preview: CharacterTemplate | null
  onInputChange: (value: string) => void
  onPreview: () => void
  onConfirm: () => void
}

// Import tab: paste a CST key or JSON, preview the decoded template, then apply it
export function TemplateImportTab({
  input,
  error,
  preview,
  onInputChange,
  onPreview,
  onConfirm,
}: TemplateImportTabProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
        วางรหัส Template Key (ขึ้นต้นด้วย <code className="text-amber-400">CST1.</code>)
        หรือข้อความ JSON ที่ได้รับมาด้านล่าง
      </div>

      <div>
        <textarea
          rows={4}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="วางรหัส CST1-... หรือ JSON ที่นี่"
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 font-mono text-xs text-white outline-none focus:border-amber-500"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {preview && <TemplatePreviewCard template={preview} />}

      <div className="flex justify-end gap-2 pt-2">
        {!preview ? (
          <button
            type="button"
            onClick={onPreview}
            disabled={!input.trim()}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium cursor-pointer"
          >
            ตรวจสอบรหัส (Preview)
          </button>
        ) : (
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 text-zinc-100 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
          >
            นำมาใช้กับตัวละครนี้ (Apply)
          </button>
        )}
      </div>
    </div>
  )
}

function TemplatePreviewCard({ template }: { template: CharacterTemplate }) {
  return (
    <div className="p-4 bg-zinc-900/60 border border-zinc-700 rounded-xl space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">{template.name}</h4>
        <span className="text-[10px] text-zinc-400 font-mono">
          By {template.author || 'Unknown'}
        </span>
      </div>
      {template.description && <p className="text-xs text-zinc-400">{template.description}</p>}
      <div className="flex gap-4 text-[11px] text-zinc-400 font-mono pt-1">
        <span>{template.stats.length} Stats</span>
        <span>•</span>
        <span>{template.resources.length} Bars</span>
        <span>•</span>
        <span>{template.textFields.length} Text Fields</span>
        <span>•</span>
        <span>{template.equipmentSlots.length} Slots</span>
      </div>
    </div>
  )
}
