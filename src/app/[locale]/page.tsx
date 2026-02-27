import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { SplineScene } from "@/components/landing/SplineScene";
import { RevealOnScroll } from "@/components/landing/RevealOnScroll";
import { Navbar } from "@/components/landing/Navbar";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function Home() {
  const t = await getTranslations("landing");
  const tc = await getTranslations("common");

  return (
    <div className="relative min-h-screen bg-[#FAFAF7] text-[#1B1B1F] overflow-x-hidden">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative z-10 min-h-[calc(100vh-4rem)] flex items-center pt-20 sm:pt-24">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-0">
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-6 items-center">
            {/* Left — Copy */}
            <div className="stagger-children">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200/60 text-teal-700 text-[13px] font-medium mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                {t("badge")}
              </div>

              <h1 className="text-[clamp(2.25rem,4.5vw,3.75rem)] font-extrabold tracking-[-0.035em] leading-[1.1] text-[#18181B] mb-6">
                {t("headline")}
              </h1>

              <p className="text-[17px] sm:text-lg text-[#52525B] max-w-xl leading-[1.7] mb-10">
                {t("subheadline")}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-12">
                <Link
                  href="/signup"
                  className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 text-[15px] font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-[#0D6960] transition-colors duration-200 active:scale-[0.98]"
                >
                  <span>{t("ctaStartTrial")}</span>
                  <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-[15px] font-medium text-[#3F3F46] rounded-xl border border-[#D4D4D8] bg-white hover:bg-[#F4F4F5] transition-colors duration-200"
                >
                  {t("ctaSignIn")}
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#71717A]">
                {(["benefit1", "benefit2", "benefit3"] as const).map((key) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {t(key)}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — 3D Robot in dark canvas */}
            <div className="relative h-[360px] sm:h-[440px] lg:h-[540px]">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.15)] overflow-hidden">
                <SplineScene />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative z-10 py-24 bg-white border-y border-[#E4E4E7]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <RevealOnScroll>
            <div className="mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-700 text-xs font-semibold tracking-wider uppercase mb-4">
                {t("featuresTag")}
              </div>
              <h2 className="text-3xl sm:text-[2.5rem] font-bold tracking-[-0.025em] text-[#18181B] leading-tight">
                {t("featuresTitle")}
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid md:grid-cols-3 gap-6">
            <RevealOnScroll delay={0}>
              <div className="group p-7 rounded-2xl bg-[#FAFAF7] border border-[#E4E4E7] hover:border-teal-300 hover:shadow-md transition-all duration-300 h-full">
                <div className="w-12 h-1 bg-teal-500 rounded-full mb-6" />
                <h3 className="text-lg font-semibold text-[#18181B] mb-2.5 tracking-tight">{t("featureRagTitle")}</h3>
                <p className="text-[15px] text-[#71717A] leading-relaxed">{t("featureRagDesc")}</p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={100}>
              <div className="group p-7 rounded-2xl bg-[#FAFAF7] border border-[#E4E4E7] hover:border-amber-300 hover:shadow-md transition-all duration-300 h-full">
                <div className="w-12 h-1 bg-amber-500 rounded-full mb-6" />
                <h3 className="text-lg font-semibold text-[#18181B] mb-2.5 tracking-tight">{t("featureMultiTitle")}</h3>
                <p className="text-[15px] text-[#71717A] leading-relaxed">{t("featureMultiDesc")}</p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={200}>
              <div className="group p-7 rounded-2xl bg-[#FAFAF7] border border-[#E4E4E7] hover:border-rose-300 hover:shadow-md transition-all duration-300 h-full">
                <div className="w-12 h-1 bg-rose-500 rounded-full mb-6" />
                <h3 className="text-lg font-semibold text-[#18181B] mb-2.5 tracking-tight">{t("featureBrandTitle")}</h3>
                <p className="text-[15px] text-[#71717A] leading-relaxed">{t("featureBrandDesc")}</p>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ── DEMO ── */}
      <section className="relative z-10 py-24">
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <RevealOnScroll>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-[2.5rem] font-bold tracking-[-0.025em] text-[#18181B] mb-4">
                {t("demoTitle")}
              </h2>
              <p className="text-lg text-[#71717A] max-w-2xl mx-auto">{t("demoSubtitle")}</p>
            </div>
          </RevealOnScroll>

          <RevealOnScroll>
            <div className="rounded-2xl border border-[#E4E4E7] bg-white shadow-xl overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-[#E4E4E7] bg-[#FAFAF7]">
                <div className="w-3 h-3 rounded-full bg-[#EF4444]/60" />
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]/60" />
                <div className="w-3 h-3 rounded-full bg-[#22C55E]/60" />
                <div className="ml-3 px-3 py-1 rounded-md bg-white border border-[#E4E4E7] text-[11px] text-[#A1A1AA] font-mono">
                  {t("previewUrl")}
                </div>
              </div>
              {/* Chat messages */}
              <div className="p-6 sm:p-8 space-y-6 bg-[#FAFAF7]/50">
                {/* User message */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E4E4E7] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-[#71717A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                    </svg>
                  </div>
                  <div className="bg-white border border-[#E4E4E7] rounded-2xl rounded-tl-md px-5 py-3.5 max-w-md shadow-sm">
                    <p className="text-[15px] text-[#3F3F46]">{t("previewUserMsg")}</p>
                  </div>
                </div>
                {/* Bot response */}
                <div className="flex gap-3 justify-end">
                  <div className="bg-white border border-[#E4E4E7] rounded-2xl rounded-tr-md px-5 py-4 max-w-lg shadow-sm">
                    <p className="text-[15px] text-[#3F3F46] mb-3">{t("previewBotMsg")}</p>
                    <div className="space-y-2 mb-4">
                      {(["previewShip1", "previewShip2", "previewShip3"] as const).map((key) => (
                        <div key={key} className="flex items-center gap-2 text-sm text-[#52525B]">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                          {t(key)}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 pt-3 border-t border-[#E4E4E7] text-xs text-[#A1A1AA]">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                      </svg>
                      {t("previewSource")}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="relative z-10 py-24 bg-white border-y border-[#E4E4E7]">
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <RevealOnScroll>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-700 text-xs font-semibold tracking-wider uppercase mb-4">
                {t("howTag")}
              </div>
              <h2 className="text-3xl sm:text-[2.5rem] font-bold tracking-[-0.025em] text-[#18181B]">
                {t("howTitle")}
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-6 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-[#E4E4E7]" />

            <RevealOnScroll delay={0}>
              <div className="text-center relative">
                <div className="relative z-10 w-12 h-12 mx-auto mb-6 rounded-full bg-teal-50 border-2 border-teal-200 flex items-center justify-center">
                  <span className="text-sm font-bold text-teal-700">01</span>
                </div>
                <h3 className="text-base font-semibold text-[#18181B] mb-2">{t("step1Title")}</h3>
                <p className="text-[14px] text-[#71717A] leading-relaxed max-w-[240px] mx-auto">{t("step1Desc")}</p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={150}>
              <div className="text-center relative">
                <div className="relative z-10 w-12 h-12 mx-auto mb-6 rounded-full bg-teal-50 border-2 border-teal-200 flex items-center justify-center">
                  <span className="text-sm font-bold text-teal-700">02</span>
                </div>
                <h3 className="text-base font-semibold text-[#18181B] mb-2">{t("step2Title")}</h3>
                <p className="text-[14px] text-[#71717A] leading-relaxed max-w-[240px] mx-auto">{t("step2Desc")}</p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={300}>
              <div className="text-center relative">
                <div className="relative z-10 w-12 h-12 mx-auto mb-6 rounded-full bg-teal-50 border-2 border-teal-200 flex items-center justify-center">
                  <span className="text-sm font-bold text-teal-700">03</span>
                </div>
                <h3 className="text-base font-semibold text-[#18181B] mb-2">{t("step3Title")}</h3>
                <p className="text-[14px] text-[#71717A] leading-relaxed max-w-[240px] mx-auto">{t("step3Desc")}</p>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative z-10 py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <RevealOnScroll>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-[-0.025em] text-[#18181B] mb-5 leading-tight">
              {t("ctaTitle")}
            </h2>
            <p className="text-lg text-[#71717A] max-w-xl mx-auto mb-10 leading-relaxed">
              {t("ctaSubtitle")}
            </p>
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2.5 px-10 py-4 text-base font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-[#0D6960] transition-colors duration-200 active:scale-[0.98]"
            >
              <span>{t("ctaGetStarted")}</span>
              <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-[#E4E4E7] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="ChatAziendale.it" width={24} height={24} className="opacity-60" />
            <span className="text-sm text-[#A1A1AA]">{tc("copyright")}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-sm text-[#A1A1AA] hover:text-[#52525B] transition-colors duration-200">{tc("privacy")}</Link>
            <Link href="/terms" className="text-sm text-[#A1A1AA] hover:text-[#52525B] transition-colors duration-200">{tc("terms")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
