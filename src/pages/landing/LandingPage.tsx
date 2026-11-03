import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'
import { useEffect } from 'react'

import { BankingSection } from './BankingSection'
import { FinalCta, LandingFooter } from './Closing'
import { CreditSection } from './CreditSection'
import { Hero, LandingHeader } from './Hero'
import { SegmentOnboarding } from './SegmentOnboarding'
import { TrustSection } from './TrustSection'

/** Página pública da ErpIa em "/", para quem ainda não entrou. */
export function LandingPage() {
  useEffect(() => {
    const previous = document.title
    document.title = 'ErpIa · ERP com banking e crédito para empresas'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    // reducedMotion="user": com "reduzir movimento" ligado, as transformações viram cortes secos.
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <div className="min-h-screen bg-paper text-ink">
          <a
            href="#conteudo"
            className="sr-only rounded-control bg-accent px-4 py-2 text-on-accent focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10"
          >
            Pular para o conteúdo
          </a>
          <LandingHeader />
          <main id="conteudo">
            <Hero />
            <SegmentOnboarding />
            <CreditSection />
            <BankingSection />
            <TrustSection />
            <FinalCta />
          </main>
          <LandingFooter />
        </div>
      </LazyMotion>
    </MotionConfig>
  )
}
