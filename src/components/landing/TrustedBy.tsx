'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'

type Client = { name: string; src: string; width: number; height: number; url: string; invertOnLight?: boolean }

const clients: Client[] = [
  { name: 'PugliAI', src: '/images/clients/pugliai.webp', width: 63, height: 60, url: 'https://pugliai.com', invertOnLight: true },
  { name: 'Niuexa', src: '/images/clients/niuexa.webp', width: 217, height: 60, url: 'https://niuexa.ai' },
  { name: 'Unioncamere', src: '/images/clients/unioncamere.webp', width: 255, height: 60, url: 'https://unioncamere.gov.it' },
  { name: 'BeBit', src: '/images/clients/bebit.webp', width: 113, height: 60, url: 'https://bebit.it' },
  { name: 'Libera Brand Building', src: '/images/clients/libera.svg', width: 180, height: 60, url: 'https://liberabrandbuilding.it' },
  { name: 'Inthezon', src: '/images/clients/inthezon.svg', width: 160, height: 60, url: 'https://inthezon.com' },
  { name: 'GeoPick', src: '/images/clients/geopick.webp', width: 176, height: 60, url: 'https://geopick.it', invertOnLight: true },
]

function LogoItem({ client }: { client: Client }) {
  return (
    <a
      href={client.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 flex items-center justify-center px-8 sm:px-12 group"
      aria-label={client.name}
    >
      <Image
        src={client.src}
        alt={client.name}
        width={client.width}
        height={client.height}
        className={`h-8 sm:h-10 w-auto object-contain opacity-40 grayscale transition-all duration-500 group-hover:opacity-100 group-hover:grayscale-0 ${client.invertOnLight ? 'invert group-hover:invert-0' : ''}`}
        unoptimized={client.src.endsWith('.svg')}
      />
    </a>
  )
}

export function TrustedBy() {
  const t = useTranslations('landing')

  // Triple the array for seamless infinite scroll
  const tripled = [...clients, ...clients, ...clients]

  return (
    <section className="relative z-10 py-14 sm:py-16 overflow-hidden">
      {/* Label */}
      <div className="text-center mb-10">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#A1A1AA]">
          {t('trustedBy')}
        </p>
      </div>

      {/* Marquee container with fade edges */}
      <div className="relative">
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-40 z-10 pointer-events-none bg-gradient-to-r from-[#FAFAF7] to-transparent" />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-40 z-10 pointer-events-none bg-gradient-to-l from-[#FAFAF7] to-transparent" />

        {/* Scrolling track */}
        <div className="marquee-track flex items-center">
          {tripled.map((client, i) => (
            <LogoItem key={`${client.name}-${i}`} client={client} />
          ))}
        </div>
      </div>

      {/* Subtle bottom divider */}
      <div className="max-w-xs mx-auto mt-14 sm:mt-16">
        <div className="h-px bg-gradient-to-r from-transparent via-[#E4E4E7] to-transparent" />
      </div>
    </section>
  )
}
