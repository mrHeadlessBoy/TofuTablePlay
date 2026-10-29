'use client'

import React, { createContext, useContext, useSyncExternalStore, useMemo } from 'react'
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

type TranslateFn = LanguageContextValue['t']

const LanguageContext = createContext<{ setLanguage: (lang: Language) => void } | null>(null)

/*
 * Client-side language store.
 * The server cannot read localStorage, so the HTML always comes in Thai. Every component reads the language
 * through useSyncExternalStore (in useLanguage): while that component hydrates, React uses the server value
 * (Thai) and switches to the stored choice right after. It has to happen per component, not once in the
 * provider, because <Suspense> sections stream in and hydrate later than the provider does.
 */
let clientLanguage: Language | null = null
const languageListeners = new Set<() => void>()

function getLanguageSnapshot(): Language {
  if (clientLanguage === null) clientLanguage = readInitialLanguage()
  return clientLanguage
}

function getServerLanguageSnapshot(): Language {
  return 'th'
}

function updateClientLanguage(lang: Language) {
  clientLanguage = lang
  languageListeners.forEach((listener) => listener())
}

// Follow changes made in other tabs
function handleStorage(e: StorageEvent) {
  if (e.key === STORAGE_KEY && (e.newValue === 'th' || e.newValue === 'en')) {
    updateClientLanguage(e.newValue)
  }
}

function subscribeToLanguage(listener: () => void) {
  if (languageListeners.size === 0) window.addEventListener('storage', handleStorage)
  languageListeners.add(listener)
  return () => {
    languageListeners.delete(listener)
    if (languageListeners.size === 0) window.removeEventListener('storage', handleStorage)
  }
}

function setLanguage(newLang: Language) {
  updateClientLanguage(newLang)
  try {
    localStorage.setItem(STORAGE_KEY, newLang)
    document.cookie = `${STORAGE_KEY}=${newLang}; path=/; max-age=31536000; SameSite=Lax`
  } catch {
    // Ignore storage errors
  }
}

const LANGUAGE_ACTIONS = { setLanguage }

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  return <LanguageContext.Provider value={LANGUAGE_ACTIONS}>{children}</LanguageContext.Provider>
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

// t() for one dictionary, falling back to the Thai dictionary, then to the key itself
function createTranslator(translations: Translations): TranslateFn {
  return (path, params) => {
    const keys = path.split('.')
    let found = lookupPath(translations, keys)
    if (found === MISSING) {
      // Fallback to Thai dictionary if key not found in current language
      const fallback = lookupPath(th, keys)
      found = fallback === MISSING ? path : (fallback ?? path)
    }

    if (typeof found !== 'string') {
      return path
    }

    return interpolate(found, params)
  }
}

const translators: Record<Language, TranslateFn> = {
  th: createTranslator(dictionaries.th),
  en: createTranslator(dictionaries.en),
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  const language = useSyncExternalStore(subscribeToLanguage, getLanguageSnapshot, getServerLanguageSnapshot)

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      translations: dictionaries[language] || th,
      t: translators[language] || translators.th,
    }),
    [language]
  )

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return value
}
