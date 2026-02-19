import Link from "next/link";

export const metadata = {
  title: "Privacy Policy - ChatAziendale.it",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <nav className="flex items-center justify-between px-6 py-4 lg:px-12 border-b border-slate-800">
        <Link href="/" className="text-2xl font-bold text-white tracking-tight">
          ChatAziendale<span className="text-indigo-400">.it</span>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: February 2026</p>

        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>When you create an account, we collect your name and email address. When you use our chatbot services, we collect conversation data between end-users and your chatbots, uploaded documents and URLs you provide as data sources, and usage metrics (message counts, token usage).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <p>We use collected information to provide and improve our AI chatbot services, generate vector embeddings for document retrieval, track usage against your plan limits, and communicate service updates.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Data Storage & Security</h2>
            <p>Your data is stored in encrypted PostgreSQL databases. Documents and files are stored securely via Vercel Blob Storage. We use industry-standard encryption in transit (TLS) and at rest. Access to your data is restricted to your tenant account only.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Third-Party Services</h2>
            <p>We use OpenAI for generating chat responses and embeddings, Firecrawl for web page crawling, and Vercel for file storage. These services process data in accordance with their own privacy policies.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Retention</h2>
            <p>Your data is retained for as long as your account is active. You can delete individual data sources, conversations, or your entire account at any time. Upon account deletion, all associated data is permanently removed.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Your Rights</h2>
            <p>You have the right to access, update, or delete your personal data. You can export your conversation data. For data-related requests, contact us at the email below.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Contact</h2>
            <p>For privacy-related inquiries, please contact us at <a href="mailto:privacy@chataziendale.it" className="text-indigo-400 hover:text-indigo-300">privacy@chataziendale.it</a>.</p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-800 flex items-center justify-between text-sm">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors">
            &larr; Back to home
          </Link>
          <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">
            Terms of Service
          </Link>
        </div>
      </main>
    </div>
  );
}
