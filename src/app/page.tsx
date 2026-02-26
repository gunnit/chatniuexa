import Link from "next/link";
import Image from "next/image";
import { SplineScene } from "@/components/landing/SplineScene";
import { RevealOnScroll } from "@/components/landing/RevealOnScroll";
import { Navbar } from "@/components/landing/Navbar";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#030014] text-white overflow-x-hidden">
      {/* ── Ambient Background ── */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full bg-purple-600/[0.12] blur-[120px] animate-[drift_25s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-indigo-600/[0.08] blur-[100px] animate-[drift_30s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-[40%] left-[60%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-fuchsia-600/[0.06] blur-[140px] animate-[drift_35s_ease-in-out_infinite_-10s]" />
        {/* Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:72px_72px]" />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,transparent_40%,#030014_100%)]" />
      </div>

      <Navbar />

      {/* ══════════════════════════════════════════════
          HERO SECTION
          ══════════════════════════════════════════════ */}
      <section className="relative z-10 min-h-screen flex items-center pt-16 sm:pt-[72px]">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-0">
          <div className="grid lg:grid-cols-[1fr_1.15fr] gap-8 lg:gap-4 items-center">
            {/* Left — Content */}
            <div className="stagger-children">
              {/* Status Badge */}
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[13px] text-slate-300 font-medium">AI-Powered Customer Support</span>
              </div>

              {/* Headline */}
              <h1 className="text-[clamp(2.75rem,5.5vw,4.75rem)] font-bold tracking-[-0.03em] leading-[1.05] mb-6">
                Your AI Assistant,{" "}
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  Always Ready
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg sm:text-xl text-slate-400 max-w-lg leading-relaxed mb-10">
                Deploy intelligent chatbots trained on your business data.
                Instant, accurate responses with source citations — 24/7.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mb-14">
                <Link
                  href="/signup"
                  className="group relative inline-flex items-center justify-center gap-2.5 px-8 py-4 text-[15px] font-semibold text-white rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_24px_rgba(99,102,241,0.3)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative">Start Free Trial</span>
                  <svg className="relative w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 text-[15px] font-semibold text-white/80 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white transition-all duration-300"
                >
                  Sign In
                </Link>
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-8">
                <div>
                  <div className="text-2xl font-bold tracking-tight">99.9%</div>
                  <div className="text-xs text-slate-500 mt-0.5">Uptime SLA</div>
                </div>
                <div className="h-8 w-px bg-white/[0.06]" />
                <div>
                  <div className="text-2xl font-bold tracking-tight">&lt;50ms</div>
                  <div className="text-xs text-slate-500 mt-0.5">Response Time</div>
                </div>
                <div className="h-8 w-px bg-white/[0.06]" />
                <div>
                  <div className="text-2xl font-bold tracking-tight">10K+</div>
                  <div className="text-xs text-slate-500 mt-0.5">Active Bots</div>
                </div>
              </div>
            </div>

            {/* Right — Spline 3D Robot */}
            <div className="relative h-[420px] sm:h-[520px] lg:h-[640px]">
              {/* Glow behind */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] bg-violet-500/[0.08] rounded-full blur-[80px] pointer-events-none" />
              <SplineScene />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TRUST BAR
          ══════════════════════════════════════════════ */}
      <section className="relative z-10 py-16 border-y border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-[13px] text-slate-500 uppercase tracking-[0.2em] font-medium mb-10">
            Trusted by forward-thinking businesses
          </p>
          <div className="flex items-center justify-center gap-12 sm:gap-16 flex-wrap">
            {["TechCorp", "InnovateLab", "DataFlow", "CloudSync", "AIBridge"].map((name) => (
              <div key={name} className="text-[17px] font-semibold tracking-tight text-white/[0.2] hover:text-white/[0.35] transition-colors duration-300 cursor-default select-none">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FEATURES
          ══════════════════════════════════════════════ */}
      <section className="relative z-10 py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <RevealOnScroll>
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wider uppercase mb-5">
                Features
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-[-0.025em] mb-5">
                Everything you need to{" "}
                <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  automate support
                </span>
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Build, train, and deploy AI chatbots that actually understand your business.
              </p>
            </div>
          </RevealOnScroll>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Card 1 — RAG */}
            <RevealOnScroll delay={0}>
              <div className="group relative p-8 rounded-3xl bg-white/[0.02] border border-white/[0.06] hover:border-indigo-500/20 transition-all duration-500 hover:bg-white/[0.04] h-full">
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b from-indigo-500/[0.05] to-transparent pointer-events-none" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">RAG-Powered Intelligence</h3>
                  <p className="text-slate-400 leading-relaxed text-[15px]">
                    Retrieval-augmented generation ensures responses are grounded in your actual data, not hallucinations.
                  </p>
                </div>
              </div>
            </RevealOnScroll>

            {/* Card 2 — Multi-Source */}
            <RevealOnScroll delay={100}>
              <div className="group relative p-8 rounded-3xl bg-white/[0.02] border border-white/[0.06] hover:border-violet-500/20 transition-all duration-500 hover:bg-white/[0.04] h-full">
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b from-violet-500/[0.05] to-transparent pointer-events-none" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">Multi-Source Learning</h3>
                  <p className="text-slate-400 leading-relaxed text-[15px]">
                    Upload PDFs, crawl websites, paste text — your chatbot learns from every source you throw at it.
                  </p>
                </div>
              </div>
            </RevealOnScroll>

            {/* Card 3 — Branding */}
            <RevealOnScroll delay={200}>
              <div className="group relative p-8 rounded-3xl bg-white/[0.02] border border-white/[0.06] hover:border-fuchsia-500/20 transition-all duration-500 hover:bg-white/[0.04] h-full">
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b from-fuchsia-500/[0.05] to-transparent pointer-events-none" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-7 h-7 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">Custom Branding</h3>
                  <p className="text-slate-400 leading-relaxed text-[15px]">
                    White-label your chatbot with your logo, colors, and personality. It&apos;s yours, completely.
                  </p>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          HOW IT WORKS
          ══════════════════════════════════════════════ */}
      <section className="relative z-10 py-32">
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <RevealOnScroll>
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold tracking-wider uppercase mb-5">
                How it works
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-[-0.025em] mb-5">
                Get started in{" "}
                <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  three steps
                </span>
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid md:grid-cols-3 gap-10 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-14 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px">
              <div className="w-full h-full bg-gradient-to-r from-indigo-500/30 via-violet-500/30 to-fuchsia-500/30" />
            </div>

            {/* Step 1 */}
            <RevealOnScroll delay={0}>
              <div className="text-center relative">
                <div className="relative z-10 w-28 h-28 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.08)] group hover:border-indigo-500/20 transition-all duration-300">
                  <span className="text-4xl font-bold bg-gradient-to-b from-white to-white/30 bg-clip-text text-transparent">01</span>
                </div>
                <h3 className="text-lg font-semibold mb-3 tracking-tight">Upload Your Data</h3>
                <p className="text-slate-400 text-[15px] leading-relaxed max-w-[260px] mx-auto">
                  Feed your chatbot with PDFs, website URLs, or paste text directly. It learns everything.
                </p>
              </div>
            </RevealOnScroll>

            {/* Step 2 */}
            <RevealOnScroll delay={150}>
              <div className="text-center relative">
                <div className="relative z-10 w-28 h-28 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.08)] group hover:border-violet-500/20 transition-all duration-300">
                  <span className="text-4xl font-bold bg-gradient-to-b from-white to-white/30 bg-clip-text text-transparent">02</span>
                </div>
                <h3 className="text-lg font-semibold mb-3 tracking-tight">Customize &amp; Train</h3>
                <p className="text-slate-400 text-[15px] leading-relaxed max-w-[260px] mx-auto">
                  Set your brand voice, choose colors, add instructions. Make it truly yours.
                </p>
              </div>
            </RevealOnScroll>

            {/* Step 3 */}
            <RevealOnScroll delay={300}>
              <div className="text-center relative">
                <div className="relative z-10 w-28 h-28 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] flex items-center justify-center shadow-[0_0_30px_rgba(192,38,211,0.08)] group hover:border-fuchsia-500/20 transition-all duration-300">
                  <span className="text-4xl font-bold bg-gradient-to-b from-white to-white/30 bg-clip-text text-transparent">03</span>
                </div>
                <h3 className="text-lg font-semibold mb-3 tracking-tight">Deploy &amp; Engage</h3>
                <p className="text-slate-400 text-[15px] leading-relaxed max-w-[260px] mx-auto">
                  Embed on your website with one line of code. Start handling queries instantly.
                </p>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          CHAT PREVIEW
          ══════════════════════════════════════════════ */}
      <section className="relative z-10 py-32">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <RevealOnScroll>
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold tracking-[-0.025em] mb-5">
                See it in{" "}
                <span className="bg-gradient-to-r from-fuchsia-400 to-rose-400 bg-clip-text text-transparent">
                  action
                </span>
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                Real conversations, real answers, sourced from your data.
              </p>
            </div>
          </RevealOnScroll>

          <RevealOnScroll>
            <div className="relative">
              {/* Outer glow */}
              <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/[0.08] via-violet-500/[0.08] to-fuchsia-500/[0.08] rounded-[2rem] blur-2xl pointer-events-none" />

              <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-1.5 shadow-[0_32px_64px_rgba(0,0,0,0.4)]">
                <div className="rounded-[20px] bg-[#0c0c1d]/90 p-6 sm:p-8">
                  {/* Window chrome */}
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                    <div className="ml-4 px-3 py-1 rounded-lg bg-white/[0.04] text-[11px] text-slate-500 font-mono">
                      chataziendale.it / live-demo
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="space-y-6">
                    {/* User message */}
                    <div className="flex gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4.5 h-4.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                        </svg>
                      </div>
                      <div className="bg-white/[0.04] rounded-2xl rounded-tl-lg px-5 py-3.5 max-w-md">
                        <p className="text-[15px] text-slate-300">What are your shipping policies for international orders?</p>
                      </div>
                    </div>

                    {/* AI response */}
                    <div className="flex gap-3.5 justify-end">
                      <div className="bg-gradient-to-br from-indigo-500/[0.12] to-violet-500/[0.12] border border-indigo-500/[0.08] rounded-2xl rounded-tr-lg px-5 py-3.5 max-w-lg">
                        <p className="text-[15px] text-white/90 mb-3">We offer worldwide shipping with the following options:</p>
                        <div className="space-y-2.5 mb-4">
                          <div className="flex items-center gap-2.5 text-sm text-slate-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                            Standard International (7-14 days): $9.99
                          </div>
                          <div className="flex items-center gap-2.5 text-sm text-slate-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                            Express International (3-5 days): $19.99
                          </div>
                          <div className="flex items-center gap-2.5 text-sm text-slate-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                            Priority (1-3 days): $34.99
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 pt-3 border-t border-white/[0.06] text-xs text-slate-500">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                          </svg>
                          Source: shipping-policy.pdf — page 3
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0 shadow-[0_0_16px_rgba(99,102,241,0.3)]">
                        <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FINAL CTA
          ══════════════════════════════════════════════ */}
      <section className="relative z-10 py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <RevealOnScroll>
            {/* Ambient glow */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-violet-500/[0.06] rounded-full blur-[100px] pointer-events-none" />

            <h2 className="relative text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.025em] mb-6 leading-[1.1]">
              Ready to transform your{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                customer experience
              </span>
              ?
            </h2>
            <p className="relative text-lg text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed">
              Start free. No credit card required. Set up your first AI chatbot in under 5 minutes.
            </p>
            <div className="relative flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="group relative inline-flex items-center justify-center gap-2.5 px-10 py-5 text-base font-semibold text-white rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_40px_rgba(99,102,241,0.25)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative">Get Started Free</span>
                <svg className="relative w-5 h-5 group-hover:translate-x-0.5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER
          ══════════════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-white/[0.04] py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="ChatAziendale.it" width={28} height={28} className="opacity-50" />
            <span className="text-sm text-slate-500">&copy; 2026 ChatAziendale.it. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-8">
            <Link href="/privacy" className="text-sm text-slate-500 hover:text-slate-300 transition-colors duration-200">Privacy</Link>
            <Link href="/terms" className="text-sm text-slate-500 hover:text-slate-300 transition-colors duration-200">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
