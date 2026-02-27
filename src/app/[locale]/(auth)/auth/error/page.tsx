/**
 * Auth Error Page
 *
 * Displays error messages for failed authentication operations,
 * such as invalid or expired email confirmation links.
 */

import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

interface AuthErrorPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { error } = await searchParams
  const t = await getTranslations('auth')

  // Determine user-friendly error message
  let errorMessage = t('authErrorDefault')

  if (error) {
    if (error === 'missing_params') {
      errorMessage = t('authErrorMissing')
    } else if (error.toLowerCase().includes('expired')) {
      errorMessage = t('authErrorExpired')
    } else if (error.toLowerCase().includes('invalid')) {
      errorMessage = t('authErrorInvalid')
    } else {
      errorMessage = error
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-red-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>

          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">{t('authError')}</h2>

          <p className="mt-4 text-gray-600">{errorMessage}</p>

          <div className="mt-8 space-y-4">
            <div>
              <Link
                href="/signup"
                className="text-indigo-600 hover:text-indigo-500 font-medium"
              >
                {t('signUpLink')}
              </Link>
            </div>
            <div>
              <Link href="/login" className="text-gray-600 hover:text-gray-500">
                {t('backToLoginLink')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
