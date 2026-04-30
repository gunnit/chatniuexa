import Link from 'next/link'
import type { ReactNode } from 'react'

/* ----------------------------- Stat ----------------------------- */
type StatProps = {
  value: string
  label?: string
  source: string
  href: string
}

export function Stat({ value, label, source, href }: StatProps) {
  return (
    <aside className="not-prose my-12 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-baseline">
      <div className="font-serif text-[clamp(4rem,10vw,7rem)] leading-[0.9] tracking-[-0.04em] text-[#0F766E]">
        {value}
      </div>
      <div className="border-t border-[#18181B]/15 pt-4 sm:pt-2 sm:border-t-0 sm:border-l sm:pl-6">
        {label ? (
          <p className="font-serif text-xl leading-snug text-[#18181B]">{label}</p>
        ) : null}
        <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#52525B]">
          Fonte ·{' '}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0F766E] hover:underline"
          >
            {source}
          </a>
        </p>
      </div>
    </aside>
  )
}

/* ---------------------------- Quote ---------------------------- */
type QuoteProps = {
  author: string
  authorRole?: string
  source: string
  href: string
  children: ReactNode
}

export function Quote({ author, authorRole, source, href, children }: QuoteProps) {
  return (
    <figure className="not-prose my-12">
      <span
        aria-hidden="true"
        className="block font-serif text-7xl leading-none text-[#0F766E]/30 select-none"
      >
        “
      </span>
      <blockquote className="-mt-3 font-serif italic text-2xl sm:text-[28px] leading-[1.35] tracking-[-0.005em] text-[#18181B]">
        {children}
      </blockquote>
      <figcaption className="mt-6 text-sm text-[#52525B]">
        <span className="font-medium text-[#18181B]">{author}</span>
        {authorRole ? <span className="text-[#71717A]"> · {authorRole}</span> : null}
        <span className="mx-2 text-[#A1A1AA]">—</span>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0F766E] hover:underline"
        >
          {source}
        </a>
      </figcaption>
    </figure>
  )
}

/* -------------------------- SourceCite ------------------------- */
type SourceCiteProps = {
  href: string
  label?: string
  children?: ReactNode
}

export function SourceCite({ href, label, children }: SourceCiteProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-baseline gap-0.5 text-[#0F766E] underline decoration-[#0F766E]/30 underline-offset-[3px] decoration-1 hover:decoration-[#0F766E]/80"
    >
      <span>{children ?? label ?? 'fonte'}</span>
      <span aria-hidden="true" className="text-[10px] translate-y-[-1px]">↗</span>
    </a>
  )
}

/* -------------------------- Definition ------------------------- */
type DefinitionProps = {
  term: string
  children: ReactNode
}

export function Definition({ term, children }: DefinitionProps) {
  return (
    <dl className="not-prose my-10 border-y border-[#18181B]/10 py-7">
      <dt className="font-serif text-2xl tracking-[-0.01em] text-[#18181B]">{term}</dt>
      <dd className="mt-3 text-[17px] leading-[1.65] text-[#52525B]">
        {children}
      </dd>
    </dl>
  )
}

/* --------------------------- ProsCons -------------------------- */
type ProsConsProps = {
  pros: string[]
  cons: string[]
}

export function ProsCons({ pros, cons }: ProsConsProps) {
  return (
    <div className="not-prose my-8 grid gap-px overflow-hidden rounded-2xl border border-[#E4E4E7] bg-[#E4E4E7] sm:grid-cols-2">
      <div className="bg-white p-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0F766E]">
          <span aria-hidden="true" className="h-px w-6 bg-[#0F766E]" />
          Pro
        </div>
        <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-[#18181B]">
          {pros.map((p, i) => (
            <li key={i} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-[10px] h-1 w-1 flex-shrink-0 rounded-full bg-[#0F766E]" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white p-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A14040]">
          <span aria-hidden="true" className="h-px w-6 bg-[#A14040]" />
          Contro
        </div>
        <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-[#18181B]">
          {cons.map((c, i) => (
            <li key={i} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-[10px] h-1 w-1 flex-shrink-0 rounded-full bg-[#A14040]" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ------------------------ MDX Link wrapper -------------------- */
function MdxLink({
  href,
  children,
  ...rest
}: { href?: string; children?: ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href) return <a {...rest}>{children}</a>
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  )
}

/* --------------------- mdx-components map --------------------- */
export const mdxComponents = {
  Stat,
  Quote,
  SourceCite,
  Definition,
  ProsCons,
  a: MdxLink,
} as const
