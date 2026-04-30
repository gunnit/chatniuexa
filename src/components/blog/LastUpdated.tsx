import type { Locale } from '@/lib/posts'

const FORMAT: Record<Locale, Intl.DateTimeFormatOptions> = {
  en: { year: 'numeric', month: 'long', day: 'numeric' },
  it: { year: 'numeric', month: 'long', day: 'numeric' },
}

const LOCALE_TAG: Record<Locale, string> = { en: 'en-US', it: 'it-IT' }

const LABEL: Record<Locale, string> = {
  en: 'Updated',
  it: 'Aggiornato',
}

type Props = {
  date: string
  locale: Locale
}

export function LastUpdated({ date, locale }: Props) {
  const formatted = new Intl.DateTimeFormat(LOCALE_TAG[locale], FORMAT[locale]).format(
    new Date(date),
  )

  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-[#71717A]">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-teal-500" />
      <time dateTime={date}>
        <span className="text-[#52525B]">{LABEL[locale]}</span>
        <span className="mx-1.5 text-[#D4D4D8]">·</span>
        <span className="text-[#18181B]">{formatted}</span>
      </time>
    </span>
  )
}
