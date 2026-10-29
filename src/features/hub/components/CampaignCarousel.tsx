'use client'

import { useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Compass } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { PublicCampaign } from '../types'

const CAMPAIGNS_PER_PAGE = 6
const SWIPE_THRESHOLD_PX = 50

type CampaignCarouselProps = {
  campaigns: PublicCampaign[]
  renderCard: (camp: PublicCampaign) => ReactNode
}

// "Explore Campaigns": collapsible, paged (6 per page) carousel with swipe and dot navigation
export default function CampaignCarousel({ campaigns, renderCard }: CampaignCarouselProps) {
  const { t, language } = useLanguage()
  const [isExtended, setIsExtended] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const totalPages = Math.max(1, Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, Math.max(0, totalPages - 1))
  const isFirstPage = safeCurrentPage === 0
  const isLastPage = safeCurrentPage >= totalPages - 1

  const campaignPages = useMemo(() => {
    const pages: PublicCampaign[][] = []
    for (let i = 0; i < campaigns.length; i += CAMPAIGNS_PER_PAGE) {
      pages.push(campaigns.slice(i, i + CAMPAIGNS_PER_PAGE))
    }
    return pages
  }, [campaigns])

  const goToPrevious = () => setCurrentPage((p) => Math.max(0, p - 1))
  const goToNext = () => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
  const toggleExtended = () => setIsExtended((prev) => !prev)

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current === null) return
    const diffX = touchStartX.current - e.changedTouches[0].clientX
    if (diffX > SWIPE_THRESHOLD_PX && !isLastPage) {
      goToNext()
    } else if (diffX < -SWIPE_THRESHOLD_PX && !isFirstPage) {
      goToPrevious()
    }
    touchStartX.current = null
  }

  const collapseLabel = language === 'en' ? 'Collapse' : 'ย่อ'
  const expandLabel = language === 'en' ? 'Expand' : 'ขยาย'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/40 pb-3">
        <button
          type="button"
          onClick={toggleExtended}
          aria-expanded={isExtended}
          aria-controls="explore-campaigns-section"
          className="flex items-center gap-2.5 text-base sm:text-lg font-semibold text-zinc-100 hover:text-amber-400 transition-colors cursor-pointer select-none group text-left"
        >
          <Compass className="w-5 h-5 text-amber-500/90 group-hover:rotate-12 transition-transform" />
          <span>{t('hub.publicCampaigns')}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800/70 border border-zinc-700/50 text-zinc-400 group-hover:text-zinc-200 font-normal">
            {campaigns.length}
          </span>
          <span className="text-xs text-zinc-400 group-hover:text-amber-400 flex items-center gap-1 ml-1 font-normal">
            {isExtended ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="hidden sm:inline">{isExtended ? collapseLabel : expandLabel}</span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          {isExtended && totalPages > 1 && (
            <div className="flex items-center gap-1.5 text-xs bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-1">
              <PagerArrowButton
                direction="previous"
                disabled={isFirstPage}
                onClick={goToPrevious}
              />
              <span className="px-2 text-zinc-300 font-mono text-[11px] select-none">
                {t('hub.page')} {safeCurrentPage + 1} / {totalPages}
              </span>
              <PagerArrowButton direction="next" disabled={isLastPage} onClick={goToNext} />
            </div>
          )}

          <button
            type="button"
            onClick={toggleExtended}
            aria-expanded={isExtended}
            aria-controls="explore-campaigns-section"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/70 rounded-xl transition-all cursor-pointer"
          >
            <span>{isExtended ? collapseLabel : expandLabel}</span>
            {isExtended ? (
              <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>
        </div>
      </div>

      {isExtended ? (
        <div id="explore-campaigns-section" className="space-y-4">
          {campaigns.length === 0 ? (
            <div className="surface-panel rounded-2xl p-8 text-center text-zinc-500 text-sm">
              {language === 'en' ? 'No public campaigns available yet.' : 'ยังไม่มีแคมเปญสาธารณะในขณะนี้'}
            </div>
          ) : (
            <>
              <div
                className="relative overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <div
                  className="flex transition-transform duration-300 ease-out items-start"
                  style={{ transform: `translateX(-${safeCurrentPage * 100}%)` }}
                >
                  {campaignPages.map((pageCamps, pageIndex) => (
                    <div
                      key={pageIndex}
                      className="w-full shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                      {pageCamps.map(renderCard)}
                    </div>
                  ))}
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 px-1">
                  <button
                    type="button"
                    onClick={goToPrevious}
                    disabled={isFirstPage}
                    className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> {language === 'en' ? 'Previous' : 'ย้อนกลับ'}
                  </button>

                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentPage(idx)}
                        aria-label={`Go to slide ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          idx === safeCurrentPage
                            ? 'w-6 bg-amber-500/90'
                            : 'w-2 bg-zinc-700 hover:bg-zinc-500'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={goToNext}
                    disabled={isLastPage}
                    className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    {language === 'en' ? 'Next' : 'ถัดไป'} <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div
          onClick={() => setIsExtended(true)}
          className="surface-panel rounded-2xl p-4 text-center text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer flex items-center justify-center gap-2"
        >
          <span>
            {language === 'en'
              ? `Explore Campaigns is collapsed (${campaigns.length} campaigns available). Click to expand.`
              : `มุมมองแคมเปญถูกย่อไว้ (มีแคมเปญทั้งหมด ${campaigns.length} รายการ) คลิกเพื่อขยาย`}
          </span>
        </div>
      )}
    </div>
  )
}

function PagerArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'previous' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'previous' ? 'Previous campaigns' : 'Next campaigns'}
      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
    >
      {direction === 'previous' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    </button>
  )
}
