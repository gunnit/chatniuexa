import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-7xl font-bold text-slate-200 mb-4">404</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Page not found</h1>
        <p className="text-slate-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
