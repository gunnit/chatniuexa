import { JsonLd } from './JsonLd'
import type { Author, Locale } from '@/lib/posts'

const BASE_URL = 'https://chataziendale.it'

export function PersonSchema({ author, locale }: { author: Author; locale: Locale }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${BASE_URL}${author.url[locale]}`,
    name: author.name,
    jobTitle: author.role,
    description: author.bio[locale],
    url: `${BASE_URL}${author.url[locale]}`,
    image: `${BASE_URL}${author.avatar}`,
    sameAs: author.sameAs,
    worksFor: {
      '@type': 'Organization',
      name: 'ChatAziendale',
      url: BASE_URL,
    },
  }
  return <JsonLd data={schema} />
}
