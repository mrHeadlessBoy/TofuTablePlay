export interface LoreEntry {
  id: string
  title: string
  trigger_keys: string[]
  content: string
  category: string
  activation_mode: 'Always Active' | 'Keyword Triggered' | 'Secret / DM-Only'
}

export function extractTriggeredLore(
  loreEntries: LoreEntry[],
  combinedText: string,
  isDmContext: boolean = true
): LoreEntry[] {
  const normalizedText = combinedText.toLowerCase()
  const matched = new Map<string, LoreEntry>()

  for (const entry of loreEntries) {
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
    const hasMatch = entry.trigger_keys.some((key) => {
      if (!key.trim()) return false
      const regex = new RegExp(`\\b${key.trim().toLowerCase()}\\b`, 'i')
      return regex.test(normalizedText)
    })

    if (hasMatch) {
      matched.set(entry.id, entry)
    }
  }

  return Array.from(matched.values())
}