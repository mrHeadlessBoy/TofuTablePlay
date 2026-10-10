export interface LoreEntry {
  id: string
  title: string
  trigger_keys: string[]
  content: string
  category: string
  activation_mode: 'Always Active' | 'Keyword Triggered' | 'Secret / DM-Only'
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function extractTriggeredLore(
  loreEntries: LoreEntry[],
  combinedText: string,
  isDmContext: boolean = true
): LoreEntry[] {
  const normalizedText = (combinedText || '').toLowerCase()
  const matched = new Map<string, LoreEntry>()

  for (const entry of (loreEntries || [])) {
    // 1. Always Active: Injected into every turn
    if (entry.activation_mode === 'Always Active') {
      matched.set(entry.id, entry)
      continue
    }

    // 2. Secret / DM-Only: Injected if matching or pinned for the DM
    if (entry.activation_mode === 'Secret / DM-Only' && !isDmContext) {
      continue
    }

    // 3. Keyword Triggered: Scan trigger keys
    const keys = Array.isArray(entry.trigger_keys) ? entry.trigger_keys : []
    const hasMatch = keys.some((key) => {
      const trimmed = (key || '').trim().toLowerCase()
      if (!trimmed) return false

      // If the keyword contains Thai characters, non-ASCII, symbols (e.g. C++, ( ), +1), or spaces,
      // \b will not work properly or will fail to match. Use direct substring matching.
      const isPureAsciiWord = /^[a-z0-9_-]+$/i.test(trimmed)
      if (isPureAsciiWord) {
        try {
          const regex = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, 'i')
          return regex.test(normalizedText)
        } catch {
          return normalizedText.includes(trimmed)
        }
      }

      // Multilingual (Thai, CJK, etc.) and symbol-laden phrases
      return normalizedText.includes(trimmed)
    })

    if (hasMatch) {
      matched.set(entry.id, entry)
    }
  }

  return Array.from(matched.values())
}