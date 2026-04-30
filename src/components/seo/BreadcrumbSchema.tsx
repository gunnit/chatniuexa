import { JsonLd } from './JsonLd'

type Crumb = {
  name: string
  url: string
}

export function BreadcrumbSchema({ items }: { items: Crumb[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  }
  return <JsonLd data={schema} />
}
