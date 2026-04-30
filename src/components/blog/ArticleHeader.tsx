import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { LastUpdated } from './LastUpdated'
import type { Author, Locale, Post } from '@/lib/posts'

const READING_TIME_LABEL: Record<Locale, (m: number) => string> = {
  en: (m) => `${m} min read`,
  it: (m) => `${m} min di lettura`,
}

const TYPE_LABEL: Record<Locale, Record<Post['type'], string>> = {
  en: { listicle: 'Listicle', 'how-to': 'How-to', comparison: 'Comparison', qa: 'Q&A' },
  it: { listicle: 'Listicle', 'how-to': 'Guida', comparison: 'Confronto', qa: 'Q&A' },
}

type Props = {
  post: Post
  author: Author
}

export function ArticleHeader({ post, author }: Props) {
  return (
    <header className="relative pb-12 mb-12 border-b border-[#E4E4E7]">
      <div className="absolute inset-x-0 top-0 -z-10 h-32 bg-dots opacity-[0.35]" aria-hidden="true" />

      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-teal-700 text-[11px] font-semibold tracking-[0.16em] uppercase">
        {TYPE_LABEL[post.locale][post.type]}
      </div>

      <h1 className="mt-7 font-serif text-[clamp(2.5rem,5.5vw,4.25rem)] tracking-[-0.025em] leading-[1.04] text-[#18181B]">
        {post.title}
      </h1>

      <p className="mt-6 max-w-3xl text-[17px] sm:text-lg leading-[1.65] text-[#52525B]">
        {post.description}
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-4">
        <Link
          href={author.url[post.locale].replace(`/${post.locale}`, '') as '/about/gregor-maric'}
          className="group flex items-center gap-3"
        >
          <Image
            src={author.avatar}
            alt={author.name}
            width={40}
            height={40}
            className="rounded-full bg-[#F4F4F5] ring-1 ring-[#E4E4E7]"
          />
          <div className="leading-tight">
            <div className="text-[14px] font-medium text-[#18181B] group-hover:text-[#0F766E] transition-colors">
              {author.name}
            </div>
            <div className="text-[12px] text-[#71717A]">{author.role}</div>
          </div>
        </Link>

        <span aria-hidden="true" className="h-4 w-px bg-[#E4E4E7]" />

        <span className="text-[12px] text-[#71717A]">
          {READING_TIME_LABEL[post.locale](post.readingTimeMinutes)}
        </span>

        <span aria-hidden="true" className="h-4 w-px bg-[#E4E4E7]" />

        <LastUpdated date={post.updatedAt} locale={post.locale} />
      </div>
    </header>
  )
}
