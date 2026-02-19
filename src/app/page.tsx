import Link from "next/link";
import Image from "next/image";
import { AnimatedBackground } from "@/components/AnimatedBackground";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <AnimatedBackground />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/images/logo.png" alt="niuexa.ai logo" width={36} height={36} className="drop-shadow-lg" />
          <span className="text-2xl font-bold text-white tracking-tight">
            niuexa<span className="text-indigo-400">.ai</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-32 lg:pt-32">
        <div className="text-center max-w-4xl mx-auto stagger-children">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-sm text-slate-300">Powered by advanced AI</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
            AI Chatbots Trained on{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Your Data
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Deploy intelligent chatbots that learn from your documents, websites, and knowledge base.
            Get accurate, cited responses in seconds.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/signup"
              className="group relative px-8 py-4 text-base font-semibold text-white rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center justify-center gap-2">
                Start Free Trial
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 text-base font-semibold text-white rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all"
            >
              Sign In
            </Link>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="text-sm font-medium text-white">RAG-Powered</div>
              <div className="text-xs text-slate-500 mt-1">Accurate, cited answers</div>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-sm font-medium text-white">Multi-Source</div>
              <div className="text-xs text-slate-500 mt-1">PDFs, URLs, docs</div>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <div className="text-sm font-medium text-white">Custom Branding</div>
              <div className="text-xs text-slate-500 mt-1">Match your brand</div>
            </div>
          </div>
        </div>

        {/* Floating Cards Preview */}
        <div className="relative mt-20 w-full max-w-5xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e27] via-transparent to-transparent z-10 pointer-events-none" />
          <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-1 shadow-2xl">
            <div className="rounded-xl bg-slate-900/80 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex-shrink-0" />
                  <div className="flex-1 bg-white/5 rounded-2xl rounded-tl-none p-4">
                    <p className="text-slate-300 text-sm">What are your shipping policies for international orders?</p>
                  </div>
                </div>
                <div className="flex gap-4 justify-end">
                  <div className="flex-1 max-w-md bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl rounded-tr-none p-4 border border-indigo-500/20">
                    <p className="text-white text-sm mb-2">We offer worldwide shipping with the following options:</p>
                    <ul className="text-slate-300 text-sm space-y-1 list-disc list-inside">
                      <li>Standard (7-14 days): $9.99</li>
                      <li>Express (3-5 days): $19.99</li>
                    </ul>
                    <div className="mt-3 text-xs text-slate-500">Source: shipping-policy.pdf</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex-shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500">
            2026 niuexa.ai. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
