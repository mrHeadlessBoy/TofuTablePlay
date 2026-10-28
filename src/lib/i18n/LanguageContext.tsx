'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Language, Translations } from './types';
import { th } from './locales/th';
import { en } from './locales/en';

const STORAGE_KEY = 'tofu_language';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  translations: Translations;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const dictionaries: Record<Language, Translations> = { th, en };

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'th';
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored === 'th' || stored === 'en') {
        return stored;
      }
      const browserLang = navigator.language?.toLowerCase() || '';
      if (browserLang.startsWith('en')) {
        return 'en';
      }
    } catch {
      // Ignore if localStorage unavailable
    }
    return 'th';
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'th' || e.newValue === 'en')) {
        setLanguageState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.cookie = `${STORAGE_KEY}=${newLang}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Ignore storage errors
    }
  }, []);

  const currentTranslations = useMemo(() => {
    return dictionaries[language] || th;
  }, [language]);

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const keys = path.split('.');
      let current: unknown = currentTranslations;

      for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
          current = (current as Record<string, unknown>)[key];
        } else {
          // Fallback to Thai dictionary if key not found in current language
          let fallback: unknown = th;
          for (const fbKey of keys) {
            if (fallback && typeof fallback === 'object' && fbKey in fallback) {
              fallback = (fallback as Record<string, unknown>)[fbKey];
            } else {
              fallback = null;
              break;
            }
          }
          current = fallback ?? path;
          break;
        }
      }

      if (typeof current !== 'string') {
        return path;
      }

      let result = current;
      if (params) {
        for (const [pKey, pVal] of Object.entries(params)) {
          result = result.replaceAll(`{${pKey}}`, String(pVal));
        }
      }

      return result;
    },
    [currentTranslations]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      translations: currentTranslations,
      t,
    }),
    [language, setLanguage, currentTranslations, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
