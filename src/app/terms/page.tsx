import Link from "next/link";

export const metadata = {
  title: "Terms of Service - ChatAziendale.it",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <nav className="flex items-center justify-between px-6 py-4 lg:px-12 border-b border-slate-800">
        <Link href="/" className="text-2xl font-bold text-white tracking-tight">
          ChatAziendale<span className="text-indigo-400">.it</span>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: February 2026</p>

        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By creating an account or using ChatAziendale.it services, you agree to these Terms of Service. If you do not agree, do not use the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Service Description</h2>
            <p>ChatAziendale.it provides an AI-powered chatbot platform that allows you to create chatbots trained on your own data sources (documents, web pages). Chatbots can be embedded on your website via a JavaScript widget.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Account Responsibilities</h2>
            <p>You are responsible for maintaining the security of your account credentials. You must not share your account with unauthorized parties. You are responsible for all activity that occurs under your account.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p>You agree not to use the service to upload illegal, harmful, or infringing content, generate misleading or deceptive chatbot responses, attempt to circumvent usage limits or security measures, or reverse-engineer or scrape the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Usage Limits</h2>
            <p>Your account is subject to monthly token limits, daily message limits, and cost limits as defined by your plan. Exceeding these limits may result in temporary service restrictions until the next billing period.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Intellectual Property</h2>
            <p>You retain ownership of all data you upload. We do not claim ownership of your content. You grant us a limited license to process your data for the purpose of providing the service (generating embeddings, serving chatbot responses).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Limitation of Liability</h2>
            <p>The service is provided &ldquo;as is&rdquo; without warranties of any kind. AI-generated responses may contain inaccuracies. We are not liable for decisions made based on chatbot outputs. Our total liability is limited to the amount you paid for the service in the preceding 12 months.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Termination</h2>
            <p>We may suspend or terminate your account for violations of these terms. You may delete your account at any time. Upon termination, your data will be permanently deleted.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Changes to Terms</h2>
            <p>We may update these terms from time to time. We will notify you of material changes via email or in-app notice. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:legal@ChatAziendale.it" className="text-indigo-400 hover:text-indigo-300">legal@ChatAziendale.it</a>.</p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-800 flex items-center justify-between text-sm">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors">
            &larr; Back to home
          </Link>
          <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">
            Privacy Policy
          </Link>
        </div>
      </main>
    </div>
  );
}
