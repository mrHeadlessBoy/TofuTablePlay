'use client'

import React, { createContext, useContext, useSyncExternalStore, useCallback, useMemo } from 'react'
import { Language, Translations } from './types'
import { th } from './locales/th'
import { en } from './locales/en'

const STORAGE_KEY = 'tofu_language'

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  translations: Translations
  t: (path: string, params?: Record<string, string | number>) => string
}

const dictionaries: Record<Language, Translations> = { th, en }

const LanguageContext = createContext<LanguageContextValue | null>(null)

/*
 * Client-side language store.
 * The server cannot read localStorage, so the HTML always comes in Thai. The client keeps reporting Thai
 * until the whole document has streamed in (DOMContentLoaded), so every part of the page, including
 * <Suspense> sections that arrive later, hydrates against the same text. Only then does it switch to the
 * stored choice. Switching earlier caused "server rendered text didn't match the client" errors.
 */
let clientLanguage: Language | null = null
let documentReady = false
const languageListeners = new Set<() => void>()

function getLanguageSnapshot(): Language {
  if (clientLanguage !== null) return clientLanguage
  if (!documentReady) return 'th'
  clientLanguage = readInitialLanguage()
  return clientLanguage
}

function getServerLanguageSnapshot(): Language {
  return 'th'
}

function notifyLanguageListeners() {
  languageListeners.forEach((listener) => listener())
}

function updateClientLanguage(lang: Language) {
  clientLanguage = lang
  notifyLanguageListeners()
}

function markDocumentReady() {
  if (documentReady) return
  documentReady = true
  notifyLanguageListeners()
}

// Also follows changes made in other tabs
function subscribeToLanguage(listener: () => void) {
  languageListeners.add(listener)

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && (e.newValue === 'th' || e.newValue === 'en')) {
      updateClientLanguage(e.newValue)
    }
  }
  window.addEventListener('storage', handleStorage)

  let readyTimer: number | undefined
  if (!documentReady) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', markDocumentReady, { once: true })
    } else {
      readyTimer = window.setTimeout(markDocumentReady, 0)
    }
  }

  return () => {
    languageListeners.delete(listener)
    window.removeEventListener('storage', handleStorage)
    document.removeEventListener('DOMContentLoaded', markDocumentReady)
    window.clearTimeout(readyTimer)
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribeToLanguage, getLanguageSnapshot, getServerLanguageSnapshot)

  const setLanguage = useCallback((newLang: Language) => {
    updateClientLanguage(newLang)
    try {
      localStorage.setItem(STORAGE_KEY, newLang)
      document.cookie = `${STORAGE_KEY}=${newLang}; path=/; max-age=31536000; SameSite=Lax`
    } catch {
      // Ignore storage errors
    }
  }, [])

  const currentTranslations = useMemo(() => {
    return dictionaries[language] || th
  }, [language])

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const keys = path.split('.')
      let found = lookupPath(currentTranslations, keys)
      if (found === MISSING) {
        // Fallback to Thai dictionary if key not found in current language
        const fallback = lookupPath(th, keys)
        found = fallback === MISSING ? path : (fallback ?? path)
      }

      if (typeof found !== 'string') {
        return path
      }

      return interpolate(found, params)
    },
    [currentTranslations]
  )

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      translations: currentTranslations,
      t,
    }),
    [language, setLanguage, currentTranslations, t]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// Stored choice first, then the browser language, defaulting to Thai (also on the server)
function readInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'th'
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null
    if (stored === 'th' || stored === 'en') {
      return stored
    }
    const browserLang = navigator.language?.toLowerCase() || ''
    if (browserLang.startsWith('en')) {
      return 'en'
    }
  } catch {
    // Ignore if localStorage unavailable
  }
  return 'th'
}

const MISSING = Symbol('missing')

// Walk a dotted key path through a dictionary; MISSING when any segment is absent
function lookupPath(dictionary: unknown, keys: string[]): unknown {
  let current = dictionary
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return MISSING
    }
  }
  return current
}

// Replace every {param} placeholder with its value
function interpolate(template: string, params?: Record<string, string | number>): string {
  let result = template
  if (params) {
    for (const [pKey, pVal] of Object.entries(params)) {
      result = result.replaceAll(`{${pKey}}`, String(pVal))
    }
  }
  return result
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
