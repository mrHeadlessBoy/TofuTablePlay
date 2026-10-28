import { stripCampaignTemplateFromRules } from '@/features/character/template'

export interface CampaignRuleMechanic {
  id?: string
  title: string
  category?: string
  description: string
}

/**
 * Parses raw rule_mechanics string (JSON array or legacy text) into structured rule items.
 */
export function parseRuleMechanics(raw: string | null | undefined): CampaignRuleMechanic[] {
  if (!raw || !raw.trim()) return []
  const text = raw.trim()

  // 1. Try parsing as JSON array
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
          .map((item, idx) => ({
            id: typeof item.id === 'string' && item.id ? item.id : `rule-${idx + 1}`,
            title: typeof item.title === 'string' ? item.title : (typeof item.name === 'string' ? item.name : ''),
            category: typeof item.category === 'string' ? item.category : '',
            description: typeof item.description === 'string' ? item.description : (typeof item.content === 'string' ? item.content : ''),
          }))
          .filter((rule) => rule.title.trim() || rule.description.trim())
      }
    } catch {
      // Fallback to text parsing
    }
  }

  // 2. Legacy markdown / text parsing
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const items: CampaignRuleMechanic[] = []

  for (const line of lines) {
    const bulletMatch = line.match(/^[-*•]?\s*(?:\*\*(.*?)\*\*|(.*?)):\s*(.*)$/)
    if (bulletMatch) {
      const title = (bulletMatch[1] || bulletMatch[2] || '').trim()
      const desc = (bulletMatch[3] || '').trim()
      if (title || desc) {
        items.push({
          id: `rule-${items.length + 1}`,
          title,
          category: 'General',
          description: desc,
        })
        continue
      }
    }
  }

  if (items.length > 0) {
    return items
  }

  // 3. Fallback: treat the entire plain text as a single rule
  return [
    {
      id: 'rule-1',
      title: 'General Mechanics',
      category: 'General',
      description: text,
    },
  ]
}

/**
 * Serializes structured rule items to JSON string for storage in rule_mechanics.
 */
export function serializeRuleMechanics(rules: CampaignRuleMechanic[]): string {
  const clean = rules
    .map((r, idx) => ({
      id: r.id || `rule-${idx + 1}`,
      title: (r.title || '').trim(),
      category: (r.category || '').trim(),
      description: (r.description || '').trim(),
    }))
    .filter((r) => r.title || r.description)

  if (clean.length === 0) return ''
  return JSON.stringify(clean)
}

/**
 * Formats rule mechanics cleanly for AI DM prompts.
 */
export function formatRuleMechanicsForPrompt(raw: string | null | undefined): string {
  const stripped = stripCampaignTemplateFromRules(raw)
  if (!stripped || !stripped.trim()) return 'Standard tabletop RPG rules apply.'
  const parsed = parseRuleMechanics(stripped)
  if (parsed.length === 0) return 'Standard tabletop RPG rules apply.'

  return parsed
    .map((r) => {
      const cat = r.category ? ` [${r.category}]` : ''
      return `- **${r.title || 'Rule'}**${cat}: ${r.description}`
    })
    .join('\n')
}

