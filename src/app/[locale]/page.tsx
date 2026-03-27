import { Link } from "@/i18n/navigation";
import Image from "next/image";
import Script from "next/script";
import { SplineScene } from "@/components/landing/SplineScene";
import { RevealOnScroll } from "@/components/landing/RevealOnScroll";
import { TrustedBy } from "@/components/landing/TrustedBy";
import { Navbar } from "@/components/landing/Navbar";
import { JsonLd } from "@/components/seo/JsonLd";
import { getTranslations, getLocale } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("metadata");
  const locale = await getLocale();
  const baseUrl = "https://chataziendale.it";
  const path = locale === "en" ? "" : `/${locale}`;

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `${baseUrl}${path || "/"}`,
      languages: {
        en: `${baseUrl}/`,
        it: `${baseUrl}/it`,
        "x-default": `${baseUrl}/`,
      },
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: `${baseUrl}${path || "/"}`,
      siteName: "ChatAziendale",
      locale: locale === "it" ? "it_IT" : "en_US",
      type: "website",
      images: [
        {
          url: `${baseUrl}/images/og-image.png`,
          width: 1200,
          height: 630,
          alt: "ChatAziendale — AI Chatbot Builder",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [`${baseUrl}/images/og-image.png`],
    },
  };
}

export default async function Home() {
  const t = await getTranslations("landing");
  const tc = await getTranslations("common");
  const locale = await getLocale();

  const baseUrl = "https://chataziendale.it";

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ChatAziendale",
    url: baseUrl,
    logo: `${baseUrl}/images/logo.png`,
    description: "AI-powered chatbot platform that lets businesses create custom chatbots trained on their own data.",
    contactPoint: {
      "@type": "ContactPoint",
      email: "support@chataziendale.it",
      contactType: "customer support",
    },
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ChatAziendale",
    url: baseUrl,
    inLanguage: [locale === "it" ? "it-IT" : "en-US"],
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ChatAziendale",
    url: baseUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "Build a custom AI chatbot in 5 minutes. Train it on your documents, website, or text — it answers questions instantly with source citations.",
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "USD",
        description: "1 chatbot, 50 messages/month",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "29",
        priceCurrency: "USD",
        priceSpecification: { "@type": "UnitPriceSpecification", billingDuration: "P1M" },
        description: "5 chatbots, 2,000 messages/month",
      },
      {
        "@type": "Offer",
        name: "Business",
        price: "149",
        priceCurrency: "USD",
        priceSpecification: { "@type": "UnitPriceSpecification", billingDuration: "P1M" },
        description: "Unlimited chatbots, 10,000 messages/month",
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: t("faq1Q"), acceptedAnswer: { "@type": "Answer", text: t("faq1A") } },
      { "@type": "Question", name: t("faq2Q"), acceptedAnswer: { "@type": "Answer", text: t("faq2A") } },
      { "@type": "Question", name: t("faq3Q"), acceptedAnswer: { "@type": "Answer", text: t("faq3A") } },
      { "@type": "Question", name: t("faq4Q"), acceptedAnswer: { "@type": "Answer", text: t("faq4A") } },
      { "@type": "Question", name: t("faq5Q"), acceptedAnswer: { "@type": "Answer", text: t("faq5A") } },
      { "@type": "Question", name: t("faq6Q"), acceptedAnswer: { "@type": "Answer", text: t("faq6A") } },
    ],
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: t("howTitle"),
    description: "Set up an AI chatbot trained on your business data in three simple steps.",
    step: [
      { "@type": "HowToStep", position: 1, name: t("step1Title"), text: t("step1Desc") },
      { "@type": "HowToStep", position: 2, name: t("step2Title"), text: t("step2Desc") },
      { "@type": "HowToStep", position: 3, name: t("step3Title"), text: t("step3Desc") },
    ],
  };

  return (
    <div className="relative min-h-screen bg-[#FAFAF7] text-[#1B1B1F] overflow-x-hidden" style={{ colorScheme: 'light' }}>
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <JsonLd data={softwareSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={howToSchema} />
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative z-10 min-h-[calc(100vh-4rem)] flex items-center pt-20 sm:pt-24">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-0">
          <div className="grid lg:grid-cols-[1.1fr_1.1fr] gap-10 lg:gap-4 items-center">
            {/* Left — Copy */}
            <div className="stagger-children">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200/60 text-teal-700 text-[13px] font-medium mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                {t("badge")}
              </div>

              <h1 className="font-serif text-[clamp(2.25rem,4.5vw,3.75rem)] tracking-[-0.02em] leading-[1.08] text-[#18181B] mb-6">
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
                  <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#52525B]">
                {(["benefit1", "benefit2", "benefit3"] as const).map((key) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {t(key)}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — 3D Robot */}
            <div className="relative h-[360px] sm:h-[440px] lg:h-[540px]">
              <SplineScene />
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative z-10 py-24 bg-white border-y border-[#E4E4E7] overflow-hidden">
        <div className="absolute inset-0 bg-dots opacity-[0.35] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative">
          <RevealOnScroll>
            <div className="mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-700 text-xs font-semibold tracking-wider uppercase mb-4">
                {t("featuresTag")}
              </div>
              <h2 className="font-serif text-3xl sm:text-[2.5rem] tracking-[-0.015em] text-[#18181B] leading-tight">
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

      {/* ── TRUSTED BY ── */}
      <TrustedBy />

      {/* ── DEMO ── */}
      <section className="relative z-10 py-24">
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <RevealOnScroll>
            <div className="text-center mb-14">
              <h2 className="font-serif text-3xl sm:text-[2.5rem] tracking-[-0.015em] text-[#18181B] mb-4">
                {t("demoTitle")}
              </h2>
              <p className="text-lg text-[#71717A] max-w-2xl mx-auto">{t("demoSubtitle")}</p>
            </div>
          </RevealOnScroll>

          <RevealOnScroll>
            <div className="demo-tilt rounded-2xl border border-[#E4E4E7] bg-white shadow-2xl overflow-hidden">
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
                    <svg className="w-4 h-4 text-[#71717A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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
                    <div className="flex items-center gap-1.5 pt-3 border-t border-[#E4E4E7] text-xs text-[#71717A]">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                      </svg>
                      {t("previewSource")}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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
              <h2 className="font-serif text-3xl sm:text-[2.5rem] tracking-[-0.015em] text-[#18181B]">
                {t("howTitle")}
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-7 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] border-t border-dashed border-[#D4D4D8]" />

            <RevealOnScroll delay={0}>
              <div className="text-center relative">
                <div className="relative z-10 w-14 h-14 mx-auto mb-6 rounded-full bg-[#0F766E] shadow-lg shadow-teal-700/25 flex items-center justify-center">
                  <span className="text-sm font-bold text-white tracking-wider">01</span>
                </div>
                <h3 className="text-base font-semibold text-[#18181B] mb-2">{t("step1Title")}</h3>
                <p className="text-[14px] text-[#71717A] leading-relaxed max-w-[240px] mx-auto">{t("step1Desc")}</p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={150}>
              <div className="text-center relative">
                <div className="relative z-10 w-14 h-14 mx-auto mb-6 rounded-full bg-[#0F766E] shadow-lg shadow-teal-700/25 flex items-center justify-center">
                  <span className="text-sm font-bold text-white tracking-wider">02</span>
                </div>
                <h3 className="text-base font-semibold text-[#18181B] mb-2">{t("step2Title")}</h3>
                <p className="text-[14px] text-[#71717A] leading-relaxed max-w-[240px] mx-auto">{t("step2Desc")}</p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={300}>
              <div className="text-center relative">
                <div className="relative z-10 w-14 h-14 mx-auto mb-6 rounded-full bg-[#0F766E] shadow-lg shadow-teal-700/25 flex items-center justify-center">
                  <span className="text-sm font-bold text-white tracking-wider">03</span>
                </div>
                <h3 className="text-base font-semibold text-[#18181B] mb-2">{t("step3Title")}</h3>
                <p className="text-[14px] text-[#71717A] leading-relaxed max-w-[240px] mx-auto">{t("step3Desc")}</p>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="relative z-10 py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <RevealOnScroll>
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-700 text-xs font-semibold tracking-wider uppercase mb-4">
                {t("testimonialsTag")}
              </div>
              <h2 className="font-serif text-3xl sm:text-[2.5rem] tracking-[-0.015em] text-[#18181B] leading-tight">
                {t("testimonialsTitle")}
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid md:grid-cols-3 gap-6">
            {([
              { q: "testimonial1Quote", n: "testimonial1Name", r: "testimonial1Role", c: "testimonial1Company" },
              { q: "testimonial2Quote", n: "testimonial2Name", r: "testimonial2Role", c: "testimonial2Company" },
              { q: "testimonial3Quote", n: "testimonial3Name", r: "testimonial3Role", c: "testimonial3Company" },
            ] as const).map((item, i) => (
              <RevealOnScroll key={i} delay={i * 100}>
                <div className="p-7 rounded-2xl bg-white border border-[#E4E4E7] h-full flex flex-col">
                  <svg className="w-8 h-8 text-teal-200 mb-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
                  </svg>
                  <p className="text-[15px] text-[#3F3F46] leading-relaxed mb-6 flex-1">
                    {t(item.q)}
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-[#E4E4E7]">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold text-sm">
                      {t(item.n).split(' ').map(w => w[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#18181B]">{t(item.n)}</p>
                      <p className="text-xs text-[#71717A]">{t(item.r)}, {t(item.c)}</p>
                    </div>
                  </div>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="relative z-10 py-24 bg-white border-y border-[#E4E4E7]">
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <RevealOnScroll>
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-700 text-xs font-semibold tracking-wider uppercase mb-4">
                {t("pricingTag")}
              </div>
              <h2 className="font-serif text-3xl sm:text-[2.5rem] tracking-[-0.015em] text-[#18181B] leading-tight">
                {t("pricingTitle")}
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <RevealOnScroll delay={0}>
              <div className="p-7 rounded-2xl bg-[#FAFAF7] border border-[#E4E4E7] h-full flex flex-col">
                <p className="text-sm font-semibold text-[#18181B] mb-1">{t("pricingFree")}</p>
                <p className="text-xs text-[#71717A] mb-4">{t("pricingForever")}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-[#18181B]">{t("pricingFreePrice")}</span>
                  <span className="text-sm text-[#71717A]">{t("pricingPerMonth")}</span>
                </div>
                <div className="space-y-3 mb-8 flex-1">
                  {(["pricingFreeFeat1", "pricingFreeFeat2", "pricingFreeFeat3", "pricingFreeFeat4"] as const).map((key) => (
                    <div key={key} className="flex items-center gap-2 text-sm text-[#52525B]">
                      <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t(key)}
                    </div>
                  ))}
                </div>
                <Link href="/signup" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-[#0F766E] rounded-xl border border-[#0F766E] hover:bg-teal-50 transition-colors duration-200">
                  {t("pricingCta")}
                </Link>
              </div>
            </RevealOnScroll>

            {/* Pro */}
            <RevealOnScroll delay={100}>
              <div className="p-7 rounded-2xl bg-white border-2 border-teal-500 h-full flex flex-col relative shadow-lg shadow-teal-500/10">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-teal-600 text-white text-xs font-semibold">
                  {t("pricingMostPopular")}
                </div>
                <p className="text-sm font-semibold text-[#18181B] mb-1">{t("pricingPro")}</p>
                <p className="text-xs text-[#71717A] mb-4">{t("pricingMostPopular")}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-[#18181B]">{t("pricingProPrice")}</span>
                  <span className="text-sm text-[#71717A]">{t("pricingPerMonth")}</span>
                </div>
                <div className="space-y-3 mb-8 flex-1">
                  {(["pricingProFeat1", "pricingProFeat2", "pricingProFeat3", "pricingProFeat4", "pricingProFeat5"] as const).map((key) => (
                    <div key={key} className="flex items-center gap-2 text-sm text-[#52525B]">
                      <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t(key)}
                    </div>
                  ))}
                </div>
                <Link href="/signup" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-[#0D6960] transition-colors duration-200">
                  {t("pricingCtaPro")}
                </Link>
              </div>
            </RevealOnScroll>

            {/* Business */}
            <RevealOnScroll delay={200}>
              <div className="p-7 rounded-2xl bg-[#FAFAF7] border border-[#E4E4E7] h-full flex flex-col">
                <p className="text-sm font-semibold text-[#18181B] mb-1">{t("pricingBusiness")}</p>
                <p className="text-xs text-[#71717A] mb-4">{t("pricingEnterprise")}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-[#18181B]">{t("pricingBusinessPrice")}</span>
                  <span className="text-sm text-[#71717A]">{t("pricingPerMonth")}</span>
                </div>
                <div className="space-y-3 mb-8 flex-1">
                  {(["pricingBizFeat1", "pricingBizFeat2", "pricingBizFeat3", "pricingBizFeat4", "pricingBizFeat5"] as const).map((key) => (
                    <div key={key} className="flex items-center gap-2 text-sm text-[#52525B]">
                      <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t(key)}
                    </div>
                  ))}
                </div>
                <Link href="/signup" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-[#0F766E] rounded-xl border border-[#0F766E] hover:bg-teal-50 transition-colors duration-200">
                  {t("pricingCtaBiz")}
                </Link>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="relative z-10 py-24">
        <div className="max-w-3xl mx-auto px-6 lg:px-12">
          <RevealOnScroll>
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-700 text-xs font-semibold tracking-wider uppercase mb-4">
                {t("faqTag")}
              </div>
              <h2 className="font-serif text-3xl sm:text-[2.5rem] tracking-[-0.015em] text-[#18181B] leading-tight">
                {t("faqTitle")}
              </h2>
            </div>
          </RevealOnScroll>

          <div className="space-y-4">
            {([
              { q: "faq1Q", a: "faq1A" },
              { q: "faq2Q", a: "faq2A" },
              { q: "faq3Q", a: "faq3A" },
              { q: "faq4Q", a: "faq4A" },
              { q: "faq5Q", a: "faq5A" },
              { q: "faq6Q", a: "faq6A" },
            ] as const).map((item, i) => (
              <RevealOnScroll key={i} delay={i * 50}>
                <details className="group rounded-2xl border border-[#E4E4E7] bg-white overflow-hidden">
                  <summary className="flex items-center justify-between px-6 py-5 cursor-pointer text-[15px] font-semibold text-[#18181B] hover:bg-[#FAFAF7] transition-colors">
                    {t(item.q)}
                    <svg className="w-5 h-5 text-[#71717A] flex-shrink-0 ml-4 group-open:rotate-180 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-5 text-[15px] text-[#52525B] leading-relaxed">
                    {t(item.a)}
                  </div>
                </details>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative z-10 py-24 bg-[#0A3D38] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.15)_0%,_transparent_60%)] pointer-events-none" />
        <div className="max-w-3xl mx-auto px-6 text-center relative">
          <RevealOnScroll>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] tracking-[-0.015em] text-white mb-5 leading-tight">
              {t("ctaTitle")}
            </h2>
            <p className="text-lg text-teal-200/80 max-w-xl mx-auto mb-10 leading-relaxed">
              {t("ctaSubtitle")}
            </p>
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2.5 px-10 py-4 text-base font-semibold text-[#0A3D38] bg-white rounded-xl hover:bg-teal-50 transition-colors duration-200 active:scale-[0.98]"
            >
              <span>{t("ctaGetStarted")}</span>
              <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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
            <Image src="/images/logo.png" alt="ChatAziendale.it" width={28} height={28} className="opacity-60" />
            <span className="text-sm text-[#71717A]">{tc("copyright")}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="text-sm text-[#71717A] hover:text-[#3F3F46] transition-colors duration-200">{tc("docs")}</Link>
            <Link href="/privacy" className="text-sm text-[#71717A] hover:text-[#3F3F46] transition-colors duration-200">{tc("privacy")}</Link>
            <Link href="/terms" className="text-sm text-[#71717A] hover:text-[#3F3F46] transition-colors duration-200">{tc("terms")}</Link>
          </div>
        </div>
      </footer>

      {/* ChatNiuexa Widget */}
      <Script
        src="https://chatniuexa.onrender.com/widget.js"
        data-chatbot-id="cmm7mojtm0001fzrkekjpfh84"
        strategy="afterInteractive"
      />
    </div>
  );
}
